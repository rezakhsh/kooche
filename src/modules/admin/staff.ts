import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { auditLog, sessions, twoFactors, users } from '../../db/schema';
import type { StaffRole } from './access';
import { staffAudit, type StaffContext } from './audit';

// Who is staff (users.staff_role). The first admin, and any later admin, is made with
// scripts/make-staff.ts as classifieds_owner; admins appoint and remove moderators on the admin
// page. Every change writes staff.role_changed. Removing a role ends the admin page for that
// person at their next request; their TOTP set-up stays for a later return.

export type RoleChange =
  | { ok: true; userId: string; from: StaffRole | null; to: StaffRole | null }
  | { ok: false; reason: 'not_found' | 'inactive' | 'not_allowed' | 'unchanged' };

export async function setStaffRole(
  tx: Queryable,
  opts: { email: string; role: StaffRole | null; by: StaffContext | null },
): Promise<RoleChange> {
  const [user] = await tx
    .select({ id: users.id, role: users.staffRole, status: users.status })
    .from(users)
    .where(eq(users.email, opts.email.trim().toLowerCase()))
    .for('update');
  if (!user) return { ok: false, reason: 'not_found' };
  if (opts.role && user.status !== 'active') return { ok: false, reason: 'inactive' };
  // On the admin page: moderators only, never an admin, never oneself
  if (opts.by && (opts.role === 'admin' || user.role === 'admin' || user.id === opts.by.userId)) return { ok: false, reason: 'not_allowed' };
  if (user.role === opts.role) return { ok: false, reason: 'unchanged' };
  await tx.update(users).set({ staffRole: opts.role }).where(eq(users.id, user.id));
  const data = { from: user.role, to: opts.role };
  if (opts.by) await staffAudit(tx, opts.by, 'staff.role_changed', { type: 'user', id: user.id }, data);
  else await tx.insert(auditLog).values({ actorType: 'system', action: 'staff.role_changed', targetType: 'user', targetId: user.id, data: { ...data, by: 'make-staff' } });
  return { ok: true, userId: user.id, from: user.role, to: opts.role };
}

/** Everyone with a staff role, admins first */
export function staffList(db: Queryable) {
  return db
    .select({ id: users.id, name: users.displayName, email: users.email, role: users.staffRole, twoFactor: users.twoFactorEnabled, status: users.status, since: users.createdAt })
    .from(users)
    .where(and(isNotNull(users.staffRole)))
    .orderBy(sql`${users.staffRole} = 'moderator'`, asc(users.createdAt));
}

/**
 * A staff member lost their phone and their backup codes: two-factor is switched off for the
 * account (they set it up again on their next visit) and their admin checks end. Script only,
 * as classifieds_owner (scripts/make-staff.ts --reset-2fa); writes staff.two_factor_reset.
 */
export async function resetTwoFactor(tx: Queryable, email: string): Promise<{ ok: true; userId: string } | { ok: false; reason: 'not_found' }> {
  const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email.trim().toLowerCase())).for('update');
  if (!user) return { ok: false, reason: 'not_found' };
  await tx.delete(twoFactors).where(eq(twoFactors.userId, user.id));
  await tx.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, user.id));
  await tx.update(sessions).set({ staffVerifiedAt: null }).where(eq(sessions.userId, user.id));
  await tx.insert(auditLog).values({ actorType: 'system', action: 'staff.two_factor_reset', targetType: 'user', targetId: user.id, data: { by: 'make-staff' } });
  return { ok: true, userId: user.id };
}
