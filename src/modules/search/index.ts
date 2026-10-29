import type { Queryable } from '../../db/drizzle';
import type { Point } from '../../db/types';
import { browseListings, cardsByIds, countListings, type BrowseItem, type SearchFilters } from './browse';
import { LISTINGS_INDEX } from './documents';
import type { BrowseState } from './filters';
import { keywordSearch } from './keyword';
import type { Meili } from './meili';
import { readNearToken } from './near';
import { nearestCity, postalCenter, postalLabel } from './places';

// The search module's interface for pages (docs/setup.md, decision 7, and "Keyword search and
// saved searches"): without a keyword every query is a browse query on PostgreSQL; with one,
// `searchListings` asks Meilisearch for the ids and loads the cards from PostgreSQL. If
// Meilisearch is unset or fails, the keyword goes to PostgreSQL instead and the page says so.

export type { SearchFilters } from './browse';

/** A point further than this from every city of the country is "not in this country" */
const IN_COUNTRY_M = 100_000;

export type PlaceNotice = 'near_expired' | 'near_invalid' | 'near_outside' | 'postal_unknown';

export type ResolvedPlace =
  | { kind: 'postal'; code: string; label: string | null; radiusKm: number | null }
  | { kind: 'near'; radiusKm: number }
  | null;

/**
 * Turns the page's state into SearchFilters: the postal code's centre, the "near me" token's grid
 * cell. A token that expired, was changed, or points outside the country is dropped with a notice
 * for the page, which then shows the listings without it.
 */
export async function resolveFilters(
  db: Queryable,
  opts: { countryCode: string; categoryIds: string[] | null; locationId: string | null; state: BrowseState; secret: string; withTest?: boolean },
): Promise<{ filters: SearchFilters; place: ResolvedPlace; notice: PlaceNotice | null; state: BrowseState }> {
  let state = opts.state;
  let notice: PlaceNotice | null = null;
  let around: { point: Point; radiusM: number } | null = null;
  let postalCode: string | null = null;
  let place: ResolvedPlace = null;

  if (state.near) {
    const read = readNearToken(opts.secret, state.near.token);
    if (!read.ok) notice = read.reason === 'expired' ? 'near_expired' : 'near_invalid';
    else if (!(await nearestCity(db, opts.countryCode, read.point, IN_COUNTRY_M))) notice = 'near_outside';
    else {
      around = { point: read.point, radiusM: state.near.radiusKm * 1000 };
      place = { kind: 'near', radiusKm: state.near.radiusKm };
    }
    if (notice) state = { ...state, near: null, after: null, sort: state.sort === 'distance' ? 'newest' : state.sort };
  } else if (state.postal) {
    const center = await postalCenter(db, opts.countryCode, state.postal.code);
    if (!center) {
      notice = 'postal_unknown';
      state = { ...state, postal: null, after: null, sort: state.sort === 'distance' ? 'newest' : state.sort };
    } else {
      if (state.postal.radiusKm) around = { point: center, radiusM: state.postal.radiusKm * 1000 };
      else postalCode = state.postal.code;
      place = { kind: 'postal', code: state.postal.code, label: await postalLabel(db, opts.countryCode, state.postal.code), radiusKm: state.postal.radiusKm };
    }
  }

  return {
    filters: {
      countryCode: opts.countryCode,
      keyword: state.q,
      categoryIds: opts.categoryIds,
      // A radius crosses city borders, so it replaces the city
      locationId: around || postalCode ? null : opts.locationId,
      postalCode,
      around,
      price: state.price,
      shipping: state.ship,
      seller: state.seller,
      attributes: state.attributes,
      sort: state.sort,
      withTest: opts.withTest,
    },
    place,
    notice,
    state,
  };
}

export type SearchResult = {
  items: BrowseItem[];
  next: string | null;
  /** Capped at COUNT_CAP + 1 */
  total: number;
  /** Keyword searches through Meilisearch: counts per category (`category_id`) and option (`attrs.<key>`) */
  facets: Record<string, Record<string, number>> | null;
  /** Keyword searches through Meilisearch: matching events of the country, first page only */
  eventIds: string[];
  /** The keyword went to PostgreSQL because Meilisearch failed */
  fallback: boolean;
};

export type SearchOptions = {
  meili?: Meili | null;
  index?: string;
  /** Fields whose options show counts (keyword searches only) */
  facetKeys?: string[];
  /** Also look for matching events */
  events?: boolean;
};

/** One page of listings and the total (capped), for a browse or a keyword query */
export async function searchListings(db: Queryable, filters: SearchFilters, cursor: string | null, opts: SearchOptions = {}): Promise<SearchResult> {
  if (filters.keyword && opts.meili) {
    try {
      const r = await keywordSearch(opts.meili, opts.index ?? LISTINGS_INDEX, filters, cursor, { facetKeys: opts.facetKeys, events: opts.events });
      return { items: await cardsByIds(db, r.ids, filters.around, filters.withTest), next: r.next, total: r.total, facets: r.facets, eventIds: r.eventIds, fallback: false };
    } catch (e) {
      console.error('search: keyword search failed, using PostgreSQL:', e instanceof Error ? e.message : e);
      return { ...(await postgresSearch(db, { ...filters, sort: filters.sort === 'relevance' ? 'newest' : filters.sort }, null)), fallback: true };
    }
  }
  return { ...(await postgresSearch(db, filters, cursor)), fallback: !!filters.keyword };
}

async function postgresSearch(db: Queryable, filters: SearchFilters, cursor: string | null) {
  const [page, total] = await Promise.all([browseListings(db, filters, cursor), countListings(db, filters)]);
  return { ...page, total, facets: null, eventIds: [] };
}
