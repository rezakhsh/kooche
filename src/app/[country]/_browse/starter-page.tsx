import Link from 'next/link';
import { Flag } from '../../../components/flag';
import { Icon } from '../../../components/icons';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { eventRowOf } from '../../../modules/events/card';
import { upcomingEvents } from '../../../modules/events/queries';
import { eventPath } from '../../../modules/events/slug';
import type { CountryInfo } from '../../../modules/launch/country-page';
import { keyCitiesOf } from '../../../modules/launch/waitlist';
import { cachedCatalog, subtreeIds } from '../../../modules/listings/catalog';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { newestListingsIn, newestVerifiedBusinesses } from '../../../modules/organizations/queries';
import { cityFoundingPlaces } from '../../../modules/payments/founding';
import { browsePath, eventsPath } from '../../../modules/search/paths';
import { viewerSeesTest } from '../../../modules/users/server';
import { CategoryGrid } from '../../category-grid';
import { RememberCountry } from '../remember-country';

// A country's first page in its first 8 weeks after opening (wave 2 part 8, mockup final/us-starter;
// src/modules/launch/country-page.ts): events, verified businesses and jobs first, because those
// exist before the listings do; its cities; the first waitlist city's goal or «آگهی بدهید»; the
// founding offer; then the categories. Prices are in the country's currency and event times at
// the venue, as everywhere. Germany, open from the start, never has it.

const t = messages.countryPage.starter;

