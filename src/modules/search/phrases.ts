import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { normalizePersian } from '../../lib/normalize-persian';
import { ancestry, browsableCategory, effectiveAttributes, type AttributeDef, type Catalog } from '../listings/catalog';
import type { Meili, Task } from './meili';
import { STOP_WORDS, synonymSettings } from './synonyms';

// The phrase index for suggestions while typing (approved Oct 22, 2026; docs/setup.md, "Keyword
// search and saved searches"), like Divar's prediction and Kleinanzeigen's suggest index: not the
// listings, but the phrases worth suggesting, each with its category and how many active listings
// its page shows. The phrases are
//   - every browsable category, at every level («خودرو»), counting everything under it;
//   - every make in each category where it is a field («پژو» in خودرو);
//   - every make + model («پژو 206»).
// One set per country and one per city that has listings, only phrases with at least one listing.
// Built from one PostgreSQL GROUP BY and swapped in whole (like the listings index): it is small,
// holds nothing that isn't rebuilt from PostgreSQL, and a rebuild that would change nothing is
// skipped.

export const SUGGESTIONS_INDEX = 'suggestions';
/** Raised when the record's shape changes, so the worker rebuilds the index */
export const PHRASE_VERSION = 1;

export type PhraseKind = 'category' | 'make' | 'model';

export type PhraseDocument = {
  id: string;
  v: number;
  /** The country code, or `<country>:<city id>` */
  scope: string;
  kind: PhraseKind;
  category_id: string;
  brand: string | null;
  model: string | null;
  /** As shown («پژو 206») */
  label: string;
  /** Count of active listings on the phrase's page, in this scope */
  count: number;
  /** 0 category, 1 make, 2 model: between equal counts, the broader page first */
  level: number;
  // Searchable: the phrase, its Latin keys («peugeot 206»), the category path; all normalized
  phrase: string;
  latin: string;
  category_text: string;
};

export const phraseScope = (country: string, cityId: string | null) => (cityId ? `${country}:${cityId}` : country);

export function phraseSettings(): Record<string, unknown> {
  const searchable = ['phrase', 'latin', 'category_text'];
  return {
    searchableAttributes: searchable,
    filterableAttributes: ['scope'],
    sortableAttributes: [],
    // Matching first; among equal matches the phrase itself before longer ones («پژو» before
    // «پژو 206»), then the phrases with the most listings, then the broader page
    rankingRules: ['words', 'typo', 'proximity', 'attributeRank', 'exactness', 'count:desc', 'level:asc', 'wordPosition'],
    synonyms: synonymSettings(),
    stopWords: STOP_WORDS,
    localizedAttributes: [{ attributePatterns: ['phrase', 'category_text'], locales: ['pes'] }],
    proximityPrecision: 'byAttribute',
    facetSearch: false,
    typoTolerance: { enabled: true, disableOnNumbers: true },
    pagination: { maxTotalHits: 100 },
    searchCutoffMs: 500,
  };
}

/** Options that mean "anything else" («سایر», «سایر مدل‌ها») are never suggested */
const OTHER = normalizePersian('سایر');
const isOther = (labelFa: string) => normalizePersian(labelFa).startsWith(OTHER);

/** «پژو 206»: a model with its make's name in front, when the model's own name doesn't say it */
export function optionLabel(def: AttributeDef, value: string, defs: AttributeDef[]): string {
  const o = def.options.find((x) => x.value === value)!;
  if (!def.dependsOn || !o.parentValue) return o.labelFa;
  const parent = defs.find((d) => d.key === def.dependsOn)?.options.find((x) => x.value === o.parentValue);
  return parent && !normalizePersian(o.labelFa).includes(normalizePersian(parent.labelFa)) ? `${parent.labelFa} ${o.labelFa}` : o.labelFa;
}

/** The make and model fields a category filters by, if any (the only fields that are phrases) */
export function makeModelDefs(catalog: Catalog, categoryId: string): { brand: AttributeDef | null; model: AttributeDef | null; defs: AttributeDef[] } {
  const defs = effectiveAttributes(catalog, categoryId).filter((d) => d.isActive && d.isFilterable && d.type === 'select');
  const brand = defs.find((d) => d.key === 'brand') ?? null;
  const model = (brand && defs.find((d) => d.key === 'model' && d.dependsOn === 'brand')) || null;
  return { brand, model, defs };
}

const LEVEL: Record<PhraseKind, number> = { category: 0, make: 1, model: 2 };

const latinOf = (value: string) => value.replace(/[_-]+/g, ' ').trim();

type CountRow = { country: string; location: string | null; category: string; brand: string | null; model: string | null; n: number };

