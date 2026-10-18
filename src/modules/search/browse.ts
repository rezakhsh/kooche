import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { listingImages, listings, locations } from '../../db/schema';
import type { Point } from '../../db/types';
import { coverKeys } from '../listings/queries';
import type { AttributeFilter, Sort } from './filters';

// Browsing without a keyword, straight from PostgreSQL (docs/architecture.md, "Search"): the
// partial browse indexes on active listings, GIN on attributes for choices and yes/no fields,
// GIST on the rounded point for a radius. Keyword search goes to Meilisearch later, behind
// `searchListings` in index.ts, so pages don't change.
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
  attributes: AttributeFilter[];
  sort: Sort;
};

export type BrowseItem = {
  id: string;
  publicToken: string;
  title: string;
  priceType: (typeof listings.$inferSelect)['priceType'];
  priceMinor: number | null;
  currency: string | null;
  categoryId: string | null;
  postalCode: string | null;
  placeName: string | null;
  district: string | null;
  cityFa: string | null;
  publishedAt: Date | null;
  kind: (typeof listings.$inferSelect)['kind'];
  photoCount: number;
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

function conditions(f: SearchFilters): SQL[] {
  const out: (SQL | undefined)[] = [
    eq(listings.status, 'active'),
    eq(listings.countryCode, f.countryCode),
    notAnEvent,
    f.categoryIds ? inArray(listings.categoryId, f.categoryIds) : undefined,
    f.locationId ? eq(listings.locationId, f.locationId) : undefined,
    f.postalCode ? eq(listings.postalCode, f.postalCode) : undefined,
    f.around ? sql`ST_DWithin(${listings.point}, ${geography(f.around.point)}, ${f.around.radiusM})` : undefined,
    f.price ? sql`${listings.priceType} IN ('fixed', 'negotiable', 'free')` : undefined,
    f.price?.min != null ? sql`${priceValue} >= ${f.price.min}` : undefined,
    f.price?.max != null ? sql`${priceValue} <= ${f.price.max}` : undefined,
    f.shipping ? eq(listings.shippingOffered, true) : undefined,
    ...f.attributes.map(attributeCondition),
  ];
  return out.filter((c): c is SQL => !!c);
}

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
      id: listings.id,
      publicToken: listings.publicToken,
      title: listings.title,
      priceType: listings.priceType,
      priceMinor: listings.priceMinor,
      currency: listings.currency,
      categoryId: listings.categoryId,
      postalCode: listings.postalCode,
      placeName: listings.placeName,
      district: listings.district,
      cityFa: locations.nameFa,
      publishedAt: listings.publishedAt,
      kind: listings.kind,
      sortKey: f.sort === 'newest' ? sql<string>`to_char(${listings.rankedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` : sql<number>`${key.expr}`,
      distanceM: f.around ? sql<number>`ST_Distance(${listings.point}, ${geography(f.around.point)})` : sql<null>`NULL`,
      photoCount: sql<number>`(SELECT count(*)::int FROM ${listingImages} WHERE ${listingImages.listingId} = ${listings.id} AND ${listingImages.status} = 'ready')`,
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

/**
 * Whole kilometres, and never under 1. The listing's point is already rounded to ~500 m or a
 * postal-area or city centre; rounding the distance keeps cards from saying more than that.
 */
export function roundKm(m: number): number {
  return Math.max(1, Math.round(m / 1000));
}

/** How many listings match, counted up to COUNT_CAP + 1 */
export async function countListings(db: Queryable, f: SearchFilters): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM ${listings} WHERE ${and(...conditions(f))} LIMIT ${COUNT_CAP + 1}) t`,
  );
  return Number(row?.n ?? 0);
}

/** Active listings by category (the leaf), in a country or one city; the page adds them up the tree */
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
    .where(and(eq(listings.status, 'active'), eq(listings.countryCode, countryCode), notAnEvent))
    .groupBy(listings.locationId);
  return new Map(rows.filter((r) => r.locationId).map((r) => [r.locationId!, r.n]));
}

// Counts read every active listing of a country (~30 ms at 50,000 listings, scripts/explain-browse.ts),
// on every page load. Pages take them from a per-process copy that is at most a minute old.
const COUNTS_TTL_MS = 60_000;
const globalForCounts = globalThis as typeof globalThis & { browseCounts?: Map<string, { value: Promise<Map<string, number>>; at: number }> };

function cachedCounts(key: string, load: () => Promise<Map<string, number>>): Promise<Map<string, number>> {
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
