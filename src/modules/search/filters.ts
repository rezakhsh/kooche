import { z } from 'zod';
import { normalizePersian } from '../../lib/normalize-persian';
import { effectiveAttributes, type AttributeDef, type Catalog, type CategoryNode } from '../listings/catalog';
import { amountInputValue, MAX_PRICE_MINOR, parseAmount } from '../listings/price';

// Browse filters (approved Oct 18, 2026): price, place and the category's own fields marked
// filterable in category_attributes, never hard-coded per category. They live in the address in a
// short canonical form, so a filtered page can be shared:
//
//   /germany/berlin/cars?sort=price_asc&price=..15000&brand=bmw,audi&year=2015..&mileage_km=..100000
//
// - a range is `a..b`, `a..` or `..b` (numbers, amounts in whole currency units, dates);
// - several choices are comma-separated, in the order of the field's options;
// - a yes/no field is `=1`.
// A plain GET form (no JavaScript) sends `year_min=2015&year_max=`, repeated checkboxes and empty
// fields; the page rewrites that into the canonical form with one redirect. Anything that doesn't
// fit a filterable field of the category is refused and dropped, so it never reaches SQL.

export const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'distance'] as const;
export type Sort = (typeof SORTS)[number];

/** Best matches first with a keyword, newest first without one */
export const defaultSort = (q: string | null): Sort => (q ? 'relevance' : 'newest');

/** A keyword is cut to this many characters and words */
export const KEYWORD_MAX_LENGTH = 100;
export const KEYWORD_MAX_WORDS = 10;

/**
 * The keyword as the address keeps it: the visitor's own spelling, trimmed, spaces collapsed, at
 * most KEYWORD_MAX_WORDS words and KEYWORD_MAX_LENGTH characters. Null when nothing searchable is
 * left (normalizing removes marks and invisible characters).
 */
export function cleanKeyword(raw: string): string | null {
  const words = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, KEYWORD_MAX_WORDS);
  let q = words.join(' ');
  if (q.length > KEYWORD_MAX_LENGTH) q = q.slice(0, KEYWORD_MAX_LENGTH).replace(/\s+\S*$/, '') || q.slice(0, KEYWORD_MAX_LENGTH);
  return normalizePersian(q) ? q : null;
}

export const RADII_KM = [5, 10, 25, 50] as const;
export type RadiusKm = (typeof RADII_KM)[number];

/** Parameters the browse pages use themselves; no attribute key may take them (seed check) */
export const RESERVED_PARAMS = ['sort', 'price', 'ship', 'postal', 'near', 'r', 'after', 'view', 'q', 'page', 'category', 'city'];
/** Suffixes of the form's range inputs (`year_min`), also kept out of attribute keys */
export const RANGE_SUFFIXES = ['_min', '_max', '_from', '_to'];

/** At most this many values per field, and fields per address */
const MAX_VALUES = 20;
const MAX_PARAMS = 60;
const MAX_VALUE_LENGTH = 400;

export type AttributeFilter =
  | { key: string; type: 'number'; min: number | null; max: number | null; money: boolean }
  | { key: string; type: 'date'; from: string | null; to: string | null }
  | { key: string; type: 'select'; values: string[] }
  | { key: string; type: 'multi_select'; values: string[]; match: 'any' | 'all' }
  | { key: string; type: 'boolean' };

export type BrowseState = {
  /** Keyword (src/modules/search/keyword.ts), as typed; null browses without one */
  q: string | null;
  sort: Sort;
  /** Minor units of the country's currency */
  price: { min: number | null; max: number | null } | null;
  /** Only listings that offer shipping */
  ship: boolean;
  /** A postal code; radius null is "this postal code only" */
  postal: { code: string; radiusKm: RadiusKm | null } | null;
  /** "Near me": an encrypted, short-lived token (src/modules/search/near.ts) */
  near: { token: string; radiusKm: RadiusKm } | null;
  /** In the order of the category's fields */
  attributes: AttributeFilter[];
  view: 'grid' | 'list' | null;
  /** Keyset cursor (src/modules/search/browse.ts), checked against the sort there */
  after: string | null;
};

