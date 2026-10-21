import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { cache } from 'react';
import { FavoriteButton } from '../../../components/favorite-button';
import { categoryIcon, Icon } from '../../../components/icons';
import { ListingCard } from '../../../components/listing-card';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { ancestry, EVENT_ROOT_SLUG, type CategoryNode } from '../../../modules/listings/catalog';
import { cardOf } from '../../../modules/listings/card';
import { savedAmong } from '../../../modules/listings/favorites';
import { currentSession } from '../../../modules/users/server';
import { searchListings } from '../../../modules/search';
import { cachedCategoryCounts, cachedCityCounts, COUNT_CAP } from '../../../modules/search/browse';
import { browseQuery, EMPTY_STATE, isFiltered, SORTS, type BrowseState, type Sort } from '../../../modules/search/filters';
import { browsePath, eventsPath } from '../../../modules/search/paths';
import { citiesOf } from '../../../modules/search/places';
import { VIEW_COOKIE } from '../../country-cookie-name';
import { CategorySheet } from '../category-sheet';
import { RememberCountry, RememberView } from '../remember-country';
import { ActiveFilters, filterChips } from './chips';
import { FilterForm } from './filter-form';
import { NearMe } from './near-me';
import type { Browse } from './resolve';

// One page for every browse address: a country, a category in it, a city, a category in a city
// (approved Oct 18, 2026). Server-rendered; categories in a sidebar on computers and a row plus a
// sheet on phones (approved Oct 17, 2026), filters in the sidebar or a second sheet, active
// filters as removable chips, sort links, 24 listings a page with a "more" link (keyset cursor).

type View = 'grid' | 'list';

/** Listings, counts and cities for the page, once per request (metadata and page share it) */
const pageData = cache(async (b: Browse) => {
  const db = appDb();
  const [result, leafCounts, cities, perCity] = await Promise.all([
    searchListings(db, b.filters, b.state.after),
    cachedCategoryCounts(db, b.country.code, b.city?.id ?? null),
    citiesOf(db, b.country.code),
    cachedCityCounts(db, b.country.code),
  ]);
  return { result, leafCounts, cities, perCity };
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
    title: `${titleOf(b)} | ${messages.site.name}`,
    description: descriptionOf(b),
    alternates: { canonical: `${webEnv().APP_URL}${b.path}` },
    robots: indexable(b, result.total) ? undefined : { index: false, follow: true },
  };
}

/** What a category link keeps from the current page: the place, shipping, the layout */
function carried(state: BrowseState): BrowseState {
  return { ...EMPTY_STATE, near: state.near, postal: state.postal, ship: state.ship, view: state.view, sort: state.sort === 'distance' ? 'distance' : 'newest' };
}

