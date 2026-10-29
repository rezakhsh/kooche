import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Queryable } from '../../db/drizzle';
import { locations, savedSearches, users, type NOTIFY_FREQUENCIES } from '../../db/schema';
import type { Point } from '../../db/types';
import { normalizePersian } from '../../lib/normalize-persian';
import { messages } from '../../messages/fa';
import { browsableCategory, subtreeIds, type Catalog, type CategoryNode } from '../listings/catalog';
import { activeCountries, type Country } from '../listings/queries';
import type { SearchFilters } from './browse';
import { browseQuery, defaultSort, filterContext, parseBrowseParams, type BrowseState, type FilterContext } from './filters';
import { browsePath } from './paths';
import { cityOf, postalCenter, type City } from './places';

// Saved searches (approved Oct 22, 2026; docs/schema.md, section 9). A saved search is a browse
// page: its country, city and category, and its canonical filter address (keyword, price, place,
// fields, sort). It is read back through the same parser as the page, so a field retired since
// simply drops out. "Near me" is never saved: the visitor's position is never stored.

export const SAVED_SEARCHES_PER_USER = 20;
/** Saves per user and hour (Valkey, in the action) */
export const SAVES_PER_HOUR = 30;
export const NAME_MAX = 60;

export type Frequency = (typeof NOTIFY_FREQUENCIES)[number];

/** What `saved_searches.filters` holds, checked on every read */
export const savedFiltersSchema = z.object({
  v: z.literal(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  categoryId: z.uuid().nullable(),
  locationId: z.uuid().nullable(),
  /** The page's canonical query ("" or "?…"), without cursor and layout */
  query: z.string().max(2_000).regex(/^(\?.*)?$/),
});
export type SavedFilters = z.infer<typeof savedFiltersSchema>;

/** A browse page as a saved search can hold it */
export type SearchTarget = { country: Country; city: City | null; category: CategoryNode | null; ctx: FilterContext; state: BrowseState };

/**
 * Reads a browse page's address back (the save button posts its path and canonical query), the
 * same way the page does. Null for anything that isn't exactly a page's canonical address.
 */
export async function resolveTarget(db: Queryable, catalog: Catalog, path: string, query: string): Promise<SearchTarget | null> {
  const segments = path.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return '';
    }
  });
  if (segments.length < 1 || segments.length > 3 || segments.some((s) => !/^[a-z0-9-]{1,80}$/.test(s))) return null;
  const country = (await activeCountries(db)).find((c) => c.slug === segments[0]);
  if (!country) return null;
  let city: City | null = null;
  let category: CategoryNode | null = null;
  if (segments[1]) {
    city = await cityOf(db, country.code, segments[1]);
    if (!city) {
      if (segments[2]) return null;
      category = browsableCategory(catalog, segments[1]);
      if (!category) return null;
    }
  }
  if (segments[2]) {
    category = browsableCategory(catalog, segments[2]);
    if (!category) return null;
  }
  const ctx = filterContext(catalog, category, country.currency.minorUnit);
  if (query && !query.startsWith('?')) return null;
  const params = new URLSearchParams(query);
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length > 1 ? all : all[0]!;
  }
  const { state, refused } = parseBrowseParams(raw, ctx);
  if (refused.length || browseQuery(state, ctx.minorUnit) !== query) return null;
  if (city && state.postal) return null;
  return { country, city, category, ctx, state };
}

/** The query a saved search keeps: no cursor, no layout */
function keptQuery(t: SearchTarget): string {
  return browseQuery({ ...t.state, after: null, view: null }, t.ctx.minorUnit);
}

/** Two saves of the same search in another order are one search: the sort is left out */
export function filtersHash(f: SavedFilters, minorUnitState: { state: BrowseState; minorUnit: number }): Buffer {
  const query = browseQuery({ ...minorUnitState.state, after: null, view: null, sort: defaultSort(minorUnitState.state.q) }, minorUnitState.minorUnit);
  return createHash('sha256').update(JSON.stringify([f.v, f.country, f.categoryId, f.locationId, query])).digest();
}

/** A short name from the keyword, the category and the place («پژو ۲۰۶، خودرو، برلین») */
export function autoName(t: SearchTarget): string {
  const place = t.city?.nameFa ?? (t.state.postal ? (t.state.postal.radiusKm ? `${t.state.postal.code} (${t.state.postal.radiusKm.toLocaleString('fa-IR')} km)` : t.state.postal.code) : null);
  const parts = [t.state.q, t.category?.nameFa, place].filter((x): x is string => !!x);
  const name = (parts.length ? parts : [t.country.nameFa]).join('، ');
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name;
}

