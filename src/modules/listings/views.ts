import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { seesTestContent } from '../users/test-accounts';
import { listingPageToken } from './shared-page';

// Listing views for the sellers' stats (roadmap step 6). A page view adds one to a Valkey hash;
// the worker adds the hash to listings.view_count every 5 minutes (docs/schema.md: "counted in
// Valkey, written here in batches"). One visitor (IP) counts once per listing per half hour, and
// obvious bots and the seller's own views don't count. Every key has an expiry (noeviction).
// Since Nov 6, 2026 the page doesn't count itself: Cloudflare keeps one copy of it for signed-out
// visitors, so the visit counter's request after the page has loaded counts the view
// (src/app/api/v/route.ts, countPageView below).

const PENDING = 'views:pending';
const FLUSHING = 'views:flushing';
const SEEN_SECONDS = 30 * 60;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|curl|wget|python|httpclient/i;

export async function countView(redis: Redis, opts: { listingId: string; ip: string | null; userAgent: string | null }): Promise<boolean> {
  if (!opts.userAgent || BOT.test(opts.userAgent)) return false;
  const visitor = createHash('sha256').update(opts.ip ?? opts.userAgent).digest('base64url').slice(0, 16);
  const first = await redis.set(`views:seen:${opts.listingId}:${visitor}`, '1', 'EX', SEEN_SECONDS, 'NX');
  if (first !== 'OK') return false;
  await redis.multi().hincrby(PENDING, opts.listingId, 1).expire(PENDING, 86_400).exec();
  return true;
}

/**
 * A view of the listing or event page at `path`, from the visit counter's request: only an active
 * listing whose page this visitor can see (a test account's only for staff and test accounts, as
 * the page itself), never the seller's own, only on the page of its kind (an event's /v/ address
 * leads to its /e/ page). The same once-per-half-hour and bot rules as countView.
 */
export async function countPageView(
  redis: Redis,
  db: Queryable,
  opts: { path: string; ip: string | null; userAgent: string | null; viewer: () => Promise<string | null> },
): Promise<boolean> {
  const page = listingPageToken(opts.path);
  if (!page || !opts.userAgent || BOT.test(opts.userAgent)) return false;
  const [l] = await db.execute<{ id: string; user_id: string; test_owner: boolean; is_event: boolean }>(sql`
    SELECT l.id, l.user_id, u.test_account IS NOT NULL AS test_owner,
      EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event
    FROM listings l JOIN users u ON u.id = l.user_id
    WHERE l.public_token = ${page.token} AND l.status = 'active'`);
  if (!l || l.is_event !== (page.kind === 'event')) return false;
  const viewer = await opts.viewer();
  if (viewer === l.user_id) return false;
  if (l.test_owner && !(await seesTestContent(db, viewer))) return false;
  return countView(redis, { listingId: l.id, ip: opts.ip, userAgent: opts.userAgent });
}

/** Adds the counted views to listings.view_count (worker). Returns the number of listings updated. */
export async function flushViews(redis: Redis, db: Queryable): Promise<number> {
  // A crashed earlier flush left its hash behind: take it too
  if (!(await redis.exists(FLUSHING))) {
    if (!(await redis.exists(PENDING))) return 0;
    await redis.rename(PENDING, FLUSHING);
  }
  const counts = await redis.hgetall(FLUSHING);
  const rows = Object.entries(counts)
    .map(([id, n]) => [id, Number(n)] as const)
    .filter(([id, n]) => /^[0-9a-f-]{36}$/.test(id) && n > 0);
  if (rows.length) {
    await db.execute(sql`
      UPDATE listings l SET view_count = l.view_count + v.n
      FROM (VALUES ${sql.join(rows.map(([id, n]) => sql`(${id}::uuid, ${n}::bigint)`), sql`, `)}) AS v(id, n)
      WHERE l.id = v.id`);
  }
  await redis.del(FLUSHING);
  return rows.length;
}
