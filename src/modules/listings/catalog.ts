import { asc } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import {
  categories,
  categoryAttributeOptions,
  categoryAttributes,
  countries,
  currencies,
  type ATTRIBUTE_TYPES,
  type PRICE_MODES,
} from '../../db/schema';

// The category tree with its attribute definitions and the currencies: reference data written
// only by the seed. Loaded in one go (~130 categories, ~120 attributes, ~320 options) and kept in
// the process for 10 minutes, so a seed change shows up within that time. A Valkey copy
// (docs/schema.md, section 5) would save one query per process and add an invalidation path;
// not worth it at this size.

export type AttributeValidation = {
  min?: number;
  max?: number;
  integer?: boolean;
  max_length?: number;
  max_items?: number;
  /** number: an amount in minor units of the listing's currency (CLAUDE.md, money) */
  money?: boolean;
  /** date: month and year only ("2027-03") instead of a day ("2027-03-15") */
  month?: boolean;
  /** Category slugs where a required field is optional (area of a parking space) */
  optional_in?: string[];
  /** multi_select filter: listings must have all chosen values (an equipment checklist); default any */
  filter?: 'all';
};

export type AttributeOption = { value: string; labelFa: string; parentValue: string | null };

export type AttributeDef = {
  key: string;
  type: (typeof ATTRIBUTE_TYPES)[number];
  labelFa: string;
  unitFa: string | null;
  helpFa: string | null;
  validation: AttributeValidation;
  /** Key of the select this one depends on (model → brand) */
  dependsOn: string | null;
  isRequired: boolean;
  /** Offered as a filter on browse pages (src/modules/search/filters.ts) */
  isFilterable: boolean;
  showOnCard: boolean;
  isActive: boolean;
  /** Active options only, in display order */
  options: AttributeOption[];
};

export type CategoryNode = {
  id: string;
  parentId: string | null;
  path: string;
  slug: string;
  nameFa: string;
  icon: string | null;
  allowsListings: boolean;
  priceMode: (typeof PRICE_MODES)[number];
  listingDurationDays: number;
  maxImages: number;
  businessOnly: boolean;
  isActive: boolean;
  /** Active children, in display order */
  childIds: string[];
  /** Defined on this category itself, in display order, retired ones included */
  ownAttributes: AttributeDef[];
};

export type Currency = { code: string; minorUnit: number; nameFa: string; symbol: string };

export type Catalog = {
  byId: Map<string, CategoryNode>;
  bySlug: Map<string, CategoryNode>;
  /** Active roots, in display order */
  rootIds: string[];
  currencies: Map<string, Currency>;
  /** Country code → its currency code: amounts in attributes are in it (decided Oct 17, 2026) */
  countryCurrency: Map<string, string>;
};

export async function loadCatalog(db: Queryable): Promise<Catalog> {
  const [cats, attrs, opts, curr, ctry] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.nameFa)),
    db.select().from(categoryAttributes).orderBy(asc(categoryAttributes.sortOrder)),
    db
      .select()
      .from(categoryAttributeOptions)
      .orderBy(asc(categoryAttributeOptions.sortOrder)),
    db.select().from(currencies),
    db.select({ code: countries.code, defaultCurrency: countries.defaultCurrency }).from(countries),
  ]);

  const optionValueById = new Map(opts.map((o) => [o.id, o.value]));
  const optionsByAttr = new Map<string, AttributeOption[]>();
  for (const o of opts) {
    if (!o.isActive) continue;
    const list = optionsByAttr.get(o.attributeId) ?? [];
    list.push({
      value: o.value,
      labelFa: o.labelFa,
      parentValue: o.parentOptionId ? (optionValueById.get(o.parentOptionId) ?? null) : null,
    });
    optionsByAttr.set(o.attributeId, list);
  }

  const keyById = new Map(attrs.map((a) => [a.id, a.key]));
  const byId = new Map<string, CategoryNode>();
  for (const c of cats) {
    byId.set(c.id, {
      id: c.id,
      parentId: c.parentId,
      path: c.path,
      slug: c.slug,
      nameFa: c.nameFa,
      icon: c.icon,
      allowsListings: c.allowsListings,
      priceMode: c.priceMode,
      listingDurationDays: c.listingDurationDays,
      maxImages: c.maxImages,
      businessOnly: c.businessOnly,
      isActive: c.isActive,
      childIds: [],
      ownAttributes: [],
    });
  }
  const rootIds: string[] = [];
  for (const c of cats) {
    if (!c.isActive) continue;
    if (c.parentId) byId.get(c.parentId)?.childIds.push(c.id);
    else rootIds.push(c.id);
  }
  for (const a of attrs) {
    byId.get(a.categoryId)?.ownAttributes.push({
      key: a.key,
      type: a.type,
      labelFa: a.labelFa,
      unitFa: a.unitFa,
      helpFa: a.helpFa,
      validation: a.validation as AttributeValidation,
      dependsOn: a.dependsOnAttributeId ? (keyById.get(a.dependsOnAttributeId) ?? null) : null,
      isRequired: a.isRequired,
      isFilterable: a.isFilterable,
      showOnCard: a.showOnCard,
      isActive: a.isActive,
      options: optionsByAttr.get(a.id) ?? [],
    });
  }

  return {
    byId,
    bySlug: new Map([...byId.values()].map((c) => [c.slug, c])),
    rootIds,
    currencies: new Map(curr.map((c) => [c.code, c])),
    countryCurrency: new Map(ctry.map((c) => [c.code, c.defaultCurrency])),
  };
}

