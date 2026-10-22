import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { LISTING_OUTBOX } from '../listings/events';

// Paid bumps (docs/schema.md, decision 4 and section 12): the worker takes bump entitlements that
// are due and moves their listing's ranked_at to now, with a `bumped` history row and an outbox
// event (search sync). This is the only code that moves ranked_at after publication.
//
// A due bump on a paused listing (or one in review) waits until the listing is live again; on a listing that is
// sold, expired, rejected, deleted or still a draft it is revoked (`listing_closed`), so a bump
// bought for a listing that later closed never runs on another life of it.

const BATCH = 200;
const MAX_BATCHES = 50;

export type BumpRun = { applied: number; revoked: number };

export async function applyDueBumps(db: Queryable, now: Date = new Date()): Promise<BumpRun> {
  const at = now.toISOString();
  let applied = 0;
  let revoked = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const [row] = await db.execute<{ applied: number; revoked: number; seen: number }>(sql`
      WITH due AS (
        SELECT e.id, e.listing_id, l.status
        FROM entitlements e
        JOIN listings l ON l.id = e.listing_id
        WHERE e.type = 'bump' AND e.applied_at IS NULL AND e.revoked_at IS NULL
          AND e.starts_at <= ${at}::timestamptz AND l.status NOT IN ('paused', 'pending_review')
        ORDER BY e.starts_at
        LIMIT ${BATCH}
        FOR UPDATE OF e, l SKIP LOCKED
      ),
      -- Two due bumps of one listing in the same run move it once; both count as applied
      live AS (SELECT DISTINCT listing_id FROM due WHERE status = 'active'),
      moved AS (
        UPDATE listings l SET ranked_at = ${at}::timestamptz
        FROM live WHERE l.id = live.listing_id
        RETURNING l.id, l.revision
      ),
      history AS (
        INSERT INTO listing_events (listing_id, event_type, actor_type, from_status, to_status, revision)
        SELECT id, 'bumped', 'payment', 'active', 'active', revision FROM moved
      ),
      outbox AS (
        INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
        SELECT ${LISTING_OUTBOX.bumped}, 'listing', id, jsonb_build_object('revision', revision)
        FROM moved
      ),
      done AS (
        UPDATE entitlements e SET applied_at = ${at}::timestamptz
        FROM due WHERE e.id = due.id AND due.status = 'active'
        RETURNING e.id
      ),
      closed AS (
        UPDATE entitlements e SET revoked_at = ${at}::timestamptz, revoke_reason = 'listing_closed'
        FROM due WHERE e.id = due.id AND due.status <> 'active'
        RETURNING e.id
      )
      SELECT (SELECT count(*) FROM done)::int AS applied,
             (SELECT count(*) FROM closed)::int AS revoked,
             (SELECT count(*) FROM due)::int AS seen
    `);
    applied += row?.applied ?? 0;
    revoked += row?.revoked ?? 0;
    if ((row?.seen ?? 0) < BATCH) break;
  }
  return { applied, revoked };
}
