import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { BrowseLink as Link } from '../../../components/browse-link';
import { cache } from 'react';
import { EventCard } from '../../../components/event-card';
import { FavoriteButton } from '../../../components/favorite-button';
import { categoryIcon, Icon } from '../../../components/icons';
import { ListingCard } from '../../../components/listing-card';
import { SearchBox } from '../../../components/search-box';
import { appDb } from '../../../db/drizzle';
import { clientIp } from '../../../lib/client-ip';
import { webEnv } from '../../../lib/env';
import { hit } from '../../../lib/rate-limit';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { eventCardOf } from '../../../modules/events/card';
import { upcomingEvents } from '../../../modules/events/queries';
import { pathOfListingCode } from '../../../modules/listings/queries';
import { ancestry, EVENT_ROOT_SLUG, type CategoryNode } from '../../../modules/listings/catalog';
import { cardOf } from '../../../modules/listings/card';
import { RENT_SLUGS } from '../../../modules/listings/safety-kind';
import { savedAmong } from '../../../modules/listings/favorites';
import { currentSession } from '../../../modules/users/server';
import { searchListings, type SearchResult } from '../../../modules/search';
import { cachedCategoryCounts, cachedCityCounts, COUNT_CAP, featuredForPage, typicalPrice } from '../../../modules/search/browse';
import { featuredListingIds } from '../../../modules/payments/plans';
import { webMeili } from '../../../modules/search/client';
import { browseQuery, defaultSort, EMPTY_STATE, isFiltered, SORTS, type BrowseState, type Sort } from '../../../modules/search/filters';
import { KEYWORD_LIMIT } from '../../../modules/search/keyword';
import { isSaved } from '../../../modules/search/saved';
import { browsePath, eventsPath } from '../../../modules/search/paths';
import { citiesOf } from '../../../modules/search/places';
import { VIEW_COOKIE } from '../../country-cookie-name';
import { CategorySheet } from '../category-sheet';
import { RememberCountry, RememberView } from '../remember-country';
import { ActiveFilters, filterChips } from './chips';
import { formatPrice } from '../../../modules/listings/price';
import { FilterForm } from './filter-form';
import { SaveSearchButton } from './save-search';
import type { Browse } from './resolve';

// One page for every browse address: a country, a category in it, a city, a category in a city
// (approved Oct 18, 2026). Server-rendered; categories in a sidebar on computers and a row plus a
// sheet on phones (approved Oct 17, 2026), filters in the sidebar or a second sheet, active
// filters as removable chips, sort links, 24 listings a page with a "more" link (keyset cursor).
// With a keyword (?q=, approved Oct 22, 2026) the same page shows Meilisearch's matches, with
// counts per category and option, and up to four matching events above them.
// Wave 1 (mockups final/browse, final/category): on phones one sticky block with the search and one
// chip row (filters, all categories, then the applied filters or the categories), a result line
// with the count, sort, layout and «خبرم کن», and a rent-scam warning on rooms and flats.

type View = 'grid' | 'list';

const NO_RESULT: SearchResult = { items: [], next: null, total: 0, facets: null, eventIds: [], fallback: false };

/** Whether this visitor may run another keyword search now (per IP; no IP in development) */
async function keywordAllowed(): Promise<boolean> {
  const ip = clientIp(await headers());
  if (!ip) return true;
  return (await hit(valkey(), [[KEYWORD_LIMIT, ip]]).catch(() => ({ ok: true }))).ok;
}