const TTL_MS = 10 * 60_000;
const globalForCatalog = globalThis as typeof globalThis & {
  catalog?: { value: Promise<Catalog>; at: number };
};

/** The catalog, loaded at most every 10 minutes per process */
export function cachedCatalog(db: Queryable): Promise<Catalog> {
  const cached = globalForCatalog.catalog;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = loadCatalog(db);
  globalForCatalog.catalog = { value, at: Date.now() };
  // A failed load is not cached
  value.catch(() => {
    if (globalForCatalog.catalog?.value === value) globalForCatalog.catalog = undefined;
  });
  return value;
}

/** The currency amounts of a listing are in: its own, else its country's */
export function listingCurrency(
  catalog: Catalog,
  listing: { currency: string | null; countryCode: string | null },
): Currency | undefined {
  const code = listing.currency ?? (listing.countryCode ? catalog.countryCurrency.get(listing.countryCode) : undefined);
  return code ? catalog.currencies.get(code) : undefined;
}

/** Root first, the category itself last */
export function ancestry(catalog: Catalog, categoryId: string): CategoryNode[] {
  const chain: CategoryNode[] = [];
  for (let c = catalog.byId.get(categoryId); c; c = c.parentId ? catalog.byId.get(c.parentId) : undefined) {
    chain.unshift(c);
  }
  return chain;
}

/**
 * The fields a listing in this category has: the definitions of every ancestor and of the
 * category itself (docs/schema.md, section 5), retired ones included so old values still display.
 */
export function effectiveAttributes(catalog: Catalog, categoryId: string): AttributeDef[] {
  const chain = ancestry(catalog, categoryId);
  const slugs = new Set(chain.map((c) => c.slug));
  return chain.flatMap((c) =>
    c.ownAttributes.map((d) =>
      d.isRequired && d.validation.optional_in?.some((s) => slugs.has(s)) ? { ...d, isRequired: false } : d,
    ),
  );
}

/** Root of the events section (src/modules/events/): its leaves are the event types */
export const EVENT_ROOT_SLUG = 'events-calendar';

/** Whether a category belongs to the events section, whose listings are events */
export function isEventCategory(catalog: Catalog, categoryId: string | null | undefined): boolean {
  if (!categoryId) return false;
  return ancestry(catalog, categoryId)[0]?.slug === EVENT_ROOT_SLUG;
}

/** A category and everything under it */
export function subtreeIds(catalog: Catalog, id: string): string[] {
  return [id, ...(catalog.byId.get(id)?.childIds ?? []).flatMap((c) => subtreeIds(catalog, c))];
}

/** A category browse pages show: active up to its root, and not part of the events section */
export function browsableCategory(catalog: Catalog, slug: string): CategoryNode | null {
  const c = catalog.bySlug.get(slug);
  if (!c || isEventCategory(catalog, c.id)) return null;
  return ancestry(catalog, c.id).every((x) => x.isActive) ? c : null;
}

/** A category new listings may use: an active leaf whose ancestors are active too */
export function isPostable(catalog: Catalog, categoryId: string): boolean {
  const chain = ancestry(catalog, categoryId);
  const leaf = chain.at(-1);
  return !!leaf && leaf.id === categoryId && leaf.allowsListings && chain.every((c) => c.isActive);
}
