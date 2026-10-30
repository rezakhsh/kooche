import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { IranPaymentNotice, fromIran } from '../../../../../components/iran';
import { Icon } from '../../../../../components/icons';
import { Alert, Button, Card, PageShell, Pill } from '../../../../../components/ui';
import { appDb } from '../../../../../db/drizzle';
import { webEnv } from '../../../../../lib/env';
import { formatDate } from '../../../../../lib/format';
import { messages } from '../../../../../messages/fa';
import { isEventListing } from '../../../../../modules/events/queries';
import { ownListing } from '../../../../../modules/listings/listings';
import { formatPrice } from '../../../../../modules/listings/price';
import { listingPath } from '../../../../../modules/listings/slug';
import { eq } from 'drizzle-orm';
import { organizations } from '../../../../../db/schema';
import { allowancesLeft } from '../../../../../modules/payments/allowances';
import { foundingState } from '../../../../../modules/payments/founding';
import { activePrice, EVENT_PRODUCTS, LISTING_PRODUCTS, PAYMENT_CURRENCY } from '../../../../../modules/payments/checkout';
import { listingPromotions } from '../../../../../modules/payments/plans';
import { paymentGateway } from '../../../../../modules/payments/server';
import { requireSession } from '../../../../../modules/users/server';
import { startPromotionAction, useAllowanceAction, useRewardAction } from './actions';
import { usableRewards } from '../../../../../modules/launch/rewards';

// Paid visibility for one of the user's own live listings or events (roadmap step 6). Works
// without JavaScript: a radio list, the withdrawal tick and a submit button that goes on to
// Stripe's hosted Checkout.

export const metadata = { title: messages.promote.title, robots: { index: false } };

type Params = { error?: string; product?: string; cancelled?: string; requested?: string; plan?: string; reward?: string };

