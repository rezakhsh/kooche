import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { browsePath, eventsPath } from '../search/paths';

// After a take-down or a restore, the plain browse pages that showed (or will show) the listing are
// purged from Cloudflare's cache at once instead of within 60 seconds (approved Oct 23, 2026).
// Purge by URL works on the Free plan, up to 30 addresses a call. Filtered and paged addresses
// can't be listed; they keep the 60-second bound (docs/setup.md, "Browsing and favorites").

export async function listingBrowseUrls(db: Queryable, listingId: string, appUrl: string): Promise<string[]> {
  const rows = await db.execute<{ country: string | null; city: string | null; categories: string[] | null; is_event: boolean }>(sql`
    SELECT co.slug AS country, loc.slug AS city,
      (SELECT array_agg(a.slug ORDER BY nlevel(a.path)) FROM categories a WHERE a.path @> c.path) AS categories,
      EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event
    FROM listings l
    LEFT JOIN countries co ON co.code = l.country_code
    LEFT JOIN locations loc ON loc.id = l.location_id AND loc.kind = 'city'
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.id = ${listingId}
  `);
  const r = rows[0];
  if (!r?.country) return [];
  const paths = new Set<string>([browsePath(r.country, null, null)]);
  if (r.city) paths.add(browsePath(r.country, r.city, null));
  if (r.is_event) {
    paths.add(eventsPath(r.country, null));
    if (r.city) paths.add(eventsPath(r.country, r.city));
  } else {
    for (const cat of r.categories ?? []) {
      paths.add(browsePath(r.country, null, cat));
      if (r.city) paths.add(browsePath(r.country, r.city, cat));
    }
  }
  return [...paths].slice(0, 30).map((p) => `${appUrl}${p}`);
}

/** Purges these addresses; errors carry Cloudflare's message, never the token */
export async function purgeUrls(zoneId: string, token: string, urls: string[], fetchFn: typeof fetch = fetch): Promise<void> {
  if (urls.length === 0) return;
  const res = await fetchFn(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: urls }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; errors?: { code: number; message: string }[] } | null;
  if (!res.ok || !body?.success) throw new Error(`Cloudflare purge failed: ${res.status} ${(body?.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ')}`);
}