export const EMPTY_STATE: BrowseState = {
  q: null,
  sort: 'newest',
  price: null,
  ship: false,
  postal: null,
  near: null,
  attributes: [],
  view: null,
  after: null,
};

export type FilterContext = {
  /** The filterable fields of the page's category (`filterableAttributes`) */
  defs: AttributeDef[];
  /** Minor unit of the country's currency, for prices and amounts */
  minorUnit: number;
  /** False where the category has no prices (price_mode none) */
  priceAllowed: boolean;
};

/**
 * The fields a browse page offers as filters: active, filterable and not free text. For a leaf,
 * all of its fields; for a parent category, only those every listing under it has (defined on the
 * category or above). No category: none.
 */
export function filterableAttributes(catalog: Catalog, category: CategoryNode | null): AttributeDef[] {
  if (!category) return [];
  return effectiveAttributes(catalog, category.id).filter((d) => d.isActive && d.isFilterable && d.type !== 'text');
}

/** The filter context of a category page */
export function filterContext(catalog: Catalog, category: CategoryNode | null, minorUnit: number): FilterContext {
  return { defs: filterableAttributes(catalog, category), minorUnit, priceAllowed: category?.priceMode !== 'none' };
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const DATE_RE = { day: /^(\d{4})-(\d{2})-(\d{2})$/, month: /^(\d{4})-(\d{2})$/ };

function isDate(s: string, month: boolean): boolean {
  const m = (month ? DATE_RE.month : DATE_RE.day).exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), month ? 1 : Number(m[3])];
  if (y < 1900 || y > 2100) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** "a..b" → [a, b] with empty ends as null; anything else (no "..", three parts) → null */
function splitRange(s: string): [string | null, string | null] | null {
  const parts = s.split('..');
  if (parts.length !== 2) return null;
  const [a, b] = parts.map((p) => p.trim()) as [string, string];
  if (!a && !b) return null;
  return [a || null, b || null];
}

function numberValue(s: string, def: AttributeDef): number | null {
  const t = normalizePersian(s).replace('٫', '.');
  if (!/^-?\d{1,12}(\.\d{1,6})?$/.test(t)) return null;
  const n = Number(t);
  const v = def.validation;
  if (v.integer && !Number.isInteger(n)) return null;
  if (v.min !== undefined && n < v.min) return null;
  if (v.max !== undefined && n > v.max) return null;
  return n;
}

function amountValue(s: string, minorUnit: number): number | null {
  const n = parseAmount(s, minorUnit);
  return n !== null && n <= MAX_PRICE_MINOR ? n : null;
}

const refused = (ctx: z.RefinementCtx) => {
  ctx.addIssue({ code: 'custom', message: 'refused' });
  return z.NEVER;
};

const rangeOrdered = (a: number | string | null, b: number | string | null) => a === null || b === null || a <= b;

/** Parses one field's canonical value into a filter, or refuses it */
export function attributeParamSchema(def: AttributeDef, minorUnit: number): z.ZodType<AttributeFilter, string> {
  const base = z.string().max(MAX_VALUE_LENGTH);
  switch (def.type) {
    case 'number':
      return base.transform((s, ctx): AttributeFilter => {
        const r = splitRange(s);
        if (!r) return refused(ctx);
        const money = !!def.validation.money;
        const parse = (x: string | null) => (x === null ? null : money ? amountValue(x, minorUnit) : numberValue(x, def));
        const [min, max] = [parse(r[0]), parse(r[1])];
        if ((r[0] !== null && min === null) || (r[1] !== null && max === null) || !rangeOrdered(min, max)) return refused(ctx);
        return { key: def.key, type: 'number', min, max, money };
      });
    case 'date':
      return base.transform((s, ctx): AttributeFilter => {
        const r = splitRange(s);
        const month = !!def.validation.month;
        if (!r || r.some((x) => x !== null && !isDate(x, month)) || !rangeOrdered(r[0], r[1])) return refused(ctx);
        return { key: def.key, type: 'date', from: r[0], to: r[1] };
      });
    case 'select':
    case 'multi_select': {
      const order = new Map(def.options.map((o, i) => [o.value, i]));
      return base.transform((s, ctx): AttributeFilter => {
        const values = [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];
        if (values.length === 0 || values.length > MAX_VALUES || values.some((x) => !order.has(x))) return refused(ctx);
        values.sort((a, b) => order.get(a)! - order.get(b)!);
        return def.type === 'select'
          ? { key: def.key, type: 'select', values }
          : { key: def.key, type: 'multi_select', values, match: def.validation.filter === 'all' ? 'all' : 'any' };
      });
    }
    case 'boolean':
      return base.transform((s, ctx): AttributeFilter => (s === '1' ? { key: def.key, type: 'boolean' } : refused(ctx)));
    case 'text':
      return base.transform((_s, ctx): AttributeFilter => refused(ctx));
  }
}

