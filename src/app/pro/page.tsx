import type { Metadata } from 'next';
import { Icon } from '../../components/icons';
import { Card, LinkButton } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { messages } from '../../messages/fa';
import { formatPrice } from '../../modules/listings/price';
import { activePrice } from '../../modules/payments/checkout';
import { FREE_BUSINESS, planFeatures } from '../../modules/payments/features';
import { myBusinesses } from '../../modules/organizations/organizations';
import { currentSession } from '../../modules/users/server';

// What Pro costs and includes (prices decided by the owner Oct 22, 2026). Private listings are
// always free; the page says so first.

export function generateMetadata(): Metadata {
  return { title: `${messages.pro.title} | ${messages.site.name}`, description: messages.pro.intro, alternates: { canonical: `${webEnv().APP_URL}/pro` } };
}

export default async function ProPage() {
  const db = appDb();
  const t = messages.pro;
  const session = await currentSession();
  const owned = session ? (await myBusinesses(db, session.user.id)).filter((b) => b.role === 'owner') : [];
  const plans = await Promise.all(
    (['pro', 'pro-plus'] as const).map(async (code) => {
      const [month, year] = await Promise.all([activePrice(db, code, 'EUR', 'month'), activePrice(db, code, 'EUR', 'year')]);
      return { code, month, year, features: planFeatures((month ?? year)?.product.features) };
    }),
  );
  const start = owned[0] ? `/b/${owned[0].slug}/billing` : '/business/new';

  const featureList = (f: typeof FREE_BUSINESS, extra: boolean) =>
    [t.features.listings(f.activeListings), t.features.bumps(f.bumpsPerMonth), t.features.featured(f.featuredSlots), t.features.staff(f.staffSeats), t.features.page, ...(extra ? [t.features.badge, t.features.stats] : [])].filter(
      (x): x is string => !!x,
    );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-3 text-2xl font-extrabold sm:text-3xl">{t.title}</h1>
      <p className="mb-8 max-w-2xl text-neutral-700">{t.intro}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <p className="text-lg font-extrabold">{t.freeName}</p>
          <p className="text-2xl font-extrabold text-brand-700">{t.free}</p>
          <ul className="flex-1 space-y-1.5 text-sm">
            {featureList(FREE_BUSINESS, false).map((x) => (
              <li key={x} className="flex gap-2">
                <Icon name="check" className="mt-0.5 size-4 text-brand-700" />
                {x}
              </li>
            ))}
          </ul>
          <LinkButton href={owned[0] ? `/b/${owned[0].slug}/manage` : '/business/new'} variant="secondary">
            {owned[0] ? messages.business.mine : t.createFirst}
          </LinkButton>
        </Card>
        {plans.map((p) => (
          <Card key={p.code} className={`flex flex-col gap-3 ${p.code === 'pro' ? 'border-brand-600 ring-2 ring-brand-600/20' : ''}`}>
            <p className="text-lg font-extrabold">{t.planNames[p.code]}</p>
            {p.month && (
              <p>
                <span className="text-2xl font-extrabold text-brand-700">{formatPrice(p.month.price.amountMinor, 'EUR', 2)}</span>{' '}
                <span className="text-sm text-neutral-600">{t.perMonth}</span>
              </p>
            )}
            {p.year && (
              <p className="text-sm text-neutral-600">
                {formatPrice(p.year.price.amountMinor, 'EUR', 2)} {t.perYear}، {t.yearlyNote}
              </p>
            )}
            <ul className="flex-1 space-y-1.5 text-sm">
              {featureList(p.features, true).map((x) => (
                <li key={x} className="flex gap-2">
                  <Icon name="check" className="mt-0.5 size-4 text-brand-700" />
                  {x}
                </li>
              ))}
            </ul>
            <LinkButton href={start}>{owned[0] ? t.start : t.createFirst}</LinkButton>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">{t.noVat}</p>
      <section className="mt-10 max-w-2xl space-y-3">
        {t.faq.map((f) => (
          <details key={f.q} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <summary className="cursor-pointer font-bold">{f.q}</summary>
            <p className="mt-2 text-sm text-neutral-700">{f.a}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