/** Listings, counts and cities for the page, once per request (metadata and page share it) */
const pageData = cache(async (b: Browse) => {
  const db = appDb();
  const limited = !!b.state.q && !(await keywordAllowed());
  // Counts per option for the choice and yes/no fields of the page's category
  const facetKeys = b.ctx.defs.filter((d) => d.type === 'select' || d.type === 'multi_select' || d.type === 'boolean').map((d) => d.key);
  const [result, leafCounts, cities, perCity] = await Promise.all([
    limited ? NO_RESULT : searchListings(db, b.filters, b.state.after, { meili: webMeili(), facetKeys, events: !b.category }),
    cachedCategoryCounts(db, b.country.code, b.city?.id ?? null),
    citiesOf(db, b.country.code),
    cachedCityCounts(db, b.country.code),
  ]);
  const events = result.eventIds.length
    ? (await upcomingEvents(db, { countryCode: b.country.code, from: new Date(), to: null, listingIds: result.eventIds })).items
    : [];
  // Paid featured listings (roadmap step 6): a strip on the first page without a keyword, and the
  // badge on any card of the page that is featured
  const featured = !b.state.q && !b.state.after ? await featuredForPage(db, b.filters) : [];
  const featuredIds = await featuredListingIds(db, result.items.map((l) => l.id));
  // «قیمت بیشتر آگهی‌های …: ۵۰۰ تا ۷۵۰ €» under the price fields, for a category with prices
  const typical = b.category && b.ctx.priceAllowed ? await typicalPrice(db, { countryCode: b.country.code, categoryIds: b.filters.categoryIds, locationId: b.city?.id ?? null }) : null;
  return { result, leafCounts, cities, perCity, limited, events, featured, featuredIds, typical };
});

function titleOf(b: Browse): string {
  const t = messages;
  const { country, city, category } = b;
  if (city && category) return t.browse.cityCategoryTitle(category.nameFa, city.nameFa);
  if (city) return t.browse.cityTitle(city.nameFa);
  if (category) return t.country.categoryTitle(category.nameFa, country.nameFa);
  return t.country.title(country.nameFa);
}

function descriptionOf(b: Browse): string {
  const t = messages;
  const { country, city, category } = b;
  if (city && category) return t.browse.cityCategoryDescription(category.nameFa, city.nameFa);
  if (city) return t.browse.cityDescription(city.nameFa, country.nameFa);
  if (category) return t.country.categoryDescription(category.nameFa, country.nameFa);
  return t.country.description(country.nameFa);
}

/**
 * Search engines index the plain country, city and category pages that have listings. Filters,
 * sorting, paging and places are for visitors: noindex, with the plain page as canonical.
 */
export function indexable(b: Browse, total: number): boolean {
  return !isFiltered(b.state) && b.state.sort === 'newest' && !b.state.after && total > 0;
}

export async function browseMetadata(b: Browse): Promise<Metadata> {
  const { result } = await pageData(b);
  return {
    title: `${b.state.q ? `${messages.search.title(b.state.q)} ${messages.search.within(titleOf(b))}` : titleOf(b)} | ${messages.site.name}`,
    description: descriptionOf(b),
    alternates: { canonical: `${webEnv().APP_URL}${b.path}` },
    robots: indexable(b, result.total) ? undefined : { index: false, follow: true },
  };
}

/** What a category link keeps from the current page: the keyword, the place, shipping, the layout */
function carried(state: BrowseState): BrowseState {
  return { ...EMPTY_STATE, q: state.q, near: state.near, postal: state.postal, ship: state.ship, view: state.view, sort: state.sort === 'distance' ? 'distance' : defaultSort(state.q) };
}

/** The hidden fields of the page's own keyword box: everything but the keyword, sort and cursor */
function keptFields(state: BrowseState, minorUnit: number): [string, string][] {
  const query = browseQuery({ ...state, q: null, after: null, sort: state.sort === 'distance' ? 'distance' : 'newest' }, minorUnit);
  return [...new URLSearchParams(query)];
}