export type SaveResult = { ok: true; id: string; created: boolean } | { ok: false; reason: 'near_not_saveable' | 'limit' | 'account_disabled' | 'invalid' };

/** Saves the page for the user, or finds the same search saved before */
export async function saveSearch(db: Db, userId: string, t: SearchTarget): Promise<SaveResult> {
  if (t.state.near) return { ok: false, reason: 'near_not_saveable' };
  const filters: SavedFilters = { v: 1, country: t.country.code, categoryId: t.category?.id ?? null, locationId: t.city?.id ?? null, query: keptQuery(t) };
  const hash = filtersHash(filters, { state: t.state, minorUnit: t.ctx.minorUnit });
  // A postal code with a radius keeps the postal area's centre (public, like the listings' points)
  let point: Point | null = null;
  let radiusM: number | null = null;
  if (t.state.postal?.radiusKm) {
    point = await postalCenter(db, t.country.code, t.state.postal.code);
    if (!point) return { ok: false, reason: 'invalid' };
    radiusM = t.state.postal.radiusKm * 1000;
  }

  return db.transaction(async (tx) => {
    // One save at a time per user, so the limit holds
    const [user] = await tx.select({ status: users.status }).from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.status !== 'active') return { ok: false, reason: 'account_disabled' };
    const [same] = await tx
      .select({ id: savedSearches.id })
      .from(savedSearches)
      .where(and(eq(savedSearches.userId, userId), sql`${savedSearches.filtersHash} = ${hash}`));
    if (same) return { ok: true, id: same.id, created: false };
    const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(savedSearches).where(eq(savedSearches.userId, userId))) as [{ n: number }];
    if (n >= SAVED_SEARCHES_PER_USER) return { ok: false, reason: 'limit' };
    const [row] = await tx
      .insert(savedSearches)
      .values({
        userId,
        name: autoName(t),
        filters,
        filtersHash: hash,
        countryCode: t.country.code,
        categoryId: t.category?.id ?? null,
        locationId: t.city?.id ?? null,
        point,
        radiusM,
        keywordNormalized: t.state.q ? normalizePersian(t.state.q) : null,
      })
      .returning({ id: savedSearches.id });
    return { ok: true, id: row!.id, created: true };
  });
}

export type SavedSearchRow = {
  id: string;
  name: string;
  href: string;
  frequency: Frequency;
  createdAt: Date;
};

/** The page address of a saved search, or null when its country, city or category is gone */
export async function savedSearchHrefs(db: Queryable, catalog: Catalog, rows: { id: string; filters: unknown }[]): Promise<Map<string, string>> {
  const countries = await activeCountries(db);
  const parsed = rows.map((r) => ({ id: r.id, f: savedFiltersSchema.safeParse(r.filters) }));
  const cityIds = parsed.flatMap((p) => (p.f.success && p.f.data.locationId ? [p.f.data.locationId] : []));
  const cities = cityIds.length ? await db.select({ id: locations.id, slug: locations.slug }).from(locations).where(inArray(locations.id, cityIds)) : [];
  const citySlug = new Map(cities.map((c) => [c.id, c.slug]));
  const out = new Map<string, string>();
  for (const { id, f } of parsed) {
    if (!f.success) continue;
    const country = countries.find((c) => c.code === f.data.country);
    const category = f.data.categoryId ? catalog.byId.get(f.data.categoryId) : null;
    const city = f.data.locationId ? citySlug.get(f.data.locationId) : null;
    if (!country || category === undefined || city === undefined) continue;
    out.set(id, `${browsePath(country.slug, city ?? null, category?.slug ?? null)}${f.data.query}`);
  }
  return out;
}

/** The user's saved searches, newest first, with their page addresses */
export async function listSavedSearches(db: Queryable, catalog: Catalog, userId: string): Promise<SavedSearchRow[]> {
  const rows = await db
    .select({ id: savedSearches.id, name: savedSearches.name, filters: savedSearches.filters, frequency: savedSearches.notifyFrequency, createdAt: savedSearches.createdAt })
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(sql`${savedSearches.createdAt} DESC`, asc(savedSearches.id));
  const hrefs = await savedSearchHrefs(db, catalog, rows);
  return rows.map((r) => ({ id: r.id, name: r.name ?? messages.savedSearches.all, href: hrefs.get(r.id) ?? '/', frequency: r.frequency, createdAt: r.createdAt }));
}