const sortSchema = z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'distance']);
const keywordSchema = z.string().max(1_000).transform((s, ctx) => cleanKeyword(s) ?? refused(ctx));
const radiusSchema = z.enum(RADII_KM.map(String) as [string, ...string[]]).transform((s) => Number(s) as RadiusKm);
const postalSchema = z
  .string()
  .transform((s) => normalizePersian(s).trim().toUpperCase().replace(/\s+/g, ' '))
  .pipe(z.string().regex(/^[0-9A-Z][0-9A-Z -]{1,9}$/));
/** base64url of the encrypted point; its contents are checked by near.ts */
const nearTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,200}$/);
const cursorSchema = z.string().regex(/^[A-Za-z0-9_-]{8,200}$/);
const viewSchema = z.enum(['grid', 'list']);

/**
 * The whole filter address of a page as one strict Zod object: every parameter the page accepts,
 * nothing else. `parseBrowseParams` uses its fields one by one, so one bad value drops only itself.
 */
export function browseParamsSchema(ctx: FilterContext) {
  const attrs = Object.fromEntries(ctx.defs.map((d) => [d.key, attributeParamSchema(d, ctx.minorUnit).optional()]));
  return z.strictObject({
    q: keywordSchema.optional(),
    sort: sortSchema.optional(),
    price: (ctx.priceAllowed
      ? z.string().max(MAX_VALUE_LENGTH).transform((s, c) => {
          const r = splitRange(s);
          if (!r) return refused(c);
          const [min, max] = r.map((x) => (x === null ? null : amountValue(x, ctx.minorUnit)));
          if ((r[0] !== null && min === null) || (r[1] !== null && max === null) || !rangeOrdered(min!, max!)) return refused(c);
          return { min: min!, max: max! };
        })
      : z.never()
    ).optional(),
    ship: z.literal('1').optional(),
    postal: postalSchema.optional(),
    near: nearTokenSchema.optional(),
    r: radiusSchema.optional(),
    view: viewSchema.optional(),
    after: cursorSchema.optional(),
    ...attrs,
  });
}

export type RawParams = Record<string, string | string[] | undefined>;

/**
 * Reads a page's query parameters. Returns the state and the parameters that were refused
 * (unknown, not filterable here, invalid values, a distance sort without a place). Empty values
 * are simply dropped. The page redirects to `browseQuery(state)` whenever the address differs.
 */