export async function BrowsePage({ b }: { b: Browse }) {
  const { country, city, category, catalog, state, ctx } = b;
  // A listing's code typed into the search box opens that listing (like Kleinanzeigen's ID)
  const coded = state.q ? await pathOfListingCode(appDb(), state.q) : null;
  if (coded) redirect(coded);
  const { result, leafCounts, cities, perCity, limited, events, featured, featuredIds, typical } = await pageData(b);
  const env = webEnv();
  const t = messages.country;
  const tb = messages.browse;
  const remembered = (await cookies()).get(VIEW_COOKIE)?.value;
  // Filled hearts for a signed-in visitor; logged-out pages are the same for everyone
  const session = await currentSession();
  const saved = session ? await savedAmong(appDb(), session.user.id, [...result.items, ...featured].map((l) => l.id)) : new Set<string>();
  // Any page narrower than a whole country can be saved as a search with alerts
  const saveable = !!(state.q || isFiltered(state) || city || category);
  const searchSaved = saveable && session && !state.near ? await isSaved(appDb(), session.user.id, { country, city, category, ctx, state }) : false;
  const here = `${b.path}${browseQuery(state, ctx.minorUnit)}`;
  const view: View = state.view ?? (remembered === 'list' ? 'list' : 'grid');

  // A listing counts for its category and every category above it. With a keyword, the counts are
  // the keyword's matches (from the same search), else all active listings (cached for a minute).
  const keywordCounts = result.facets?.category_id;
  const leaves = keywordCounts ? new Map(Object.entries(keywordCounts)) : leafCounts;
  const counts = new Map<string, number>();
  let total = 0;
  for (const [id, n] of leaves) {
    if (!catalog.byId.has(id)) continue;
    total += n;
    for (const c of ancestry(catalog, id)) counts.set(c.id, (counts.get(c.id) ?? 0) + n);
  }
  const path = category ? ancestry(catalog, category.id) : [];
  const root = path[0] ?? null;
  const roots = catalog.rootIds.map((id) => catalog.byId.get(id)!).filter((c) => c.isActive && c.slug !== EVENT_ROOT_SLUG);
  const children = root ? root.childIds.map((id) => catalog.byId.get(id)!).filter((c) => c.isActive) : [];
  const keep = carried(state);
  const link = (slug: string | null) => `${browsePath(country.slug, city?.slug ?? null, slug)}${browseQuery(keep, ctx.minorUnit)}`;
  const eventsHref = eventsPath(country.slug, city?.slug ?? null);
  const withState = (s: Partial<BrowseState>) => `${b.path}${browseQuery({ ...state, after: null, ...s }, ctx.minorUnit)}`;

  const cards = result.items.map((l) => ({ id: l.id, token: l.publicToken, card: { ...cardOf(b.catalog, l, env.APP_TIME_ZONE), featured: featuredIds.has(l.id) } }));
  const featuredCards = featured.map((l) => ({ id: l.id, token: l.publicToken, card: { ...cardOf(b.catalog, l, env.APP_TIME_ZONE), featured: true } }));
  const filtered = isFiltered(state);
  const chips = filterChips(b);
  const filterCount = chips.length;
  const rent = path.some((c) => RENT_SLUGS.has(c.slug));
  const sorts = SORTS.filter((s) => (s === 'relevance' ? !!state.q : s === 'distance' ? !!b.filters.around : s.startsWith('price') ? ctx.priceAllowed : true));
  const topCities = city
    ? []
    : cities
        .filter((c) => (perCity.get(c.id) ?? 0) > 0)
        .sort((a, z) => (perCity.get(z.id) ?? 0) - (perCity.get(a.id) ?? 0))
        .slice(0, 10);
  const notice =
    b.notice === 'near_expired'
      ? tb.near.expired
      : b.notice === 'near_invalid'
        ? tb.near.invalid
        : b.notice === 'near_outside'
          ? tb.near.outside(country.nameFa)
          : b.notice === 'postal_unknown'
            ? tb.postalUnknown
            : limited
              ? messages.search.rateLimited
              : result.fallback
                ? messages.search.fallback
                : null;

  // Structured data: where the page sits (country › city › categories) and the listings on it
  const crumbs = [
    { name: country.nameFa, path: browsePath(country.slug, null, null) },
    ...(city ? [{ name: city.nameFa, path: browsePath(country.slug, city.slug, null) }] : []),
    ...path.map((c) => ({ name: c.nameFa, path: browsePath(country.slug, city?.slug ?? null, c.slug) })),
  ];
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${env.APP_URL}${c.path}` })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: titleOf(b),
      numberOfItems: cards.length,
      itemListElement: cards.map(({ card }, i) => ({ '@type': 'ListItem', position: i + 1, url: `${env.APP_URL}${card.href}`, name: card.title })),
    },
  ];
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const categoryLinks = <CategoryLinks roots={roots} counts={counts} total={total} root={root} selected={category} childrenOfRoot={children} link={link} />;
  const scope = city && category ? `${category.nameFa}، ${city.nameFa}` : city ? city.nameFa : category ? category.nameFa : country.nameFa;
  const money = (n: number) => formatPrice(n, country.currency.code, country.currency.minorUnit);
  const typicalText = typical && category ? tb.typicalPrice(city ? `${category.nameFa} در ${city.nameFa}` : category.nameFa, money(typical.low), money(typical.high)) : null;
  const filterForm = (id: string) => (
    <FilterForm b={b} cities={cities} id={id} facets={result.facets} count={{ n: Math.min(result.total, COUNT_CAP), capped: result.total > COUNT_CAP }} typical={typicalText} />
  );
  const searchBox = (id: string, className: string) => (
    <SearchBox
      id={id}
      action={b.path}
      q={state.q}
      placeholder={messages.search.placeholderIn(scope)}
      hidden={keptFields(state, ctx.minorUnit)}
      country={country.slug}
      city={city?.slug ?? null}
      className={className}
    />
  );
  const widen = state.q && (city || category) ? `${browsePath(country.slug, null, null)}?q=${encodeURIComponent(state.q)}` : null;

  return (
    <main className="mx-auto w-full max-w-6xl pb-6 sm:px-6">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <RememberCountry slug={country.slug} />
      <RememberView view={state.view} />

      {/* Phones: one sticky block under the header, the search and one row of chips. The sheets
          are <details>, so they open without JavaScript. */}
      <div className="sticky top-[57px] z-20 border-b border-neutral-200 bg-white px-4 pt-2.5 pb-2.5 lg:hidden">
        {searchBox('q', '')}
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
          <CategorySheet label={filterCount ? tb.filtersCount(filterCount) : tb.filters} title={tb.filters} closeLabel={t.close} icon="sliders" tone={filterCount ? 'on' : 'brand'}>
            {filterForm('m')}
          </CategorySheet>
          <CategorySheet label={category ? category.nameFa : t.allCategories} title={t.categories} closeLabel={t.close} tone="plain" chevron>
            {categoryLinks}
          </CategorySheet>
          {chips.length > 0 ? (
            chips.map((c) => (
              <Link
                key={c.href + c.label}
                href={c.href}
                aria-label={tb.removeFilter(c.label)}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 ps-3.5 pe-3 text-sm font-medium whitespace-nowrap text-brand-800"
              >
                {c.label}
                <Icon name="close" className="size-3.5" />
              </Link>
            ))
          ) : (
            <>
              {(children.length > 0 ? children : roots).map((c) => (
                <Chip key={c.id} href={link(c.slug)} on={category?.id === c.id || path[1]?.id === c.id}>
                  {c.nameFa}
                </Chip>
              ))}
              {!category && (
                <Link href={eventsHref} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-saffron-100 bg-saffron-50 px-3.5 text-sm font-bold whitespace-nowrap text-saffron-700">
                  <Icon name="calendar" className="size-4" />
                  {messages.events.section}
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:pt-6">
        {/* Computers: categories and filters in a sidebar; with a category chosen, the filters come first */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <nav aria-label={t.categories} className={`rounded-2xl border border-neutral-200 p-2 ${category ? 'order-2' : ''}`}>
            <h2 className="px-2 pt-1 pb-2 text-xs font-bold text-neutral-500">{t.categories}</h2>
            {categoryLinks}
            <Link href={eventsHref} className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-neutral-200 px-2 pt-3 pb-2 text-sm font-bold text-saffron-700 hover:bg-saffron-50">
              <Icon name="calendar" className="size-[18px]" />
              {city ? tb.cityEvents(city.nameFa) : messages.events.linkFromCountry}
            </Link>
          </nav>
          <section aria-label={tb.filters} className="rounded-2xl border border-neutral-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
                <Icon name="sliders" className="size-4 text-brand-700" />
                {tb.filters}
              </h2>
            </div>
            {filterForm('d')}
          </section>
        </aside>

        <div className="min-w-0 px-4 sm:px-0">
          {/* The page's own box searches within its city and category; from 1024 px the header's box covers the plain country page */}
          {(state.q || city || category) && searchBox('q-d', 'mb-4 hidden lg:block')}
          {(city || path.length > 0) && (
            <nav aria-label={tb.breadcrumb} className="mt-4 flex flex-wrap gap-1 text-xs text-neutral-500 lg:mt-0">
              <Link href={browsePath(country.slug, null, null)} className="hover:underline">
                {country.nameFa}
              </Link>
              {city && (
                <span>
                  ›{' '}
                  <Link href={browsePath(country.slug, city.slug, null)} className="hover:underline">
                    {city.nameFa}
                  </Link>
                </span>
              )}
              {path.map((c) => (
                <span key={c.id}>
                  ›{' '}
                  <Link href={browsePath(country.slug, city?.slug ?? null, c.slug)} className="hover:underline">
                    {c.nameFa}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          {/* The result line: what and how many, then sort, layout and «خبرم کن» */}
          <div className="mt-3 lg:mt-1">
            <h1 className="text-lg font-extrabold sm:text-2xl">
              {state.q ? messages.search.title(state.q) : titleOf(b)}
              <span className="ms-2 text-sm font-normal text-neutral-600">{result.total > COUNT_CAP ? tb.countAtLeast(COUNT_CAP) : t.count(result.total)}</span>
            </h1>
            {(state.q || widen) && (
              <p className="text-xs text-neutral-600">
                {state.q && messages.search.within(titleOf(b))}
                {widen && (
                  <>
                    {'، '}
                    <Link href={widen} className="text-brand-700 hover:underline">
                      {messages.search.widen(country.nameFa)}
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="mt-2 mb-3 flex items-center gap-2">
            <SortMenu sorts={sorts} current={state.sort} href={(s2) => withState({ sort: s2 })} />
            <div role="group" aria-label={t.view} className="flex shrink-0 overflow-hidden rounded-xl border border-neutral-200">
              <ViewLink href={withState({ view: 'grid', after: state.after })} on={view === 'grid'} label={t.viewGrid} icon="grid" />
              <ViewLink href={withState({ view: 'list', after: state.after })} on={view === 'list'} label={t.viewList} icon="list" />
            </div>
            {saveable && (
              <div className="ms-auto">
                {state.near ? (
                  <p className="text-xs text-neutral-600">{messages.savedSearches.nearNotSaveable}</p>
                ) : (
                  <SaveSearchButton path={b.path} query={browseQuery({ ...state, after: null, view: null }, ctx.minorUnit)} saved={searchSaved} compact />
                )}
              </div>
            )}
          </div>

          {rent && (
            <p className="mb-3 flex gap-2 rounded-xl bg-saffron-50 p-3 text-sm leading-6 text-saffron-800">
              <Icon name="alert" className="mt-1 size-4 shrink-0" />
              <span>
                {tb.rentWarning}{' '}
                <Link href="/safety#rent" className="font-bold underline underline-offset-2">
                  {tb.rentWarningLink}
                </Link>
              </span>
            </p>
          )}

          {notice && (
            <p role="status" className="mb-3 rounded-xl border border-saffron-100 bg-saffron-50 px-3 py-2 text-sm text-saffron-800">
              {notice}
            </p>
          )}

          {topCities.length > 0 && !b.place && (
            <nav aria-label={tb.popularCities} className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {topCities.map((c) => (
                <Link key={c.id} href={browsePath(country.slug, c.slug, category?.slug ?? null)} className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-300">
                  <Icon name="pin" className="size-3 text-neutral-400" />
                  {c.nameFa}
                </Link>
              ))}
            </nav>
          )}

          {/* On phones the applied filters are in the chip row */}
          <div className="hidden lg:block">
            <ActiveFilters b={b} />
          </div>

          {events.length > 0 && (
            <section aria-labelledby="search-events" className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="search-events" className="flex items-center gap-1.5 text-sm font-extrabold text-saffron-700">
                  <Icon name="calendar" className="size-4" />
                  {messages.search.events}
                </h2>
                <Link href={eventsHref} className="text-xs text-neutral-600 hover:underline">
                  {messages.search.allEvents}
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {events.map((e) => (
                  <li key={e.id}>
                    <EventCard e={eventCardOf(catalog, e)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {featuredCards.length > 0 && (
            <section aria-labelledby="featured-listings" className="mb-6 rounded-2xl bg-saffron-50/60 p-3">
              <h2 id="featured-listings" className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-saffron-700" title={messages.featured.stripHint}>
                <Icon name="star" className="size-4" />
                {messages.featured.strip}
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {featuredCards.map(({ id, token, card }) => (
                  <li key={id}>
                    <ListingCard card={card} view="grid" favorite={<FavoriteButton token={token} saved={saved.has(id)} back={here} />} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {cards.length === 0 && !limited && (
            <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-600">
              <Icon name="search" className="mx-auto mb-3 size-8 text-neutral-400" />
              <p>{state.q ? messages.search.empty(state.q) : filtered ? tb.emptyFiltered : category ? t.emptyCategory : t.empty}</p>
              {filtered ? (
                <Link href={b.path} className="mt-4 inline-flex rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold hover:bg-neutral-50">
                  {tb.clearFilters}
                </Link>
              ) : (
                <Link href="/new" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
                  <Icon name="plus" className="size-4" />
                  {messages.nav.post}
                </Link>
              )}
            </div>
          )}
          <ul className={view === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4' : 'flex flex-col'}>
            {cards.map(({ id, token, card }) => (
              <li key={id}>
                <ListingCard card={card} view={view} favorite={<FavoriteButton token={token} saved={saved.has(id)} back={here} />} />
              </li>
            ))}
          </ul>
          {result.next && (
            <div className="mt-8 flex justify-center">
              <Link href={withState({ after: result.next })} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50">
                {t.more}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Chip({ href, on, small, children }: { href: string; on: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`flex shrink-0 items-center rounded-full border whitespace-nowrap ${small ? 'h-9 px-3 text-xs' : 'h-10 px-3.5 text-sm'} ${
        on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
      }`}
    >
      {children}
    </Link>
  );
}

/** Sort as a small menu on the result line: a <details>, so it opens without JavaScript */
function SortMenu({ sorts, current, href }: { sorts: Sort[]; current: Sort; href: (s: Sort) => string }) {
  const tb = messages.browse;
  return (
    <details className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-lg px-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
        <Icon name="sort" className="size-4" />
        <span className="sr-only">{tb.sort}: </span>
        {tb.sorts[current]}
        <Icon name="chevronDown" className="size-3.5" />
      </summary>
      <ul className="absolute start-0 top-full z-20 mt-1 min-w-40 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
        {sorts.map((s) => (
          <li key={s}>
            <Link
              href={href(s)}
              aria-current={current === s ? 'true' : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${current === s ? 'bg-brand-50 font-bold text-brand-800' : 'text-neutral-700 hover:bg-neutral-50'}`}
            >
              {tb.sorts[s]}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ViewLink({ href, on, label, icon }: { href: string; on: boolean; label: string; icon: 'grid' | 'list' }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={on ? 'true' : undefined}
      className={`flex size-10 items-center justify-center ${on ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-600 hover:text-neutral-800'}`}
    >
      <Icon name={icon} className="size-5" />
    </Link>
  );
}