/** Whether the user has saved this page already (the button shows «ذخیره شده») */
export async function isSaved(db: Queryable, userId: string, t: SearchTarget): Promise<boolean> {
  const filters: SavedFilters = { v: 1, country: t.country.code, categoryId: t.category?.id ?? null, locationId: t.city?.id ?? null, query: keptQuery(t) };
  const hash = filtersHash(filters, { state: t.state, minorUnit: t.ctx.minorUnit });
  const [row] = await db
    .select({ id: savedSearches.id })
    .from(savedSearches)
    .where(and(eq(savedSearches.userId, userId), sql`${savedSearches.filtersHash} = ${hash}`));
  return !!row;
}

export const nameSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(NAME_MAX));
export const frequencySchema = z.enum(['instant', 'daily', 'off']);

/** Renames or changes the alert of one of the user's own saved searches */
export async function updateSavedSearch(db: Queryable, userId: string, id: string, change: { name?: string; frequency?: Frequency }): Promise<boolean> {
  const set: Partial<typeof savedSearches.$inferInsert> = {};
  if (change.name !== undefined) set.name = nameSchema.parse(change.name);
  if (change.frequency !== undefined) set.notifyFrequency = frequencySchema.parse(change.frequency);
  if (!Object.keys(set).length || !z.uuid().safeParse(id).success) return false;
  const rows = await db
    .update(savedSearches)
    .set(set)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
    .returning({ id: savedSearches.id });
  return rows.length === 1;
}

/** Deletes one of the user's own saved searches */
export async function deleteSavedSearch(db: Queryable, userId: string, id: string): Promise<boolean> {
  if (!z.uuid().safeParse(id).success) return false;
  const rows = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
    .returning({ id: savedSearches.id });
  return rows.length === 1;
}

/**
 * A saved search as the filters of its page today (for matching): the stored point for a postal
 * radius, the category with everything under it. Null when the search no longer reads (its
 * country, category or filters went away).
 */
export function searchFiltersOf(
  catalog: Catalog,
  countries: Country[],
  row: { filters: unknown; point: Point | null; radiusM: number | null },
): SearchFilters | null {
  const f = savedFiltersSchema.safeParse(row.filters);
  if (!f.success) return null;
  const country = countries.find((c) => c.code === f.data.country);
  const category = f.data.categoryId ? catalog.byId.get(f.data.categoryId) : null;
  if (!country || category === undefined) return null;
  const ctx = filterContext(catalog, category, country.currency.minorUnit);
  const { state } = parseBrowseParams(Object.fromEntries(new URLSearchParams(f.data.query)), ctx);
  const postal = state.postal;
  return {
    countryCode: country.code,
    keyword: state.q,
    categoryIds: category ? subtreeIds(catalog, category.id) : null,
    locationId: f.data.locationId,
    postalCode: postal && !postal.radiusKm ? postal.code : null,
    around: postal?.radiusKm && row.point && row.radiusM ? { point: row.point, radiusM: row.radiusM } : null,
    price: state.price,
    shipping: state.ship,
    seller: state.seller,
    attributes: state.attributes,
    sort: state.sort === 'distance' ? 'newest' : state.sort,
  };
}

const TOKEN = /^[0-9a-f]{32}$/;

/** The saved search an alert email's "turn off" link names, or null */
export async function searchByUnsubscribeToken(db: Queryable, token: string): Promise<{ id: string; name: string } | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await db.select({ id: savedSearches.id, name: savedSearches.name }).from(savedSearches).where(eq(savedSearches.unsubscribeToken, token));
  return row ? { id: row.id, name: row.name ?? messages.savedSearches.all } : null;
}

/** Turns off the alert of the saved search the link names (no sign-in: the token is the key) */
export async function unsubscribeByToken(db: Queryable, token: string): Promise<{ name: string } | null> {
  if (!TOKEN.test(token)) return null;
  const rows = await db
    .update(savedSearches)
    .set({ notifyFrequency: 'off' })
    .where(eq(savedSearches.unsubscribeToken, token))
    .returning({ name: savedSearches.name });
  return rows[0] ? { name: rows[0].name ?? messages.savedSearches.all } : null;
}
