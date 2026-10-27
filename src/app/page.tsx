import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Flag } from '../components/flag';
import { categoryIcon, Icon, type IconName } from '../components/icons';
import { SearchBox } from '../components/search-box';
import { SectionTitle } from '../components/section-title';
import { appDb } from '../db/drizzle';
import { visitorCountry } from '../lib/client-ip';
import { messages } from '../messages/fa';
import { keyCitiesOf, waitingCountries } from '../modules/launch/waitlist';
import { cachedCatalog, EVENT_ROOT_SLUG } from '../modules/listings/catalog';
import { activeCountries, countryCounts } from '../modules/listings/queries';
import { cachedCityCounts } from '../modules/search/browse';
import { browsePath, eventsPath } from '../modules/search/paths';
import { chosenCountry } from './country-choice';
import { NearestCity } from './nearest-city';
import { cityFoundingPlaces } from '../modules/payments/founding';

// The first page (wave 1, mockup final/home). It never redirects by IP (Google advises against it):
// it suggests the visitor's country from Cloudflare's header («به نظر می‌رسد در آلمان هستید»), or
// the first open country, with one line on what Peydoo is, search at once, the country's key
// cities (open ones with their counts, waitlist ones with their business goal), the categories,
// three trust lines and the business offer. A visitor who chose a country before goes straight to
// it; «کشور دیگر» and the header's chip open the city chooser (/cities); `?choose` (from posting,
// to change the listing's country) lists the open countries and, under «به‌زودی», the ones with a
// waitlist (mockup final/countries).

