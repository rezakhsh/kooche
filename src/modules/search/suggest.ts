import { z } from 'zod';
import { normalizePersian } from '../../lib/normalize-persian';
import type { Limit } from '../../lib/rate-limit';
import { ancestry, browsableCategory, type AttributeDef, type Catalog, type CategoryNode } from '../listings/catalog';
import type { SearchFilters } from './browse';
import { browseQuery, cleanKeyword, EMPTY_STATE, filterContext, KEYWORD_MAX_LENGTH, type AttributeFilter } from './filters';
import { meiliFilter } from './keyword';
import { type Meili, type SearchQuery, filterValue } from './meili';
import { browsePath } from './paths';
import { makeModelDefs, optionLabel, phraseScope, type PhraseKind } from './phrases';
import { synonymSettings } from './synonyms';

// Suggestions while typing (approved Oct 22, 2026), like Divar: the box completes what is typed
// with phrases from the phrase index (./phrases.ts), each with its category and how many listings
// its page shows. In order, at most MAX_ROWS:
//   1. «جستجوی "…"»: the keyword in all listings (of the box's country, or its city);
//   2. up to six phrases: categories (their page) and makes and models (the category page
//      filtered by them, exactly, not as a keyword). A category typed first narrows them:
//      «خودرو پژو» only finds Peugeots in خودرو;
//   3. while there is room, the keyword in the categories that have matching listings and no row
//      yet, with the count the keyword page will show (same keyword, same filter).
// Both lookups are one Meilisearch multi-search. When it can't answer (down, or the phrase index
// not built yet), rows 2 come from the category tree in memory, without counts.

export const MIN_CHARS = 2;
/** The search row and six more */
export const MAX_ROWS = 7;
const MAX_IN_CATEGORY = 4;
const PHRASE_HITS = 30;
// Without Meilisearch
const MAX_CATEGORIES = 2;
const MAX_FIELDS = 3;

/** Requests per visitor's IP, apart from the full searches (a box sends one per pause in typing) */
export const SUGGEST_LIMIT: Limit = { name: 'search-suggest:ip', max: 120, windowSeconds: 60 };

/** The API's parameters: the box's country and city slugs and what is typed */
export const suggestParams = z.object({
  country: z.string().regex(/^[a-z-]{2,40}$/),
  city: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  q: z.string().max(KEYWORD_MAX_LENGTH * 2),
});

export type Suggestion =
  | { kind: 'search'; q: string; where: string | null; href: string }
  | { kind: 'category'; label: string; parent: string | null; count: number | null; href: string }
  | { kind: 'field'; label: string; where: string; count: number | null; href: string }
  | { kind: 'in'; q: string; where: string; count: number; href: string };

export type SuggestScope = {
  country: { code: string; slug: string; nameFa: string; minorUnit: number };
  city: { id: string; slug: string; nameFa: string } | null;
};

export type PhraseHit = {
  kind: PhraseKind;
  category_id: string;
  brand: string | null;
  model: string | null;
  label: string;
  count: number;
  _matchesPosition?: Record<string, unknown>;
};

/** What Meilisearch found for the typed text: phrases, and matching listings per leaf category */
export type Found = { phrases: PhraseHit[]; counts: Map<string, number> };

/** Text for matching: normalized, without ZWNJ and spaces, so «لپ‌تاپ», «لپتاپ» and «لپ تاپ» compare equal */
const flat = (s: string) => normalizePersian(s).replace(/[\s‌]+/g, '');

/** The keyword exactly as the keyword page will read it, or null when too short */
export function suggestKeyword(typed: string): string | null {
  const q = cleanKeyword(typed);
  return q && flat(q).length >= MIN_CHARS ? q : null;
}

/** The keyword page's filters for the box's country or city, all categories */
function pageFilters(scope: SuggestScope, q: string): SearchFilters {
  return { countryCode: scope.country.code, keyword: q, categoryIds: null, locationId: scope.city?.id ?? null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'relevance' };
}

