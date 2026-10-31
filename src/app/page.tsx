import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Flag } from '../components/flag';
import { Icon, type IconName } from '../components/icons';
import { SearchBox } from '../components/search-box';
import { SectionTitle } from '../components/section-title';
import { Sheet } from '../components/sheet';
import { appDb } from '../db/drizzle';
import { visitorCountry } from '../lib/client-ip';
import { messages } from '../messages/fa';
import { countryByCode, isPlanned, isStarter, soonCountries } from '../modules/launch/country-page';
import { keyCitiesOf } from '../modules/launch/waitlist';
import { cachedCatalog } from '../modules/listings/catalog';
import { activeCountries, countryCounts } from '../modules/listings/queries';
import { cachedCityCounts } from '../modules/search/browse';
import { browsePath } from '../modules/search/paths';
import { CountrySoon, openingDay } from './[country]/_browse/country-soon';
import { StarterPage } from './[country]/_browse/starter-page';
import { CategoryGrid } from './category-grid';
import { chosenPageCountry } from './country-choice';
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
// Wave 2 part 8: a visitor from a planned country that isn't open sees its «پیدو به‌زودی» page
// (mockup final/home-waitlist), and one from a country in its starter weeks its starter page;
// a visitor who chose a planned country before goes back to its page.

const TRUST_ICONS: IconName[] = ['shield', 'chat', 'plus'];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ choose?: string }> }) {
  const db = appDb();
  const { choose } = await searchParams;
  if (choose === undefined) {
    const chosen = await chosenPageCountry(db);
    if (chosen) redirect(`/${chosen.slug}`);
  }
  const countries = await activeCountries(db);
  const here = visitorCountry(await headers());
  if (choose !== undefined) return <CountryChooser here={here} />;
  // From Iran (mockup final/iran; design check, Oct 31, 2026): the Iran notice (on every page) above
  // the first open city's listings, not the welcome page. Crawlers never come from Iran, so this
  // isn't the redirect by IP that Google advises against.
  if (countries[0] && here === 'IR') {
    const city = (await keyCitiesOf(db, countries[0].code)).find((c) => c.status === 'open');
    redirect(browsePath(countries[0].slug, city?.slug ?? null, null));
  }
  const mine = here ? await countryByCode(db, here) : null;
  if (mine && mine.mode !== 'open' && (await isPlanned(db, mine))) return <CountrySoon country={mine} detected />;
  if (countries.length === 0) return <CountryChooser here={here} />;

  const detected = countries.find((c) => c.code === here) ?? null;
  const country = detected ?? countries[0]!;
  const info = mine?.code === country.code ? mine : await countryByCode(db, country.code);
  if (info && isStarter(info)) return <StarterPage country={info} detected={!!detected} />;
  const [cities, perCity, catalog] = await Promise.all([keyCitiesOf(db, country.code), cachedCityCounts(db, country.code), cachedCatalog(db)]);
  const t = messages.home;
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
          <Sheet
            title={t.chooseCountry}
            closeLabel={messages.country.close}
            className="shrink-0"
            summaryClassName="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-brand-800 hover:bg-brand-50"
            summary={
              <>
                <Icon name="globe" className="size-4" />
                {t.otherCountry}
              </>
            }
          >
            <CountryList here={here} current={country.code} />
          </Sheet>
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
                    {open ? t.listingCount(perCity.get(c.id) ?? 0) : c.goal && c.businesses > 0 ? t.businesses(c.businesses, c.goal) : messages.cities.beFirst}
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
        <CategoryGrid catalog={catalog} country={country.slug} />

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
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-4 text-2xl font-extrabold">{messages.home.chooseCountry}</h1>
      <CountryList here={here} current={null} />
    </main>
  );
}

/**
 * The countries: open ones with their counts (the visitor's own first, the current one checked),
 * then «به‌زودی» and the guides. On the home page in a sheet over the page (mockup final/countries;
 * design check, Oct 31, 2026), at `?choose` as its own page.
 */
async function CountryList({ here, current }: { here: string | null; current: string | null }) {
  const db = appDb();
  const [countries, counts, planned] = await Promise.all([activeCountries(db), countryCounts(db), soonCountries(db)]);
  const waiting = planned.filter((c) => c.mode !== 'guide');
  const guides = planned.filter((c) => c.mode === 'guide');
  const ordered = [...countries].sort((a, b) => Number(b.code === here) - Number(a.code === here));
  const t = messages.home;
  return (
    <>
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
                {c.code === current ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand-700 text-white" aria-label={t.currentCountry}>
                    <Icon name="check" className="size-4" />
                  </span>
                ) : (
                  <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                )}
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
                <Link href={`/${c.slug}`} className="flex flex-1 flex-col">
                  <span className="text-base">{c.nameFa}</span>
                  <span className="text-xs text-saffron-800">{c.opensOn ? messages.countryPage.soonOn(openingDay(c.opensOn, true)) : c.city ? t.soonCity(c.city.nameFa) : null}</span>
                </Link>
                <Link href={`/${c.slug}`} className="rounded-full border border-brand-200 bg-brand-50 px-3 text-sm font-bold leading-8 text-brand-800 hover:bg-brand-100">
                  {t.notifyMe}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {guides.length > 0 && (
        <>
          <h2 className="mt-6 mb-1 text-sm font-bold text-neutral-600">{messages.countryPage.guide}</h2>
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4">
            {guides.map((c) => (
              <li key={c.code}>
                <Link href={`/${c.slug}`} className="flex min-h-14 items-center gap-3 py-2">
                  <Flag code={c.code} className="h-5 w-8" />
                  <span className="flex flex-1 flex-col">
                    <span className="text-base">{c.nameFa}</span>
                    <span className="text-xs text-neutral-600">{messages.countryPage.guideLine}</span>
                  </span>
                  <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
