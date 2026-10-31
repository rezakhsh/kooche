import { headers } from 'next/headers';
import Link from 'next/link';
import { Icon, type IconName } from '../components/icons';
import { ListingCard } from '../components/listing-card';
import { SearchBox } from '../components/search-box';
import { appDb } from '../db/drizzle';
import { webEnv } from '../lib/env';
import { messages } from '../messages/fa';
import { keyCitiesOf } from '../modules/launch/waitlist';
import { cardOf } from '../modules/listings/card';
import { cachedCatalog, subtreeIds } from '../modules/listings/catalog';
import { activeCountries, listingTopic } from '../modules/listings/queries';
import { browseListings, categoryCounts, similarListings, type BrowseItem } from '../modules/search/browse';
import { browsePath, eventsPath } from '../modules/search/paths';
import { CategoryGrid } from './category-grid';
import { chosenCountry } from './country-choice';

// Replaces Next's built-in 404 page (English, inline styles the CSP blocks). Most people come from
// an old link to a listing that ended, so the page is a starting point (design check, Oct 31,
// 2026; mockup final/not-found): search in their city, the old listing's category first, the
// categories, the newest (or similar) listings, then events, posting and help. The address still
// answers 404.

const t = messages.notFound;
const NEWEST = 4;
const NO_LISTING = '00000000-0000-0000-0000-000000000000';

export default async function NotFound() {
  const db = appDb();
  const segments = ((await headers()).get('x-pathname') ?? '/').split('/').filter(Boolean);
  const [open, chosen, catalog] = await Promise.all([activeCountries(db), chosenCountry(db), cachedCatalog(db)]);
  // An old listing's address (/v/<slug>/<token>, /e/<slug>/<token>): its category and place
  const topic = (segments[0] === 'v' || segments[0] === 'e') && segments[2] ? await listingTopic(db, segments[2]).catch(() => null) : null;
  const country = open.find((c) => c.slug === segments[0]) ?? open.find((c) => c.code === topic?.countryCode) ?? chosen ?? open[0] ?? null;
  if (!country) return <Plain />;
  const cities = (await keyCitiesOf(db, country.code)).filter((c) => c.status === 'open');
  const city = cities.find((c) => c.id === topic?.locationId) ?? (segments[0] === country.slug ? cities.find((c) => c.slug === segments[1]) : undefined) ?? cities[0] ?? null;
  const place = city?.nameFa ?? country.nameFa;
  const category = topic?.categoryId ? catalog.byId.get(topic.categoryId) ?? null : null;

  const [counts, cards] = await Promise.all([
    category ? categoryCounts(db, country.code, city?.id ?? null) : null,
    category
      ? similarListings(db, { id: NO_LISTING, countryCode: country.code, categoryId: category.id, locationId: city?.id ?? null })
      : browseListings(
          db,
          { countryCode: country.code, keyword: null, categoryIds: null, locationId: city?.id ?? null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest' },
          null,
        ).then((r) => r.items as BrowseItem[]),
  ]);
  const inCategory = category && counts ? subtreeIds(catalog, category.id).reduce((n, id) => n + (counts.get(id) ?? 0), 0) : 0;
  const cityPath = browsePath(country.slug, city?.slug ?? null, null);
  const links: Array<[IconName, string, string, string, string]> = [
    ['calendar', t.events, t.eventsSub(place), eventsPath(country.slug, city?.slug ?? null), 'bg-saffron-100 text-saffron-800'],
    ['plus', t.post, t.postSub, '/new', 'bg-brand-50 text-brand-700'],
    ['chat', t.help, t.helpSub, '/help', 'bg-brand-50 text-brand-700'],
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 lg:px-6 lg:pt-10">
      <section className="rounded-3xl border border-neutral-200 bg-gradient-to-b from-brand-50 to-white p-5 lg:flex lg:items-center lg:gap-10 lg:p-8">
        <div className="min-w-0 flex-1">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
            <Icon name="search" className="size-7" />
          </span>
          <h1 className="mt-4 text-2xl font-black lg:text-3xl">{t.title}</h1>
          <p className="mt-1.5 text-[15px] leading-7 text-neutral-700">{t.lead}</p>
        </div>
        <SearchBox
          id="not-found-q"
          action={cityPath}
          country={country.slug}
          city={city?.slug ?? null}
          placeholder={messages.search.placeholderIn(place)}
          className="mt-4 min-w-0 lg:mt-0 lg:w-[26rem]"
        />
      </section>

      {category && (
        <Link href={browsePath(country.slug, city?.slug ?? null, category.slug)} className="mt-4 flex items-center gap-3 rounded-2xl border border-saffron-100 bg-saffron-50 p-3.5 hover:border-saffron-300">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-saffron-700">
            <Icon name="grid" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">{t.lookingFor(category.nameFa)}</b>
            <span className="text-sm text-neutral-700">{inCategory > 0 ? t.activeIn(inCategory, place) : t.seeIn(place)}</span>
          </span>
          <Icon name="chevronEnd" className="size-5 text-neutral-500" />
        </Link>
      )}

      <h2 className="mt-7 text-lg font-extrabold">{t.categories}</h2>
      <div className="mt-3">
        <CategoryGrid catalog={catalog} country={country.slug} />
      </div>

      {cards.length > 0 && (
        <>
          <div className="mt-7 flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold">{t.newestIn(place)}</h2>
            <Link href={cityPath} className="text-sm font-bold text-brand-700 hover:underline">
              {t.all}
            </Link>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.slice(0, NEWEST).map((x) => (
              <li key={x.id}>
                <ListingCard card={cardOf(catalog, x, webEnv().APP_TIME_ZONE)} view="grid" />
              </li>
            ))}
          </ul>
        </>
      )}

      <ul className="mt-7 grid gap-3 lg:grid-cols-3">
        {links.map(([icon, title, sub, href, tone]) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:border-brand-300">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon name={icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{title}</b>
                <span className="text-sm text-neutral-600">{sub}</span>
              </span>
              <Icon name="chevronEnd" className="size-5 text-neutral-500" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** No open country at all (a new installation) */
function Plain() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col px-6 py-16">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="mt-4 text-lg text-neutral-700">{t.body}</p>
      <Link href="/" className="mt-8 w-fit text-brand-700 underline underline-offset-4">
        {t.home}
      </Link>
    </main>
  );
}
