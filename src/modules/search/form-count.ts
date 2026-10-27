import type { Queryable } from '../../db/drizzle';
import { browsableCategory, cachedCatalog, subtreeIds, type CategoryNode } from '../listings/catalog';
import { activeCountries } from '../listings/queries';
import { countListings } from './browse';
import { resolveFilters } from './index';
import { filterContext, parseBrowseParams, type RawParams } from './filters';
import { cityOf, type City } from './places';

// «نمایش ۲۳ آگهی» on the filter sheet's button (wave 1, mockup final/filters): how many listings
// the filter form would show as it is now, before it is sent. Reads the form the way the browse
// page does (src/app/[country]/_browse/resolve.ts) without its redirects: the city select replaces
// the path's city, and a postal code or "near me" drops the city. Counted in PostgreSQL (also with
// a keyword), up to COUNT_CAP + 1.

/** "/germany", "/germany/berlin", "/germany/cars", "/germany/berlin/cars" */
const PATH = /^\/([a-z-]{2,40})(?:\/([^/?#]{1,80}))?(?:\/([^/?#]{1,80}))?$/;

export async function countForForm(db: Queryable, path: string, raw: RawParams, secret: string): Promise<number | null> {
  const m = PATH.exec(path);
  if (!m) return null;
  const [, countrySlug, first, second] = m;
  const country = (await activeCountries(db)).find((c) => c.slug === countrySlug);
  if (!country) return null;
  const catalog = await cachedCatalog(db);
  let city: City | null = null;
  let category: CategoryNode | null = null;
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return '';
    }
  };
  if (first) {
    city = await cityOf(db, country.code, decode(first));
    if (!city) {
      if (second) return null;
      category = browsableCategory(catalog, decode(first));
      if (!category) return null;
    }
  }
  if (second) {
    category = browsableCategory(catalog, decode(second));
    if (!category) return null;
  }
  const rest: RawParams = { ...raw };
  if ('city' in rest) {
    const slug = typeof rest.city === 'string' ? rest.city : '';
    delete rest.city;
    city = slug ? await cityOf(db, country.code, slug) : null;
  }
  if (rest.postal || rest.near) city = null;

  const ctx = filterContext(catalog, category, country.currency.minorUnit);
  const { state } = parseBrowseParams(rest, ctx);
  const { filters } = await resolveFilters(db, {
    countryCode: country.code,
    categoryIds: category ? subtreeIds(catalog, category.id) : null,
    locationId: city?.id ?? null,
    state,
    secret,
  });
  return countListings(db, filters);
}
