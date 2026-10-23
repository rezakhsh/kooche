import type { Queryable } from '../../db/drizzle';
import { listingEvents, outboxEvents, type LISTING_ACTOR_TYPES, type LISTING_EVENT_TYPES } from '../../db/schema';
import type { LISTING_STATUSES } from '../../db/schema/_values';

// Every listing change writes its history row and, in the same transaction, an outbox event
// (docs/schema.md, section 8, "Lifecycle"). Search sync, notifications and the post-checks read
// the outbox; handlers re-read the listing, so the payload carries only ids and small facts.

type Status = (typeof LISTING_STATUSES)[number];

/** listing.<what>: the outbox event types this module writes */
export const LISTING_OUTBOX = {
  created: 'listing.created',
  published: 'listing.published',
  updated: 'listing.updated',
  submitted: 'listing.submitted',
  paused: 'listing.paused',
  resumed: 'listing.resumed',
  sold: 'listing.sold',
  expired: 'listing.expired',
  renewed: 'listing.renewed',
  /** A paid bump moved ranked_at (written by the worker, src/modules/payments/bumps.ts) */
  bumped: 'listing.bumped',
  rejected: 'listing.rejected',
  /** Back after a take-down: staff restored it, an appeal was granted, a suspension ended */
  restored: 'listing.restored',
  deleted: 'listing.deleted',
} as const;

export type ListingChange = {
  listingId: string;
  event: (typeof LISTING_EVENT_TYPES)[number];
  outbox: (typeof LISTING_OUTBOX)[keyof typeof LISTING_OUTBOX] | null;
  actorType: (typeof LISTING_ACTOR_TYPES)[number];
  actorUserId?: string | null;
  from: Status | null;
  to: Status | null;
  revision: number;
  data?: Record<string, unknown>;
  moderationDecisionId?: string | null;
};

export async function recordChange(tx: Queryable, c: ListingChange): Promise<void> {
  await tx.insert(listingEvents).values({
    listingId: c.listingId,
    eventType: c.event,
    actorType: c.actorType,
    actorUserId: c.actorUserId ?? null,
    fromStatus: c.from,
    toStatus: c.to,
    revision: c.revision,
    data: c.data ?? {},
    moderationDecisionId: c.moderationDecisionId ?? null,
  });
  if (c.outbox) {
    await tx.insert(outboxEvents).values({
      eventType: c.outbox,
      aggregateType: 'listing',
      aggregateId: c.listingId,
      payload: { revision: c.revision, from: c.from, to: c.to },
    });
  }
}