/** A progress bar filling from the right. SVG attributes, because the CSP allows no style attributes. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1 block h-2 w-full overflow-hidden rounded-full" aria-hidden>
      <rect width="100" height="4" className="fill-white" />
      <rect x={100 - pct} width={pct} height="4" className="fill-saffron-500" />
    </svg>
  );
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <h2 className="mt-7 flex items-center justify-between text-lg font-extrabold">
      {title}
      {href && (
        <Link href={href} className="flex min-h-11 items-center text-sm font-bold text-brand-800 hover:underline">
          {t.all}
        </Link>
      )}
    </h2>
  );
}

export async function StarterPage({ country, detected = false, remember = false }: { country: CountryInfo; detected?: boolean; remember?: boolean }) {
  const db = appDb();
  const withTest = await viewerSeesTest();
  const catalog = await cachedCatalog(db);
  const jobsRoot = catalog.bySlug.get('jobs');
  const [cities, events, businesses, jobs] = await Promise.all([
    keyCitiesOf(db, country.code),
    upcomingEvents(db, { countryCode: country.code, from: new Date(), to: null, withTest }, new Date(), 3),
    newestVerifiedBusinesses(db, country.code, { limit: 3, withTest }).then((rows) => rows.map((b) => ({ ...b, logo: b.logoKey ? imageUrl(b.logoKey, 'thumb', 'webp') : null }))),
    jobsRoot ? newestListingsIn(db, country.code, subtreeIds(catalog, jobsRoot.id), { limit: 3, withTest }) : Promise.resolve([]),
  ]);
  const firstOpen = cities.find((c) => c.status === 'open') ?? null;
  const gate = cities.find((c) => c.status === 'waitlist' && c.goal) ?? null;
  const founding = firstOpen ? await cityFoundingPlaces(db, firstOpen.id) : null;
  const nothing = events.items.length === 0 && businesses.length === 0 && jobs.length === 0;
  // Where (the venue, or «آنلاین») and the price («رایگان», «از ۲۰ $»), as in the events list
  const row = (e: (typeof events.items)[number]) => eventRowOf(catalog, e, { saved: new Set(), season: null });
  const part = (d: Date, timeZone: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone, ...o }).format(d);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24">
      {remember && <RememberCountry slug={country.slug} />}
      <section className="pt-6 lg:pt-10">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-800">
          <Flag code={country.code} className="h-4 w-6" />
          {detected ? messages.home.seemsIn(country.nameFa) : country.nameFa}
        </p>
        <h1 className="mt-2 text-[26px] font-black leading-[1.5] lg:text-4xl">{t.title(country.nameFa)}</h1>
        <p className="mt-1 text-[15px] leading-8 text-neutral-700">{t.intro}</p>
        {cities.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {cities.map((c) => (
              <Link
                key={c.id}
                href={browsePath(country.slug, c.slug, null)}
                className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-sm ${c.status === 'open' ? 'border-brand-300 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300 text-neutral-700'}`}
              >
                {c.nameFa}
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
        <div>
          {nothing && (
            <div className="mt-6 rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm leading-7 text-neutral-700">{t.empty}</p>
              <Link href="/new" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white hover:bg-brand-800">
                {t.post}
              </Link>
            </div>
          )}

          {events.items.length > 0 && (
            <>
              <SectionHead title={t.events(country.nameFa)} href={eventsPath(country.slug, null)} />
              <ul className="mt-3 space-y-2">
                {events.items.map((e) => (
                  <li key={e.id}>
                    <Link href={eventPath(e.title, e.publicToken)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 hover:border-brand-300">
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-saffron-50 py-1.5 text-saffron-800">
                        <span className="text-xs">{part(e.startsAt, e.timeZone, { weekday: 'long' })}</span>
                        <b className="text-sm">{part(e.startsAt, e.timeZone, { day: 'numeric', month: 'short' })}</b>
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-sm leading-6">{e.title}</b>
                        <span className="text-xs text-neutral-600">{[row(e).where, row(e).price].filter(Boolean).join('، ')}</span>
                      </span>
                      <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {businesses.length > 0 && (
            <>
              <SectionHead title={t.businesses} />
              <ul className="mt-3 grid gap-2 lg:grid-cols-3">
                {businesses.map((b) => (
                  <li key={b.slug}>
                    <Link href={`/b/${b.slug}`} className="block rounded-2xl border border-neutral-200 p-3 hover:border-brand-300">
                      <span className="flex items-center gap-3">
                        {b.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logo} alt="" className="size-12 rounded-xl object-cover" />
                        ) : (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                            <Icon name="store" className="size-6" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{b.name}</b>
                          <span className="block truncate text-xs text-neutral-600">
                            {[b.businessType ? messages.business.types[b.businessType] : b.tagline, b.city].filter(Boolean).join('، ')}
                          </span>
                        </span>
                      </span>
                      <span className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-800">
                        <Icon name="verified" className="size-3.5" />
                        {t.verified}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {jobs.length > 0 && jobsRoot && (
            <>
              <SectionHead title={t.jobs} href={browsePath(country.slug, null, jobsRoot.slug)} />
              <ul className="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
                {jobs.map((j) => (
                  <li key={j.publicToken}>
                    <Link href={listingPath(j.title, j.publicToken)} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon name="briefcase" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-sm">{j.title}</b>
                        <span className="text-xs text-neutral-600">{j.city ?? j.placeName}</span>
                      </span>
                      <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside>
          {gate ? (
            <div className="mt-6 rounded-2xl bg-saffron-50 p-4">
              <h2 className="font-extrabold">{t.gateTitle(gate.nameFa)}</h2>
              <p className="mt-1 text-sm leading-7 text-neutral-700">{messages.launch.goalLine(gate.nameFa, gate.goal!)}</p>
              <p className="mt-2 flex justify-between text-xs text-saffron-800">
                <span>{messages.countryPage.gate.count(gate.businesses, gate.goal!)}</span>
                <span>{messages.countryPage.gate.percent(Math.min(100, Math.round((gate.businesses / gate.goal!) * 100)))}</span>
              </p>
              <Bar value={gate.businesses} max={gate.goal!} />
              <Link href={browsePath(country.slug, gate.slug, null)} className="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white hover:bg-brand-800">
                {t.gateCta(gate.nameFa)}
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-saffron-50 p-4">
              <h2 className="font-extrabold">{t.postTitle}</h2>
              <p className="mt-1 text-sm leading-7 text-neutral-700">{t.postText}</p>
              <Link href="/new" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white hover:bg-brand-800">
                {t.post}
              </Link>
            </div>
          )}
          <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <h2 className="font-extrabold">{t.businessTitle}</h2>
            <p className="mt-1 text-sm leading-7 text-neutral-700">
              {founding && firstOpen ? t.businessText(founding.places, firstOpen.nameFa) : t.businessFree}
            </p>
            <Link href="/business/new" className="mt-3 flex h-11 items-center justify-center rounded-xl border border-brand-300 bg-white text-sm font-bold text-brand-800 hover:bg-brand-100">
              {t.businessCta}
            </Link>
          </div>
        </aside>
      </div>

      <h2 className="mt-8 text-lg font-extrabold">{messages.home.popular}</h2>
      <CategoryGrid catalog={catalog} country={country.slug} />
    </main>
  );
}
