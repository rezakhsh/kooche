import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { cache } from 'react';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { browsableCategory, cachedCatalog, EVENT_ROOT_SLUG, isEventCategory, subtreeIds, type Catalog, type CategoryNode } from '../../../modules/listings/catalog';
import { activeCountries, type Country } from '../../../modules/listings/queries';
import { resolveFilters, type PlaceNotice, type ResolvedPlace, type SearchFilters } from '../../../modules/search';
import { browseQuery, currentQuery, filterContext, parseBrowseParams, type BrowseState, type FilterContext, type RawParams } from '../../../modules/search/filters';
import { browsePath, eventsPath } from '../../../modules/search/paths';
import { cityOf, type City } from '../../../modules/search/places';

// Shared by every browse page (country, category, city, city and category) and its metadata:
// finds the country, city and category from the address, follows old and form addresses with a
// redirect, reads the filters and redirects to the canonical address whenever it differs, so each
// filtered view has exactly one address. Cached per request.

export type Browse = {
  country: Country;
  city: City | null;
  category: CategoryNode | null;
  catalog: Catalog;
  ctx: FilterContext;
  state: BrowseState;
  filters: SearchFilters;
  place: ResolvedPlace;
  notice: PlaceNotice | null;
  /** The page's path without the query */
  path: string;
};

const browsable = browsableCategory;

/** An events-section slug in a browse address goes to the events pages */
function eventsRedirect(catalog: Catalog, country: string, city: string | null, slug: string): never | void {
  const c = catalog.bySlug.get(slug);
  if (!c || !isEventCategory(catalog, c.id)) return;
  permanentRedirect(`${eventsPath(country, city)}${c.slug === EVENT_ROOT_SLUG ? '' : `?type=${c.slug}`}`);
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

async function resolve(countrySlug: string, placeSlug: string, categorySlug: string, rawJson: string): Promise<Browse> {
  const raw = JSON.parse(rawJson) as RawParams;
  const db = appDb();
  const country = (await activeCountries(db)).find((c) => c.slug === countrySlug);
  if (!country) notFound();
  const catalog = await cachedCatalog(db);

  let city: City | null = null;
  let category: CategoryNode | null = null;
  if (placeSlug) {
    city = await cityOf(db, country.code, placeSlug);
    if (!city) {
      if (categorySlug) notFound();
      eventsRedirect(catalog, country.slug, null, placeSlug);
      category = browsable(catalog, placeSlug);
      if (!category) notFound();
    }
  }
  if (categorySlug) {
    eventsRedirect(catalog, country.slug, city!.slug, categorySlug);
    category = browsable(catalog, categorySlug);
    if (!category) notFound();
  }

  const rest: RawParams = { ...raw };
  // The old country page address, /germany?category=cars
  if ('category' in raw) {
    delete rest.category;
    const c = first(raw.category) ? browsable(catalog, first(raw.category)) : null;
    permanentRedirect(`${browsePath(country.slug, city?.slug ?? null, c?.slug ?? category?.slug ?? null)}${currentQuery(rest)}`);
  }
  // The filter form's city select: the city is part of the path, and a chosen city replaces a
  // radius. An unchanged select just goes (the canonical redirect below drops it).
  if ('city' in raw) {
    delete rest.city;
    const next = first(raw.city) ? await cityOf(db, country.code, first(raw.city)) : null;
    if (next?.id !== city?.id) {
      delete rest.after;
      if (next) {
        for (const k of ['postal', 'near', 'r']) delete rest[k];
        if (rest.sort === 'distance') delete rest.sort;
      }
      redirect(`${browsePath(country.slug, next?.slug ?? null, category?.slug ?? null)}${currentQuery(rest)}`);
    }
  }
  // A postal code or "near me" crosses city borders, so it belongs to the country's address
  if (city && (first(raw.postal) || first(raw.near))) {
    redirect(`${browsePath(country.slug, null, category?.slug ?? null)}${currentQuery(rest)}`);
  }

  const path = browsePath(country.slug, city?.slug ?? null, category?.slug ?? null);
  const ctx = filterContext(catalog, category, country.currency.minorUnit);
  const { state: parsed } = parseBrowseParams(rest, ctx);
  const canonical = browseQuery(parsed, ctx.minorUnit);
  if (canonical !== currentQuery(raw)) redirect(`${path}${canonical}`);

  const resolved = await resolveFilters(db, {
    countryCode: country.code,
    categoryIds: category ? subtreeIds(catalog, category.id) : null,
    locationId: city?.id ?? null,
    state: parsed,
    secret: webEnv().AUTH_SECRET,
  });
  return { country, city, category, catalog, ctx, state: resolved.state, filters: resolved.filters, place: resolved.place, notice: resolved.notice, path };
}

const cached = cache(resolve);

export async function resolveBrowse(
  params: Promise<{ country: string; place?: string; category?: string }>,
  searchParams: Promise<RawParams>,
): Promise<Browse> {
  const p = await params;
  const raw = await searchParams;
  return cached(p.country, p.place ? decodeURIComponent(p.place) : '', p.category ? decodeURIComponent(p.category) : '', JSON.stringify(raw));
}