export function parseBrowseParams(raw: RawParams, ctx: FilterContext): { state: BrowseState; refused: string[] } {
  const refusedKeys: string[] = [];
  const entries = Object.entries(raw).filter(([, v]) => v !== undefined) as [string, string | string[]][];
  if (entries.length > MAX_PARAMS) return { state: { ...EMPTY_STATE }, refused: entries.map(([k]) => k) };

  // Fold the form's range inputs (`year_min`, `available_from_to`) and repeated checkboxes into
  // the canonical one-value form
  const defsByKey = new Map(ctx.defs.map((d) => [d.key, d]));
  const values = new Map<string, string>();
  const ranges = new Map<string, [string, string]>();
  for (const [key, v] of entries) {
    const list = (Array.isArray(v) ? v : [v]).map((x) => x.trim()).filter(Boolean);
    const suffix = RANGE_SUFFIXES.find((s) => key.endsWith(s));
    const base = suffix ? key.slice(0, -suffix.length) : null;
    const baseDef = base ? defsByKey.get(base) : undefined;
    const isRangeInput =
      suffix &&
      ((base === 'price' && (suffix === '_min' || suffix === '_max')) ||
        (baseDef?.type === 'number' && (suffix === '_min' || suffix === '_max')) ||
        (baseDef?.type === 'date' && (suffix === '_from' || suffix === '_to')));
    if (isRangeInput) {
      if (list.length > 1) {
        refusedKeys.push(key);
        continue;
      }
      const r = ranges.get(base!) ?? ['', ''];
      r[suffix === '_min' || suffix === '_from' ? 0 : 1] = list[0] ?? '';
      ranges.set(base!, r);
      continue;
    }
    if (list.length === 0) continue;
    if (list.length > MAX_VALUES) {
      refusedKeys.push(key);
      continue;
    }
    values.set(key, list.join(','));
  }
  for (const [base, [a, b]] of ranges) {
    if (a || b) values.set(base, `${a}..${b}`);
    else values.delete(base);
  }

  const shape = browseParamsSchema(ctx).shape as Record<string, z.ZodType>;
  const parsed: Record<string, unknown> = {};
  for (const [key, v] of values) {
    const field = Object.hasOwn(shape, key) ? shape[key] : undefined;
    const result = field?.safeParse(v);
    if (!result?.success || result.data === undefined) {
      refusedKeys.push(key);
      continue;
    }
    parsed[key] = result.data;
  }

  const state: BrowseState = { ...EMPTY_STATE, attributes: [] };
  state.q = (parsed.q as string | undefined) ?? null;
  state.sort = defaultSort(state.q);
  if (parsed.price) state.price = parsed.price as BrowseState['price'];
  state.ship = parsed.ship === '1';
  const radius = (parsed.r as RadiusKm | undefined) ?? null;
  if (parsed.near) {
    state.near = { token: parsed.near as string, radiusKm: radius ?? 10 };
    if (parsed.postal) refusedKeys.push('postal');
  } else if (parsed.postal) {
    state.postal = { code: parsed.postal as string, radiusKm: radius };
  } else if (parsed.r !== undefined) {
    refusedKeys.push('r');
  }
  const sort = parsed.sort as Sort | undefined;
  if (sort === 'distance' && !state.near && !state.postal?.radiusKm) refusedKeys.push('sort');
  else if (sort === 'relevance' && !state.q) refusedKeys.push('sort');
  else if ((sort === 'price_asc' || sort === 'price_desc') && !ctx.priceAllowed) refusedKeys.push('sort');
  else if (sort) state.sort = sort;
  state.view = (parsed.view as BrowseState['view']) ?? null;
  state.after = (parsed.after as string | undefined) ?? null;

  // Fields in definition order. A dependent select (model) needs its parent (brand) chosen, and
  // keeps only values that belong to a chosen parent.
  const chosen = new Map<string, AttributeFilter>();
  for (const def of ctx.defs) {
    const f = parsed[def.key] as AttributeFilter | undefined;
    if (!f) continue;
    if (def.dependsOn && (f.type === 'select' || f.type === 'multi_select')) {
      const parent = chosen.get(def.dependsOn);
      const parentValues = parent && 'values' in parent ? new Set(parent.values) : null;
      const kept = parentValues
        ? f.values.filter((v) => {
            const p = def.options.find((o) => o.value === v)?.parentValue;
            return !p || parentValues.has(p);
          })
        : [];
      if (kept.length === 0) {
        refusedKeys.push(def.key);
        continue;
      }
      if (kept.length !== f.values.length) refusedKeys.push(def.key);
      chosen.set(def.key, { ...f, values: kept });
      continue;
    }
    chosen.set(def.key, f);
  }
  state.attributes = ctx.defs.map((d) => chosen.get(d.key)).filter((f): f is AttributeFilter => !!f);
  return { state, refused: [...new Set(refusedKeys)] };
}

// ---------------------------------------------------------------------------
// Writing the address
// ---------------------------------------------------------------------------

const rangeText = (a: string | null, b: string | null) => `${a ?? ''}..${b ?? ''}`;

