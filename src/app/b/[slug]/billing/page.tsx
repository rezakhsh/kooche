import { Alert, Button, Card, PageShell, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatDate } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { formatPrice } from '../../../../modules/listings/price';
import { activePrice } from '../../../../modules/payments/checkout';
import { activeSubscription, businessPlan, latestSubscription } from '../../../../modules/payments/plans';
import { paymentGateway } from '../../../../modules/payments/server';
import { portalAction, subscribeAction } from '../../../business/actions';
import { memberOf } from '../member';

// The business's plan (owner only): subscribe through Stripe Checkout, or manage the running
// subscription in Stripe's Customer Portal. What the business has is read from entitlements; the
// subscription row only mirrors Stripe for this page.

export const metadata = { title: messages.business.billing.title, robots: { index: false } };

export default async function BillingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const { org } = await memberOf(slug, `/b/${slug}/billing`, ['owner']);
  const db = appDb();
  const t = messages.business.billing;
  const zone = webEnv().APP_TIME_ZONE;
  const [plan, running, latest] = await Promise.all([businessPlan(db, org.id), activeSubscription(db, org.id), latestSubscription(db, org.id)]);
  const offers = await Promise.all(
    (['pro', 'pro-plus'] as const).map(async (code) => ({ code, month: await activePrice(db, code, 'EUR', 'month'), year: await activePrice(db, code, 'EUR', 'year') })),
  );
  const payments = !!paymentGateway();
  const error = query.error && query.error in t.errors ? t.errors[query.error as keyof typeof t.errors] : null;
  const hidden = (
    <>
      <input type="hidden" name="organizationId" value={org.id} />
      <input type="hidden" name="slug" value={org.slug} />
    </>
  );
  const processing = running && !plan.code && (running.status === 'incomplete' || running.status === 'active');

  return (
    <PageShell title={`${t.title}: ${org.name}`} wide>
      <div className="space-y-5">
        {query.done && !plan.code && <meta httpEquiv="refresh" content="4" />}
        {query.done && <Alert tone="success">{t.done}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {!payments && <Alert tone="info">{t.off}</Alert>}

        <Card className="space-y-2">
          <h2 className="font-extrabold">{t.current}</h2>
          {latest && running ? (
            <>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{messages.pro.planNames[latest.code] ?? latest.code}</span>
                <span className="text-sm text-neutral-600">{latest.interval === 'year' ? t.yearly : t.monthly}</span>
                <Pill tone={running.status === 'active' || running.status === 'trialing' ? 'success' : 'warning'}>{t.status[running.status]}</Pill>
              </p>
              <p className="text-sm text-neutral-600">{running.cancelAtPeriodEnd ? t.ends(formatDate(running.currentPeriodEnd, zone)) : t.renews(formatDate(running.currentPeriodEnd, zone))}</p>
              {processing && <Alert tone="info">{t.processing}</Alert>}
            </>
          ) : (
            <p className="text-sm text-neutral-600">{t.none}</p>
          )}
          {latest && payments && (
            <form action={portalAction} className="pt-2">
              {hidden}
              <Button type="submit" variant="secondary">
                {t.portal}
              </Button>
              <p className="mt-1 text-xs text-neutral-500">{t.portalHint}</p>
            </form>
          )}
        </Card>

        {!running && payments && (
          <section className="space-y-3">
            <h2 className="font-extrabold">{t.choose}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {offers.map((o) => (
                <form key={o.code} action={subscribeAction} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
                  {hidden}
                  <input type="hidden" name="plan" value={o.code} />
                  <p className="text-lg font-extrabold">{messages.pro.planNames[o.code]}</p>
                  <fieldset className="space-y-2 text-sm">
                    {o.month && (
                      <label className="flex items-center gap-2">
                        <input type="radio" name="interval" value="month" defaultChecked className="accent-brand-700" />
                        {t.monthly}: <b>{formatPrice(o.month.price.amountMinor, 'EUR', 2)}</b>
                      </label>
                    )}
                    {o.year && (
                      <label className="flex items-center gap-2">
                        <input type="radio" name="interval" value="year" className="accent-brand-700" />
                        {t.yearly}: <b>{formatPrice(o.year.price.amountMinor, 'EUR', 2)}</b>
                      </label>
                    )}
                  </fieldset>
                  <Button type="submit" className="w-full">
                    {t.subscribe}
                  </Button>
                </form>
              ))}
            </div>
            <p className="text-xs text-neutral-500">{t.code}</p>
            <p className="text-xs text-neutral-500">{t.methods}</p>
            <p className="text-xs text-neutral-500">{messages.pro.noVat}</p>
          </section>
        )}
      </div>
    </PageShell>
  );
}
