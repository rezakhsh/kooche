import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';

// Listing views for the sellers' stats (roadmap step 6). A page view adds one to a Valkey hash;
// the worker adds the hash to listings.view_count every 5 minutes (docs/schema.md: "counted in
// Valkey, written here in batches"). One visitor (IP) counts once per listing per half hour, and
// obvious bots and the seller's own views don't count. Every key has an expiry (noeviction).

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
