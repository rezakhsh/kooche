import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { adminCities } from '../../../modules/launch/waitlist';
import { activeCountries } from '../../../modules/listings/queries';
import { AdminTitle, Chips } from '../ui';
import { cityLaunchAction, openCountryAction } from './actions';

// Countries and cities (round 12, mockup admin-cities): one goal per city (verified businesses),
// people waiting for information only, and the owner's one-click opening with a confirmation step.

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
  const ready = cities.filter((c) => c.status === 'waitlist' && c.goal && c.businesses >= c.goal * 0.9);
  const pill = { open: 'bg-green-50 text-green-800', waitlist: 'bg-neutral-100 text-neutral-700', later: 'bg-neutral-50 text-neutral-500' } as const;

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro}>
        {countries.length > 1 && <Chips items={countries.map((c) => ({ href: adminHref(`/cities?country=${c.code}`), label: c.nameFa, active: c.code === country.code }))} />}
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
                      <b>{fa(c.businesses)}</b>
                      {c.status !== 'open' && (
                        <>
                          <span className="text-neutral-500">/</span>
                          <input name="goal" type="number" min={1} max={1000} defaultValue={c.goal ?? 20} className="h-9 w-20 rounded-lg border border-neutral-300 px-2" aria-label={t.columns.businesses} />
                          <Button type="submit" name="change" value={c.status === 'waitlist' ? 'goal' : 'waitlist'} variant="secondary" className="!py-1.5">
                            {c.status === 'waitlist' ? t.saveGoal : t.toWaitlist}
                          </Button>
                        </>
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

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
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
    </>
  );
}