function CategoryLinks({
  roots,
  counts,
  total,
  root,
  selected,
  childrenOfRoot,
  link,
}: {
  roots: CategoryNode[];
  counts: Map<string, number>;
  total: number;
  root: CategoryNode | null;
  selected: CategoryNode | null;
  childrenOfRoot: CategoryNode[];
  link: (slug: string | null) => string;
}) {
  const t = messages.country;
  const item = (on: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm ${on ? 'bg-brand-50 font-bold text-brand-700' : 'text-neutral-700 hover:bg-neutral-50'}`;
  const count = (n: number) => <span className="ms-auto text-xs font-normal text-neutral-500">{n.toLocaleString('fa-IR')}</span>;
  return (
    <ul className="flex flex-col">
      <li>
        <Link href={link(null)} className={item(!selected)} aria-current={!selected ? 'page' : undefined}>
          <Icon name="grid" className="size-[18px]" />
          {t.all}
          {count(total)}
        </Link>
      </li>
      {roots.map((c) => (
        <li key={c.id}>
          <Link href={link(c.slug)} className={item(selected?.id === c.id)} aria-current={selected?.id === c.id ? 'page' : undefined}>
            <Icon name={categoryIcon(c.slug)} className={`size-[18px] ${root?.id === c.id ? 'text-brand-700' : 'text-neutral-500'}`} />
            {c.nameFa}
            {count(counts.get(c.id) ?? 0)}
          </Link>
          {root?.id === c.id && childrenOfRoot.length > 0 && (
            <ul className="mb-1 flex flex-col">
              {childrenOfRoot.map((s) => {
                const on = selected?.id === s.id || selected?.parentId === s.id;
                return (
                  <li key={s.id}>
                    <Link href={link(s.slug)} className={`${item(on)} ps-9`} aria-current={selected?.id === s.id ? 'page' : undefined}>
                      {s.nameFa}
                      {count(counts.get(s.id) ?? 0)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
