import { z } from 'zod';
import { normalizePersian } from '../../lib/normalize-persian';
import { COUNT_CAP, PAGE_SIZE, type SearchFilters } from './browse';
import { dateNumber } from './documents';
import type { AttributeFilter, Sort } from './filters';
import type { Limit } from '../../lib/rate-limit';
import { filterValue, type Meili, type SearchQuery } from './meili';

// Keyword search with Meilisearch (approved Oct 22, 2026). The filters are the browse page's,
// already validated (filters.ts), translated to Meilisearch's filter syntax with every value
// quoted. Meilisearch returns listing ids in order; the page loads the cards from PostgreSQL
// (browse.ts, cardsByIds). Paging is by offset (a keyword's order isn't a stored key), carried
// in an opaque cursor checked against the sort, up to the index's 1,001 hits.

/** Keyword searches per visitor's IP (pages over it show a notice instead of results) */
export const KEYWORD_LIMIT: Limit = { name: 'search:ip', max: 60, windowSeconds: 60 };

/** The facet name of a filterable field */
export const attrFacet = (key: string) => `attrs.${key}`;

const list = (values: (string | number)[]) => `[${values.map((v) => filterValue(v)).join(', ')}]`;

function attributeFilter(f: AttributeFilter): string {
  const field = attrFacet(f.key);
  switch (f.type) {
    case 'select':
      return `${field} IN ${list(f.values)}`;
    case 'multi_select':
      return f.match === 'all' ? f.values.map((v) => `${field} = ${filterValue(v)}`).join(' AND ') : `${field} IN ${list(f.values)}`;
    case 'boolean':
      return `${field} = true`;
    case 'number':
      return [f.min !== null ? `${field} >= ${f.min}` : null, f.max !== null ? `${field} <= ${f.max}` : null].filter(Boolean).join(' AND ');
    case 'date': {
      const from = f.from === null ? null : dateNumber(f.from);
      const to = f.to === null ? null : dateNumber(f.to);
      return [from !== null ? `${field} >= ${from}` : null, to !== null ? `${field} <= ${to}` : null].filter(Boolean).join(' AND ');
    }
  }
}

/**
 * The filter expression of a search. `omit` leaves out one field, for the counts shown next to
 * that field's own options (they would otherwise only count the chosen ones), or the category
 * together with its fields, for the counts next to the categories. `events` searches the events
 * section instead of the listings.
 */
export function meiliFilter(f: SearchFilters, opts: { omit?: 'category' | string; events?: boolean } = {}): string {
  const parts: string[] = [`country = ${filterValue(f.countryCode)}`, `is_event = ${opts.events ? 'true' : 'false'}`];
  if (!opts.events && f.categoryIds && opts.omit !== 'category') parts.push(`category_id IN ${list(f.categoryIds)}`);
  if (f.locationId) parts.push(`location_id = ${filterValue(f.locationId)}`);
  if (f.postalCode) parts.push(`postal_code = ${filterValue(f.postalCode)}`);
  if (f.around) parts.push(`_geoRadius(${f.around.point.lat}, ${f.around.point.lng}, ${Math.round(f.around.radiusM)})`);
  if (!opts.events) {
    if (f.price?.min != null) parts.push(`price_value >= ${f.price.min}`);
    if (f.price?.max != null) parts.push(`price_value <= ${f.price.max}`);
    if (f.shipping) parts.push('shipping = true');
    if (opts.omit !== 'category') for (const a of f.attributes) if (a.key !== opts.omit) parts.push(`(${attributeFilter(a)})`);
  }
  return parts.join(' AND ');
}

export function meiliSort(sort: Sort, around: SearchFilters['around']): string[] | undefined {
  switch (sort) {
    case 'relevance':
      return undefined;
    case 'newest':
      return ['ranked_at:desc'];
    // Listings without a price have no price_value; Meilisearch puts them last in both orders
    case 'price_asc':
      return ['price_value:asc'];
    case 'price_desc':
      return ['price_value:desc'];
    case 'distance':
      if (!around) throw new Error('distance sort needs a point');
      return [`_geoPoint(${around.point.lat}, ${around.point.lng}):asc`];
  }
}

// ---------------------------------------------------------------------------
// Cursor: base64url of ["k", offset, sort]
// ---------------------------------------------------------------------------

export function encodeOffsetCursor(offset: number, sort: Sort): string {
  return Buffer.from(JSON.stringify(['k', offset, sort])).toString('base64url');
}