/**
 * Active listings grouped by country, city, category, make and model: what the browse pages count
 * (active, not an event; a choice only as a JSON string, as the page's filter matches it).
 */
export async function phraseCounts(db: Queryable): Promise<CountRow[]> {
  const rows = await db.execute<CountRow>(sql`
    SELECT l.country_code AS country, l.location_id AS location, l.category_id AS category,
           CASE WHEN jsonb_typeof(l.attributes -> 'brand') = 'string' THEN l.attributes ->> 'brand' END AS brand,
           CASE WHEN jsonb_typeof(l.attributes -> 'model') = 'string' THEN l.attributes ->> 'model' END AS model,
           count(*)::int AS n
    FROM listings l
    WHERE l.status = 'active' AND l.country_code IS NOT NULL AND l.category_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)
    GROUP BY 1, 2, 3, 4, 5`);
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}

const recordId = (...parts: (string | null)[]) => createHash('sha1').update(parts.map((p) => p ?? '').join('|')).digest('hex').slice(0, 24);

/** The records for those counts, in a stable order */
export function phraseRecords(catalog: Catalog, counts: CountRow[]): PhraseDocument[] {
  const out = new Map<string, PhraseDocument>();
  const pathText = (categoryId: string) => normalizePersian(ancestry(catalog, categoryId).map((c) => c.nameFa).join(' '));

  const add = (scope: string, kind: PhraseKind, categoryId: string, brand: string | null, model: string | null, label: string, latin: string, n: number) => {
    const id = recordId(scope, categoryId, brand, model);
    const have = out.get(id);
    if (have) {
      have.count += n;
      return;
    }
    out.set(id, { id, v: PHRASE_VERSION, scope, kind, category_id: categoryId, brand, model, label, count: n, level: LEVEL[kind], phrase: normalizePersian(label), latin, category_text: pathText(categoryId) });
  };

  for (const r of counts) {
    const leaf = catalog.byId.get(r.category);
    // A category page counts its active subtree: a listing whose category isn't browsable is on none
    if (!leaf || browsableCategory(catalog, leaf.slug)?.id !== leaf.id) continue;
    const scopes = [phraseScope(r.country, null), ...(r.location ? [phraseScope(r.country, r.location)] : [])];
    const chain = ancestry(catalog, leaf.id);
    const { brand, model, defs } = makeModelDefs(catalog, leaf.id);
    const make = brand && r.brand ? brand.options.find((o) => o.value === r.brand && !isOther(o.labelFa)) : undefined;
    const mod = make && model && r.model ? model.options.find((o) => o.value === r.model && o.parentValue === make.value && !isOther(o.labelFa)) : undefined;
    for (const scope of scopes) {
      for (const c of chain) add(scope, 'category', c.id, null, null, c.nameFa, latinOf(c.slug), r.n);
      if (make) add(scope, 'make', leaf.id, make.value, null, make.labelFa, latinOf(make.value), r.n);
      if (make && mod) add(scope, 'model', leaf.id, make.value, mod.value, optionLabel(model!, mod.value, defs), `${latinOf(make.value)} ${latinOf(mod.value)}`, r.n);
    }
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A digest of the records, to skip a rebuild that would change nothing */
export const phraseDigest = (docs: PhraseDocument[]) => createHash('sha1').update(JSON.stringify(docs)).digest('hex');

// What the live index was last built from, per index. Empty after a restart, so the worker's
// first rebuild always runs (and brings new settings and record shapes with it).
const built = new Map<string, string>();

/**
 * Builds `<index>_new` from PostgreSQL and swaps it in, unless the live index exists and was last
 * built from the same records. Returns the number of records, or null when nothing changed.
 */
export async function rebuildPhrases(db: Queryable, meili: Meili, index: string, catalog: Catalog, opts: { force?: boolean } = {}): Promise<number | null> {
  const docs = phraseRecords(catalog, await phraseCounts(db));
  const digest = phraseDigest(docs);
  if (!opts.force && built.get(index) === digest && (await meili.indexStats(index))) return null;

  const next = `${index}_new`;
  if (await meili.indexStats(next)) await meili.wait(await meili.deleteIndex(next));
  await meili.wait(await meili.createIndex(next));
  await meili.wait(await meili.updateSettings(next, phraseSettings()), 120_000);
  let last: Task | null = null;
  for (let i = 0; i < docs.length; i += 1000) last = await meili.addDocuments(next, docs.slice(i, i + 1000));
  if (last) await meili.wait(last, 300_000);
  if (!(await meili.indexStats(index))) await meili.wait(await meili.createIndex(index));
  await meili.wait(await meili.swapIndexes(index, next));
  await meili.wait(await meili.deleteIndex(next));
  built.set(index, digest);
  return docs.length;
}
