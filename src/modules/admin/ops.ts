import { z } from 'zod';
import { REASON_CODES } from '../../db/schema/_values';
import type { StaffAction } from './access';

// The decision form's operations and the permission each needs (roadmap step 8). Moderators handle
// content, warnings, restrictions and suspensions of up to 30 days; anything for good, businesses
// and lifting a sanction outside an appeal are for admins (src/modules/admin/access.ts).

export const OPS = [
  'take_down',
  'restore',
  'no_violation',
  'approve',
  'warning',
  'posting_restricted',
  'messaging_restricted',
  'suspended',
  'banned',
  'hide_message',
  'unhide_message',
  'suspend_business',
  'lift_business',
  'lift_sanction',
  'keep',
] as const;
export type Op = (typeof OPS)[number];

/**
 * The decision form lists the operations from mild to severe (wave 1, mockup admin-item): clearing
 * and giving back first, then a warning, removing the content, restrictions, and the account last.
 * Nothing is chosen in advance.
 */
const SEVERITY: Record<Op, number> = {
  approve: 0,
  no_violation: 0,
  restore: 1,
  unhide_message: 1,
  lift_business: 1,
  lift_sanction: 1,
  keep: 2,
  warning: 3,
  hide_message: 4,
  take_down: 4,
  posting_restricted: 5,
  messaging_restricted: 6,
  suspend_business: 7,
  suspended: 8,
  banned: 9,
};

/** Mild to severe; operations of the same weight keep their order */
export function bySeverity<T extends { op: Op }>(ops: T[]): T[] {
  return ops.map((o, i) => [o, i] as const).sort((a, b) => SEVERITY[a[0].op] - SEVERITY[b[0].op] || a[1] - b[1]).map(([o]) => o);
}

const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max).optional().default('');

export const opInput = z.object({
  op: z.enum(OPS),
  kind: z.enum(['listing', 'user', 'business', 'message']),
  id: uuid,
  reason: z.enum(REASON_CODES).optional(),
  section: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/).optional(),
  legalGround: text(200),
  facts: text(1000),
  note: text(1000),
  days: z.enum(['7', '30', 'none']).optional(),
  appealId: uuid.optional(),
  /** For lift_sanction: which sanction */
  sanctionId: uuid.optional(),
  /** The user an account decision is about (from a listing or message page: its seller or sender) */
  userId: uuid.optional(),
});
export type OpInput = z.infer<typeof opInput>;

export function opPermission(i: Pick<OpInput, 'op' | 'days' | 'appealId'>, sanctionType?: string | null): StaffAction {
  switch (i.op) {
    case 'take_down':
    case 'restore':
    case 'approve':
      return 'listing.moderate';
    case 'no_violation':
      return 'queue.view';
    case 'warning':
      return 'user.warn';
    case 'posting_restricted':
    case 'messaging_restricted':
      return i.days === 'none' ? 'user.ban' : 'user.restrict';
    case 'suspended':
      return 'user.suspend';
    case 'banned':
      return 'user.ban';
    case 'hide_message':
    case 'unhide_message':
      return 'message.moderate';
    case 'suspend_business':
    case 'lift_business':
      return 'organization.suspend';
    case 'lift_sanction':
      // Granting an appeal against a limited sanction is the moderators' job; a ban stays with admins
      return i.appealId && sanctionType && sanctionType !== 'banned' ? 'appeal.decide' : 'sanction.lift';
    case 'keep':
      return 'appeal.decide';
  }
}

/** Operations that restrict something and so need a reason, a ground and the facts */
export const RESTRICTING_OPS: ReadonlySet<Op> = new Set(['take_down', 'warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned', 'hide_message', 'suspend_business']);

/** Where «… و بعدی» may go after a decision (wave 1): an item page or the queue, under the admin path */
export function nextPath(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return /^\/items\/(listing|user|business|message)\/[0-9a-f-]{36}$/.test(v) ? v : '/queue';
}
