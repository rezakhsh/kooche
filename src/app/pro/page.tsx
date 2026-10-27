import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { fromIran } from '../../components/iran';
import { Icon } from '../../components/icons';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { messages } from '../../messages/fa';
import { keyCitiesOf } from '../../modules/launch/waitlist';
import { formatPrice } from '../../modules/listings/price';
import { activeCountries } from '../../modules/listings/queries';
import { activePrice } from '../../modules/payments/checkout';
import { FREE_BUSINESS, planFeatures, type PlanFeatures } from '../../modules/payments/features';
import { cityFoundingPlaces } from '../../modules/payments/founding';
import { myBusinesses } from '../../modules/organizations/organizations';
import { currentSession } from '../../modules/users/server';
import { visitorCountry } from '../../lib/client-ip';
import { chosenCountry } from '../country-choice';

// What Pro costs and includes (wave 1, mockup final/pro; prices decided by the owner Oct 22, 2026):
// the founding offer of the first open city first, a monthly / yearly switch (CSS only, so it works
// without JavaScript), three plans with «پیشنهاد ما» on Pro, a short FAQ. Private listings are
// always free; the page says so first. No pay buttons from Iran (src/lib/region.ts).

export function generateMetadata(): Metadata {
  return { title: `${messages.pro.title} | ${messages.site.name}`, description: messages.pro.intro, alternates: { canonical: `${webEnv().APP_URL}/pro` } };
}

type Plan = { code: 'free' | 'pro' | 'pro-plus'; month: number | null; year: number | null; features: PlanFeatures };

const eur = (minor: number) => formatPrice(minor, 'EUR', 2);