function attributeValue(f: AttributeFilter, minorUnit: number): string {
  switch (f.type) {
    case 'number': {
      const fmt = (n: number | null) => (n === null ? null : f.money ? amountInputValue(n, minorUnit) : String(n));
      return rangeText(fmt(f.min), fmt(f.max));
    }
    case 'date':
      return rangeText(f.from, f.to);
    case 'select':
    case 'multi_select':
      return f.values.join(',');
    case 'boolean':
      return '1';
  }
}

/**
 * The canonical query string of a state ("" or "?…"), in a fixed order: sort, place, price,
 * shipping, fields in definition order, view, cursor. Reading it back gives the same state.
 */
export function browseQuery(state: BrowseState, minorUnit: number): string {
  const q: [string, string][] = [];
  if (state.q) q.push(['q', state.q]);
  if (state.sort !== defaultSort(state.q)) q.push(['sort', state.sort]);
  if (state.near) {
    q.push(['near', state.near.token], ['r', String(state.near.radiusKm)]);
  } else if (state.postal) {
    q.push(['postal', state.postal.code]);
    if (state.postal.radiusKm) q.push(['r', String(state.postal.radiusKm)]);
  }
  if (state.price) {
    const fmt = (n: number | null) => (n === null ? null : amountInputValue(n, minorUnit));
    q.push(['price', rangeText(fmt(state.price.min), fmt(state.price.max))]);
  }
  if (state.ship) q.push(['ship', '1']);
  for (const f of state.attributes) q.push([f.key, attributeValue(f, minorUnit)]);
  if (state.view) q.push(['view', state.view]);
  if (state.after) q.push(['after', state.after]);
  if (q.length === 0) return '';
  // Commas and dots stay readable; everything else is encoded as usual
  return `?${q.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',')}`).join('&')}`;
}

/** The query string as the browser sent it, in the same encoding, to compare with the canonical one */
export function currentQuery(raw: RawParams): string {
  const q: string[] = [];
  for (const [k, v] of Object.entries(raw)) {
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) {
      q.push(`${encodeURIComponent(k)}=${encodeURIComponent(x).replace(/%2C/g, ',')}`);
    }
  }
  return q.length ? `?${q.join('&')}` : '';
}

/** Whether the state narrows the listings (anything beyond sort, layout and paging; the keyword too) */
export function isFiltered(state: BrowseState): boolean {
  return !!(state.q || state.price || state.ship || state.postal || state.near || state.attributes.length);
}

/**
 * The same state with one filter (or all of them) taken out, back on the first page. `defs` lets a
 * dependent field (model) go with its parent (brand).
 */
export function without(
  state: BrowseState,
  what: 'all' | 'q' | 'price' | 'ship' | 'place' | { key: string; value?: string },
  defs: AttributeDef[] = [],
): BrowseState {
  const next: BrowseState = { ...state, after: null };
  // "Clear filters" keeps the keyword: it is the search itself, and has a chip of its own
  if (what === 'all') return { ...EMPTY_STATE, q: state.q, view: state.view, sort: state.sort === 'distance' ? defaultSort(state.q) : state.sort };
  if (what === 'q') {
    next.q = null;
    if (next.sort === 'relevance') next.sort = 'newest';
  } else if (what === 'price') next.price = null;
  else if (what === 'ship') next.ship = false;
  else if (what === 'place') {
    next.postal = null;
    next.near = null;
    if (next.sort === 'distance') next.sort = defaultSort(next.q);
  } else {
    next.attributes = state.attributes.flatMap((f) => {
      if (f.key !== what.key) return [f];
      if (what.value === undefined || !('values' in f)) return [];
      const values = f.values.filter((v) => v !== what.value);
      return values.length ? [{ ...f, values }] : [];
    });
    // A model without its brand means nothing
    const parentOf = new Map(defs.filter((d) => d.dependsOn).map((d) => [d.key, d.dependsOn!]));
    const left = new Set(next.attributes.map((f) => f.key));
    next.attributes = next.attributes.filter((f) => !parentOf.has(f.key) || left.has(parentOf.get(f.key)!));
  }
  return next;
}