const offsetCursor = z.tuple([z.literal('k'), z.number().int().min(PAGE_SIZE).max(COUNT_CAP).multipleOf(PAGE_SIZE), z.string()]);

/** The offset of a keyword cursor, or 0 when it is missing, malformed or from another sort */
export function decodeOffsetCursor(cursor: string | null, sort: Sort): number {
  if (!cursor) return 0;
  try {
    const parsed = offsetCursor.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return parsed.success && parsed.data[2] === sort ? parsed.data[1] : 0;
  } catch {
    return 0;
  }
}

export type KeywordResult = {
  ids: string[];
  next: string | null;
  /** Capped like the browse count: COUNT_CAP + 1 means "more than COUNT_CAP" */
  total: number;
  /** Counts per option: `category_id` (leaf categories) and `attrs.<key>` */
  facets: Record<string, Record<string, number>>;
  /** Matching events of the country (first page only, when asked) */
  eventIds: string[];
};

export const EVENTS_STRIP = 4;

/**
 * One page of a keyword search. With `facetKeys`, also the counts per option of those fields and
 * per category, each without its own filter, in the same request (multi-search).
 */
export async function keywordSearch(
  meili: Meili,
  index: string,
  f: SearchFilters,
  cursor: string | null,
  opts: { facetKeys?: string[]; events?: boolean } = {},
): Promise<KeywordResult> {
  if (!f.keyword) throw new Error('keywordSearch needs a keyword');
  const q = normalizePersian(f.keyword);
  const offset = decodeOffsetCursor(cursor, f.sort);
  const sort = meiliSort(f.sort, f.around);
  const facetKeys = opts.facetKeys ?? [];
  const filtered = new Set(f.attributes.map((a) => a.key));

  const queries: (SearchQuery & { indexUid: string })[] = [
    {
      indexUid: index,
      q,
      matchingStrategy: 'all',
      filter: meiliFilter(f),
      ...(sort ? { sort } : {}),
      offset,
      limit: PAGE_SIZE + 1,
      attributesToRetrieve: ['id'],
      // Fields not filtered yet count within the results as they are
      facets: facetKeys.filter((k) => !filtered.has(k)).map(attrFacet),
    },
  ];
  // Categories counted without the category; each filtered field without its own filter
  const extra: string[] = ['category', ...facetKeys.filter((k) => filtered.has(k))];
  for (const omit of extra) {
    queries.push({ indexUid: index, q, matchingStrategy: 'all', filter: meiliFilter(f, { omit }), limit: 0, facets: [omit === 'category' ? 'category_id' : attrFacet(omit)] });
  }
  const withEvents = !!opts.events && offset === 0;
  if (withEvents) queries.push({ indexUid: index, q, matchingStrategy: 'all', filter: meiliFilter(f, { events: true }), limit: EVENTS_STRIP, attributesToRetrieve: ['id'] });

  const results = await meili.multiSearch(queries);
  const main = results[0]!;
  const facets: Record<string, Record<string, number>> = { ...(main.facetDistribution ?? {}) };
  extra.forEach((_omit, i) => Object.assign(facets, results[i + 1]?.facetDistribution ?? {}));
  const ids = main.hits.map((h) => h.id);
  const hasMore = ids.length > PAGE_SIZE && offset + PAGE_SIZE < COUNT_CAP + 1;
  return {
    ids: ids.slice(0, PAGE_SIZE),
    next: hasMore ? encodeOffsetCursor(offset + PAGE_SIZE, f.sort) : null,
    total: Math.min(main.estimatedTotalHits ?? ids.length, COUNT_CAP + 1),
    facets,
    eventIds: withEvents ? (results.at(-1)?.hits.map((h) => h.id) ?? []) : [],
  };
}

/**
 * Whether one listing would be on a keyword search's page: the same query restricted to its id.
 * Saved-search alerts use it, so an alert means exactly "it shows up in your search".
 */
export async function keywordMatches(meili: Meili, index: string, listingId: string, searches: { id: string; filters: SearchFilters }[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (searches.length === 0) return out;
  const results = await meili.multiSearch(
    searches.map((s) => ({
      indexUid: index,
      q: normalizePersian(s.filters.keyword ?? ''),
      matchingStrategy: 'all',
      filter: `id = ${filterValue(listingId)} AND ${meiliFilter(s.filters)}`,
      limit: 1,
      attributesToRetrieve: ['id'],
    })),
  );
  results.forEach((r, i) => {
    if (r.hits.length) out.add(searches[i]!.id);
  });
  return out;
}