export default async function PromotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id } = await params;
  const { user } = await requireSession(`/my/listings/${id}/promote`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = appDb();
  const own = await ownListing(db, user.id, id);
  if (!own || own.listing.status === 'draft') notFound();
  const { listing } = own;
  const query = await searchParams;
  const t = messages.promote;
  const zone = webEnv().APP_TIME_ZONE;
  const isEvent = await isEventListing(db, listing.id);
  const codes = isEvent ? EVENT_PRODUCTS : LISTING_PRODUCTS;
  // Euros everywhere; a listing priced in another money gets a word on paying in it
  const offers = (await Promise.all(codes.map((c) => activePrice(db, c, PAYMENT_CURRENCY)))).filter((o) => !!o);
  const otherMoney = !!listing.currency && listing.currency !== PAYMENT_CURRENCY;
  const running = await listingPromotions(db, listing.id);
  const rewards = await usableRewards(db, user.id);
  const plan = listing.organizationId ? await allowancesLeft(db, listing.organizationId) : null;
  const live = listing.status === 'active';
  // Paying isn't possible from Iran (src/lib/region.ts): a notice instead of the pay buttons
  const iran = await fromIran();
  const payments = !!paymentGateway() && !iran;
  const error = query.error && query.error in t.errors ? t.errors[query.error as keyof typeof t.errors] : null;
  const chosen = query.product && offers.some((o) => o.product.code === query.product) ? query.product : offers[0]?.product.code;
  const back = isEvent ? `/my/events` : `/my/listings`;
  // A founding business that hasn't started its free months yet: point to its included bumps
  const foundingSlug =
    listing.organizationId && !plan?.plan.subscriptionId && (await foundingState(db, listing.organizationId)) === 'offered'
      ? (await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, listing.organizationId)))[0]?.slug
      : null;

  return (
    <PageShell title={isEvent ? t.titleEvent : t.title} wide>
      <div className="space-y-5">
        <p className="text-sm text-neutral-700">
          <Link href={listingPath(listing.title, listing.publicToken)} className="font-bold text-brand-800 hover:underline">
            {listing.title}
          </Link>
        </p>
        {/* Back from Stripe's page unpaid (wave 1); the same choice is ticked below */}
        {query.cancelled && (
          <Alert tone="info">
            {messages.orders.notPaid}{' '}
            {live && payments && (
              <a href="#pay" className="font-bold text-brand-800 underline">
                {messages.orders.retry}
              </a>
            )}
          </Alert>
        )}
        {query.requested && <Alert tone="success">{t.plan.requested}</Alert>}
        {query.reward === 'used' && <Alert tone="success">{t.reward.used}</Alert>}
        {(query.reward === 'none' || query.reward === 'not_allowed') && <Alert tone="error">{t.reward[query.reward]}</Alert>}
        {query.plan === 'none_left' && <Alert tone="error">{t.plan.none_left}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {!live && <Alert tone="error">{t.notLive}</Alert>}
        {iran ? <IranPaymentNotice /> : !payments && <Alert tone="info">{t.off}</Alert>}

        {(running.featuredUntil || running.pendingBumps.length > 0) && (
          <Card>
            <h2 className="mb-2 text-sm font-extrabold">{t.running}</h2>
            <p className="flex flex-wrap gap-2">
              {running.featuredUntil && <Pill tone="saffron">{t.featuredUntil(formatDate(running.featuredUntil, zone))}</Pill>}
              {running.pendingBumps.length > 0 && <Pill tone="brand">{t.bumpsWaiting(running.pendingBumps.length)}</Pill>}
            </p>
          </Card>
        )}

        {live && plan?.plan.subscriptionId && (plan.bumps > 0 || plan.featured > 0) && (
          <Card>
            <h2 className="mb-3 text-sm font-extrabold">{t.plan.title}</h2>
            <div className="flex flex-wrap gap-2">
              {plan.bumps > 0 && (
                <form action={useAllowanceAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <input type="hidden" name="kind" value="bump" />
                  <Button type="submit" variant="secondary">{t.plan.bump(plan.bumps)}</Button>
                </form>
              )}
              {plan.featured > 0 && !running.featuredUntil && (
                <form action={useAllowanceAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <input type="hidden" name="kind" value="featured" />
                  <Button type="submit" variant="secondary">{t.plan.featured(plan.featured)}</Button>
                </form>
              )}
            </div>
          </Card>
        )}

        {/* The waitlist's free bump (wave 2 part 9): free, so from Iran and without payments too */}
        {live && !isEvent && rewards[0] && (
          <div className="rounded-2xl border-2 border-saffron-100 bg-saffron-50 p-4">
            <h2 className="text-sm font-extrabold">{t.reward.title}</h2>
            <p className="mt-1 text-sm leading-7 text-neutral-700">{t.reward.text(rewards[0].cityFa, formatDate(rewards[0].endsAt, zone))}</p>
            <form action={useRewardAction} className="mt-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <Button type="submit">
                <Icon name="arrowUp" className="size-4" />
                {t.reward.use}
              </Button>
            </form>
          </div>
        )}

        {foundingSlug && (
          <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 text-sm leading-7">
            <p>{t.foundingHint}</p>
            <Link href={`/b/${foundingSlug}/manage`} className="font-bold text-brand-800 underline">
              {messages.business.billing.founding.start}
            </Link>
          </div>
        )}

        {live && payments && offers.length > 0 && (
          <form id="pay" action={startPromotionAction} className="scroll-mt-20 space-y-4">
            <input type="hidden" name="listingId" value={listing.id} />
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm text-neutral-700">{t.intro}</legend>
              {offers.map(({ product, price }) => (
                <label key={product.code} className="flex cursor-pointer gap-3 rounded-2xl border border-neutral-200 bg-white p-4 has-[:checked]:border-brand-600 has-[:checked]:ring-2 has-[:checked]:ring-brand-600/20">
                  {/* A card to tap, with a tick instead of the browser's radio dot (wave 1) */}
                  <input type="radio" name="product" value={product.code} defaultChecked={product.code === chosen} className="peer sr-only" />
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-300 text-transparent peer-checked:border-brand-700 peer-checked:bg-brand-700 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700"
                  >
                    <Icon name="check" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">{product.nameFa}</span>
                      <span className="font-extrabold text-brand-700">{formatPrice(price.amountMinor, price.currency, 2)}</span>
                    </span>
                    <span className="mt-1 block text-sm text-neutral-600">{product.descriptionFa}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-neutral-500">{t.noVat}</p>
            {otherMoney && <p className="text-xs text-neutral-500">{t.inEuros}</p>}
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="waiver" required className="mt-0.5 size-4 shrink-0 accent-brand-700" />
              <span>
                {t.waiver}{' '}
                <Link href="/terms#s14" className="text-brand-800 underline">
                  {t.terms}
                </Link>
              </span>
            </label>
            <Button type="submit" className="w-full sm:w-auto">
              <Icon name="arrow-up" className="size-4" />
              {t.pay}
            </Button>
            <p className="text-xs text-neutral-500">{t.methods}</p>
          </form>
        )}

        <Link href={back} className="inline-block text-sm text-neutral-600 hover:underline">
          {messages.orders.backToMine}
        </Link>
      </div>
    </PageShell>
  );
}
