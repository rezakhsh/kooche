import { and, eq, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { listingImages, listings, moderationDecisions } from '../../db/schema';
import type { REASON_CODES } from '../../db/schema/_values';
import { messages } from '../../messages/fa';
import { cachedCatalog } from '../listings/catalog';
import { LISTING_OUTBOX, recordChange } from '../listings/events';
import { eventCheckFields } from '../events/events';
import { checkLink } from '../events/links';
import { findBannedTerm } from './terms';

// Automatic checks after publishing (decided Oct 17, 2026). Listings go live at once; the worker
// runs these checks on every publish, edit, photo change and resubmission, and a check can take a
// listing down. Each check answers pass, take_down or flag:
// - take_down: status `rejected`, a moderation_decisions row (decided_by `rule`) with the reason
//   and the Persian statement the DSA requires, and a `rejected` listing event linked to it.
// - flag: an `escalate` decision, once per listing revision and rule. That is the input of the
//   human moderation queue in phase 4; the listing stays up.
// The AI review (phase 4) is one more entry in CHECKS with decided_by `ai`.

type Listing = typeof listings.$inferSelect;
type ReasonCode = (typeof REASON_CODES)[number];

export type CheckOutcome =
  | { verdict: 'pass' }
  | {
      verdict: 'take_down' | 'flag';
      rule: string;
      reason: ReasonCode;
      /** Section of our terms; the terms are written before launch */
      policyGround: string;
      detail: Record<string, unknown>;
    };

export type CheckContext = { tx: Queryable; listing: Listing };
export type ListingCheck = { name: string; run: (ctx: CheckContext) => Promise<CheckOutcome> };

const bannedTerms: ListingCheck = {
  name: 'banned_terms',
  async run({ listing }) {
    const found = findBannedTerm(`${listing.title}\n${listing.description}\n${listing.district ?? ''}`);
    if (!found) return { verdict: 'pass' };
    return {
      verdict: 'take_down',
      rule: 'banned_terms',
      reason: 'prohibited',
      policyGround: 'terms-prohibited-items',
      detail: found,
    };
  },
};

/** Live or once-live listings of other sellers; drafts and deleted listings don't count */
const OTHERS_LISTING = sql`ol.user_id <> l.user_id AND ol.status NOT IN ('draft', 'deleted')`;

const duplicatePhotos: ListingCheck = {
  name: 'duplicate_photos',
  async run({ tx, listing }) {
    // The same master bytes: the same original was uploaded by another account
    const exact = await tx.execute<{ image_id: string; other_listing_id: string }>(sql`
      SELECT me.id AS image_id, o.listing_id AS other_listing_id
      FROM listing_images me
      JOIN listings l ON l.id = me.listing_id
      JOIN listing_images o ON o.sha256 = me.sha256 AND o.status = 'ready' AND o.id <> me.id
      JOIN listings ol ON ol.id = o.listing_id
      WHERE me.listing_id = ${listing.id} AND me.status = 'ready' AND ${OTHERS_LISTING}
      LIMIT 1
    `);
    if (exact[0]) {
      return {
        verdict: 'take_down',
        rule: 'duplicate_photos_exact',
        reason: 'duplicate',
        policyGround: 'terms-own-photos',
        detail: { imageId: exact[0].image_id, otherListingId: exact[0].other_listing_id },
      };
    }
    // Near-duplicates (resized, re-compressed): product photos often look alike, so only flagged.
    // One identical 16-bit band finds the candidates through the GIN index (docs/schema.md).
    const near = await tx.execute<{ image_id: string; other_listing_id: string; distance: number }>(sql`
      SELECT me.id AS image_id, o.listing_id AS other_listing_id,
             bit_count((o.phash # me.phash)::bit(64))::int AS distance
      FROM listing_images me
      JOIN listings l ON l.id = me.listing_id
      JOIN listing_images o ON o.phash_bands && me.phash_bands AND o.status = 'ready' AND o.id <> me.id
      JOIN listings ol ON ol.id = o.listing_id
      WHERE me.listing_id = ${listing.id} AND me.status = 'ready' AND ${OTHERS_LISTING}
        AND bit_count((o.phash # me.phash)::bit(64)) <= 6
      ORDER BY distance
      LIMIT 1
    `);
    if (near[0]) {
      return {
        verdict: 'flag',
        rule: 'duplicate_photos_near',
        reason: 'duplicate',
        policyGround: 'terms-own-photos',
        detail: {
          imageId: near[0].image_id,
          otherListingId: near[0].other_listing_id,
          distance: near[0].distance,
        },
      };
    }
    return { verdict: 'pass' };
  },
};

/**
 * An event's own text (venue, address, organizer) gets the banned-terms check too, and its ticket
 * and online links the link rules again (the form already refuses shorteners; this catches rows
 * written before a shortener was added to the list).
 */
const eventFields: ListingCheck = {
  name: 'event_fields',
  async run({ tx, listing }) {
    const fields = await eventCheckFields(tx, listing.id);
    if (!fields) return { verdict: 'pass' };
    const found = findBannedTerm(fields.text);
    if (found) {
      return { verdict: 'take_down', rule: 'banned_terms', reason: 'prohibited', policyGround: 'terms-prohibited-items', detail: { ...found, field: 'event' } };
    }
    const bad = fields.links.find((l) => !checkLink(l).ok);
    if (bad) return { verdict: 'take_down', rule: 'event_links', reason: 'scam', policyGround: 'terms-event-links', detail: { link: bad } };
    return { verdict: 'pass' };
  },
};

export const CHECKS: readonly ListingCheck[] = [bannedTerms, duplicatePhotos, eventFields];

/** Statuses the checks look at: live, paused (can come back) and waiting for review */
const CHECKED = new Set<Listing['status']>(['active', 'paused', 'pending_review']);

export type ChecksResult = 'skipped' | 'passed' | 'published' | 'taken_down' | 'flagged';

async function snapshot(tx: Queryable, listing: Listing) {
  const images = await tx
    .select({ key: listingImages.storageKey })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, listing.id), eq(listingImages.status, 'ready')));
  const event = await eventCheckFields(tx, listing.id);
  return {
    title: listing.title,
    description: listing.description,
    price_type: listing.priceType,
    price_minor: listing.priceMinor,
    currency: listing.currency,
    attributes: listing.attributes,
    district: listing.district,
    images: images.map((i) => i.key),
    ...(event ? { event } : {}),
  };
}

