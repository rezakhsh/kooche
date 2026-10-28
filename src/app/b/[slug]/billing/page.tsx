import { IranPaymentNotice, fromIran } from '../../../../components/iran';
import { Alert, Button, Card, PageShell, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatDate } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { formatPrice } from '../../../../modules/listings/price';
import { activePrice, businessInvoices } from '../../../../modules/payments/checkout';
import { activeSubscription, businessPlan, latestSubscription } from '../../../../modules/payments/plans';
import { paymentGateway } from '../../../../modules/payments/server';
import { foundingAction, portalAction, subscribeAction } from '../../../business/actions';
import { foundingState } from '../../../../modules/payments/founding';
import { legalComplete } from '../../../../modules/organizations/organizations';
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
  const [plan, running, latest, founding] = await Promise.all([businessPlan(db, org.id), activeSubscription(db, org.id), latestSubscription(db, org.id), foundingState(db, org.id)]);
  const offers = await Promise.all(
    (['pro', 'pro-plus'] as const).map(async (code) => ({ code, month: await activePrice(db, code, 'EUR', 'month'), year: await activePrice(db, code, 'EUR', 'year') })),
  );
  // Paying isn't possible from Iran (src/lib/region.ts): a notice instead of the pay buttons
  const iran = await fromIran();
  const payments = !!paymentGateway() && !iran;
  // Listed here from Stripe: its Customer Portal leaves out some invoices (the €0 trial invoice)
  const invoices = await businessInvoices(db, paymentGateway(), org.id);
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
        {iran ? <IranPaymentNotice /> : !payments && <Alert tone="info">{t.off}</Alert>}
        {/* Wave 1: the legal details can wait until here; paying needs them (legal_missing) */}
        {payments && !running && !legalComplete(org) && (
          <Alert tone="info">
            {t.errors.legal_missing}{' '}
            <a href={`/b/${org.slug}/edit`} className="font-bold underline">
              {messages.business.wizard.legalHeading}
            </a>
          </Alert>
        )}

        {founding === 'offered' && !running && payments && (
          <form action={foundingAction} className="space-y-3 rounded-3xl border-2 border-brand-200 bg-brand-50 p-4 lg:p-5">
            {hidden}
            <h2 className="text-lg font-extrabold">{t.founding.title}</h2>
            <p className="text-sm leading-7 text-neutral-700">{t.founding.body}</p>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="business" required className="mt-0.5 size-4 shrink-0 accent-brand-700" />
              <span>{t.businessTick}</span>
            </label>
            <Button type="submit" className="w-full sm:w-auto">
              {t.founding.start}
            </Button>
          </form>
        )}
        {running?.status === 'trialing' && running.trialEndsAt && (
          <div className="space-y-1 rounded-2xl bg-brand-50 p-4 text-sm leading-7">
            <p className="font-bold text-brand-800">{t.founding.trialing(formatDate(running.trialEndsAt, zone))}</p>
            <p className="text-neutral-700">{t.founding.continue}</p>
          </div>
        )}

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

        {invoices.length > 0 && (
          <Card className="space-y-2">
            <h2 className="font-extrabold">{t.invoices.title}</h2>
            <ul className="divide-y divide-neutral-100 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="tabular-nums">{formatDate(inv.created, zone)}</span>
                  {inv.number && <span className="text-xs text-neutral-500" dir="ltr">{inv.number}</span>}
                  <b className="tabular-nums">{formatPrice(inv.totalMinor, inv.currency, 2)}</b>
                  {inv.status && <Pill tone={inv.status === 'paid' ? 'success' : 'neutral'}>{t.invoices.status[inv.status] ?? inv.status}</Pill>}
                  {inv.url && (
                    <a href={inv.url} target="_blank" rel="noopener noreferrer" className="ms-auto font-bold text-brand-800 underline">
                      {t.invoices.view}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

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
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" name="business" required className="mt-0.5 size-4 shrink-0 accent-brand-700" />
                    <span>{t.businessTick}</span>
                  </label>
                  <Button type="submit" className="w-full">
                    {t.subscribe}
                  </Button>
                </form>
              ))}
            </div>
            <p className="text-xs text-neutral-500">{t.methods}</p>
            <p className="text-xs text-neutral-500">{t.businessTickHint}</p>
            <p className="text-xs text-neutral-500">{messages.pro.noVat}</p>
          </section>
        )}
      </div>
    </PageShell>
  );
}
