'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { appDb, type Db } from '../../db/drizzle';
import { listings, messages, organizationMembers, userSanctions } from '../../db/schema';
import { webEnv } from '../../lib/env';
import { admin } from '../../messages/fa';
import { can } from '../../modules/admin/access';
import { nextPath, opInput, opPermission, RESTRICTING_OPS } from '../../modules/admin/ops';
import { adminHref, requireStaffAction } from '../../modules/admin/server';
import {
  approveListing,
  hideMessage,
  keepDecision,
  liftBusinessSuspension,
  liftSanction,
  noViolation,
  restoreListing,
  sanctionUser,
  suspendBusiness,
  takeDownListing,
  unhideMessage,
  type DecideResult,
  type Grounds,
} from '../../modules/moderation/decide';
import { appealFits } from '../../modules/moderation/appeals';
import { REASON_CODES } from '../../db/schema/_values';
import { REASON_SECTIONS } from '../../modules/moderation/reasons';
import { z } from 'zod';

// The decision form on an item page (src/app/admin/items). One action for every operation: the
// staff check comes first, then the operation's own permission (src/modules/admin/ops.ts).

export type DecideState = { error?: string } | undefined;

/**
 * Whom a sanction on this item hits: the listing's poster or the message's sender as stored now,
 * never a user id from the form; for a business, the form's person only if they are a member
 * (Check B, Oct 31, 2026: a stale page or a hand-made form could hit someone else)
 */
async function personOf(db: Db, kind: string, id: string, formUserId: string | undefined): Promise<string | null> {
  if (kind === 'user') return id;
  if (kind === 'listing') return (await db.select({ u: listings.userId }).from(listings).where(eq(listings.id, id)))[0]?.u ?? null;
  if (kind === 'message') return (await db.select({ u: messages.senderUserId }).from(messages).where(eq(messages.id, id)))[0]?.u ?? null;
  if (!formUserId) return null;
  const [m] = await db.select({ u: organizationMembers.userId }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, id), eq(organizationMembers.userId, formUserId)));
  return m?.u ?? null;
}

export async function decideAction(_prev: DecideState, form: FormData): Promise<DecideState> {
  const staff = await requireStaffAction('queue.view');
  const raw = Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === 'string' && v !== '' && !k.startsWith('$')));
  const parsed = opInput.safeParse(raw);
  const t = admin.decide;
  if (!parsed.success) return { error: t.errors.invalid };
  const i = parsed.data;
  const db = appDb();
  // An appeal must be real, open, about this item and not the staff member's own
  if (i.appealId && !(await appealFits(db, { appealId: i.appealId, staffUserId: staff.ctx.userId, op: i.op, kind: i.kind, itemId: i.id, sanctionId: i.sanctionId }))) return { error: t.errors.invalid };
  const sanctionType = i.sanctionId ? (await db.select({ type: userSanctions.type }).from(userSanctions).where(eq(userSanctions.id, i.sanctionId)))[0]?.type : null;
  if (!can(staff.role, opPermission(i, sanctionType))) return { error: admin.common.forbidden };

  let grounds: Grounds | null = null;
  if (RESTRICTING_OPS.has(i.op)) {
    if (!i.reason) return { error: t.errors.invalid };
    // An illegal-content decision may name only the law; otherwise the reason's first section
    const section = i.section ?? (i.legalGround ? null : REASON_SECTIONS[i.reason][0]!);
    grounds = { reason: i.reason, section, legalGround: i.legalGround || null, facts: i.facts };
  }
  const opts = { timeZone: webEnv().APP_TIME_ZONE, appealId: i.appealId };
  const ctx = staff.ctx;
  const userId = RESTRICTING_OPS.has(i.op) ? await personOf(db, i.kind, i.id, i.userId) : null;

  let result: DecideResult;
  switch (i.op) {
    case 'take_down':
      result = i.kind === 'listing' ? await takeDownListing(db, ctx, i.id, grounds!, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'restore':
      result = i.kind === 'listing' ? await restoreListing(db, ctx, i.id, i.note, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'approve':
      result = i.kind === 'listing' ? await approveListing(db, ctx, i.id) : { ok: false, reason: 'invalid' };
      break;
    case 'no_violation': {
      const target = i.kind === 'listing' ? { listingId: i.id } : i.kind === 'user' ? { reportedUserId: i.id } : i.kind === 'business' ? { organizationId: i.id } : { messageId: i.id };
      result = await noViolation(db, ctx, target, i.note, opts);
      break;
    }
    case 'warning':
    case 'posting_restricted':
    case 'messaging_restricted':
    case 'suspended':
    case 'banned': {
      if (!userId) return { error: t.errors.invalid };
      const days = i.op === 'warning' || i.op === 'banned' ? null : i.days === '7' ? 7 : i.days === '30' ? 30 : null;
      result = await sanctionUser(db, ctx, { userId, kind: i.op, days, alsoListingId: i.kind === 'listing' ? i.id : null, ...grounds! }, opts);
      break;
    }
    case 'hide_message':
      result = i.kind === 'message' ? await hideMessage(db, ctx, i.id, grounds!, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'unhide_message':
      result = i.kind === 'message' ? await unhideMessage(db, ctx, i.id, i.note, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'suspend_business':
      result = i.kind === 'business' ? await suspendBusiness(db, ctx, i.id, grounds!, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'lift_business':
      result = i.kind === 'business' ? await liftBusinessSuspension(db, ctx, i.id, i.note, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'lift_sanction':
      result = i.sanctionId ? await liftSanction(db, ctx, i.sanctionId, i.note, opts) : { ok: false, reason: 'invalid' };
      break;
    case 'keep':
      result = i.appealId ? await keepDecision(db, ctx, i.appealId, i.note, opts) : { ok: false, reason: 'invalid' };
      break;
  }
  if (!result.ok) return { error: t.errors[result.reason] };
  // «… و بعدی» (wave 1): on to the next item in the queue, or the queue when it is empty
  redirect(adminHref(`${nextPath(form.get('next'))}?done=1`));
}

export type FreshState = { done?: 'approve' | 'take_down'; error?: string } | undefined;

const freshInput = z.object({
  op: z.enum(['approve', 'take_down']),
  id: z.string().uuid(),
  reason: z.enum(REASON_CODES).optional(),
  facts: z.string().trim().max(1000).optional().default(''),
});

/**
 * Approve or take down from the review of new listings (Nov 3, 2026: everything on the card, no
 * page per listing): the same decisions as the item page, a take-down with the reason's first
 * terms section and the moderator's sentence. No redirect; the card leaves the list.
 */
export async function freshDecideAction(_prev: FreshState, form: FormData): Promise<FreshState> {
  const staff = await requireStaffAction('listing.moderate');
  const parsed = freshInput.safeParse(Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === 'string' && v !== '' && !k.startsWith('$'))));
  const t = admin.decide;
  if (!parsed.success) return { error: t.errors.invalid };
  const i = parsed.data;
  const db = appDb();
  let result: DecideResult;
  if (i.op === 'approve') result = await approveListing(db, staff.ctx, i.id);
  else {
    if (!i.reason) return { error: t.errors.invalid };
    const grounds: Grounds = { reason: i.reason, section: REASON_SECTIONS[i.reason][0]!, legalGround: null, facts: i.facts };
    result = await takeDownListing(db, staff.ctx, i.id, grounds, { timeZone: webEnv().APP_TIME_ZONE });
  }
  return result.ok ? { done: i.op } : { error: t.errors[result.reason] };
}