/** The two searches: phrases in the scope, and matching listings counted per leaf category */
export function suggestQueries(scope: SuggestScope, q: string, indexes: { listings: string; suggestions: string }): (SearchQuery & { indexUid: string })[] {
  const text = normalizePersian(q);
  return [
    {
      indexUid: indexes.suggestions,
      q: text,
      matchingStrategy: 'all',
      filter: `scope = ${filterValue(phraseScope(scope.country.code, scope.city?.id ?? null))}`,
      limit: PHRASE_HITS,
      showMatchesPosition: true,
      attributesToRetrieve: ['kind', 'category_id', 'brand', 'model', 'label', 'count'],
    },
    { indexUid: indexes.listings, q: text, matchingStrategy: 'all', filter: meiliFilter(pageFilters(scope, q)), limit: 0, facets: ['category_id'] },
  ];
}

export async function findSuggestions(meili: Meili, indexes: { listings: string; suggestions: string }, scope: SuggestScope, q: string): Promise<Found> {
  const [phrases, listings] = await meili.multiSearch(suggestQueries(scope, q, indexes));
  return {
    phrases: (phrases?.hits ?? []) as unknown as PhraseHit[],
    counts: new Map(Object.entries(listings?.facetDistribution?.category_id ?? {})),
  };
}

const isBrowsable = (catalog: Catalog, c: CategoryNode | undefined): c is CategoryNode => !!c && browsableCategory(catalog, c.slug)?.id === c.id;

/** The canonical address of a category page filtered by one option (and its make, for a model) */
function fieldHref(scope: SuggestScope, catalog: Catalog, category: CategoryNode, def: AttributeDef, value: string): string | null {
  const ctx = filterContext(catalog, category, scope.country.minorUnit);
  const chosen: AttributeFilter[] = [];
  const parentValue = def.options.find((o) => o.value === value)?.parentValue ?? null;
  for (const d of ctx.defs) {
    if (d.key === def.key) chosen.push({ key: d.key, type: 'select', values: [value] });
    else if (def.dependsOn === d.key && parentValue) chosen.push({ key: d.key, type: 'select', values: [parentValue] });
  }
  if (!chosen.some((f) => f.key === def.key)) return null;
  return `${browsePath(scope.country.slug, scope.city?.slug ?? null, category.slug)}${browseQuery({ ...EMPTY_STATE, attributes: chosen }, scope.country.minorUnit)}`;
}

const categoryRow = (scope: SuggestScope, catalog: Catalog, c: CategoryNode, count: number | null): Suggestion => ({
  kind: 'category',
  label: c.nameFa,
  parent: (c.parentId && catalog.byId.get(c.parentId)?.nameFa) || null,
  count,
  href: browsePath(scope.country.slug, scope.city?.slug ?? null, c.slug),
});

/** A phrase as a row, or null when its category or field is no longer browsable */
function phraseRow(scope: SuggestScope, catalog: Catalog, h: PhraseHit): Suggestion | null {
  const c = catalog.byId.get(h.category_id);
  if (!isBrowsable(catalog, c)) return null;
  if (h.kind === 'category') return categoryRow(scope, catalog, c, h.count);
  const { brand, model } = makeModelDefs(catalog, c.id);
  const def = h.kind === 'model' ? model : brand;
  const value = h.kind === 'model' ? h.model : h.brand;
  if (!def || !value || !def.options.some((o) => o.value === value)) return null;
  const href = fieldHref(scope, catalog, c, def, value);
  return href ? { kind: 'field', label: h.label, where: c.nameFa, count: h.count, href } : null;
}

/**
 * The rows for what has been typed so far. `found` is null when Meilisearch couldn't answer: the
 * phrases then come from the category tree, without counts, and the keyword rows are left out.
 */
