import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { adminCities } from '../../../modules/launch/waitlist';
import { adminCountries, type AdminCountry, type CountryMode } from '../../../modules/launch/countries';
import { isStarter, starterUntil } from '../../../modules/launch/country-page';
import { Icon } from '../../../components/icons';
import { activePauses, PAUSE_MAX_DAYS } from '../../../modules/launch/pauses';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { Flag } from '../../../components/flag';
import { formatDate } from '../../../lib/format';
import { webEnv } from '../../../lib/env';
import { AdminTitle, Progress } from '../ui';
import { cityLaunchAction, countryModeAction, liftPauseAction, openCountryAction, pauseAction } from './actions';
import { COUNTRY_MODES } from '../../../db/schema';

// Countries and cities (round 12, mockup admin-cities): one goal per city (verified businesses),
// people waiting for information only, and the owner's one-click opening with a confirmation step.
// Wave 1: the mockup's look (the country's key cities open, a bar under each goal, the opening
// date, the early-signup reward beside the country rule). Wave 2 part 2 (mockup admin-countries):
// every country with its mode first, the chosen country's mode, and its emergency pauses beside.

const fa = (n: number) => n.toLocaleString('fa-IR');

const MODE_PILL = { open: 'bg-green-50 text-green-800', prestart: 'bg-brand-50 text-brand-800', waitlist: 'bg-neutral-100 text-neutral-700', guide: 'bg-saffron-50 text-saffron-800', hidden: 'bg-neutral-100 text-neutral-500' } as const;

function ModePill({ mode }: { mode: CountryMode }) {
  return <span className={`rounded-full px-2.5 text-xs font-bold leading-6 ${MODE_PILL[mode]}`}>{admin.cities.modes[mode]}</span>;
}

/** The countries with a card of their own: not hidden, and with key cities or past the plain waitlist */
const mainCountries = (all: AdminCountry[]) => all.filter((c) => c.mode !== 'hidden' && (c.cities > 0 || c.mode !== 'waitlist'));

/**
 * Every country first (mockup admin-countries): each planned country's mode and its key cities with
 * their goal, the others in one line, and the running emergency pauses beside.
 */