export async function BrowsePage({ b }: { b: Browse }) {
  const { country, city, category, catalog, state, ctx } = b;
  const { result, leafCounts, cities, perCity } = await pageData(b);
  const env = webEnv();
  const t = messages.country;
  const tb = messages.browse;
  const remembered = (await cookies()).get(VIEW_COOKIE)?.value;
  // Filled hearts for a signed-in visitor; logged-out pages are the same for everyone
  const session = await currentSession();
  const saved = session ? await savedAmong(appDb(), session.user.id, result.items.map((l) => l.id)) : new Set<string>();
  const here = `${b.path}${browseQuery(state, ctx.minorUnit)}`;
  const view: View = state.view ?? (remembered === 'list' ? 'list' : 'grid');

  // A listing counts for its category and every category above it
  const counts = new Map<string, number>();
  let total = 0;
  for (const [id, n] of leafCounts) {
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

  const cards = result.items.map((l) => ({ id: l.id, token: l.publicToken, card: cardOf(b.catalog, l, env.APP_TIME_ZONE) }));
  const filtered = isFiltered(state);
  const filterCount = filterChips(b).length;
  const sorts = SORTS.filter((s) => (s === 'distance' ? !!b.filters.around : s.startsWith('price') ? ctx.priceAllowed : true));
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
  const filterForm = (id: string) => <FilterForm b={b} cities={cities} id={id} />;

  return (
    <main className="mx-auto w-full max-w-6xl pb-6 sm:px-6">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <RememberCountry slug={country.slug} />
      <RememberView view={state.view} />

      {/* Phones: categories as a row to swipe; "all categories" and the filters open sheets (no JavaScript needed) */}
      <div className="border-b border-neutral-200 lg:hidden">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          <CategorySheet label={t.allCategories} title={t.categories} closeLabel={t.close}>
            {categoryLinks}
          </CategorySheet>
          <Chip href={link(null)} on={!category}>
            {t.allShort}
          </Chip>
          <Link href={eventsHref} className="flex shrink-0 items-center gap-1.5 rounded-full border border-saffron-100 bg-saffron-50 px-3 py-1.5 text-sm font-bold whitespace-nowrap text-saffron-700">
            <Icon name="calendar" className="size-4" />
            {messages.events.section}
          </Link>
          {roots.map((c) => (
            <Chip key={c.id} href={link(c.slug)} on={root?.id === c.id}>
              {c.nameFa}
            </Chip>
          ))}
        </div>
        {children.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
            {children.map((c) => (
              <Chip key={c.id} href={link(c.slug)} on={path[1]?.id === c.id} small>
                {c.nameFa}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex items-start gap-2 px-4 pb-2.5">
          <CategorySheet label={filterCount ? tb.filtersCount(filterCount) : tb.filters} title={tb.filters} closeLabel={t.close} icon="sliders">
            {filterForm('m')}
          </CategorySheet>
          {!city && <NearMe country={country.slug} countryName={country.nameFa} active={!!state.near} />}
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
              {!city && <NearMe country={country.slug} countryName={country.nameFa} active={!!state.near} />}
            </div>
            {filterForm('d')}
          </section>
        </aside>

        <div className="min-w-0 px-4 sm:px-0">
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
          <div className="mt-3 mb-3 flex items-end justify-between gap-3 lg:mt-1">
            <div>
              <h1 className="text-xl font-extrabold sm:text-2xl">{titleOf(b)}</h1>
              <p className="text-xs text-neutral-500">{result.total > COUNT_CAP ? tb.countAtLeast(COUNT_CAP) : t.count(result.total)}</p>
            </div>
            <div role="group" aria-label={t.view} className="flex shrink-0 overflow-hidden rounded-xl border border-neutral-200">
              <ViewLink href={withState({ view: 'grid', after: state.after })} on={view === 'grid'} label={t.viewGrid} icon="grid" />
              <ViewLink href={withState({ view: 'list', after: state.after })} on={view === 'list'} label={t.viewList} icon="list" />
            </div>
          </div>

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

          <ActiveFilters b={b} />

          <nav aria-label={tb.sort} className="no-scrollbar -mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0">
            <Icon name="sort" className="size-4 shrink-0 text-neutral-400" />
            {sorts.map((s: Sort) => (
              <Link
                key={s}
                href={withState({ sort: s })}
                aria-current={state.sort === s ? 'true' : undefined}
                className={`shrink-0 rounded-lg px-2.5 py-1 whitespace-nowrap ${state.sort === s ? 'bg-neutral-900 font-bold text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
              >
                {tb.sorts[s]}
              </Link>
            ))}
          </nav>

          {cards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-600">
              <Icon name="search" className="mx-auto mb-3 size-8 text-neutral-400" />
              <p>{filtered ? tb.emptyFiltered : category ? t.emptyCategory : t.empty}</p>
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
      className={`shrink-0 rounded-full border whitespace-nowrap ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
        on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
      }`}
    >
      {children}
    </Link>
  );
}

function ViewLink({ href, on, label, icon }: { href: string; on: boolean; label: string; icon: 'grid' | 'list' }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={on ? 'true' : undefined}
      className={`flex items-center justify-center px-2.5 py-1.5 ${on ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-500 hover:text-neutral-800'}`}
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
