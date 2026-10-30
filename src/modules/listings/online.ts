import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings, locations } from '../../db/schema';
import { countEvents } from '../events/queries';
import { JOBS_ROOT, SERVICE_ROOTS } from '../organizations/limits';
import { cachedCounts, cardColumns, decodeCursor, encodeCursor, keywordCondition, PAGE_SIZE, type BrowseItem } from '../search/browse';
import { hideTest } from '../users/test-accounts';
import { subtreeIds, type Catalog } from './catalog';
import { coverKeys } from './queries';
import { zoneOf, zoneSql } from './zones';

// The online layer (wave 2 part 6; docs/setup.md, "The online layer"). What works from anywhere
// is shown beyond its own country, in every open country's «آنلاین از همه‌جا» page
// (/austria/online):
// - services and lessons offered online («امکان انجام آنلاین», a lesson held online), from every
//   open country;
// - remote jobs («دورکاری»), from the open countries of the same zone (src/modules/listings/zones.ts):
//   a German employer's remote job usually still needs the worker to live in the EU;
// - events held only online, from every open country; they also join the country's and its
//   cities' events lists (src/modules/events/queries.ts, `onlineElsewhere`). Hybrid events stay at
//   home: their venue is the point.
// Prices stay in the listing's currency, so these never mix into the category pages, whose price
// filters and sort are in the country's own; those pages link here with a count.

export const ONLINE_SECTIONS = ['events', 'services', 'jobs'] as const;
export type OnlineSection = (typeof ONLINE_SECTIONS)[number];
type ListingSection = Exclude<OnlineSection, 'events'>;

/** Open countries */
const OPEN = sql`(SELECT code FROM countries WHERE is_active)`;

/** The categories of a section: under the service roots, or under jobs */
export function sectionIds(catalog: Catalog, section: ListingSection): string[] {
  const roots = section === 'services' ? SERVICE_ROOTS : [JOBS_ROOT];
  return roots.flatMap((slug) => {
    const root = catalog.bySlug.get(slug);
    return root ? subtreeIds(catalog, root.id) : [];
  });
}

/** The section a category belongs to, or null (the category pages' link) */
export function sectionOf(catalog: Catalog, categoryId: string): ListingSection | null {
  if (sectionIds(catalog, 'services').includes(categoryId)) return 'services';
  if (sectionIds(catalog, 'jobs').includes(categoryId)) return 'jobs';
  return null;
}

export type OnlineFilter = {
  /** The page's country */
  countryCode: string;
  /** Only listings from other countries (the links on the country's own pages) */
  elsewhereOnly?: boolean;
  /** Within these categories of the section */
  categoryIds?: string[] | null;
  keyword?: string | null;
  withTest?: boolean;
};

/** The listings of a section that work from anywhere and are shown in `countryCode` */
function conditions(catalog: Catalog, section: ListingSection, f: OnlineFilter): SQL[] {
  const ids = f.categoryIds?.length ? f.categoryIds.filter((id) => sectionIds(catalog, section).includes(id)) : sectionIds(catalog, section);
  const online =
    section === 'services'
      ? sql`(${listings.attributes} @> '{"online_possible": true}'::jsonb OR ${listings.attributes} ->> 'lesson_format' IN ('online', 'both'))`
      : sql`${listings.attributes} @> '{"work_mode": "remote"}'::jsonb AND ${zoneSql(sql`${listings.countryCode}`)} = ${zoneOf(f.countryCode)}`;
  const from = f.elsewhereOnly
    ? sql`${listings.countryCode} <> ${f.countryCode} AND ${listings.countryCode} IN ${OPEN}`
    : sql`(${listings.countryCode} = ${f.countryCode} OR ${listings.countryCode} IN ${OPEN})`;
  const out: (SQL | undefined)[] = [
    eq(listings.status, 'active'),
    ids.length ? inArray(listings.categoryId, ids) : sql`false`,
    online,
    from,
    hideTest(f.withTest, listings.userId),
    f.keyword ? keywordCondition(f.keyword) : undefined,
  ];
  return out.filter((c): c is SQL => !!c);
}

/** One page of a section's online listings, newest first (keyset on ranked_at and the id) */
export async function onlineListings(
  db: Queryable,
  catalog: Catalog,
  section: ListingSection,
  f: OnlineFilter & { after?: string | null },
  pageSize = PAGE_SIZE,
): Promise<{ items: BrowseItem[]; next: string | null }> {
  const where = conditions(catalog, section, f);
  const after = decodeCursor(f.after ?? null, 'newest');
  if (after) where.push(sql`(${listings.rankedAt}, ${listings.id}) < (${after.key}::timestamptz, ${after.id}::uuid)`);
  const rows = await db
    .select({ ...cardColumns, sortKey: sql<string>`to_char(${listings.rankedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(and(...where))
    .orderBy(desc(listings.rankedAt), desc(listings.id))
    .limit(pageSize + 1);
  const page = rows.slice(0, pageSize);
  const covers = await coverKeys(db, page.map((r) => r.id));
  const last = page.at(-1);
  return {
    items: page.map(({ sortKey: _k, ...r }) => ({ ...r, coverKey: covers.get(r.id) ?? null, distanceKm: null })),
    next: rows.length > pageSize && last ? encodeCursor(last.sortKey, last.id) : null,
  };
}

async function countListings(db: Queryable, catalog: Catalog, section: ListingSection, f: OnlineFilter): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(...conditions(catalog, section, f)));
  return row?.n ?? 0;
}

export type OnlineCounts = Record<OnlineSection, number>;

/** How many of each the online page shows for these filters (events: those not over yet) */
export async function onlineCounts(db: Queryable, catalog: Catalog, f: OnlineFilter, now = new Date()): Promise<OnlineCounts> {
  const [events, services, jobs] = await Promise.all([
    f.categoryIds?.length
      ? Promise.resolve(0)
      : countEvents(db, { countryCode: f.countryCode, onlineElsewhere: f.elsewhereOnly ? 'only' : 'also', online: true, text: f.keyword ?? null, from: now, to: null, withTest: f.withTest }, now),
    countListings(db, catalog, 'services', f),
    countListings(db, catalog, 'jobs', f),
  ]);
  return { events, services, jobs };
}

/**
 * The counts of the links on the country's pages (never test accounts', whoever looks), at most a
 * minute old: everything online for the country's first page, or what other countries add in a
 * services, lessons or jobs category (`categoryId`, with everything under it).
 */
export async function cachedOnlineCounts(db: Queryable, catalog: Catalog, countryCode: string, categoryId: string | null = null): Promise<OnlineCounts> {
  const counts = await cachedCounts(`online:${countryCode}:${categoryId ?? 'all'}`, async () => {
    const c = await onlineCounts(db, catalog, categoryId ? { countryCode, elsewhereOnly: true, categoryIds: subtreeIds(catalog, categoryId) } : { countryCode });
    return new Map(Object.entries(c));
  });
  return { events: counts.get('events') ?? 0, services: counts.get('services') ?? 0, jobs: counts.get('jobs') ?? 0 };
}
