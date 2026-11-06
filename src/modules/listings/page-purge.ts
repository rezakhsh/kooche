import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { outboxEvents } from '../../db/schema';
import { titleSlug } from './slug';

// Cloudflare keeps one copy of a listing's or event's page for every signed-out visitor (src/proxy.ts,
// listingCacheControl). Whenever something on it changes, the worker drops that copy at once
// (Nov 6, 2026; docs/setup.md, "Browsing and favorites"), so a sold, paused, deleted or edited
// listing never shows as it was. Purge by address on the Free plan: 30 addresses a call.
// - every listing event (edit, photos, pause, resume, sold, expiry, renewal, bump, take-down,
//   restore, delete) and the event ones (published, changed, cancelled): its own page;
// - PAGES_CHANGED: a business's or a private seller's name, badge, logo or contact details, shown
//   on all their pages.

/** The page's addresses under every title it had: the address carries the title, and old links keep working */
const MAX_TITLES = 10;
/** Addresses of one seller's or business's pages purged after a change of theirs */
const MAX_SELLER_PAGES = 600;
/** Cloudflare's limit per purge call on the Free plan */
export const PURGE_BATCH = 30;

/** Something shown on every page of a business or a private seller changed */
export const PAGES_CHANGED = 'pages.changed';

/** The address a page has under a title, as browsers send it (the title part percent-encoded) */
export function pagePath(kind: 'listing' | 'event', title: string, token: string): string {
  return `/${kind === 'event' ? 'e' : 'v'}/${encodeURIComponent(titleSlug(title))}/${token}`;
}

/**
 * Every address of one listing's page: under its current title and the titles it had before (from
 * its history), each as /v/ and /e/ (an event's /v/ address answers with a redirect to /e/, which
 * Cloudflare keeps too). Deleted listings included: their copies must go as well.
 */
export async function listingPageUrls(db: Queryable, listingId: string, appUrl: string): Promise<string[]> {
  const rows = await db.execute<{ token: string; title: string }>(sql`
    SELECT l.public_token AS token, t.title
    FROM listings l
    CROSS JOIN LATERAL (
      SELECT l.title, now() AS at
      UNION ALL
      SELECT e.data->'title'->>0, e.created_at FROM listing_events e
      WHERE e.listing_id = l.id AND jsonb_typeof(e.data->'title') = 'array'
    ) t
    WHERE l.id = ${listingId} AND t.title IS NOT NULL
    ORDER BY t.at DESC`);
  const titles = [...new Set(rows.map((r) => r.title))].slice(0, MAX_TITLES);
  const token = rows[0]?.token;
  if (!token) return [];
  const paths = new Set(titles.flatMap((t) => [pagePath('listing', t, token), pagePath('event', t, token)]));
  return [...paths].map((p) => `${appUrl}${p}`);
}

/**
 * The current addresses of every page a business or a private seller has out (anything a visitor
 * can open: active, paused, sold, expired), newest first. One address each, of its kind.
 */
export async function sellerPageUrls(db: Queryable, owner: { organizationId: string } | { userId: string }, appUrl: string): Promise<string[]> {
  const rows = await db.execute<{ token: string; title: string; is_event: boolean }>(sql`
    SELECT l.public_token AS token, l.title, EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event
    FROM listings l
    WHERE ${'organizationId' in owner ? sql`l.organization_id = ${owner.organizationId}` : sql`l.user_id = ${owner.userId}`}
      AND l.status IN ('active', 'paused', 'sold', 'expired')
    ORDER BY l.status_changed_at DESC NULLS LAST
    LIMIT ${MAX_SELLER_PAGES}`);
  return rows.map((r) => `${appUrl}${pagePath(r.is_event ? 'event' : 'listing', r.title, r.token)}`);
}

/** In the transaction that changed it: the business's or seller's pages are purged by the worker */
export async function queuePagesPurge(tx: Queryable, owner: { organizationId: string } | { userId: string }): Promise<void> {
  await tx.insert(outboxEvents).values(
    'organizationId' in owner
      ? { eventType: PAGES_CHANGED, aggregateType: 'organization', aggregateId: owner.organizationId, payload: { owner: 'organization' } }
      : { eventType: PAGES_CHANGED, aggregateType: 'user', aggregateId: owner.userId, payload: { owner: 'user' } },
  );
}

/** The owner a PAGES_CHANGED event names (its payload) */
export function pagesOwner(aggregateId: string, payload: Record<string, unknown>): { organizationId: string } | { userId: string } {
  return payload.owner === 'organization' ? { organizationId: aggregateId } : { userId: aggregateId };
}
