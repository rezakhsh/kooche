import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { listingImages, listings, locations, organizations } from '../../db/schema';
import type { Point } from '../../db/types';
import { normalizePersian } from '../../lib/normalize-persian';
import { listingNeighbourhood } from '../listings/neighbourhood';
import { coverKeys } from '../listings/queries';
import { hideTest } from '../users/test-accounts';
import type { AttributeFilter, Sort } from './filters';
import { STOP_WORDS, synonymsOf } from './synonyms';

// Browsing without a keyword, straight from PostgreSQL (docs/architecture.md, "Search"): the
// partial browse indexes on active listings, GIN on attributes for choices and yes/no fields,
// GIST on the rounded point for a radius. Keyword search goes to Meilisearch (./keyword.ts),
// behind `searchListings` in index.ts; this query takes a keyword only as the fallback when
// Meilisearch is down or not configured (every word or a synonym of it, no typos, newest first).
//
// Paging is keyset on (sort key, id), never OFFSET, so a listing published while someone pages
// never shows twice or pushes another out. Every sort key is non-null: listings without a price
// sort last in both price orders through a sentinel.

export const PAGE_SIZE = 24;
/** Totals above this show as "1,000+"; counting further would read every matching row */
export const COUNT_CAP = 1000;

/** What a browse query asks for, resolved to ids and minor units (built by the page from BrowseState) */
export type SearchFilters = {
  countryCode: string;
  /** The keyword as typed (filters.ts, cleanKeyword); null browses without one */
  keyword: string | null;
  /** A category and everything under it; null for all */
  categoryIds: string[] | null;
  /** A city page */
  locationId: string | null;
  /** "This postal code only" */
  postalCode: string | null;
  /** A radius around a postal area's centre or the visitor's rounded position. Never stored. */
  around: { point: Point; radiusM: number } | null;
  /** Minor units; free listings count as 0, listings without a price are left out */
  price: { min: number | null; max: number | null } | null;
  shipping: boolean;
  /** Only private people's (no business) or only businesses' listings */
  seller?: 'private' | 'business' | null;
  attributes: AttributeFilter[];
  sort: Sort;
  /** Test accounts' listings too: only for staff and test accounts (src/modules/users/test-accounts.ts) */
  withTest?: boolean;
};

export type BrowseItem = {
  id: string;
  publicToken: string;
  title: string;
  priceType: (typeof listings.$inferSelect)['priceType'];
  priceMinor: number | null;
  currency: string | null;
  countryCode: string | null;
  categoryId: string | null;
  postalCode: string | null;
  placeName: string | null;
  district: string | null;
  cityFa: string | null;
  publishedAt: Date | null;
  /** Publishing or the last bump: the card's time, like Kleinanzeigen's after "Hochschieben" */
  rankedAt: Date | null;
  kind: (typeof listings.$inferSelect)['kind'];
  /** The listing's field values, for the card facts */
  attributes: Record<string, unknown>;
  photoCount: number;
  /** «ودینگ»: the neighbourhood covering the listing's point (src/modules/listings/neighbourhood.ts) */
  neighbourhood: string | null;
  /** Posted by a founding business while its badge runs (foundingBadge(), src/modules/payments/founding.ts) */
  founding: boolean;
  /** Posted by an active, verified business («تأییدشده» on the card) */
  verified: boolean;
  coverKey: string | null;
  /** Whole kilometres to the listing's stored (rounded) point, when a radius is on */
  distanceKm: number | null;
};

