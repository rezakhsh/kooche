import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { chosenCountry, chosenPageCountry } from '../app/country-choice';
import { COUNTRY_COOKIE } from '../app/country-cookie-name';
import { appDb } from '../db/drizzle';
import { countries } from '../db/schema';
import { visitorCountry } from '../lib/client-ip';
import { ADMIN_GATE_HEADER } from '../modules/admin/gate';
import { viewAsCountry } from '../modules/admin/view-as';
import { countryByCode, isPlanned } from '../modules/launch/country-page';
import { browsableCategory, cachedCatalog } from '../modules/listings/catalog';
import { countryCatalog } from '../modules/listings/country-rules';
import { homeArea } from '../modules/listings/neighbourhood';
import { activeCountries, listingTopic } from '../modules/listings/queries';
import { listingPageToken, SHARED_PAGE_HEADER } from '../modules/listings/shared-page';
import { allCities } from '../modules/search/places';
import { currentSession } from '../modules/users/server';
import { sql } from 'drizzle-orm';
import type { HeaderPlaceData } from './header-place';

// What the header's middle needs besides the address (./header-place.ts), once per request: the
// root layout's header and its HeaderSync read the same.

/** The visitor's own country when it is planned but not open (its «به‌زودی» page is their first page) */
async function visitorsPlannedCountry(code: string) {
  const db = appDb();
  const c = await countryByCode(db, code).catch(() => null);
  return c && c.mode !== 'open' && (await isPlanned(db, c)) ? c : null;
}

export const headerPlaceData = cache(async (): Promise<HeaderPlaceData & { start: string; signedIn: boolean; shared: string | null }> => {
  const db = appDb();
  const [session, chosen, open, jar, requestHeaders] = await Promise.all([currentSession(), chosenCountry(db), activeCountries(db), cookies(), headers()]);
  // A listing or event page that Cloudflare keeps for every signed-out visitor (src/proxy.ts): the
  // proxy dropped the remembered country, and the header is the page's own country's instead of
  // the connection's, as a browse page shows its own (docs/setup.md, "Browsing and favorites")
  const sharedToken = requestHeaders.get(SHARED_PAGE_HEADER);
  const shared = sharedToken && listingPageToken(requestHeaders.get('x-pathname') ?? '')?.token === sharedToken ? sharedToken : null;
  const pageCountry = shared ? ((await listingTopic(db, shared).catch(() => null))?.countryCode ?? null) : null;
  // Before a country is chosen, the visitor's own (Cloudflare's header) when it is open (wave 1, mockup final/home)
  const here = shared ? pageCountry : visitorCountry(requestHeaders);
  // A signed-in user's saved place comes before the guess from their connection
  const home = session ? await homeArea(db, session.user.id).catch(() => null) : null;
  const country = chosen ?? open.find((c) => c.code === home?.countryCode) ?? open.find((c) => c.code === here) ?? null;
  const visitorPlannedAsked = !shared && !chosen && !!here && !open.some((c) => c.code === here);
  const [withPages, cities, catalog, mine, planned] = await Promise.all([
    // countryBySlug()'s countries: every one but the hidden ones
    db.select({ slug: countries.slug, nameFa: countries.nameFa }).from(countries).where(sql`${countries.mode} <> 'hidden'`),
    country ? allCities(db).catch(() => []) : [],
    country ? cachedCatalog(db).then((c) => countryCatalog(c, country.code)) : null,
    // The remembered country when it isn't open yet (owner, Oct 31, 2026): the logo leads to its page
    chosen ? null : chosenPageCountry(db).catch(() => null),
    visitorPlannedAsked && here ? visitorsPlannedCountry(here) : null,
  ]);
  const mineClosed = mine && !open.some((c) => c.slug === mine.slug) ? mine : null;
  const categories: [string, string][] = [];
  if (catalog) for (const slug of catalog.bySlug.keys()) {
    const c = browsableCategory(catalog, slug);
    if (c) categories.push([slug, c.nameFa]);
  }
  const place = (c: { slug: string | null; nameFa: string } | null) => (c?.slug ? { slug: c.slug, nameFa: c.nameFa } : null);
  return {
    country: place(country),
    cookie: jar.get(COUNTRY_COOKIE)?.value ?? null,
    viewAs: !!viewAsCountry(requestHeaders),
    adminRoot: requestHeaders.has(ADMIN_GATE_HEADER) ? ((requestHeaders.get('x-pathname') ?? '').split('/')[1] ?? null) : null,
    footer: (chosen ?? open[0])?.slug ?? null,
    open: open.flatMap((c) => (c.slug ? [c.slug] : [])),
    closed: withPages.flatMap((c) => (c.slug && !open.some((o) => o.slug === c.slug) ? [[c.slug, c.nameFa] as [string, string]] : [])),
    cities: country ? cities.filter((c) => c.countryCode === country.code).map((c) => [c.slug, c.nameFa] as [string, string]) : [],
    categories,
    home: country && home?.countryCode === country.code ? { slug: home.citySlug, nameFa: home.city } : null,
    mineClosed: place(mineClosed),
    visitorPlanned: place(planned),
    visitorPlannedAsked,
    start: mineClosed ? `/${mineClosed.slug}` : country ? `/${country.slug}` : '/',
    signedIn: !!session,
    shared,
  };
});