/**
 * Runs every check on the listing as it is now (the outbox event only says that something
 * changed). Runs as classifieds_worker; the listing row is locked, so an edit waits.
 */
export async function runListingChecks(
  db: Db,
  listingId: string,
  checks: readonly ListingCheck[] = CHECKS,
  now: Date = new Date(),
): Promise<ChecksResult> {
  const catalog = await cachedCatalog(db);
  return db.transaction(async (tx) => {
    const [listing] = await tx.select().from(listings).where(eq(listings.id, listingId)).for('update');
    if (!listing || !CHECKED.has(listing.status)) return 'skipped';

    const outcomes: CheckOutcome[] = [];
    for (const check of checks) outcomes.push(await check.run({ tx, listing }));
    const takeDown = outcomes.find((o) => o.verdict === 'take_down');

    if (takeDown && takeDown.verdict === 'take_down') {
      const [decision] = await tx
        .insert(moderationDecisions)
        .values({
          listingId: listing.id,
          listingRevision: listing.revision,
          // Refused before going live, or removed after
          decision: listing.status === 'pending_review' ? 'reject' : 'remove',
          reasonCode: takeDown.reason,
          policyGround: takeDown.policyGround,
          statementFa: messages.moderation.statement[takeDown.rule as keyof typeof messages.moderation.statement],
          decidedBy: 'rule',
          aiOutput: { rule: takeDown.rule, detail: takeDown.detail },
          contentSnapshot: await snapshot(tx, listing),
        })
        .returning({ id: moderationDecisions.id });
      await tx
        .update(listings)
        .set({ status: 'rejected', statusChangedAt: now })
        .where(eq(listings.id, listing.id));
      await recordChange(tx, {
        listingId: listing.id,
        event: 'rejected',
        outbox: LISTING_OUTBOX.rejected,
        actorType: 'system',
        from: listing.status,
        to: 'rejected',
        revision: listing.revision,
        data: { rule: takeDown.rule, reason: takeDown.reason },
        moderationDecisionId: decision!.id,
      });
      return 'taken_down';
    }

    // Flags: once per revision and rule, so a re-run doesn't fill the queue
    let flagged = false;
    for (const o of outcomes) {
      if (o.verdict !== 'flag') continue;
      const [existing] = await tx
        .select({ id: moderationDecisions.id })
        .from(moderationDecisions)
        .where(
          and(
            eq(moderationDecisions.listingId, listing.id),
            eq(moderationDecisions.listingRevision, listing.revision),
            eq(moderationDecisions.decision, 'escalate'),
            sql`${moderationDecisions.aiOutput} ->> 'rule' = ${o.rule}`,
          ),
        );
      if (existing) continue;
      await tx.insert(moderationDecisions).values({
        listingId: listing.id,
        listingRevision: listing.revision,
        decision: 'escalate',
        reasonCode: o.reason,
        policyGround: o.policyGround,
        decidedBy: 'rule',
        aiOutput: { rule: o.rule, detail: o.detail },
        contentSnapshot: await snapshot(tx, listing),
      });
      flagged = true;
    }

    // A resubmitted listing that passes goes live again
    if (listing.status === 'pending_review') {
      const duration = (catalog.byId.get(listing.categoryId ?? '')?.listingDurationDays ?? 30) * 86_400_000;
      const [decision] = await tx
        .insert(moderationDecisions)
        .values({
          listingId: listing.id,
          listingRevision: listing.revision,
          decision: 'approve',
          decidedBy: 'rule',
          contentSnapshot: await snapshot(tx, listing),
        })
        .returning({ id: moderationDecisions.id });
      await tx
        .update(listings)
        .set({
          status: 'active',
          statusChangedAt: now,
          publishedAt: listing.publishedAt ?? now,
          rankedAt: listing.rankedAt ?? now,
          expiresAt: new Date(now.getTime() + duration),
        })
        .where(eq(listings.id, listing.id));
      await recordChange(tx, {
        listingId: listing.id,
        event: 'published',
        outbox: LISTING_OUTBOX.published,
        actorType: 'system',
        from: 'pending_review',
        to: 'active',
        revision: listing.revision,
        moderationDecisionId: decision!.id,
      });
      return 'published';
    }
    return flagged ? 'flagged' : 'passed';
  });
}