/** Events have their own section and pages (src/modules/events/) */
const notAnEvent = sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`;

const geography = (p: Point) => sql`ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography`;

/** Free counts as 0; exchange and on request have no price */
const priceValue = sql`CASE WHEN ${listings.priceType} = 'free' THEN 0 ELSE ${listings.priceMinor} END`;
const NO_PRICE_LAST_ASC = Number.MAX_SAFE_INTEGER;
const NO_PRICE_LAST_DESC = -1;

/** The sort key as an SQL expression, and its direction */
function sortKey(sort: Sort, around: SearchFilters['around']): { expr: SQL; dir: 'asc' | 'desc' } {
  switch (sort) {
    // Relevance needs Meilisearch; the PostgreSQL fallback shows the newest first
    case 'relevance':
    case 'newest':
      return { expr: sql`${listings.rankedAt}`, dir: 'desc' };
    case 'price_asc':
      return { expr: sql`COALESCE(${priceValue}, ${NO_PRICE_LAST_ASC}::bigint)`, dir: 'asc' };
    case 'price_desc':
      return { expr: sql`COALESCE(${priceValue}, ${NO_PRICE_LAST_DESC}::bigint)`, dir: 'desc' };
    case 'distance':
      if (!around) throw new Error('distance sort needs a point');
      // KNN distance on the sphere, which the GIST index can order by
      return { expr: sql`(${listings.point} <-> ${geography(around.point)})`, dir: 'asc' };
  }
}

// ---------------------------------------------------------------------------
// Cursor: base64url of [sort key, id], checked against the sort
// ---------------------------------------------------------------------------

type CursorKey = string | number;
const uuid = z.uuid();
const cursorKeySchema: Record<Sort, z.ZodType<CursorKey>> = {
  relevance: z.iso.datetime(),
  newest: z.iso.datetime(),
  price_asc: z.number().int().min(NO_PRICE_LAST_DESC).max(NO_PRICE_LAST_ASC),
  price_desc: z.number().int().min(NO_PRICE_LAST_DESC).max(NO_PRICE_LAST_ASC),
  distance: z.number().finite().min(0),
};

export function encodeCursor(key: CursorKey, id: string): string {
  return Buffer.from(JSON.stringify([key, id])).toString('base64url');
}

/** The cursor's key and id, or null when it is malformed or belongs to another sort */
export function decodeCursor(cursor: string | null, sort: Sort): { key: CursorKey; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = z.tuple([cursorKeySchema[sort], uuid]).safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return parsed.success ? { key: parsed.data[0], id: parsed.data[1] } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** One attribute filter as SQL. Keys come from validated definitions and are bound as parameters too. */
function attributeCondition(f: AttributeFilter): SQL {
  const json = (v: unknown) => sql`${JSON.stringify(v)}::jsonb`;
  const contains = (v: unknown) => sql`${listings.attributes} @> ${json(v)}`;
  switch (f.type) {
    case 'select':
      return sql`(${sql.join(
        f.values.map((v) => contains({ [f.key]: v })),
        sql` OR `,
      )})`;
    case 'multi_select':
      return f.match === 'all'
        ? contains({ [f.key]: f.values })
        : sql`(${sql.join(
            f.values.map((v) => contains({ [f.key]: [v] })),
            sql` OR `,
          )})`;
    case 'boolean':
      return contains({ [f.key]: true });
    case 'number': {
      // The CASE keeps the cast away from anything that isn't a JSON number
      const n = sql`(CASE WHEN jsonb_typeof(${listings.attributes} -> ${f.key}) = 'number' THEN (${listings.attributes} -> ${f.key})::numeric END)`;
      return sql.join(
        [f.min !== null ? sql`${n} >= ${f.min}` : undefined, f.max !== null ? sql`${n} <= ${f.max}` : undefined].filter((x): x is SQL => !!x),
        sql` AND `,
      );
    }
    case 'date': {
      // Stored as "2027-03-15" or "2027-03": text order is date order
      const d = sql`(CASE WHEN jsonb_typeof(${listings.attributes} -> ${f.key}) = 'string' THEN ${listings.attributes} ->> ${f.key} END)`;
      return sql.join(
        [f.from !== null ? sql`${d} >= ${f.from}` : undefined, f.to !== null ? sql`${d} <= ${f.to}` : undefined].filter((x): x is SQL => !!x),
        sql` AND `,
      );
    }
  }
}

/** The keyword's words for the fallback: normalized, without stop words, each with its synonyms */
export function keywordWords(keyword: string): string[][] {
  const words = normalizePersian(keyword).split(' ').filter((w) => w && !STOP_WORDS.includes(w));
  return words.map((w) => [w, ...synonymsOf(w)]);
}

/** Every word (or a synonym of it) somewhere in the title or description, ZWNJ ignored */
export function keywordCondition(keyword: string): SQL | undefined {
  const groups = keywordWords(keyword);
  if (groups.length === 0) return undefined;
  const flat = (col: SQL) => sql`replace(${col}, ${'\u200c'}, '')`;
  const like = (w: string) => `%${w.replace(/\u200c/g, '').replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql.join(
    groups.map((g) => sql`(${sql.join(
      g.map((w) => sql`(${flat(sql`${listings.titleNormalized}`)} LIKE ${like(w)} OR ${flat(sql`${listings.descriptionNormalized}`)} LIKE ${like(w)})`),
      sql` OR `,
    )})`),
    sql` AND `,
  );
}

