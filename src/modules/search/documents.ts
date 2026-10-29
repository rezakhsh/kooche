import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { normalizePersian } from '../../lib/normalize-persian';
import { ancestry, effectiveAttributes, type AttributeDef, type Catalog } from '../listings/catalog';
import { STOP_WORDS, synonymSettings } from './synonyms';

// What the listings index holds (docs/setup.md, "Keyword search and saved searches"). PostgreSQL
// stays the source of truth: the index only answers which listing ids match a keyword and in which
// order, and pages load the cards from PostgreSQL. So a document carries what filtering, sorting
// and matching need, never anything shown on a page that isn't already public (no user, no exact
// place: the point is the stored, already rounded one).

export const LISTINGS_INDEX = 'listings';
/** Raised when the document's shape changes, so the worker rebuilds the index at its next start */
export const DOC_VERSION = 4;

export type ListingDocument = {
  id: string;
  v: number;
  country: string;
  category_id: string;
  location_id: string;
  postal_code: string | null;
  _geo: { lat: number; lng: number };
  /** Minor units; free is 0; absent for exchange and on request (they sort last both ways) */
  price_value?: number;
  shipping: boolean;
  /** Posted as a business (wave 2 part 4: the seller filter) */
  business: boolean;
  kind: string;
  is_event: boolean;
  /** Posted by a test account (src/modules/users/test-accounts.ts): found only by staff and test accounts */
  is_test: boolean;
  /** Epoch seconds */
  ranked_at: number;
  /** The category's filterable fields: choices as values, numbers, dates as YYYYMMDD numbers */
  attrs: Record<string, string | string[] | number | boolean>;
  // Searchable, all normalized (src/lib/normalize-persian.ts)
  title: string;
  category_text: string;
  attr_text: string;
  place_text: string;
  description: string;
};

/**
 * The index settings. Every field the app filters or sorts on is declared here and nowhere else;
 * the worker applies them and rebuilds the index when they change (src/worker/search.ts).
 */
export function indexSettings(): Record<string, unknown> {
  const searchable = ['title', 'category_text', 'attr_text', 'place_text', 'description'];
  return {
    searchableAttributes: searchable,
    filterableAttributes: ['id', 'country', 'category_id', 'location_id', 'postal_code', '_geo', 'price_value', 'shipping', 'business', 'kind', 'is_event', 'is_test', 'attrs'],
    sortableAttributes: ['_geo', 'price_value', 'ranked_at'],
    // Meilisearch's defaults, then the newest first among equally good matches
    rankingRules: ['words', 'typo', 'proximity', 'attributeRank', 'sort', 'wordPosition', 'exactness', 'ranked_at:desc'],
    synonyms: synonymSettings(),
    stopWords: STOP_WORDS,
    localizedAttributes: [{ attributePatterns: searchable, locales: ['pes'] }],
    // Lighter indexing: word proximity per field instead of per word position
    proximityPrecision: 'byAttribute',
    facetSearch: false,
    typoTolerance: { enabled: true, disableOnNumbers: true },
    // One more than the page shows as a number («بیش از ۱٬۰۰۰ آگهی»)
    pagination: { maxTotalHits: 1001 },
    // Category counts need one value per leaf category
    faceting: { maxValuesPerFacet: 300 },
    searchCutoffMs: 1500,
  };
}

/** A short stamp of what an index looks like in some code: its record version and settings */
export const codeStamp = (version: number, settings: Record<string, unknown>) =>
  createHash('sha1').update(JSON.stringify([version, settings])).digest('hex').slice(0, 12);

/**
 * The listings index as this code builds it. During a deploy the old and the new worker both take
 * jobs for a moment; a start-up rebuild carries the stamp of the code that asked for it and only
 * code with the same stamp runs it (src/worker/search.ts).
 */
export const indexCode = () => codeStamp(DOC_VERSION, indexSettings());

/** A date field's value as a number with the same order: "2027-03-15" → 20270315, "2027-03" → 20270300 */
export function dateNumber(s: string): number | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  return m ? Number(m[1]) * 10_000 + Number(m[2]) * 100 + (m[3] ? Number(m[3]) : 0) : null;
}

/** The filterable values of a listing, as the index stores them */
export function indexedAttributes(defs: AttributeDef[], values: Record<string, unknown>): ListingDocument['attrs'] {
  const out: ListingDocument['attrs'] = {};
  for (const d of defs) {
    if (!d.isFilterable || d.type === 'text') continue;
    const v = values[d.key];
    if (v === undefined || v === null) continue;
    if (d.type === 'number' && typeof v === 'number' && Number.isFinite(v)) out[d.key] = v;
    else if (d.type === 'date' && typeof v === 'string') {
      const n = dateNumber(v);
      if (n !== null) out[d.key] = n;
    } else if (d.type === 'select' && typeof v === 'string') out[d.key] = v;
    else if (d.type === 'multi_select' && Array.isArray(v)) out[d.key] = v.filter((x): x is string => typeof x === 'string');
    else if (d.type === 'boolean' && typeof v === 'boolean') out[d.key] = v;
  }
  return out;
}

/** Fields whose chosen label is searchable text: what a listing *is*, not how it is described */
const SEARCHABLE_FIELDS = new Set(['brand', 'model']);

