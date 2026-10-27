import { headers } from 'next/headers';
import Link from 'next/link';
import { AppBar } from '../../components/app-bar';
import { Flag } from '../../components/flag';
import { Icon } from '../../components/icons';
import { appDb } from '../../db/drizzle';
import { visitorCountry } from '../../lib/client-ip';
import { normalizePersian } from '../../lib/normalize-persian';
import { messages } from '../../messages/fa';
import { homeArea } from '../../modules/listings/neighbourhood';
import { activeCountries, countryCounts } from '../../modules/listings/queries';
import { keyCitiesOf, waitingCountries } from '../../modules/launch/waitlist';
import { cachedCityCounts } from '../../modules/search/browse';
import { browsePath } from '../../modules/search/paths';
import { currentSession } from '../../modules/users/server';
import { chosenCountry } from '../country-choice';
import { CityFilter } from './filter';

export const metadata = { title: messages.cities.title };

// Choosing a city (round 12, mockup final/city-chooser), from the header's «برلین ▾» and the first
// page's «کشور دیگر»: the country's key cities (open ones with their counts, waitlist ones with
// their one goal and «خبرم کن»), what opens the whole country, then the other open countries and
// the countries that aren't open with their first city's goal.

const fa = (n: number) => n.toLocaleString('fa-IR');
const names = (...xs: string[]) => normalizePersian(xs.join(' ')).toLowerCase();

/** A progress bar filling from the right. SVG attributes, because the CSP allows no style attributes. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
      <rect width="100" height="4" className="fill-neutral-100" />
      <rect x={100 - pct} width={pct} height="4" className="fill-brand-600" />
    </svg>
  );
}

export default async function CitiesPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const db = appDb();
  const [open, session, chosen, requested] = await Promise.all([activeCountries(db), currentSession(), chosenCountry(db), searchParams]);
  const home = session ? await homeArea(db, session.user.id).catch(() => null) : null;
  const here = visitorCountry(await headers());
  const country =
    open.find((c) => c.slug === requested.country) ?? chosen ?? open.find((c) => c.code === home?.countryCode) ?? open.find((c) => c.code === here) ?? open[0] ?? null;
  const [cities, perCity, waiting, perCountry] = await Promise.all([
    country ? keyCitiesOf(db, country.code) : Promise.resolve([]),
    country ? cachedCityCounts(db, country.code) : Promise.resolve(new Map<string, number>()),
    waitingCountries(db),
    countryCounts(db),
  ]);
  const t = messages.cities;
  const openCities = cities.filter((c) => c.status === 'open');
  const others = open.filter((c) => c.code !== country?.code);

  return (
    <>
      <AppBar title={t.title} back={country ? `/${country.slug}` : '/'} backLabel={t.close} />
      <main className="mx-auto w-full max-w-xl px-4 pt-4 pb-10">
        <CityFilter placeholder={t.search} />

        {country && cities.length > 0 && (
          <>
            <h2 className="mt-5 flex items-center gap-2 text-sm font-extrabold">
              <Flag code={country.code} className="h-4 w-6" />
              {country.nameFa}
              <span className="ms-auto text-xs font-normal text-neutral-600">{t.openOf(openCities.length, cities.length)}</span>
            </h2>
            <ul className="mt-2 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
              {cities.map((c) =>
                c.status === 'open' ? (
                  <li key={c.id} data-names={names(c.nameFa, c.slug, country.nameFa)}>
                    <Link href={browsePath(country.slug, c.slug, null)} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-700 text-white">
                        <Icon name="check" className="size-4" />
                      </span>
                      <span className="flex-1">
                        <b className="block text-sm">{c.nameFa}</b>
                        <span className="text-xs text-neutral-600">{t.openCity(perCity.get(c.id) ?? 0)}</span>
                      </span>
                      <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                    </Link>
                  </li>
                ) : (
                  <li key={c.id} data-names={names(c.nameFa, c.slug, country.nameFa)}>
                    <Link href={browsePath(country.slug, c.slug, null)} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                        <Icon name="clock" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-sm">{c.nameFa}</b>
                        <span className="text-xs text-neutral-600">{c.goal ? t.soon(c.businesses, c.goal) : t.soonNoGoal}</span>
                        {c.goal && <Bar value={c.businesses} max={c.goal} />}
                      </span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">{t.notify}</span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
            {cities.length > openCities.length && <p className="mt-2 rounded-xl bg-neutral-50 p-3 text-xs leading-6 text-neutral-700">{t.countryRule(cities.length, country.nameFa)}</p>}
          </>
        )}

        {(others.length > 0 || waiting.length > 0) && (
          <>
            <h2 className="mt-6 text-sm font-extrabold">{t.otherCountries}</h2>
            <ul className="mt-2 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
              {others.map((c) => (
                <li key={c.code} data-names={names(c.nameFa, c.nameLocal)}>
                  <Link href={`/cities?country=${c.slug}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                    <Flag code={c.code} className="h-5 w-7" />
                    <span className="flex-1">
                      <b className="block text-sm">{c.nameFa}</b>
                      <span className="text-xs text-neutral-600">{t.openCountry(perCountry.get(c.code) ?? 0)}</span>
                    </span>
                    <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                  </Link>
                </li>
              ))}
              {waiting.map((c) => (
                <li key={c.code} data-names={names(c.nameFa, c.city.nameFa, c.slug, c.city.slug)}>
                  <Link href={browsePath(c.slug, c.city.slug, null)} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                    <Flag code={c.code} className="h-5 w-7" />
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm">{c.nameFa}</b>
                      <span className="text-xs text-neutral-600">{c.goal ? t.firstCity(c.city.nameFa, c.businesses, c.goal) : t.firstCityNoGoal(c.city.nameFa)}</span>
                      {c.goal && <Bar value={c.businesses} max={c.goal} />}
                    </span>
                    <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/contact" className="mt-3 flex h-12 items-center justify-center rounded-xl border border-neutral-300 text-sm font-bold hover:bg-neutral-50">
          {t.notListed}
        </Link>
      </main>
    </>
  );
}