export default async function ProPage() {
  const db = appDb();
  const t = messages.pro;
  const session = await currentSession();
  const [owned, iran] = await Promise.all([session ? myBusinesses(db, session.user.id).then((b) => b.filter((x) => x.role === 'owner')) : Promise.resolve([]), fromIran()]);
  const paid = await Promise.all(
    (['pro', 'pro-plus'] as const).map(async (code): Promise<Plan> => {
      const [month, year] = await Promise.all([activePrice(db, code, 'EUR', 'month'), activePrice(db, code, 'EUR', 'year')]);
      return { code, month: month?.price.amountMinor ?? null, year: year?.price.amountMinor ?? null, features: planFeatures((month ?? year)?.product.features) };
    }),
  );
  const plans: Plan[] = [{ code: 'free', month: null, year: null, features: FREE_BUSINESS }, ...paid];

  // The founding offer of the visitor's country's first open city, with its places left
  const [countries, chosen, here] = await Promise.all([activeCountries(db), chosenCountry(db), headers().then(visitorCountry)]);
  const country = chosen ?? countries.find((c) => c.code === here) ?? countries[0];
  const firstOpen = country ? ((await keyCitiesOf(db, country.code)).find((c) => c.status === 'open') ?? null) : null;
  const founding = firstOpen ? await cityFoundingPlaces(db, firstOpen.id) : null;
  const left = founding ? Math.max(0, founding.places - founding.used) : 0;

  const mine = owned[0];
  const startHref = (code: Plan['code']) => (code === 'free' ? (mine ? `/b/${mine.slug}/manage` : '/business/new') : mine ? `/b/${mine.slug}/billing` : '/business/new');
  const featureList = (p: Plan) => {
    const f = t.features;
    if (p.code === 'free') return [f.listings(p.features.activeListings), f.page, f.bumps(0)];
    const list = [f.listings(p.features.activeListings), f.bumps(p.features.bumpsPerMonth), f.featured(p.features.featuredSlots), f.staff(p.features.staffSeats)];
    return (p.code === 'pro' ? [...list, f.badge, f.stats] : [...list, f.allPro]).filter((x): x is string => !!x);
  };
  const price = (p: Plan, interval: 'month' | 'year') => {
    if (p.code === 'free') return { main: t.free, per: '', note: t.forever };
    const main = interval === 'month' ? p.month : p.year;
    const other = interval === 'month' ? p.year : p.month;
    if (main === null) return null;
    const note = other === null ? '' : interval === 'month' ? t.orYearly(eur(other), eur(main * 12 - other)) : t.orMonthly(eur(other));
    return { main: eur(main), per: interval === 'month' ? t.perMonth : t.perYear, note };
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-10">
      <h1 className="text-2xl font-extrabold lg:text-4xl">{t.title}</h1>
      <p className="mt-2 max-w-2xl text-base leading-8 text-neutral-700">{t.intro}</p>

      {founding && firstOpen && country && left > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-saffron-50 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-saffron-500 text-neutral-900">
            <Icon name="star" className="size-5" />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <b className="block">{t.founding.title(firstOpen.nameFa)}</b>
            <span className="block text-sm leading-7 text-saffron-800">
              {t.founding.body(founding.places, left)}{' '}
              <Link href={`/${country.slug}/${firstOpen.slug}/founding`} className="font-bold underline">
                {t.founding.terms}
              </Link>
            </span>
          </div>
          <Link href={mine ? `/b/${mine.slug}/manage` : '/business/new'} className="flex h-11 items-center gap-2 rounded-xl border border-saffron-300 bg-white px-4 text-sm font-bold text-brand-800 hover:bg-saffron-50">
            {mine ? t.mine : t.founding.cta}
          </Link>
        </div>
      )}

      {/* The switch: two radios and CSS, so the prices change without JavaScript */}
      <div className="group/interval">
        <div className="mt-6 flex justify-center">
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm">
            <label className="cursor-pointer">
              <input type="radio" name="interval" value="month" defaultChecked className="peer sr-only" />
              <span className="block rounded-full px-5 leading-10 text-neutral-700 peer-checked:bg-white peer-checked:font-bold peer-checked:text-neutral-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">{t.monthly}</span>
            </label>
            <label className="cursor-pointer">
              <input type="radio" name="interval" value="year" id="pro-yearly" className="peer sr-only" />
              <span className="block rounded-full px-5 leading-10 text-neutral-700 peer-checked:bg-white peer-checked:font-bold peer-checked:text-neutral-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
                {t.yearly} <b className="text-green-800">{t.yearlyFree}</b>
              </span>
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {plans.map((p) => {
            const rec = p.code === 'pro';
            const name = p.code === 'free' ? t.freeName : t.planNames[p.code]!;
            return (
              <section key={p.code} className={`relative flex flex-col rounded-3xl bg-white p-5 ${rec ? 'border-2 border-brand-600 shadow-lg' : 'border border-neutral-200'}`}>
                {rec && <span className="absolute -top-3 start-5 rounded-full bg-brand-700 px-3 text-xs leading-6 font-bold text-white">{t.recommended}</span>}
                <h2 className="text-lg font-extrabold">{name}</h2>
                {(['month', 'year'] as const).map((interval) => {
                  const pr = price(p, interval);
                  if (!pr) return null;
                  const show = p.code === 'free' ? (interval === 'month' ? 'block' : 'hidden') : interval === 'month' ? 'block group-has-[#pro-yearly:checked]/interval:hidden' : 'hidden group-has-[#pro-yearly:checked]/interval:block';
                  return (
                    <div key={interval} className={show}>
                      <p className="mt-1">
                        <b className="text-3xl font-black">{pr.main}</b> <span className="text-sm text-neutral-600">{pr.per}</span>
                      </p>
                      <p className="text-xs text-neutral-600">{pr.note}</p>
                    </div>
                  );
                })}
                <ul className="mt-4 flex-1 space-y-2">
                  {featureList(p).map((x) => (
                    <li key={x} className="flex items-start gap-2 text-sm">
                      <Icon name="check" className="mt-1 size-4 shrink-0 text-brand-700" />
                      {x}
                    </li>
                  ))}
                </ul>
                {p.code === 'free' || !iran ? (
                  <Link
                    href={startHref(p.code)}
                    className={`mt-5 flex h-12 items-center justify-center rounded-xl font-bold ${rec ? 'bg-brand-700 text-white hover:bg-brand-800' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                  >
                    {p.code === 'free' ? (mine ? t.mine : t.createFirst) : t.start(name)}
                  </Link>
                ) : (
                  <p className="mt-5 text-xs leading-6 text-neutral-600">{t.iranNote}</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-neutral-600">{t.noVat}</p>

      <h2 className="mt-10 text-xl font-extrabold">{t.faqTitle}</h2>
      <div className="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {t.faq.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
              {f.q}
              <Icon name="chevronDown" className="size-4 shrink-0 text-neutral-500 transition group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-sm leading-7 text-neutral-700">{f.a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
