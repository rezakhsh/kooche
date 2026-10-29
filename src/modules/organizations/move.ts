import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings } from '../../db/schema';
import { LISTING_OUTBOX, recordChange } from '../listings/events';
import { businessLegalComplete, businessUsage } from './limits';
import { roleIn } from './organizations';

// Moving one's own private listings to a business one belongs to (wave 2 part 4, round 9's "move
// to business" button): for someone who starts selling regularly, or whom the «احتمالاً کسب‌وکار»
// queue asked to switch. Drafts and listings that aren't live move freely (the limits apply when
// they go live). Live ones count towards the business's plan (3 / 25 / 100) and need its legal
// details (Impressum), like publishing as the business: those that don't fit stay private. Events
// stay where they are (they have their own form). Live ones are announced like an edit, so search
// shows them as the business's at once.

export type MoveResult =
  | { ok: true; moved: number; leftLive: number; reason: 'business_limit' | 'legal_missing' | null }
  | { ok: false; reason: 'not_member' };

/** The private listings someone may move: their own, not deleted, not events, newest first */
export async function movableListings(db: Queryable, userId: string) {
  return db
    .select({ id: listings.id, title: listings.title, status: listings.status })
    .from(listings)
    .where(
      and(
        eq(listings.userId, userId),
        isNull(listings.organizationId),
        ne(listings.status, 'deleted'),
        sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
      ),
    )
    .orderBy(sql`${listings.updatedAt} DESC`)
    .limit(100);
}

export async function moveToBusiness(tx: Queryable, opts: { userId: string; organizationId: string; listingIds: string[] }, now = new Date()): Promise<MoveResult> {
  if (!(await roleIn(tx, opts.userId, opts.organizationId))) return { ok: false, reason: 'not_member' };
  if (opts.listingIds.length === 0) return { ok: true, moved: 0, leftLive: 0, reason: null };
  const rows = await tx
    .select({ id: listings.id, status: listings.status, revision: listings.revision })
    .from(listings)
    .where(
      and(
        inArray(listings.id, opts.listingIds.slice(0, 100)),
        eq(listings.userId, opts.userId),
        isNull(listings.organizationId),
        ne(listings.status, 'deleted'),
        sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
      ),
    )
    .orderBy(listings.createdAt)
    .for('update');

  const live = rows.filter((r) => r.status === 'active');
  let room = 0;
  let reason: 'business_limit' | 'legal_missing' | null = null;
  if (live.length > 0) {
    if (!(await businessLegalComplete(tx, opts.organizationId))) reason = 'legal_missing';
    else {
      const usage = await businessUsage(tx, opts.organizationId, now);
      room = Math.max(0, usage.limit - usage.active);
      if (room < live.length) reason = 'business_limit';
    }
  }
  const liveMoving = new Set(live.slice(0, room).map((r) => r.id));
  const moving = rows.filter((r) => r.status !== 'active' || liveMoving.has(r.id));

  for (const r of moving) {
    const revision = r.revision + (r.status === 'draft' ? 0 : 1);
    await tx.update(listings).set({ organizationId: opts.organizationId, revision }).where(eq(listings.id, r.id));
    // Drafts aren't public: no history or outbox (as in saveListing)
    if (r.status !== 'draft') {
      await recordChange(tx, {
        listingId: r.id,
        event: 'edited',
        outbox: r.status === 'active' ? LISTING_OUTBOX.updated : null,
        actorType: 'user',
        actorUserId: opts.userId,
        from: r.status,
        to: r.status,
        revision,
        data: { movedToBusiness: opts.organizationId },
      });
    }
  }
  return { ok: true, moved: moving.length, leftLive: live.length - liveMoving.size, reason };
}
