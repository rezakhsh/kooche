import type { Queryable } from '../../db/drizzle';
import { auditLog } from '../../db/schema';
import type { StaffRole } from './access';

// Every staff action writes audit_log in the same transaction as the change (docs/schema.md,
// section 13), with the session, IP and browser. So does looking at personal data (email, phone,
// a reported chat, a user's payments): `staff.*_viewed`.

export type StaffContext = {
  userId: string;
  /** Null before the role matters (the two-factor check) */
  role: StaffRole | null;
  sessionId: string;
  ip: string | null;
  userAgent: string | null;
};

export type AuditTarget = { type: string; id: string } | null;

export async function staffAudit(
  tx: Queryable,
  ctx: StaffContext,
  action: string,
  target: AuditTarget,
  data: Record<string, unknown> = {},
  actorType: 'staff' | 'user' = 'staff',
): Promise<void> {
  await tx.insert(auditLog).values({
    actorType,
    actorUserId: ctx.userId,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    sessionId: ctx.sessionId,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    data: ctx.role ? { ...data, role: ctx.role } : data,
  });
}