/**
 * The Persian names of a listing's make and model (a search for «بنز» finds the make). Not every
 * choice: «بنزین» (petrol) would make every petrol car match «بنز» while it is being typed.
 */
function attributeLabels(defs: AttributeDef[], values: Record<string, unknown>): string {
  const labels: string[] = [];
  for (const d of defs) {
    if (!SEARCHABLE_FIELDS.has(d.key)) continue;
    const v = values[d.key];
    const chosen = d.type === 'select' && typeof v === 'string' ? [v] : d.type === 'multi_select' && Array.isArray(v) ? v : [];
    for (const c of chosen) {
      const label = d.options.find((o) => o.value === c)?.labelFa;
      if (label) labels.push(label);
    }
  }
  return normalizePersian(labels.join(' '));
}

type Row = {
  id: string;
  status: string;
  country_code: string | null;
  category_id: string | null;
  location_id: string | null;
  postal_code: string | null;
  place_name: string | null;
  district_normalized: string | null;
  city_fa: string | null;
  lat: number | null;
  lng: number | null;
  price_type: string;
  price_minor: string | number | null;
  shipping_offered: boolean;
  business: boolean;
  kind: string;
  ranked_at: Date | string | null;
  attributes: Record<string, unknown>;
  title_normalized: string;
  description_normalized: string;
  is_event: boolean;
  is_test: boolean;
};

const SELECT = sql`
  SELECT l.id, l.status, l.country_code, l.category_id, l.location_id, l.postal_code, l.place_name,
         l.district_normalized, loc.name_fa AS city_fa,
         ST_Y(l.point::geometry) AS lat, ST_X(l.point::geometry) AS lng,
         l.price_type, l.price_minor, l.shipping_offered, l.organization_id IS NOT NULL AS business, l.kind, l.ranked_at, l.attributes,
         l.title_normalized, l.description_normalized,
         EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event,
         EXISTS (SELECT 1 FROM users u WHERE u.id = l.user_id AND u.test_account IS NOT NULL) AS is_test
  FROM listings l
  LEFT JOIN locations loc ON loc.id = l.location_id`;

/** Whether a listing belongs in the index: exactly what browse pages and listing pages show */
const indexable = (r: Row) => r.status === 'active' && !!r.country_code && !!r.category_id && !!r.location_id && r.lat !== null && r.lng !== null && r.ranked_at !== null;

export function documentOf(catalog: Catalog, r: Row): ListingDocument {
  const defs = effectiveAttributes(catalog, r.category_id!).filter((d) => d.isActive);
  const price = r.price_type === 'free' ? 0 : r.price_minor === null ? null : Number(r.price_minor);
  return {
    id: r.id,
    v: DOC_VERSION,
    country: r.country_code!,
    category_id: r.category_id!,
    location_id: r.location_id!,
    postal_code: r.postal_code,
    _geo: { lat: Number(r.lat), lng: Number(r.lng) },
    ...(price === null || !['fixed', 'negotiable', 'free'].includes(r.price_type) ? {} : { price_value: price }),
    shipping: r.shipping_offered,
    business: r.business,
    kind: r.kind,
    is_event: r.is_event,
    is_test: r.is_test,
    ranked_at: Math.floor(new Date(r.ranked_at!).getTime() / 1000),
    attrs: indexedAttributes(defs, r.attributes ?? {}),
    title: r.title_normalized,
    category_text: normalizePersian(ancestry(catalog, r.category_id!).map((c) => c.nameFa).join(' ')),
    attr_text: attributeLabels(defs, r.attributes ?? {}),
    place_text: normalizePersian([r.city_fa, r.place_name, r.district_normalized].filter(Boolean).join(' ')),
    description: r.description_normalized,
  };
}

/**
 * The listings as they are now: documents for those that belong in the index, and the ids of the
 * rest (taken down, gone, or never published), which the caller deletes from it.
 */
export async function documentsFor(db: Queryable, catalog: Catalog, ids: string[]): Promise<{ upsert: ListingDocument[]; remove: string[] }> {
  if (ids.length === 0) return { upsert: [], remove: [] };
  const rows = await db.execute<Row>(sql`${SELECT} WHERE l.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
  const upsert = rows.filter(indexable).map((r) => documentOf(catalog, r));
  const kept = new Set(upsert.map((d) => d.id));
  return { upsert, remove: ids.filter((id) => !kept.has(id)) };
}

/** One batch of every indexable listing after `afterId`, in id order (the full reindex) */
export async function documentBatch(db: Queryable, catalog: Catalog, afterId: string | null, limit: number): Promise<{ docs: ListingDocument[]; lastId: string | null }> {
  const rows = await db.execute<Row>(sql`
    ${SELECT}
    WHERE l.status = 'active' ${afterId ? sql`AND l.id > ${afterId}::uuid` : sql``}
    ORDER BY l.id
    LIMIT ${limit}`);
  return { docs: rows.filter(indexable).map((r) => documentOf(catalog, r)), lastId: rows.at(-1)?.id ?? null };
}

/** How many listings the index should hold */
export async function indexableCount(db: Queryable): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM listings WHERE status = 'active'`);
  return Number(row?.n ?? 0);
}