const TRUST_ICONS: IconName[] = ['shield', 'chat', 'plus'];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ choose?: string }> }) {
  const db = appDb();
  const { choose } = await searchParams;
  if (choose === undefined) {
    const chosen = await chosenCountry(db);
    if (chosen) redirect(`/${chosen.slug}`);
  }
  const countries = await activeCountries(db);
  const here = visitorCountry(await headers());
  if (choose !== undefined || countries.length === 0) return <CountryChooser here={here} />;

  const detected = countries.find((c) => c.code === here) ?? null;
  const country = detected ?? countries[0]!;
  const [cities, perCity, catalog] = await Promise.all([keyCitiesOf(db, country.code), cachedCityCounts(db, country.code), cachedCatalog(db)]);
  const t = messages.home;
  // The mockup's order and short names («دیجیتال», «خانه»), the rest after them
  const order = Object.keys(t.categoryShort);
  const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
  const roots = catalog.rootIds
    .map((id) => catalog.byId.get(id)!)
    .filter((c) => c.isActive && c.slug !== EVENT_ROOT_SLUG)
    .sort((a, b) => rank(a.slug) - rank(b.slug));
  // The founding offer of the first open city, with its places left
  const firstOpen = cities.find((c) => c.status === 'open') ?? null;
  const founding = firstOpen ? await cityFoundingPlaces(db, firstOpen.id) : null;

  return (
    <main data-soft-page>
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-6 sm:px-6 lg:pt-14 lg:pb-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[1.75rem] font-black leading-[1.45] text-balance lg:text-5xl lg:leading-[1.3]">{t.title}</h1>
          <p className="mt-2 text-base leading-8 text-neutral-700 lg:text-lg">{t.intro}</p>
          <SearchBox id="home-q" action={`/${country.slug}`} country={country.slug} placeholder={t.searchPlaceholder} className="mt-5" large />
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{t.chooseCity}</h2>
            <p className="flex items-center gap-1.5 text-sm text-neutral-600">
              <Flag code={country.code} className="h-3.5 w-5" />
              {detected ? t.seemsIn(country.nameFa) : country.nameFa}
            </p>
          </div>
          <Link href="/cities" className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold text-brand-800 hover:bg-brand-50">
            <Icon name="globe" className="size-4" />
            {t.otherCountry}
          </Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {cities.map((c) => {
            const open = c.status === 'open';
            return (
              <li key={c.id}>
                <Link
                  href={browsePath(country.slug, c.slug, null)}
                  className={`flex min-h-14 items-center justify-between gap-2 rounded-2xl border p-3.5 hover:shadow-sm ${open ? 'border-brand-300 bg-brand-50' : 'border-neutral-200 bg-white'}`}
                >
                  <b className="text-[15px]">{c.nameFa}</b>
                  <span className={`text-xs whitespace-nowrap ${open ? 'text-neutral-600' : 'text-saffron-800'}`}>
                    {open ? t.listingCount(perCity.get(c.id) ?? 0) : c.goal ? t.businesses(c.businesses, c.goal) : t.waitlist}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <NearestCity country={country.slug} countryName={country.nameFa} />
          <Link href={browsePath(country.slug, null, null)} className="col-start-2 flex min-h-11 items-center justify-center rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-50">
            {t.wholeCountry(country.nameFa)}
          </Link>
        </div>

        <SectionTitle title={t.popular} href={browsePath(country.slug, null, null)} className="mt-7" />
        <ul className="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-8">
          {/* Events first, in saffron, so people find them at once (owner, Oct 27, 2026) */}
          <li>
            <Link href={eventsPath(country.slug, null)} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-bold hover:bg-saffron-50">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-saffron-100 text-saffron-800 ring-1 ring-saffron-300 ring-inset">
                <Icon name="calendar" className="size-6" />
              </span>
              {messages.events.section}
            </Link>
          </li>
          {roots.slice(0, 7).map((c) => (
            <li key={c.id}>
              <Link href={browsePath(country.slug, null, c.slug)} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium hover:bg-neutral-50">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon name={categoryIcon(c.slug)} className="size-6" />
                </span>
                {t.categoryShort[c.slug] ?? c.nameFa}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-7 grid gap-2 lg:grid-cols-3">
          {t.trust.map((x, i) => (
            <li key={x.text} className="flex items-center gap-3 rounded-2xl bg-white p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={TRUST_ICONS[i]!} className="size-5" />
              </span>
              <span className="flex-1 text-sm font-medium">{x.text}</span>
              <Link href={x.href} className="flex min-h-11 items-center text-xs font-bold text-brand-800 hover:underline">
                {x.link}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/business/new" className="mt-3 flex items-center gap-3 rounded-2xl border border-saffron-100 bg-white p-3.5 hover:bg-saffron-50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-800">
            <Icon name="store" className="size-5" />
          </span>
          <span className="flex-1 text-sm leading-6">
            <b>{t.business}</b>{' '}
            {founding && firstOpen ? (
              <>
                {t.foundingText(founding.places, firstOpen.nameFa)} <span className="text-saffron-800">{t.placesLeft(Math.max(0, founding.places - founding.used))}</span>
              </>
            ) : (
              t.businessText
            )}
          </span>
          <Icon name="chevronEnd" className="size-4 text-neutral-400" />
        </Link>
      </div>
    </main>
  );
}

/** `?choose`: every open country with its count, the visitor's own first, then «به‌زودی» (mockup final/countries) */
async function CountryChooser({ here }: { here: string | null }) {
  const db = appDb();
  const [countries, counts, waiting] = await Promise.all([activeCountries(db), countryCounts(db), waitingCountries(db)]);
  const ordered = [...countries].sort((a, b) => Number(b.code === here) - Number(a.code === here));
  const t = messages.home;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-4 text-2xl font-extrabold">{t.chooseCountry}</h1>
      <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4">
        {ordered.map((c) => {
          const mine = c.code === here;
          return (
            <li key={c.code}>
              <Link href={`/${c.slug}`} className="flex min-h-16 items-center gap-3">
                <Flag code={c.code} className="h-5 w-8" />
                <span className="flex flex-1 flex-col">
                  <span className="text-base font-bold">{c.nameFa}</span>
                  <bdi dir="ltr" className="text-xs text-neutral-600">
                    {c.nameLocal}
                  </bdi>
                </span>
                {mine && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{t.yourCountry}</span>}
                <span className="text-sm text-neutral-600">{t.listingCount(counts.get(c.code) ?? 0)}</span>
                <Icon name="chevronEnd" className="size-4 text-neutral-400" />
              </Link>
            </li>
          );
        })}
      </ul>
      {waiting.length > 0 && (
        <>
          <h2 className="mt-6 mb-1 text-sm font-bold text-neutral-600">{t.soon}</h2>
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4">
            {waiting.map((c) => (
              <li key={c.code} className="flex min-h-14 items-center gap-3 py-2">
                <Flag code={c.code} className="h-5 w-8" />
                <span className="flex flex-1 flex-col">
                  <span className="text-base">{c.nameFa}</span>
                  <span className="text-xs text-saffron-800">{t.soonCity(c.city.nameFa)}</span>
                </span>
                <Link href={browsePath(c.slug, c.city.slug, null)} className="rounded-full border border-brand-200 bg-brand-50 px-3 text-sm font-bold leading-8 text-brand-800 hover:bg-brand-100">
                  {t.notifyMe}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
