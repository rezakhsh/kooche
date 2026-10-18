import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { categoryIcon, Icon } from '../../components/icons';
import { ListingCard, type CardData } from '../../components/listing-card';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { formatAgo } from '../../lib/format';
import { messages } from '../../messages/fa';
import { ancestry, cachedCatalog, EVENT_ROOT_SLUG, type Catalog, type CategoryNode } from '../../modules/listings/catalog';
import { placeParts } from '../../modules/listings/place-text';
import { formatPrice } from '../../modules/listings/price';
import { activeCountries } from '../../modules/listings/queries';
import { browseListings, categoryCounts } from '../../modules/search/browse';
import { listingPath } from '../../modules/listings/slug';
import { imageUrl } from '../../modules/media/server';
import { VIEW_COOKIE } from '../country-cookie-name';
import { CategorySheet } from './category-sheet';
import { RememberCountry, RememberView } from './remember-country';

// A country's page, /germany, /austria: its newest active listings, 24 at a time
// (listings_country_ranked_idx). `?category=<slug>` narrows to a category and everything under
// it; the categories sit in a sidebar on computers and in a row plus a sheet on phones (approved
// Oct 17, 2026). `?view=grid|list` switches the layout and is remembered in a cookie.
// `?after=<ranked_at>_<id>` continues after the last listing of the previous page.

type Params = { country: string };
type Search = { after?: string; category?: string; view?: string };
type View = 'grid' | 'list';


const viewSchema = z.enum(['grid', 'list']);

async function find(slug: string) {
  return (await activeCountries(appDb())).find((c) => c.slug === slug) ?? null;
}

/** The category from `?category=`, if it exists and is active */
function categoryOf(catalog: Catalog, slug: string | undefined): CategoryNode | null {
  const c = slug ? catalog.bySlug.get(slug) : undefined;
  return c?.isActive ? c : null;
}

function subtree(catalog: Catalog, id: string): string[] {
  const out = [id];
  for (const child of catalog.byId.get(id)?.childIds ?? []) out.push(...subtree(catalog, child));
  return out;
}

function href(country: string, p: { category?: string | null; view?: View | null; after?: string }) {
  const q = new URLSearchParams();
  if (p.category) q.set('category', p.category);
  if (p.view) q.set('view', p.view);
  if (p.after) q.set('after', p.after);
  const s = q.toString();
  return `/${country}${s ? `?${s}` : ''}`;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const country = await find((await params).country);
  if (!country) return { title: messages.notFound.title, robots: { index: false } };
  const category = categoryOf(await cachedCatalog(appDb()), (await searchParams).category);
  const t = messages.country;
  return {
    title: `${category ? t.categoryTitle(category.nameFa, country.nameFa) : t.title(country.nameFa)} | ${messages.site.name}`,
    description: category ? t.categoryDescription(category.nameFa, country.nameFa) : t.description(country.nameFa),
    alternates: { canonical: `${webEnv().APP_URL}${href(country.slug, { category: category?.slug })}` },
  };
}