function conditions(f: SearchFilters): SQL[] {
  const out: (SQL | undefined)[] = [
    eq(listings.status, 'active'),
    eq(listings.countryCode, f.countryCode),
    notAnEvent,
    hideTest(f.withTest, listings.userId),
    f.categoryIds ? inArray(listings.categoryId, f.categoryIds) : undefined,
    f.locationId ? eq(listings.locationId, f.locationId) : undefined,
    f.postalCode ? eq(listings.postalCode, f.postalCode) : undefined,
    f.around ? sql`ST_DWithin(${listings.point}, ${geography(f.around.point)}, ${f.around.radiusM})` : undefined,
    f.price ? sql`${listings.priceType} IN ('fixed', 'negotiable', 'free')` : undefined,
    f.price?.min != null ? sql`${priceValue} >= ${f.price.min}` : undefined,
    f.price?.max != null ? sql`${priceValue} <= ${f.price.max}` : undefined,
    f.shipping ? eq(listings.shippingOffered, true) : undefined,
    f.seller === 'business' ? isNotNull(listings.organizationId) : f.seller === 'private' ? isNull(listings.organizationId) : undefined,
    ...f.attributes.map(attributeCondition),
    f.keyword ? keywordCondition(f.keyword) : undefined,
  ];
  return out.filter((c): c is SQL => !!c);
}

/**
 * What a listing card needs, selected from `listings` left-joined to its city (`locations`). The
 * seller page (src/modules/users/profile.ts) selects the same columns.
 */
export const cardColumns = {
  id: listings.id,
  publicToken: listings.publicToken,
  title: listings.title,
  priceType: listings.priceType,
  priceMinor: listings.priceMinor,
  currency: listings.currency,
  countryCode: listings.countryCode,
  categoryId: listings.categoryId,
  postalCode: listings.postalCode,
  placeName: listings.placeName,
  district: listings.district,
  cityFa: locations.nameFa,
  publishedAt: listings.publishedAt,
  rankedAt: listings.rankedAt,
  kind: listings.kind,
  attributes: sql<Record<string, unknown>>`${listings.attributes}`,
  photoCount: sql<number>`(SELECT count(*)::int FROM ${listingImages} WHERE ${listingImages.listingId} = ${listings.id} AND ${listingImages.status} = 'ready')`,
  neighbourhood: listingNeighbourhood,
  verified: sql<boolean>`EXISTS (SELECT 1 FROM ${organizations} WHERE ${organizations.id} = ${listings.organizationId} AND ${organizations.status} = 'active' AND ${organizations.verificationStatus} = 'verified')`,
  // The same year as foundingBadge(): from the page's creation
  founding: sql<boolean>`EXISTS (SELECT 1 FROM ${organizations} WHERE ${organizations.id} = ${listings.organizationId} AND ${organizations.foundingOfferedAt} IS NOT NULL AND ${organizations.createdAt} + interval '1 year' > now())`,
};

/**
 * One page of active listings matching the filters, in the asked order, after the cursor.
 * `next` is the cursor of the following page, or null on the last one.
 */
export async function browseListings(db: Queryable, f: SearchFilters, cursor: string | null) {
  if (f.sort === 'distance' && !f.around) throw new Error('distance sort needs a point');
  const key = sortKey(f.sort, f.around);
  const after = decodeCursor(cursor, f.sort);
  const where = conditions(f);
  if (after) {
    const k = f.sort === 'newest' ? sql`${after.key}::timestamptz` : f.sort === 'distance' ? sql`${after.key}::float8` : sql`${after.key}::bigint`;
    where.push(key.dir === 'desc' ? sql`(${key.expr}, ${listings.id}) < (${k}, ${after.id}::uuid)` : sql`(${key.expr}, ${listings.id}) > (${k}, ${after.id}::uuid)`);
  }
  const order = key.dir === 'desc' ? [desc(key.expr), desc(listings.id)] : [asc(key.expr), asc(listings.id)];

  const rows = await db
    .select({
      ...cardColumns,
      sortKey: f.sort === 'newest' ? sql<string>`to_char(${listings.rankedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` : sql<number>`${key.expr}`,
      distanceM: f.around ? sql<number>`ST_Distance(${listings.point}, ${geography(f.around.point)})` : sql<null>`NULL`,
    })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(and(...where))
    .orderBy(...order)
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const covers = await coverKeys(db, page.map((r) => r.id));
  const last = page.at(-1);
  const items: BrowseItem[] = page.map(({ sortKey: _k, distanceM, ...r }) => ({
    ...r,
    coverKey: covers.get(r.id) ?? null,
    distanceKm: distanceM === null ? null : roundKm(Number(distanceM)),
  }));
  return {
    items,
    next: rows.length > PAGE_SIZE && last ? encodeCursor(f.sort === 'newest' ? String(last.sortKey) : Number(last.sortKey), last.id) : null,
  };
}

