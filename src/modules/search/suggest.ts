import { normalizePersian } from '../../lib/normalize-persian';
import { browsableCategory, effectiveAttributes, type AttributeDef, type Catalog, type CategoryNode } from '../listings/catalog';
import { browseQuery, EMPTY_STATE, filterContext, type AttributeFilter } from './filters';
import { filterValue, type Meili } from './meili';
import { browsePath } from './paths';
import { synonymSettings } from './synonyms';

// Suggestions while typing (approved Oct 22, 2026), like Divar and Kleinanzeigen: before any
// full search, the box offers where to look. In order, at most MAX_ROWS:
//   1. the keyword in all listings (of the box's country, or its city);
//   2. the keyword in the categories that have matching listings, most first, with counts
//      (one Meilisearch query that returns counts only, no listings);
//   3. categories whose name matches (synonyms too): the category page itself;
//   4. makes and models whose name matches: the category page filtered by them.
// Rows 3 and 4 come from the category tree in memory, so they still show when Meilisearch is down.

export const MIN_CHARS = 2;
export const MAX_ROWS = 8;
const MAX_IN_CATEGORY = 4;
const MAX_CATEGORIES = 2;
const MAX_FIELDS = 3;

export type Suggestion =
  | { kind: 'search'; q: string; where: string | null; href: string }
  | { kind: 'in'; q: string; where: string; count: number; href: string }
  | { kind: 'category'; label: string; parent: string | null; href: string }
  | { kind: 'field'; label: string; where: string; href: string };

export type SuggestScope = {
  country: { code: string; slug: string; nameFa: string; minorUnit: number };
  city: { id: string; slug: string; nameFa: string } | null;
};

/** Text for matching: normalized, without ZWNJ and spaces, so «لپ‌تاپ», «لپتاپ» and «لپ تاپ» compare equal */
const flat = (s: string) => normalizePersian(s).replace(/[\s‌]+/g, '');

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

const leafCategories = (catalog: Catalog) =>
  [...catalog.byId.values()].filter((c) => c.allowsListings && c.childIds.length === 0 && browsableCategory(catalog, c.slug)?.id === c.id);

/** «پژو ۲۰۶»: a model with its make's name in front, when the model's own name doesn't say it */
function optionLabel(def: AttributeDef, value: string, defs: AttributeDef[]): string {
  const o = def.options.find((x) => x.value === value)!;
  if (!def.dependsOn || !o.parentValue) return o.labelFa;
  const parent = defs.find((d) => d.key === def.dependsOn)?.options.find((x) => x.value === o.parentValue);
  return parent && !normalizePersian(o.labelFa).includes(normalizePersian(parent.labelFa)) ? `${parent.labelFa} ${o.labelFa}` : o.labelFa;
}

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

/** Leaf category id → matching listings, from one Meilisearch query (counts only) */
export async function categoryCounts(meili: Meili, index: string, scope: SuggestScope, q: string): Promise<Map<string, number>> {
  const filter = [`country = ${filterValue(scope.country.code)}`, 'is_event = false', ...(scope.city ? [`location_id = ${filterValue(scope.city.id)}`] : [])].join(' AND ');
  const r = await meili.search(index, { q: normalizePersian(q), matchingStrategy: 'all', filter, limit: 0, facets: ['category_id'] });
  return new Map(Object.entries(r.facetDistribution?.category_id ?? {}));
}

/**
 * The rows for what has been typed so far. `counts` is null when Meilisearch couldn't answer:
 * the "in category" rows are then left out.
 */
export function suggestions(catalog: Catalog, scope: SuggestScope, typed: string, counts: Map<string, number> | null): Suggestion[] {
  const q = typed.replace(/\s+/g, ' ').trim();
  if (flat(q).length < MIN_CHARS) return [];
  const base = browsePath(scope.country.slug, scope.city?.slug ?? null, null);
  const withQ = (path: string) => `${path}?q=${encodeURIComponent(q)}`;
  const rows: Suggestion[] = [{ kind: 'search', q, where: scope.city?.nameFa ?? null, href: withQ(base) }];

  const leaves = leafCategories(catalog);
  const rank = (id: string) => counts?.get(id) ?? 0;

  if (counts) {
    const top = leaves.filter((c) => rank(c.id) > 0).sort((a, b) => rank(b.id) - rank(a.id) || a.nameFa.localeCompare(b.nameFa, 'fa'));
    for (const c of top.slice(0, MAX_IN_CATEGORY)) {
      rows.push({ kind: 'in', q, where: c.nameFa, count: rank(c.id), href: withQ(browsePath(scope.country.slug, scope.city?.slug ?? null, c.slug)) });
    }
  }

  // Categories by name, the typed word's synonyms included; a leaf's parent is shown beside it
  const words = variants(q);
  const seen = new Set<string>();
  const byName = [...catalog.byId.values()]
    .filter((c) => browsableCategory(catalog, c.slug)?.id === c.id && words.some((w) => nameMatches(c.nameFa, w)))
    .sort((a, b) => rank(b.id) - rank(a.id) || a.path.length - b.path.length);
  for (const c of byName.slice(0, MAX_CATEGORIES)) {
    seen.add(c.id);
    const parent = c.parentId ? catalog.byId.get(c.parentId) : undefined;
    rows.push({ kind: 'category', label: c.nameFa, parent: parent?.nameFa ?? null, href: browsePath(scope.country.slug, scope.city?.slug ?? null, c.slug) });
  }

  // Makes and models by name, in the categories that have the most matches first
  const fields: (Suggestion & { kind: 'field'; model: boolean })[] = [];
  const fieldSeen = new Set<string>();
  const ordered = [...leaves].sort((a, b) => rank(b.id) - rank(a.id));
  for (const c of ordered) {
    const defs = effectiveAttributes(catalog, c.id).filter((d) => d.isActive && d.isFilterable && d.type === 'select');
    for (const def of defs) {
      if (def.key !== 'brand' && def.key !== 'model') continue;
      for (const o of def.options) {
        const label = optionLabel(def, o.value, defs);
        // The Persian name, or the Latin key people type from German sites («samsung», «peugeot 206»)
        const latin = o.value.replace(/[_-]+/g, ' ');
        if (!words.some((w) => nameMatches(label, w) || nameMatches(o.labelFa, w) || nameMatches(latin, w))) continue;
        const key = `${c.id}:${def.key}:${o.value}`;
        if (fieldSeen.has(key)) continue;
        fieldSeen.add(key);
        const href = fieldHref(scope, catalog, c, def, o.value);
        if (href) fields.push({ kind: 'field', label, where: c.nameFa, href, model: def.key === 'model' });
      }
    }
  }
  // Makes before models (a make is the broader page), each in the order of the categories' matches
  fields.sort((a, b) => Number(a.model) - Number(b.model));
  rows.push(...fields.slice(0, MAX_FIELDS).map(({ model: _m, ...f }) => f));

  return rows.slice(0, MAX_ROWS);
}