export default async function CountryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const country = await find((await params).country);
  if (!country) notFound();
  const search = await searchParams;
    const asked = viewSchema.safeParse(search.view);
  const remembered = viewSchema.safeParse((await cookies()).get(VIEW_COOKIE)?.value);
  const view: View = asked.success ? asked.data : remembered.success ? remembered.data : 'grid';

  const db = appDb();
  const catalog = await cachedCatalog(db);
  const category = categoryOf(catalog, search.category);
  const [page, leafCounts] = await Promise.all([
    browseListings(
      db,
      { countryCode: country.code, categoryIds: category ? subtree(catalog, category.id) : null, locationId: null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest' },
      search.after ?? null,
    ),
    categoryCounts(db, country.code),
  ]);
  // A listing counts for its category and every category above it
  const counts = new Map<string, number>();
  let total = 0;
  for (const [id, n] of leafCounts) {
    total += n;
    for (const c of ancestry(catalog, id)) counts.set(c.id, (counts.get(c.id) ?? 0) + n);
  }
  const path = category ? ancestry(catalog, category.id) : [];
  const root = path[0] ?? null;
  const t = messages.country;
  const env = webEnv();
  // Events have their own pages (/germany/events); their root is a link there, not a filter
  const roots = catalog.rootIds.map((id) => catalog.byId.get(id)!).filter((c) => c.isActive && c.slug !== EVENT_ROOT_SLUG);
  const eventsHref = `/${country.slug}/events`;
  const children = root ? root.childIds.map((id) => catalog.byId.get(id)!).filter((c) => c.isActive) : [];
  const link = (slug: string | null) => href(country.slug, { category: slug, view: asked.success ? view : null });

  const cards: CardData[] = page.items.map((l) => {
    const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
    const noPrice = l.categoryId ? catalog.byId.get(l.categoryId)?.priceMode === 'none' : false;
    const price =
      l.priceMinor !== null && currency
        ? `${formatPrice(l.priceMinor, currency.code, currency.minorUnit)}${l.priceType === 'negotiable' ? ` (${messages.priceType.negotiable})` : ''}`
        : noPrice
          ? null
          : messages.priceType[l.priceType];
    const place = placeParts({ ...l, cityLocal: null }, t.near);
    return {
      href: listingPath(l.title, l.publicToken),
      title: l.title,
      price,
      place: place.local ? { text: l.placeName!, latin: true } : place.city ? { text: place.city, latin: false } : null,
      ago: l.publishedAt ? formatAgo(l.publishedAt, env.APP_TIME_ZONE) : null,
      cover: l.coverKey ? imageUrl(l.coverKey, 'card', 'webp') : null,
      photoCount: l.photoCount,
      wanted: l.kind === 'wanted',
    };
  });

  const title = category ? t.categoryTitle(category.nameFa, country.nameFa) : t.title(country.nameFa);
  const shown = category ? (counts.get(category.id) ?? 0) : total;

  return (
    <main className="mx-auto w-full max-w-6xl pb-6 sm:px-6">
      <RememberCountry slug={country.slug} />
      <RememberView view={asked.success ? asked.data : null} />

      {/* Phones: the categories as a row to swipe, "all categories" opens a sheet (no JavaScript needed) */}
      <div className="border-b border-neutral-200 lg:hidden">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          <CategorySheet label={t.allCategories} title={t.categories} closeLabel={t.close}>
            <CategoryLinks roots={roots} counts={counts} total={total} root={root} selected={category} childrenOfRoot={children} link={link} />
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
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8 lg:pt-6">
        {/* Computers: the categories in a sidebar */}
        <aside className="hidden lg:block">
          <nav aria-label={t.categories} className="sticky top-20 rounded-2xl border border-neutral-200 p-2">
            <h2 className="px-2 pt-1 pb-2 text-xs font-bold text-neutral-500">{t.categories}</h2>
            <CategoryLinks roots={roots} counts={counts} total={total} root={root} selected={category} childrenOfRoot={children} link={link} />
            <Link href={eventsHref} className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-neutral-200 px-2 pt-3 pb-2 text-sm font-bold text-saffron-700 hover:bg-saffron-50">
              <Icon name="calendar" className="size-[18px]" />
              {messages.events.linkFromCountry}
            </Link>
          </nav>
        </aside>

        <div className="min-w-0 px-4 sm:px-0">
          {path.length > 0 && (
            <nav aria-label="breadcrumb" className="mt-4 flex flex-wrap gap-1 text-xs text-neutral-500 lg:mt-0">
              <Link href={link(null)} className="hover:underline">
                {country.nameFa}
              </Link>
              {path.map((c) => (
                <span key={c.id}>
                  ›{' '}
                  <Link href={link(c.slug)} className="hover:underline">
                    {c.nameFa}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          <div className="mt-3 mb-4 flex items-end justify-between gap-3 lg:mt-1">
            <div>
              <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
              <p className="text-xs text-neutral-500">{t.count(shown)}</p>
            </div>
            <div role="group" aria-label={t.view} className="flex shrink-0 overflow-hidden rounded-xl border border-neutral-200">
              <ViewLink href={href(country.slug, { category: category?.slug, view: 'grid' })} on={view === 'grid'} label={t.viewGrid} icon="grid" />
              <ViewLink href={href(country.slug, { category: category?.slug, view: 'list' })} on={view === 'list'} label={t.viewList} icon="list" />
            </div>
          </div>

          {cards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-600">
              <Icon name="search" className="mx-auto mb-3 size-8 text-neutral-400" />
              <p>{category ? t.emptyCategory : t.empty}</p>
              <Link href="/new" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
                <Icon name="plus" className="size-4" />
                {messages.nav.post}
              </Link>
            </div>
          )}
          <ul className={view === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4' : 'flex flex-col'}>
            {cards.map((card) => (
              <li key={card.href}>
                <ListingCard card={card} view={view} />
              </li>
            ))}
          </ul>
          {page.next && (
            <div className="mt-8 flex justify-center">
              <Link
                href={href(country.slug, { category: category?.slug, view: asked.success ? view : null, after: page.next })}
                className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50"
              >
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