/** How many featured listings a browse page shows above its results */
export const FEATURED_ON_PAGE = 3;

/**
 * Featured listings for a browse page (roadmap step 6): active listings matching the page's own
 * filters with a running `featured` entitlement, shuffled, at most three. Featured is never stored
 * on the listing; the small set of running entitlements is looked up first.
 */
export async function featuredForPage(db: Queryable, f: SearchFilters, now: Date = new Date()): Promise<BrowseItem[]> {
  const at = now.toISOString();
  const rows = await db
    .select({ ...cardColumns, distanceM: f.around ? sql<number>`ST_Distance(${listings.point}, ${geography(f.around.point)})` : sql<null>`NULL` })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(
      and(
        ...conditions({ ...f, keyword: null }),
        sql`${listings.id} IN (SELECT listing_id FROM entitlements WHERE type = 'featured' AND revoked_at IS NULL AND starts_at <= ${at}::timestamptz AND ends_at > ${at}::timestamptz)`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(FEATURED_ON_PAGE);
  const covers = await coverKeys(db, rows.map((r) => r.id));
  return rows.map(({ distanceM, ...r }) => ({ ...r, coverKey: covers.get(r.id) ?? null, distanceKm: distanceM === null ? null : roundKm(Number(distanceM)) }));
}

/**
 * Which of the searches would show this listing, by the browse query itself (saved-search
 * alerts): one round trip for up to 50 searches.
 */
export async function searchesShowing(db: Queryable, listingId: string, searches: { id: string; filters: SearchFilters }[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < searches.length; i += 50) {
    const chunk = searches.slice(i, i + 50);
    const rows = await db.execute<{ id: string }>(
      sql.join(
        chunk.map((s) => sql`(SELECT ${s.id}::text AS id FROM ${listings} WHERE ${listings.id} = ${listingId}::uuid AND ${and(...conditions(s.filters))})`),
        sql` UNION ALL `,
      ),
    );
    for (const r of rows) out.add(r.id);
  }
  return out;
}

/**
 * Cards for listing ids found by keyword search, in the order given. Only active listings that
 * aren't events: an index entry that went stale since is simply left out.
 */
export async function cardsByIds(db: Queryable, ids: string[], around: SearchFilters['around'], withTest?: boolean): Promise<BrowseItem[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      ...cardColumns,
      distanceM: around ? sql<number>`ST_Distance(${listings.point}, ${geography(around.point)})` : sql<null>`NULL`,
    })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(and(inArray(listings.id, ids), eq(listings.status, 'active'), notAnEvent, hideTest(withTest, listings.userId)));
  const covers = await coverKeys(db, ids);
  const byId = new Map(rows.map(({ distanceM, ...r }) => [r.id, { ...r, coverKey: covers.get(r.id) ?? null, distanceKm: distanceM === null ? null : roundKm(Number(distanceM)) }]));
  return ids.map((id) => byId.get(id)).filter((r): r is BrowseItem => !!r);
}

/**
 * Whole kilometres, and never under 1. The listing's point is already rounded to ~500 m or a
 * postal-area or city centre; rounding the distance keeps cards from saying more than that.
 */
export function roundKm(m: number): number {
  return Math.max(1, Math.round(m / 1000));
}

export const SIMILAR_COUNT = 6;

/**
 * «آگهی‌های مشابه» under a listing (wave 1): the newest active listings of the same category in the
 * same city (or country when it has no city), without the listing itself.
 */
