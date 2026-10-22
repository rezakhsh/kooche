import { appDb } from '../../../../db/drizzle';
import { clientIp } from '../../../../lib/client-ip';
import { hit } from '../../../../lib/rate-limit';
import { valkey } from '../../../../lib/valkey';
import { cachedCatalog } from '../../../../modules/listings/catalog';
import { activeCountries } from '../../../../modules/listings/queries';
import { webMeili } from '../../../../modules/search/client';
import { LISTINGS_INDEX } from '../../../../modules/search/documents';
import { cityOf } from '../../../../modules/search/places';
import { SUGGESTIONS_INDEX } from '../../../../modules/search/phrases';
import { findSuggestions, SUGGEST_LIMIT, suggestKeyword, suggestions, suggestParams, type Found, type SuggestScope } from '../../../../modules/search/suggest';

// Suggestions while typing (src/modules/search/suggest.ts) for the search boxes: one Meilisearch
// multi-search over the phrase index and the listings. GET, no session needed, nothing personal
// in or out. 120 a minute per IP (separate from the full searches). The
// browser keeps an answer for 30 seconds; Cloudflare never stores it (/api/ is outside the Cache
// Rule). Nothing typed is stored or logged.

export const dynamic = 'force-dynamic';


const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': status === 200 ? 'private, max-age=30' : 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = suggestParams.safeParse(params);
  if (!parsed.success) return json({ rows: [] }, 400);
  const ip = clientIp(request.headers);
  if (ip && !(await hit(valkey(), [[SUGGEST_LIMIT, ip]]).catch(() => ({ ok: true }))).ok) return json({ rows: [] }, 429);

  const q = suggestKeyword(parsed.data.q);
  if (!q) return json({ rows: [] });

  const db = appDb();
  const country = (await activeCountries(db)).find((c) => c.slug === parsed.data.country);
  if (!country) return json({ rows: [] }, 404);
  const city = parsed.data.city ? await cityOf(db, country.code, parsed.data.city) : null;
  const scope: SuggestScope = {
    country: { code: country.code, slug: country.slug, nameFa: country.nameFa, minorUnit: country.currency.minorUnit },
    city: city ? { id: city.id, slug: city.slug, nameFa: city.nameFa } : null,
  };
  const catalog = await cachedCatalog(db);
  const meili = webMeili();
  let found: Found | null = null;
  if (meili) {
    found = await findSuggestions(meili, { listings: LISTINGS_INDEX, suggestions: SUGGESTIONS_INDEX }, scope, q).catch((e) => {
      console.error('search: suggestions failed:', e instanceof Error ? e.message : e);
      return null;
    });
  }
  return json({ rows: suggestions(catalog, scope, parsed.data.q, found) });
}