async function Overview({ countries }: { countries: AdminCountry[] }) {
  const t = admin.cities;
  const db = appDb();
  const zone = webEnv().APP_TIME_ZONE;
  const main = mainCountries(countries);
  const others = countries.filter((c) => !main.includes(c));
  const [cities, pauses] = await Promise.all([Promise.all(main.map((c) => adminCities(db, c.code))), activePauses(db, null)]);
  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t.title}</h1>
        <span className="text-sm text-neutral-600">{t.overviewHint}</span>
      </header>
      <div className="lg:grid lg:grid-cols-[1fr_19rem] lg:gap-4">
        <ul className="min-w-0 space-y-2">
          {main.map((c, i) => (
            <li key={c.code}>
              <Link href={adminHref(`/cities?country=${c.code}`)} prefetch={false} className="block rounded-2xl border border-neutral-200 bg-white p-3.5 hover:border-brand-300">
                <span className="flex items-center gap-2.5">
                  <Flag code={c.code} className="h-4 w-6" />
                  <b className="text-[15px]">{c.nameFa}</b>
                  <ModePill mode={c.mode} />
                  {c.opensOn && <span className="text-xs font-bold text-brand-800">{t.opensOn(formatDate(new Date(`${c.opensOn}T12:00:00Z`), zone))}</span>}
                  <Icon name="chevronEnd" className="ms-auto size-4 text-neutral-400" />
                </span>
                {cities[i]!
                  .filter((k) => !k.withName && k.status !== 'later')
                  .map((k) => (
                    <span key={k.id} className="mt-3 block border-t border-neutral-200 pt-2.5">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <b>{k.nameFa}</b>
                        <span className="text-xs text-neutral-600">
                          {k.goal && k.status !== 'open' ? `${fa(Math.min(100, Math.round((k.businesses / k.goal) * 100)))}٪، ` : ''}
                          {t.status[k.status]}، {t.cityStats(k.businesses, k.status === 'open' ? null : k.goal, k.waiting)}
                        </span>
                      </span>
                      {k.goal && k.status !== 'open' && <Progress value={k.businesses} goal={k.goal} className="mt-1.5" />}
                    </span>
                  ))}
              </Link>
            </li>
          ))}
          {others.length > 0 && (
            <li className="flex items-start gap-2.5 rounded-2xl border border-dashed border-neutral-300 p-3.5 text-sm leading-7 text-neutral-600">
              <Icon name="globe" className="mt-1.5 size-4 shrink-0" />
              <span>
                {t.others('')}
                {others.map((c, i) => (
                  <span key={c.code}>
                    {i > 0 && '، '}
                    <Link href={adminHref(`/cities?country=${c.code}`)} prefetch={false} className="hover:underline">{c.nameFa}</Link>
                    {c.mode !== 'waitlist' && ` (${t.modes[c.mode]})`}
                  </span>
                ))}
              </span>
            </li>
          )}
        </ul>
        <aside className="mt-4 lg:mt-0">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:sticky lg:top-20">
            <h2 className="font-extrabold">{t.allPauses}</h2>
            {pauses.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">{t.pauses.none}</p>
            ) : (
              <ul className="mt-2 divide-y divide-neutral-200">
                {pauses.map((p) => (
                  <li key={p.id} className="py-2.5 text-sm">
                    <Link href={adminHref(`/cities?country=${p.countryCode}`)} prefetch={false} className="flex items-center justify-between gap-2 hover:underline">
                      <b>{p.categoryName}</b>
                      <span className="text-xs font-bold text-saffron-800">{t.pauses.until(formatDate(p.until, zone))}</span>
                    </Link>
                    <p className="text-xs text-neutral-600">
                      {countries.find((c) => c.code === p.countryCode)?.nameFa}، {p.city ?? t.pauses.wholeCountry}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs leading-6 text-neutral-600">{t.pauses.intro}</p>
          </section>
        </aside>
      </div>
    </>
  );
}

export default async function CitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('cities.manage');
  const sp = await searchParams;
  const t = admin.cities;
  const db = appDb();
  const countries = await adminCountries(db);
  const country = countries.find((c) => c.code === sp.country);
  // Without a chosen country: the overview of every country (mockup admin-countries)
  if (!country) return <Overview countries={countries} />;
  const [cities, pauses, catalog] = await Promise.all([adminCities(db, country.code), activePauses(db, country.code), cachedCatalog(db)]);
  const zone = webEnv().APP_TIME_ZONE;
  // Categories for the pause form: each top category, then its own subcategories
  const pausable = catalog.rootIds.flatMap((id) => {
    const root = catalog.byId.get(id)!;
    return [{ id, name: root.nameFa, depth: 0 }, ...root.childIds.map((cid) => ({ id: cid, name: catalog.byId.get(cid)!.nameFa, depth: 1 }))];
  });
  const field = 'h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm';
  const confirming = cities.find((c) => c.id === sp.confirm);
  // Key cities: those with their own goal (Bonn counts with Cologne)
  const key = cities.filter((c) => !c.withName && c.status !== 'later');
  const ready = cities.filter((c) => c.status === 'waitlist' && c.goal && c.businesses >= c.goal * 0.9);
  const pill = { open: 'bg-green-50 text-green-800', waitlist: 'bg-neutral-100 text-neutral-700', later: 'bg-neutral-50 text-neutral-500' } as const;

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {sp.done && <div className="mb-4"><Alert tone="success">{t.done}</Alert></div>}
      {sp.error && <div className="mb-4"><Alert tone="error">{t.error}</Alert></div>}
      {sp.mode === 'sure' && <div className="mb-4"><Alert tone="error">{t.mode.sureRequired}</Alert></div>}
      {sp.pause === 'invalid' && <div className="mb-4"><Alert tone="error">{t.pauses.invalid}</Alert></div>}

      <nav aria-label={t.countries} className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-neutral-200">
        <Link href={adminHref('/cities')} prefetch={false} className="shrink-0 rounded-lg px-3 text-sm leading-9 text-neutral-700 hover:bg-neutral-50">
          {t.allCountries}
        </Link>
        {mainCountries(countries).map((c) => (
          <Link
            key={c.code}
            href={adminHref(`/cities?country=${c.code}`)}
            prefetch={false}
            aria-current={c.code === country.code ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 text-sm leading-9 ${c.code === country.code ? 'bg-brand-50 font-bold text-brand-800' : 'text-neutral-700 hover:bg-neutral-50'}`}
          >
            {c.nameFa}
          </Link>
        ))}
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-4">
      <div className="min-w-0">
      <section className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Flag code={country.code} className="h-4 w-6" />
          {t.mode.title(country.nameFa)}
          <ModePill mode={country.mode} />
        </h2>
        {country.opensOn && <p className="mt-1 text-sm font-bold text-brand-800">{t.opensOn(formatDate(new Date(`${country.opensOn}T12:00:00Z`), zone))}</p>}
        {isStarter(country) && <p className="mt-1 text-sm text-neutral-700">{t.starterUntil(formatDate(starterUntil(country.openedAt)!, zone))}</p>}
        <form action={countryModeAction} className="mt-3 space-y-3">
          <input type="hidden" name="country" value={country.code} />
          <fieldset className="grid gap-2 sm:grid-cols-2">
            {COUNTRY_MODES.map((m) => (
              <label key={m} className="flex cursor-pointer gap-2 rounded-xl border border-neutral-200 p-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
                <input type="radio" name="mode" value={m} defaultChecked={m === country.mode} className="mt-1 accent-brand-700" />
                <span>
                  <b className="block">{t.modes[m]}</b>
                  <span className="text-xs leading-6 text-neutral-600">{t.modeHelp[m]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">{t.mode.opensOn}</span>
            <input type="date" name="opensOn" defaultValue={country.opensOn ?? ''} dir="ltr" className="h-10 rounded-xl border border-neutral-300 px-3" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sure" className="size-4 accent-brand-700" />
            {t.mode.sure}
          </label>
          <Button type="submit">{t.mode.save}</Button>
        </form>
      </section>
      {ready.map((c) => (
        <p key={c.id} className="mb-4 rounded-2xl border border-saffron-300 bg-saffron-50 p-4 text-sm font-bold text-saffron-800">{t.ready(c.nameFa, c.businesses, c.goal!)}</p>
      ))}

      {confirming && (
        <section className="mb-4 rounded-2xl border-2 border-brand-300 bg-brand-50 p-4">
          <p className="text-sm leading-7">{t.confirmOpen(confirming.nameFa, confirming.waiting)}</p>
          <form action={cityLaunchAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="cityId" value={confirming.id} />
            <input type="hidden" name="country" value={country.code} />
            <Button type="submit" name="change" value="open">{t.confirm}</Button>
            <Link href={adminHref(`/cities?country=${country.code}`)} prefetch={false} className="inline-flex items-center rounded-xl px-4 text-sm font-bold text-neutral-700">{t.cancel}</Link>
          </form>
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Flag code={country.code} className="h-5 w-7" />
          <b>{country.nameFa}</b>
          <span className="text-sm text-neutral-600">{t.keyOpen(key.filter((c) => c.status === 'open').length, key.length)}</span>
        </div>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-600">
            <tr>
              {(['city', 'status', 'businesses', 'waiting', 'actions'] as const).map((k) => <th key={k} className="p-3 text-start">{t.columns[k]}</th>)}
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.id} className="border-t border-neutral-200 align-top">
                <td className="p-3">
                  <b>{c.nameFa}</b>
                  {c.withName && <span className="block text-xs text-neutral-500">{t.with(c.withName)}</span>}
                  {c.radiusKm && <span className="block text-xs text-neutral-500">{t.radius(c.radiusKm)}</span>}
                </td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pill[c.status]}`}>{t.status[c.status]}</span></td>
                <td className="p-3">
                  {c.withName ? '—' : (
                    <form action={cityLaunchAction} className="flex items-center gap-2">
                      <input type="hidden" name="cityId" value={c.id} />
                      <input type="hidden" name="country" value={country.code} />
                      <div className="w-36">
                        <p className="flex items-center gap-2">
                          <b>{fa(c.businesses)}</b>
                          {c.status !== 'open' && (
                            <>
                              <span className="text-neutral-600">{t.of}</span>
                              <input name="goal" type="number" min={1} max={1000} defaultValue={c.goal ?? 20} className="h-9 w-16 rounded-lg border border-neutral-300 px-2 text-center" aria-label={t.columns.businesses} />
                            </>
                          )}
                        </p>
                        {c.goal && <Progress value={c.businesses} goal={c.goal} className="mt-1.5" />}
                      </div>
                      {c.status !== 'open' && (
                        <Button type="submit" name="change" value={c.status === 'waitlist' ? 'goal' : 'waitlist'} variant="secondary" className="!py-1.5 text-xs">
                          {c.status === 'waitlist' ? t.saveGoal : t.toWaitlist}
                        </Button>
                      )}
                    </form>
                  )}
                </td>
                <td className="p-3">
                  {fa(c.waiting)}
                  {c.waiting > 0 && !c.withName && (
                    <a href={adminHref(`/cities/export?city=${c.id}`)} className="ms-2 text-xs font-bold text-brand-800 underline">{t.export}</a>
                  )}
                </td>
                <td className="p-3">
                  {c.status === 'open' && c.openedAt && <span className="text-xs text-neutral-600">{t.openedOn(formatDate(c.openedAt, webEnv().APP_TIME_ZONE))}</span>}
                  {c.status !== 'open' && !c.withName && (
                    <div className="flex flex-wrap gap-2">
                      <Link href={adminHref(`/cities?country=${country.code}&confirm=${c.id}`)} prefetch={false} className="inline-flex h-9 items-center rounded-lg bg-brand-700 px-3 text-xs font-bold text-white">{t.open(c.nameFa)}</Link>
                      {c.status === 'waitlist' && (
                        <form action={cityLaunchAction}>
                          <input type="hidden" name="cityId" value={c.id} />
                          <input type="hidden" name="country" value={country.code} />
                          <Button type="submit" name="change" value="later" variant="secondary" className="!py-1.5 text-xs">{t.toLater}</Button>
                        </form>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="font-extrabold">{t.country.title(country.nameFa)}</h2>
        <p className="mt-2 text-sm leading-7 text-neutral-700">{t.country.body(country.nameFa)}</p>
        {sp.openCountry ? (
          <form action={openCountryAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="country" value={country.code} />
            <span className="text-sm font-bold">{t.country.confirm(country.nameFa)}</span>
            <Button type="submit">{t.confirm}</Button>
            <Link href={adminHref(`/cities?country=${country.code}`)} prefetch={false} className="text-sm font-bold text-neutral-700">{t.cancel}</Link>
          </form>
        ) : (
          <Link href={adminHref(`/cities?country=${country.code}&openCountry=1`)} prefetch={false} className="mt-3 inline-flex h-10 items-center rounded-xl border border-neutral-300 px-4 text-sm font-bold">{t.country.button(country.nameFa)}</Link>
        )}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="font-extrabold">{t.reward.title}</h2>
        <p className="mt-2 text-sm leading-7 text-neutral-700">{t.reward.body}</p>
        <p className="mt-2 text-xs leading-6 text-neutral-600">{key.filter((c) => c.status === 'waitlist').map((c) => t.reward.city(c.nameFa, c.rewardPlaces)).join('، ')}</p>
      </section>
      </div>
      </div>

      <aside className="mt-4 lg:mt-0">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:sticky lg:top-20">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Flag code={country.code} className="h-3.5 w-5" />
            {t.pauses.title(country.nameFa)}
          </h2>
          <p className="mt-1 text-xs leading-6 text-neutral-600">{t.pauses.intro}</p>
          {pauses.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600">{t.pauses.none}</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-200">
              {pauses.map((p) => (
                <li key={p.id} className="py-2.5 text-sm">
                  <p className="flex items-center justify-between gap-2">
                    <b>{p.categoryName}</b>
                    <span className="text-xs font-bold text-saffron-800">{t.pauses.until(formatDate(p.until, zone))}</span>
                  </p>
                  <p className="text-xs text-neutral-600">{p.city ?? t.pauses.wholeCountry}، {p.reason}</p>
                  <form action={liftPauseAction} className="mt-1.5">
                    <input type="hidden" name="country" value={country.code} />
                    <input type="hidden" name="pauseId" value={p.id} />
                    <button type="submit" className="text-xs font-bold text-brand-800 underline">{t.pauses.lift}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={pauseAction} className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
            <input type="hidden" name="country" value={country.code} />
            <label className="block text-xs font-medium text-neutral-700">
              {t.pauses.category}
              <select name="categoryId" required className={`${field} mt-1`}>
                {pausable.map((c) => <option key={c.id} value={c.id}>{c.depth ? `– ${c.name}` : c.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-neutral-700">
              {t.pauses.city}
              <select name="cityId" className={`${field} mt-1`}>
                <option value="">{t.pauses.wholeCountry}</option>
                {cities.filter((c) => !c.withName).map((c) => <option key={c.id} value={c.id}>{c.nameFa}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-neutral-700">
              {t.pauses.days}
              <input name="days" type="number" min={1} max={PAUSE_MAX_DAYS} defaultValue={7} required className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-neutral-700">
              {t.pauses.reason}
              <input name="reason" required minLength={3} maxLength={500} className={`${field} mt-1`} />
            </label>
            <Button type="submit" variant="secondary">{t.pauses.pause}</Button>
          </form>
        </section>
      </aside>
      </div>
    </>
  );
}
