import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { pagePath } from '../listings/page-purge';
import { testOwned } from '../users/test-accounts';

// IndexNow (SEO plan step 7, docs/research/seo.md section 5; approved Nov 7, 2026): when a public
// page is published, changed or gone, the worker tells Bing and the other IndexNow engines
// (api.indexnow.org shares each call with all of them), so they fetch it again within minutes
// instead of at their next crawl. Only with SEARCH_INDEXING=on and INDEXNOW_KEY set: staging and
// production before go-live never call it.
//
// - The same moments as the Cloudflare purge (src/worker/moderation.ts, jobs `page_purge` and
//   `seller_pages_purge`): a listing's or event's page under its current title (the address search
//   engines keep: the page's canonical), and for a business's or private seller's change their
//   active pages plus the business page /b/{slug}. Never a page nobody could see: a draft never
//   published, or a test account's.
// - Gathered in Valkey for INDEXNOW_GATHER_MS, then one call of up to 10,000 addresses (the API's
//   limit). The wait also lets both Cloudflare purges finish first, so the engines' crawlers fetch
//   the new page, not the cached one.
// - The engines check the key at keyLocation: the web serves it at /indexnow.txt
//   (src/app/indexnow.txt/route.ts).

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_KEY_PATH = '/indexnow.txt';
/** The API's limit of addresses per call */
export const INDEXNOW_BATCH = 10_000;
/** Changed pages are gathered this long before one call (longer than the purge's second round, 15 s) */
export const INDEXNOW_GATHER_MS = 60_000;
/** The set of addresses waiting for the next call (behind the queue prefix) */
export const INDEXNOW_PENDING_KEY = 'indexnow:pending';
/** Addresses not sent within this time (IndexNow down for days) are dropped; the sitemaps still have them */
const PENDING_TTL_S = 2 * 86_400;
/** Calls per job at most; more waiting goes with the next job */
const MAX_CALLS = 5;
/** Active pages of one business or seller sent after a change of theirs (the purge's limit) */
const MAX_OWNER_PAGES = 600;

export type IndexNowConfig = { key: string; appUrl: string };

/** IndexNow's settings, or null when it is off (SEARCH_INDEXING not `on`, or no key) */
export function indexNowConfig(env: { SEARCH_INDEXING?: 'on' | 'off'; INDEXNOW_KEY?: string; APP_URL: string }): IndexNowConfig | null {
  if (env.SEARCH_INDEXING !== 'on' || !env.INDEXNOW_KEY) return null;
  return { key: env.INDEXNOW_KEY, appUrl: env.APP_URL };
}

/** IndexNow can try again later: not reached, 429 or a server error */
export class IndexNowBusy extends Error {}
/** IndexNow refused the call (a wrong key or addresses of another host): trying again won't help */
export class IndexNowRefused extends Error {}

/** The JSON body of one call: our own addresses only, each once, at most INDEXNOW_BATCH */
export function indexNowBody(cfg: IndexNowConfig, urls: readonly string[]) {
  const origin = new URL(cfg.appUrl).origin;
  const own = [...new Set(urls)].filter((u) => URL.canParse(u) && new URL(u).origin === origin);
  return { host: new URL(origin).host, key: cfg.key, keyLocation: `${origin}${INDEXNOW_KEY_PATH}`, urlList: own.slice(0, INDEXNOW_BATCH) };
}

/**
 * One call. Returns the number of addresses sent. Throws IndexNowBusy (try again later) or
 * IndexNowRefused; neither message carries the key.
 */
export async function submitIndexNow(cfg: IndexNowConfig, urls: readonly string[], fetchFn: typeof fetch = fetch): Promise<number> {
  const body = indexNowBody(cfg, urls);
  if (body.urlList.length === 0) return 0;
  let res: Response;
  try {
    res = await fetchFn(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new IndexNowBusy(`IndexNow not reached: ${e instanceof Error ? e.name : 'error'}`);
  }
  // 200 OK, 202 Accepted (the key is still being checked)
  if (res.ok) return body.urlList.length;
  if (res.status === 429 || res.status >= 500) throw new IndexNowBusy(`IndexNow busy: ${res.status}`);
  throw new IndexNowRefused(`IndexNow refused: ${res.status}`);
}

/** Adds addresses to the waiting set */
export async function addPendingIndexNow(redis: Redis, key: string, urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  await redis.sadd(key, [...urls]);
  await redis.expire(key, PENDING_TTL_S);
}

/**
 * Sends what is waiting, INDEXNOW_BATCH addresses a call. Sent addresses leave the set; on
 * IndexNowBusy they stay for the retry (the error is thrown on), on IndexNowRefused they are dropped.
 */
export async function sendPendingIndexNow(redis: Redis, key: string, cfg: IndexNowConfig, fetchFn?: typeof fetch): Promise<number> {
  let sent = 0;
  for (let call = 0; call < MAX_CALLS; call++) {
    const urls = await redis.srandmember(key, INDEXNOW_BATCH);
    if (urls.length === 0) break;
    try {
      sent += await submitIndexNow(cfg, urls, fetchFn);
    } catch (e) {
      if (e instanceof IndexNowRefused) await redis.srem(key, urls);
      throw e;
    }
    await redis.srem(key, urls);
    if (urls.length < INDEXNOW_BATCH) break;
  }
  return sent;
}

type PageRow = { token: string; title: string; is_event: boolean };
const pageUrl = (appUrl: string, r: PageRow) => `${appUrl}${pagePath(r.is_event ? 'event' : 'listing', r.title, r.token)}`;

/**
 * A listing's or event's page as search engines know it: its current title and its kind (the
 * canonical address; older titles answer with the same page and point to it). Gone pages too: the
 * engines learn they are gone. Nothing for a listing never published or a test account's.
 */
export async function listingIndexUrls(db: Queryable, listingId: string, appUrl: string): Promise<string[]> {
  const rows = await db.execute<PageRow>(sql`
    SELECT l.public_token AS token, l.title, EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event
    FROM listings l
    WHERE l.id = ${listingId} AND l.published_at IS NOT NULL AND NOT ${testOwned(sql`l.user_id`)}`);
  return rows.map((r) => pageUrl(appUrl, r));
}

/**
 * After a business's or private seller's change (name, badge, logo, contact details): the business
 * page and their active listing and event pages (the indexable ones), newest first.
 */
export async function ownerIndexUrls(db: Queryable, owner: { organizationId: string } | { userId: string }, appUrl: string): Promise<string[]> {
  const urls: string[] = [];
  if ('organizationId' in owner) {
    const orgs = await db.execute<{ slug: string }>(sql`
      SELECT o.slug FROM organizations o
      WHERE o.id = ${owner.organizationId} AND o.status = 'active' AND NOT ${testOwned(sql`o.created_by_user_id`)}`);
    for (const o of orgs) urls.push(`${appUrl}/b/${o.slug}`);
  }
  const rows = await db.execute<PageRow>(sql`
    SELECT l.public_token AS token, l.title, EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event
    FROM listings l
    WHERE ${'organizationId' in owner ? sql`l.organization_id = ${owner.organizationId}` : sql`l.user_id = ${owner.userId}`}
      AND l.status = 'active' AND NOT ${testOwned(sql`l.user_id`)}
    ORDER BY l.status_changed_at DESC NULLS LAST
    LIMIT ${MAX_OWNER_PAGES}`);
  for (const r of rows) urls.push(pageUrl(appUrl, r));
  return urls;
}
