import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { auditLog, users } from '../../db/schema';

// The audit log on the admin page: filters by action prefix, actor and target. Moderators see
// only their own rows (audit.all is for admins).

/** The audit page's filter: groups of actions by the start of their code (design check, Oct 31, 2026) */
export const AUDIT_GROUPS: Record<string, string[]> = {
  staff: ['staff.', 'auth.'],
  moderation: ['listing.', 'message.', 'appeal.', 'moderation.'],
  people: ['user.', 'phone.'],
  businesses: ['organization.'],
  money: ['order.', 'refund.', 'invoice.', 'payment.', 'subscription.', 'product.'],
  places: ['country.', 'city.', 'category.', 'waitlist.'],
  system: ['system.', 'stats.'],
};

export async function auditRows(db: Queryable, opts: { action: string; actor: string; target: string; onlyUserId: string | null; limit?: number }) {
  const conds: SQL[] = [];
  const action = opts.action.trim().toLowerCase();
  // A group from the page's list, or a code (or its start) typed into the address
  const group = AUDIT_GROUPS[action];
  if (group) conds.push(or(...group.map((p) => ilike(auditLog.action, `${p}%`)))!);
  else if (/^[a-z_]+\.?[a-z_]*$/.test(action)) conds.push(ilike(auditLog.action, `${action}%`));
  const target = opts.target.trim();
  if (/^[0-9a-f-]{36}$/.test(target)) conds.push(eq(auditLog.targetId, target));
  const actor = opts.actor.trim().toLowerCase();
  if (/^[0-9a-f-]{36}$/.test(actor)) conds.push(eq(auditLog.actorUserId, actor));
  else if (actor) conds.push(or(eq(users.email, actor), ilike(users.displayName, `%${actor.replace(/[%_\\]/g, '')}%`))!);
  if (opts.onlyUserId) conds.push(eq(auditLog.actorUserId, opts.onlyUserId));
  return db
    .select({
      id: auditLog.id,
      at: auditLog.createdAt,
      actorType: auditLog.actorType,
      actorId: auditLog.actorUserId,
      actor: users.displayName,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      ip: sql<string | null>`host(${auditLog.ipAddress})`,
      data: auditLog.data,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 200);
}