export async function similarListings(db: Queryable, l: { id: string; countryCode: string | null; categoryId: string | null; locationId: string | null }, withTest?: boolean): Promise<BrowseItem[]> {
  if (!l.countryCode || !l.categoryId) return [];
  const { items } = await browseListings(
    db,
    { countryCode: l.countryCode, keyword: null, categoryIds: [l.categoryId], locationId: l.locationId, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest', withTest },
    null,
  );
  return items.filter((i) => i.id !== l.id).slice(0, SIMILAR_COUNT);
}

/** Typical prices need this many priced listings, so a hint never rests on two or three */
export const TYPICAL_PRICE_MIN = 8;

/**
 * The filter sheet's hint, «بیشتر اتاق‌های برلین: ۵۰۰ تا ۷۵۰ €» (wave 1): the middle half of the
 * fixed and negotiable prices (25th to 75th percentile, rounded to a nice step) of the active
 * listings in the page's category and city, whatever else is filtered. Null below TYPICAL_PRICE_MIN.
 */
export async function typicalPrice(db: Queryable, f: Pick<SearchFilters, 'countryCode' | 'categoryIds' | 'locationId'>): Promise<{ low: number; high: number } | null> {
  if (!f.categoryIds) return null;
  const [row] = await db.execute<{ n: number; low: number | null; high: number | null }>(sql`
    SELECT count(*)::int AS n,
      percentile_disc(0.25) WITHIN GROUP (ORDER BY ${listings.priceMinor}) AS low,
      percentile_disc(0.75) WITHIN GROUP (ORDER BY ${listings.priceMinor}) AS high
    FROM ${listings}
    WHERE ${and(
      eq(listings.status, 'active'),
      eq(listings.countryCode, f.countryCode),
      hideTest(false, listings.userId),
      inArray(listings.categoryId, f.categoryIds),
      f.locationId ? eq(listings.locationId, f.locationId) : undefined,
      sql`${listings.priceType} IN ('fixed', 'negotiable') AND ${listings.priceMinor} > 0`,
    )}`);
  if (!row || row.n < TYPICAL_PRICE_MIN || row.low == null || row.high == null) return null;
  return { low: niceStep(Number(row.low), 'down'), high: niceStep(Number(row.high), 'up') };
}

/** 487 € → 480 €, 742 € → 750 €: steps of 5, 10, 50, 100… in minor units by size */
export function niceStep(minor: number, dir: 'down' | 'up'): number {
  const step = minor >= 1_000_000 ? 100_000 : minor >= 100_000 ? 5_000 : minor >= 10_000 ? 1_000 : 500;
  return (dir === 'down' ? Math.floor(minor / step) : Math.ceil(minor / step)) * step;
}

/** How many listings match, counted up to COUNT_CAP + 1 */
export async function countListings(db: Queryable, f: SearchFilters): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM ${listings} WHERE ${and(...conditions(f))} LIMIT ${COUNT_CAP + 1}) t`,
  );
  return Number(row?.n ?? 0);
}

/**
 * Active listings by category (the leaf), in a country or one city; the page adds them up the tree.
 * Counts never include test accounts' listings, whoever looks.
 */
export async function categoryCounts(db: Queryable, countryCode: string, locationId: string | null = null): Promise<Map<string, number>> {
  const rows = await db
    .select({ categoryId: listings.categoryId, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(
      and(
        eq(listings.status, 'active'),
        eq(listings.countryCode, countryCode),
        locationId ? eq(listings.locationId, locationId) : undefined,
        notAnEvent,
        hideTest(false, listings.userId),
      ),
    )
    .groupBy(listings.categoryId);
  return new Map(rows.filter((r) => r.categoryId).map((r) => [r.categoryId!, r.n]));
}

/** Active listings per city of a country, for the city links on the country page */
export async function cityCounts(db: Queryable, countryCode: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ locationId: listings.locationId, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.status, 'active'), eq(listings.countryCode, countryCode), notAnEvent, hideTest(false, listings.userId)))
    .groupBy(listings.locationId);
  return new Map(rows.filter((r) => r.locationId).map((r) => [r.locationId!, r.n]));
}

// Counts read every active listing of a country (~30 ms at 50,000 listings, scripts/explain-browse.ts),
// on every page load. Pages take them from a per-process copy that is at most a minute old.
const COUNTS_TTL_MS = 60_000;
const globalForCounts = globalThis as typeof globalThis & { browseCounts?: Map<string, { value: Promise<Map<string, number>>; at: number }> };

export function cachedCounts(key: string, load: () => Promise<Map<string, number>>): Promise<Map<string, number>> {
  const cache = (globalForCounts.browseCounts ??= new Map());
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < COUNTS_TTL_MS) return hit.value;
  const value = load();
  cache.set(key, { value, at: Date.now() });
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

/** categoryCounts, at most a minute old */
export function cachedCategoryCounts(db: Queryable, countryCode: string, locationId: string | null = null) {
  return cachedCounts(`category:${countryCode}:${locationId ?? ''}`, () => categoryCounts(db, countryCode, locationId));
}

/** cityCounts, at most a minute old */
export function cachedCityCounts(db: Queryable, countryCode: string) {
  return cachedCounts(`city:${countryCode}`, () => cityCounts(db, countryCode));
}