export function suggestions(catalog: Catalog, scope: SuggestScope, typed: string, found: Found | null): Suggestion[] {
  const q = suggestKeyword(typed);
  if (!q) return [];
  const withQ = (path: string) => `${path}?q=${encodeURIComponent(q)}`;
  const rows: Suggestion[] = [{ kind: 'search', q, where: scope.city?.nameFa ?? null, href: withQ(browsePath(scope.country.slug, scope.city?.slug ?? null, null)) }];
  if (!found) return [...rows, ...treeRows(catalog, scope, q)].slice(0, MAX_ROWS);

  // Phrases: a typed word must be in the phrase itself, so typing «خودرو» lists categories, not
  // every make whose category is خودرو
  const shown = new Set<string>();
  for (const h of found.phrases) {
    if (rows.length >= MAX_ROWS) break;
    if (!h._matchesPosition?.phrase && !h._matchesPosition?.latin) continue;
    const row = phraseRow(scope, catalog, h);
    if (!row || rows.some((r) => r.href === row.href)) continue;
    rows.push(row);
    shown.add(h.category_id);
  }

  // The keyword in the categories with the most matching listings that have no row yet, nor a
  // row for a category above them («املاک» offers املاک, not also «املاک در اجاره آپارتمان»)
  const leaves = [...found.counts]
    .map(([id, n]) => [catalog.byId.get(id), n] as const)
    .filter((x): x is readonly [CategoryNode, number] => isBrowsable(catalog, x[0]) && x[1] > 0 && !ancestry(catalog, x[0].id).some((a) => shown.has(a.id)))
    .sort((a, b) => b[1] - a[1] || a[0].nameFa.localeCompare(b[0].nameFa, 'fa'));
  for (const [c, n] of leaves.slice(0, MAX_IN_CATEGORY)) {
    if (rows.length >= MAX_ROWS) break;
    rows.push({ kind: 'in', q, where: c.nameFa, count: n, href: withQ(browsePath(scope.country.slug, scope.city?.slug ?? null, c.slug)) });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Without Meilisearch: categories, makes and models by name, from the category tree in memory
// ---------------------------------------------------------------------------

/** Whether the typed text starts the name or one of its words (normalized, spacing ignored) */
export function nameMatches(name: string, typed: string): boolean {
  const t = flat(typed);
  if (!t) return false;
  const words = normalizePersian(name).split(/[\s‌/،,()-]+/).filter(Boolean);
  return words.some((_, i) => words.slice(i).join('').startsWith(t));
}

/** The typed text and the words that mean the same (whole-word synonyms only) */
function variants(typed: string): string[] {
  const n = normalizePersian(typed);
  return [n, ...(synonymSettings()[n] ?? [])];
}

function treeRows(catalog: Catalog, scope: SuggestScope, q: string): Suggestion[] {
  const words = variants(q);
  const rows: Suggestion[] = [];
  const browsable = [...catalog.byId.values()].filter((c) => isBrowsable(catalog, c));

  // Categories by name, the broader first
  const byName = browsable.filter((c) => words.some((w) => nameMatches(c.nameFa, w))).sort((a, b) => a.path.length - b.path.length);
  for (const c of byName.slice(0, MAX_CATEGORIES)) rows.push(categoryRow(scope, catalog, c, null));

  // Makes before models (a make is the broader page)
  const fields: (Suggestion & { kind: 'field'; model: boolean })[] = [];
  for (const c of browsable.filter((x) => x.childIds.length === 0)) {
    const { brand, model, defs } = makeModelDefs(catalog, c.id);
    for (const def of [brand, model]) {
      if (!def) continue;
      for (const o of def.options) {
        const label = optionLabel(def, o.value, defs);
        // The Persian name, or the Latin key people type from German sites («samsung», «peugeot 206»)
        const latin = o.value.replace(/[_-]+/g, ' ');
        if (!words.some((w) => nameMatches(label, w) || nameMatches(o.labelFa, w) || nameMatches(latin, w))) continue;
        const href = fieldHref(scope, catalog, c, def, o.value);
        if (href) fields.push({ kind: 'field', label, where: c.nameFa, count: null, href, model: def === model });
      }
    }
  }
  fields.sort((a, b) => Number(a.model) - Number(b.model));
  rows.push(...fields.slice(0, MAX_FIELDS).map(({ model: _m, ...f }) => f));
  return rows;
}
