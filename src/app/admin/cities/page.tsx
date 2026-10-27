import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { adminCities } from '../../../modules/launch/waitlist';
import { activeCountries } from '../../../modules/listings/queries';
import { Flag } from '../../../components/flag';
import { formatDate } from '../../../lib/format';
import { webEnv } from '../../../lib/env';
import { AdminTitle, Progress } from '../ui';
import { cityLaunchAction, openCountryAction } from './actions';

// Countries and cities (round 12, mockup admin-cities): one goal per city (verified businesses),
// people waiting for information only, and the owner's one-click opening with a confirmation step.
// Wave 1: the mockup's look (country tabs, the country's key cities open, a bar under each goal,
// the opening date, the early-signup reward beside the country rule).

const fa = (n: number) => n.toLocaleString('fa-IR');

export default async function CitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('cities.manage');
  const sp = await searchParams;
  const t = admin.cities;
  const db = appDb();
  const countries = await activeCountries(db);
  const country = countries.find((c) => c.code === sp.country) ?? countries[0];
  if (!country) return <AdminTitle title={t.title} intro={t.intro} />;
  const cities = await adminCities(db, country.code);
  const confirming = cities.find((c) => c.id === sp.confirm);
  // Key cities: those with their own goal (Bonn counts with Cologne)
  const key = cities.filter((c) => !c.withName && c.status !== 'later');
  const ready = cities.filter((c) => c.status === 'waitlist' && c.goal && c.businesses >= c.goal * 0.9);
  const pill = { open: 'bg-green-50 text-green-800', waitlist: 'bg-neutral-100 text-neutral-700', later: 'bg-neutral-50 text-neutral-500' } as const;

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro}>
        <nav aria-label={t.title} className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-neutral-200">
          {countries.map((c) => (
            <Link
              key={c.code}
              href={adminHref(`/cities?country=${c.code}`)}
              prefetch={false}
              aria-current={c.code === country.code ? 'page' : undefined}
              className={`rounded-lg px-3 text-sm leading-9 ${c.code === country.code ? 'bg-brand-50 font-bold text-brand-800' : 'text-neutral-700 hover:bg-neutral-50'}`}
            >
              {c.nameFa}
            </Link>
          ))}
        </nav>
      </AdminTitle>
      {sp.done && <div className="mb-4"><Alert tone="success">{t.done}</Alert></div>}
      {sp.error && <div className="mb-4"><Alert tone="error">{t.error}</Alert></div>}
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
    </>
  );
}
