import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { countries, eventDates, listings, sitemapFiles } from '../../db/schema';
import { eventPath } from '../events/slug';
import { ancestry, isEventCategory, loadCatalog, type Catalog } from '../listings/catalog';
import { listingPath } from '../listings/slug';
import { browsePath, eventsPath } from './paths';
import { allCities } from './places';

// XML sitemaps (docs/architecture.md, SEO), built by the worker every hour and stored in
// sitemap_files; the web app serves them at /sitemap.xml and /sitemaps/<name>.xml unless
// SEARCH_INDEXING is off. Only addresses search engines should index: the plain country, city
// and category pages that have listings, the events pages with upcoming events, and every
// active listing and event page. Never a filtered, sorted or paged address.
//
// Files: `index` (the sitemap index), `<country>` (its browse and events pages) and
// `<country>-listings-<n>` (listing and event pages, at most 50,000 each).

export const SITEMAP_MAX_URLS = 50_000;

export type SitemapFile = { name: string; body: string; urlCount: number };
type Url = { loc: string; lastmod: Date | null };

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const xml = (s: string) => s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!);

function urlset(urls: Url[]): string {
  const items = urls.map((u) => `<url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`;
}

function sitemapIndex(appUrl: string, names: string[], at: Date): string {
  const items = names.map((n) => `<sitemap><loc>${xml(`${appUrl}/sitemaps/${n}.xml`)}</loc><lastmod>${at.toISOString()}</lastmod></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`;
}

const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

/** A category browse pages show: active up to its root, not in the events section */
function browsable(catalog: Catalog, id: string): boolean {
  return !isEventCategory(catalog, id) && ancestry(catalog, id).every((c) => c.isActive);
}

/** The browse and events pages of one country that have something on them */
async function countryPages(db: Queryable, catalog: Catalog, appUrl: string, country: { code: string; slug: string }, now: Date): Promise<Url[]> {
  const groups = await db
    .select({
      locationId: listings.locationId,
      categoryId: listings.categoryId,
      latest: sql<string>`max(${listings.rankedAt})`,
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, 'active'),
        eq(listings.countryCode, country.code),
        sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
      ),
    )
    .groupBy(listings.locationId, listings.categoryId);

  const cities = new Map((await allCities(db)).filter((c) => c.countryCode === country.code).map((c) => [c.id, c]));
  // lastmod per page: the newest listing on it. Keys: "", "c:<category>", "l:<city>", "l:<city>:<category>"
  const pages = new Map<string, Date | null>();
  const bump = (key: string, at: Date) => pages.set(key, later(pages.get(key) ?? null, at));
  for (const g of groups) {
    if (!g.categoryId || !browsable(catalog, g.categoryId)) continue;
    const at = new Date(g.latest);
    const city = g.locationId ? cities.get(g.locationId) : undefined;
    bump('', at);
    if (city) bump(`l:${city.slug}`, at);
    for (const c of ancestry(catalog, g.categoryId)) {
      bump(`c:${c.slug}`, at);
      if (city) bump(`l:${city.slug}:${c.slug}`, at);
    }
  }

  const urls: Url[] = [];
  for (const [key, lastmod] of pages) {
    const [kind, a, b] = key.split(':');
    const path =
      key === ''
        ? browsePath(country.slug, null, null)
        : kind === 'c'
          ? browsePath(country.slug, null, a!)
          : browsePath(country.slug, a!, b ?? null);
    urls.push({ loc: `${appUrl}${path}`, lastmod });
  }

  // Events pages: the country's and each city's, while they have upcoming events
  const upcoming = await db
    .select({ locationId: eventDates.locationId, latest: sql<string>`max(${listings.updatedAt})` })
    .from(eventDates)
    .innerJoin(listings, eq(listings.id, eventDates.listingId))
    .where(and(eq(eventDates.countryCode, country.code), gt(eventDates.endsAt, now), eq(listings.status, 'active')))
    .groupBy(eventDates.locationId);
  let countryEvents: Date | null = null;
  for (const u of upcoming) {
    const at = new Date(u.latest);
    countryEvents = later(countryEvents, at);
    const city = cities.get(u.locationId);
    if (city) urls.push({ loc: `${appUrl}${eventsPath(country.slug, city.slug)}`, lastmod: at });
  }
  if (countryEvents) urls.push({ loc: `${appUrl}${eventsPath(country.slug, null)}`, lastmod: countryEvents });

  // A stable order makes the files easy to compare between runs
  return urls.sort((x, y) => (x.loc < y.loc ? -1 : x.loc > y.loc ? 1 : 0));
}

/** Every active listing and event page of a country */
async function listingPages(db: Queryable, appUrl: string, countryCode: string): Promise<Url[]> {
  const rows = await db
    .select({
      title: listings.title,
      token: listings.publicToken,
      updatedAt: listings.updatedAt,
      isEvent: sql<boolean>`EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
    })
    .from(listings)
    .where(and(eq(listings.status, 'active'), eq(listings.countryCode, countryCode)))
    .orderBy(asc(listings.id));
  return rows.map((r) => ({ loc: `${appUrl}${r.isEvent ? eventPath(r.title, r.token) : listingPath(r.title, r.token)}`, lastmod: r.updatedAt }));
}

/** All sitemap files for the open countries, the index first */
export async function buildSitemaps(db: Queryable, appUrl: string, opts: { now?: Date; maxUrls?: number } = {}): Promise<SitemapFile[]> {
  const now = opts.now ?? new Date();
  const max = Math.min(opts.maxUrls ?? SITEMAP_MAX_URLS, SITEMAP_MAX_URLS);
  const base = appUrl.replace(/\/+$/, '');
  const catalog = await loadCatalog(db);
  const open = await db
    .select({ code: countries.code, slug: countries.slug })
    .from(countries)
    .where(and(eq(countries.isActive, true), sql`${countries.slug} IS NOT NULL`))
    .orderBy(asc(countries.sortOrder), asc(countries.code));

  const files: SitemapFile[] = [];
  for (const c of open) {
    const country = { code: c.code, slug: c.slug! };
    const pages = (await countryPages(db, catalog, base, country, now)).slice(0, max);
    if (pages.length) files.push({ name: country.slug, body: urlset(pages), urlCount: pages.length });
    const items = await listingPages(db, base, country.code);
    for (let i = 0; i * max < items.length; i++) {
      const chunk = items.slice(i * max, (i + 1) * max);
      files.push({ name: `${country.slug}-listings-${i + 1}`, body: urlset(chunk), urlCount: chunk.length });
    }
  }
  return [{ name: 'index', body: sitemapIndex(base, files.map((f) => f.name), now), urlCount: files.length }, ...files];
}

/** Replaces the stored sitemaps with these, in one transaction (the worker) */
export async function writeSitemaps(db: Queryable, files: SitemapFile[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const f of files) {
      await tx
        .insert(sitemapFiles)
        .values({ name: f.name, body: f.body, urlCount: f.urlCount, generatedAt: new Date() })
        .onConflictDoUpdate({ target: sitemapFiles.name, set: { body: f.body, urlCount: f.urlCount, generatedAt: new Date() } });
    }
    const keep = files.map((f) => f.name);
    await tx.delete(sitemapFiles).where(keep.length ? sql`${sitemapFiles.name} NOT IN (${sql.join(keep.map((n) => sql`${n}`), sql`, `)})` : sql`true`);
  });
}

/** One stored file by name (the web app), or null */
export async function readSitemap(db: Queryable, name: string): Promise<string | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(name)) return null;
  const [row] = await db.select({ body: sitemapFiles.body }).from(sitemapFiles).where(inArray(sitemapFiles.name, [name]));
  return row?.body ?? null;
}
