import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import {
  auditLog,
  billingCustomers,
  entitlements,
  eventDates,
  orders,
  organizations,
  payments,
  productPrices,
  products,
  subscriptions,
  webhookEvents,
} from '../../db/schema';
import type { PaymentGateway } from './gateway';
import {
  checkoutSessionSchema,
  disputeSchema,
  eventSchema,
  fromUnix,
  invoiceSchema,
  refundSchema,
  subscriptionSchema,
  type CheckoutSession,
  type Invoice,
  type Refund,
  type Subscription,
} from './stripe-objects';
import { restrictedBillingPlace } from '../../lib/region';
import { queuePaymentNotice } from './notices';
import { REFUSED_REVOKE_REASON, refusedPlace, refusePayment } from './restricted';
import { endWithdrawnOrder } from './withdrawals';

// The worker applies stored webhooks (docs/schema.md, section 12), as classifieds_worker, the only
// role that may write payments, subscriptions and entitlements. One webhook_events row is applied
// in one transaction that locks it first, so a duplicate delivery or a retried job is applied once.
// Calls back to the provider (the current subscription, an invoice's payments) happen before that
// transaction, never while the row is locked.
//
// A payment whose billing address is in a place payments can't come from (Stripe's restricted
// jurisdictions, src/lib/region.ts) grants nothing: the order or plan is refused, refunded in full
// and the subscription cancelled (./restricted.ts), checked in checkoutPaid and invoicePaid.

const DAY_MS = 86_400_000;
/**
 * A pro_plan period lasts until the period's end plus this grace (decided Oct 22, 2026): a SEPA
 * renewal is confirmed only about 6 business days later, and card retries take days too. A
 * subscription that ends revokes what is left of it.
 */
export const PRO_GRACE_MS = 7 * DAY_MS;
/** A featured event lasts until its last date ends, at most this long */
const FEATURED_EVENT_MAX_MS = 30 * DAY_MS;
const ENDED = new Set<Subscription['status']>(['canceled', 'unpaid', 'incomplete_expired']);

type Order = typeof orders.$inferSelect;
type Product = typeof products.$inferSelect;

/** Something the event needs isn't there yet (events can arrive out of order): retried later */
export class NotReady extends Error {}

/**
 * The event is about something this database never made: a checkout or subscription started
 * elsewhere on the same Stripe account (a local run on the shared test account, Oct 22, 2026).
 * In test mode it is skipped; in live mode it stays an error for the system page.
 */
export class NotOurs extends Error {}

export type ApplyOutcome = 'applied' | 'duplicate' | 'skipped';

/** Applies one stored webhook. Throws on failure, after recording the error on the row. */
export async function applyWebhookEvent(db: Db, gateway: PaymentGateway, webhookEventId: string, now = new Date()): Promise<ApplyOutcome> {
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, webhookEventId));
  if (!row) throw new Error(`webhook event ${webhookEventId} not found`);
  if (row.processedAt) return 'duplicate';
  let live = true;
  try {
    const event = eventSchema.parse(row.payload);
    live = event.livemode;
    const fetched = await prefetch(gateway, event.type, event.data.object);
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ processedAt: webhookEvents.processedAt })
        .from(webhookEvents)
        .where(eq(webhookEvents.id, webhookEventId))
        .for('update');
      if (locked?.processedAt) return 'duplicate';
      await dispatch(tx, event.type, event.data.object, fetched, { now, occurredAt: fromUnix(event.created) });
      await tx
        .update(webhookEvents)
        .set({ processedAt: now, attempts: sql`${webhookEvents.attempts} + 1`, lastError: null })
        .where(eq(webhookEvents.id, webhookEventId));
      return 'applied';
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotOurs && !live) {
      await db
        .update(webhookEvents)
        .set({ processedAt: now, attempts: sql`least(${webhookEvents.attempts} + 1, 32767)`, lastError: `skipped (test mode): ${message}`.slice(0, 1000) })
        .where(and(eq(webhookEvents.id, webhookEventId), isNull(webhookEvents.processedAt)));
      return 'skipped';
    }
    await db
      .update(webhookEvents)
      .set({ attempts: sql`least(${webhookEvents.attempts} + 1, 32767)`, lastError: message.slice(0, 1000) })
      .where(eq(webhookEvents.id, webhookEventId));
    throw e;
  }
}

type Fetched = { subscription?: Subscription; invoice?: Invoice; refund?: Refund };

async function prefetch(gateway: PaymentGateway, type: string, object: Record<string, unknown>): Promise<Fetched> {
  if (type.startsWith('customer.subscription.')) {
    const id = subscriptionSchema.shape.id.parse(object.id);
    return { subscription: subscriptionSchema.parse(await gateway.getSubscription(id)) };
  }
  if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
    const invoice = invoiceSchema.parse(object);
    const subId = invoice.parent?.subscription_details?.subscription;
    if (!subId) return {};
    const subscription = subscriptionSchema.parse(await gateway.getSubscription(subId));
    // The payment intent of a paid invoice is only in its payments list
    const full = type === 'invoice.paid' && invoice.amount_paid > 0 ? invoiceSchema.parse(await gateway.getInvoice(invoice.id)) : invoice;
    return { subscription, invoice: full };
  }
  if (type.startsWith('refund.')) {
    // Its status now, not the event's: an older "pending" must not overwrite a later "failed"
    const id = refundSchema.shape.id.parse(object.id);
    return { refund: refundSchema.parse((await gateway.getRefund(id)) ?? object) };
  }
  if (type === 'checkout.session.completed') {
    const session = checkoutSessionSchema.parse(object);
    if (session.mode === 'subscription' && session.subscription) {
      return { subscription: subscriptionSchema.parse(await gateway.getSubscription(session.subscription)) };
    }
  }
  return {};
}

type Ctx = { now: Date; occurredAt: Date };

async function dispatch(tx: Queryable, type: string, object: Record<string, unknown>, fetched: Fetched, ctx: Ctx): Promise<void> {
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return checkoutPaid(tx, checkoutSessionSchema.parse(object), fetched, ctx);
    case 'checkout.session.async_payment_failed':
      return checkoutClosed(tx, checkoutSessionSchema.parse(object), 'failed');
    case 'checkout.session.expired':
      return checkoutClosed(tx, checkoutSessionSchema.parse(object), 'expired');
    case 'invoice.paid':
      return invoicePaid(tx, fetched, ctx);
    case 'invoice.payment_failed':
      return paymentFailed(tx, fetched, ctx);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      if (fetched.subscription) await syncSubscription(tx, fetched.subscription, ctx);
      return;
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
      return refundChanged(tx, fetched.refund ?? refundSchema.parse(object), ctx);
    case 'charge.dispute.created':
      return disputed(tx, disputeSchema.parse(object), ctx);
    case 'charge.dispute.closed':
      return disputeClosed(tx, disputeSchema.parse(object), ctx);
    default:
      // The endpoint stores only handled types (./webhook.ts); nothing to do for anything else
      return;
  }
}

// ---------------------------------------------------------------------------
// One-time products
// ---------------------------------------------------------------------------

/** The checkout's order, locked; null when this database never made one for it */
async function lockOrder(tx: Queryable, session: CheckoutSession): Promise<Order | null> {
  const id = session.client_reference_id;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
  if (!order) return null;
  // The order is made before its Checkout page, and the page's id stored right after
  if (order.providerCheckoutId !== session.id) throw new NotReady(`order ${order.id} isn't linked to checkout ${session.id} yet`);
  return order;
}

async function checkoutPaid(tx: Queryable, session: CheckoutSession, fetched: Fetched, ctx: Ctx): Promise<void> {
  if (session.mode === 'subscription') {
    // The subscription itself; its invoice.paid grants the plan
    if (!fetched.subscription) return;
    const { row } = await syncSubscription(tx, fetched.subscription, ctx);
    // A billing address in a restricted place: the plan is refused, cancelled and refunded (./restricted.ts)
    const place = restrictedBillingPlace(session.customer_details?.address);
    if (place && row.organizationId && (await refusedPlace(tx, 'subscription', row.id)) === null) {
      // Its invoice may have been applied first (events out of order): its payment is refunded too
      const [charge] = session.invoice
        ? await tx
            .select()
            .from(payments)
            .where(and(eq(payments.subscriptionId, row.id), eq(payments.kind, 'charge'), eq(payments.providerInvoiceId, session.invoice)))
        : [];
      await revokeRefusedPeriods(tx, row.id, ctx.now);
      await refusePayment(
        tx,
        { type: 'subscription', subscriptionId: row.id, organizationId: row.organizationId },
        {
          what: 'subscription',
          place,
          subscription: fetched.subscription.id,
          paymentIntent: charge?.providerPaymentId ?? null,
          amountMinor: charge?.amountMinor ?? 0,
          currency: (charge?.currency ?? session.currency ?? 'EUR').toUpperCase(),
          key: session.invoice ?? session.id,
        },
        { checkout: session.id, invoice: session.invoice },
      );
    }
    return;
  }
  if (session.mode !== 'payment') return;
  // A delayed payment method completes the session unpaid; async_payment_succeeded follows
  if (session.payment_status !== 'paid') return;
  const order = await lockOrder(tx, session);
  if (!order) throw new NotOurs(`no order for checkout ${session.id}`);
  if (order.status !== 'pending' && order.status !== 'expired' && order.status !== 'failed') return;

  const subtotal = session.amount_subtotal ?? 0;
  const discount = session.total_details?.amount_discount ?? 0;
  const tax = session.total_details?.amount_tax ?? 0;
  const total = session.amount_total ?? 0;
  if (total !== subtotal - discount + tax) throw new Error(`checkout ${session.id}: amounts don't add up`);
  const currency = (session.currency ?? order.currency).toUpperCase();
  if (currency !== order.currency) throw new Error(`checkout ${session.id}: paid in ${currency}, ordered in ${order.currency}`);
  // A billing address in a restricted place (src/lib/region.ts): recorded as paid, nothing granted, refunded
  const place = restrictedBillingPlace(session.customer_details?.address);

  await tx
    .update(orders)
    .set({
      status: 'paid',
      paidAt: ctx.occurredAt,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: tax,
      totalMinor: total,
      providerInvoiceId: session.invoice,
      buyerCountry: session.customer_details?.address?.country ?? null,
    })
    .where(eq(orders.id, order.id));
  if (total > 0 && session.payment_intent) {
    await tx
      .insert(payments)
      .values({
        orderId: order.id,
        kind: 'charge',
        status: 'succeeded',
        amountMinor: total,
        currency,
        provider: order.provider,
        providerPaymentId: session.payment_intent,
        providerInvoiceId: session.invoice,
        occurredAt: ctx.occurredAt,
      })
      .onConflictDoNothing();
  }
  if (place) {
    await refusePayment(
      tx,
      { type: 'order', orderId: order.id },
      { what: 'order', place, subscription: null, paymentIntent: total > 0 ? session.payment_intent : null, amountMinor: total, currency, key: session.id },
      { checkout: session.id },
    );
    return;
  }
  const [product] = await tx.select().from(products).where(eq(products.id, order.productId));
  // From when it is applied, if later: a delayed webhook never costs the buyer paid days (code check, Oct 30, 2026)
  await grantForOrder(tx, order, product!, new Date(Math.max(ctx.occurredAt.getTime(), ctx.now.getTime())));
  // The buyer gets a receipt with the invoice's link (./notices.ts)
  await queuePaymentNotice(tx, order.id, { kind: 'order_paid', invoiceId: session.invoice });
}

async function checkoutClosed(tx: Queryable, session: CheckoutSession, status: 'failed' | 'expired'): Promise<void> {
  if (session.mode !== 'payment') return;
  // A page that closed unpaid without an order of ours needs nothing (wave 1)
  const order = await lockOrder(tx, session);
  if (order?.status === 'pending') await tx.update(orders).set({ status }).where(eq(orders.id, order.id));
}

/** The entitlements a paid one-time order grants (docs/schema.md, section 12) */
export async function grantForOrder(tx: Queryable, order: Order, product: Product, paidAt: Date): Promise<void> {
  if (!order.listingId) throw new Error(`order ${order.id} has no listing`);
  const holder = order.organizationId ? { organizationId: order.organizationId } : { userId: order.buyerUserId };
  const base = { ...holder, listingId: order.listingId, orderId: order.id, features: {} };

  if (product.entitlementType === 'bump') {
    // Spread over the duration: 3 bumps in 7 days → now, +3 days, +6 days
    const count = Math.max(1, product.bumpCount ?? 1);
    const stepDays = count > 1 && product.durationDays ? Math.floor((product.durationDays - 1) / (count - 1)) : 0;
    await tx.insert(entitlements).values(
      Array.from({ length: count }, (_, i) => ({ ...base, type: 'bump' as const, startsAt: new Date(paidAt.getTime() + i * stepDays * DAY_MS) })),
    );
    return;
  }
  if (product.entitlementType === 'featured') {
    const { startsAt, endsAt } = await featuredPeriod(tx, order.listingId, product, paidAt);
    await tx.insert(entitlements).values({ ...base, type: 'featured', startsAt, endsAt });
    return;
  }
  throw new Error(`product ${product.code} grants ${product.entitlementType}, which a one-time order can't`);
}

/**
 * When a featured period runs: a listing starts after the featured time it already has (buying
 * again extends it); an event runs until its last date ends, at most 30 days.
 */
export async function featuredPeriod(tx: Queryable, listingId: string, product: Pick<Product, 'durationDays'>, from: Date) {
  const [event] = await tx
    .select({ lastEnd: sql<Date | null>`max(${eventDates.endsAt})`.mapWith((v) => (v ? new Date(v) : null)) })
    .from(eventDates)
    .where(eq(eventDates.listingId, listingId));
  if (event?.lastEnd) {
    const endsAt = new Date(Math.min(event.lastEnd.getTime(), from.getTime() + FEATURED_EVENT_MAX_MS));
    // An event that has already ended still gets a valid (short) period; the badge shows nowhere
    return { startsAt: from, endsAt: endsAt > from ? endsAt : new Date(from.getTime() + 60_000) };
  }
  const [current] = await tx
    .select({ until: sql<Date | null>`max(${entitlements.endsAt})`.mapWith((v) => (v ? new Date(v) : null)) })
    .from(entitlements)
    .where(and(eq(entitlements.listingId, listingId), eq(entitlements.type, 'featured'), isNull(entitlements.revokedAt), gt(entitlements.endsAt, from)));
  const startsAt = current?.until && current.until > from ? current.until : from;
  return { startsAt, endsAt: new Date(startsAt.getTime() + (product.durationDays ?? 7) * DAY_MS) };
}

/**
 * A featured event moved later: «ویژه تا پایان رویداد» follows its new last date, still at most 30
 * days from the start (Check B, Oct 31, 2026). Entitlements are never rewritten, so the extra time is
 * one more row of the same order (refunds and withdrawals end it with the order). Featured time
 * that already ran out, or an event moved earlier, is left as it is. Run by the worker after
 * `event.changed` (src/worker/events.ts); returns how many periods it extended.
 */
export async function followEventEnd(tx: Queryable, listingId: string, now: Date = new Date()): Promise<number> {
  const [event] = await tx
    .select({ lastEnd: sql<Date | null>`max(${eventDates.endsAt})`.mapWith((v) => (v ? new Date(v) : null)) })
    .from(eventDates)
    .where(eq(eventDates.listingId, listingId));
  if (!event?.lastEnd) return 0;
  const periods = await tx
    .select({
      orderId: entitlements.orderId,
      userId: entitlements.userId,
      organizationId: entitlements.organizationId,
      startsAt: sql<Date>`min(${entitlements.startsAt})`.mapWith((v) => new Date(v)),
      endsAt: sql<Date>`max(${entitlements.endsAt})`.mapWith((v) => new Date(v)),
    })
    .from(entitlements)
    .where(and(eq(entitlements.listingId, listingId), eq(entitlements.type, 'featured'), isNull(entitlements.revokedAt), sql`${entitlements.orderId} IS NOT NULL`))
    .groupBy(entitlements.orderId, entitlements.userId, entitlements.organizationId);
  let extended = 0;
  for (const p of periods) {
    const until = new Date(Math.min(event.lastEnd.getTime(), p.startsAt.getTime() + FEATURED_EVENT_MAX_MS));
    if (p.endsAt <= now || until <= p.endsAt) continue;
    const holder = p.organizationId ? { organizationId: p.organizationId } : { userId: p.userId };
    await tx.insert(entitlements).values({ ...holder, type: 'featured', listingId, orderId: p.orderId, features: {}, startsAt: p.endsAt, endsAt: until });
    extended++;
  }
  return extended;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** The subscriptions row mirrors Stripe's subscription as it is now. Returns it with its product. */
async function syncSubscription(tx: Queryable, sub: Subscription, ctx: Ctx) {
  const item = sub.items.data[0]!;
  const [price] = await tx
    .select({ id: productPrices.id, product: products })
    .from(productPrices)
    .innerJoin(products, eq(products.id, productPrices.productId))
    .where(and(eq(productPrices.provider, 'stripe'), eq(productPrices.providerPriceId, item.price.id)));
  if (!price) throw new Error(`subscription ${sub.id}: unknown price ${item.price.id}`);

  const organizationId = await subscriberOf(tx, sub);
  const [before] = await tx.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.providerSubscriptionId, sub.id));
  const values = {
    productPriceId: price.id,
    status: sub.status,
    currentPeriodStart: fromUnix(item.current_period_start),
    currentPeriodEnd: fromUnix(item.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEndsAt: sub.trial_end ? fromUnix(sub.trial_end) : null,
    canceledAt: sub.canceled_at ? fromUnix(sub.canceled_at) : null,
    endedAt: sub.ended_at ? fromUnix(sub.ended_at) : null,
  };
  const [row] = await tx
    .insert(subscriptions)
    .values({ ...values, organizationId, provider: 'stripe', providerSubscriptionId: sub.id })
    .onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: values })
    .returning();

  // The owner hears when Pro ends, once (./notices.ts); a refused plan's own notice already said it (./restricted.ts)
  if (ENDED.has(sub.status) && before && !ENDED.has(before.status) && (await refusedPlace(tx, 'subscription', row!.id)) === null) {
    await queuePaymentNotice(tx, organizationId, { kind: 'pro_ended' });
  }
  if (ENDED.has(sub.status)) {
    // What is left of the plan (its grace included) ends with the subscription
    await tx
      .update(entitlements)
      .set({ revokedAt: ctx.now, revokeReason: 'subscription_ended' })
      .where(and(eq(entitlements.subscriptionId, row!.id), eq(entitlements.type, 'pro_plan'), isNull(entitlements.revokedAt), gt(entitlements.endsAt, ctx.now)));
  }
  return { row: row!, product: price.product, ended: ENDED.has(sub.status) };
}

/**
 * A subscription invoice's payment failed: the subscription's state is synced, and the owner hears
 * of a renewal's first failure (check B part 6) with the next try and how long Pro holds. The first
 * payment at checkout is left out: the buyer sees it fail on Stripe's page. Later tries of the same
 * invoice stay quiet; if they all fail, «اشتراک تمام شد» follows.
 */
async function paymentFailed(tx: Queryable, fetched: Fetched, ctx: Ctx) {
  if (!fetched.subscription) return;
  const { row, ended } = await syncSubscription(tx, fetched.subscription, ctx);
  const invoice = fetched.invoice;
  if (!invoice || !row.organizationId || ended || invoice.billing_reason === 'subscription_create' || (invoice.attempt_count ?? 1) > 1) return;
  await queuePaymentNotice(tx, row.organizationId, {
    kind: 'pro_payment_failed',
    invoiceId: invoice.id,
    nextAttempt: invoice.next_payment_attempt ? fromUnix(invoice.next_payment_attempt).toISOString() : null,
  });
}

/** The business a subscription belongs to: its metadata (set at checkout), else its customer */
async function subscriberOf(tx: Queryable, sub: Subscription): Promise<string> {
  const fromMeta = sub.metadata.organization_id;
  if (fromMeta && /^[0-9a-f-]{36}$/.test(fromMeta)) {
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, fromMeta));
    if (org) return org.id;
  }
  const [customer] = await tx
    .select({ organizationId: billingCustomers.organizationId })
    .from(billingCustomers)
    .where(and(eq(billingCustomers.provider, 'stripe'), eq(billingCustomers.providerCustomerId, sub.customer)));
  if (customer?.organizationId) return customer.organizationId;
  // Plan checkouts always carry the business's id, and the business is never deleted
  throw new NotOurs(`subscription ${sub.id}: no business found`);
}

/**
 * The line of the period an invoice pays for. After a plan switch in the portal, the renewal
 * invoice first lists the switch's price differences (proration lines, from the switch to the
 * renewal) and then the new period (seen in Stripe's test mode, Oct 30, 2026): the latest line
 * that isn't a proration.
 */
export function periodLine(invoice: Pick<Invoice, 'lines'>): Invoice['lines']['data'][number] | undefined {
  const lines = invoice.lines.data;
  const regular = lines.filter((l) => !l.parent?.subscription_item_details?.proration);
  return (regular.length ? regular : lines).reduce<(typeof lines)[number] | undefined>((a, l) => (!a || l.period.end > a.period.end ? l : a), undefined);
}

/** A refused subscription's periods end at once (one granted before the refusal arrived, events out of order) */
async function revokeRefusedPeriods(tx: Queryable, subscriptionId: string, now: Date): Promise<void> {
  await tx
    .update(entitlements)
    .set({ revokedAt: now, revokeReason: REFUSED_REVOKE_REASON })
    .where(and(eq(entitlements.subscriptionId, subscriptionId), eq(entitlements.type, 'pro_plan'), isNull(entitlements.revokedAt)));
}

/** A paid invoice grants its period of Pro (a €0 invoice from the launch coupon too) */
async function invoicePaid(tx: Queryable, fetched: Fetched, ctx: Ctx): Promise<void> {
  const { invoice, subscription } = fetched;
  if (!invoice || !subscription) return; // not a subscription invoice (one-off invoices of orders)
  const { row, product, ended } = await syncSubscription(tx, subscription, ctx);

  // The plan of the invoice's own line (a later upgrade doesn't change what this period bought)
  const line = periodLine(invoice);
  if (!line) throw new Error(`invoice ${invoice.id} has no lines`);
  const linePriceId = line.pricing?.price_details?.price;
  const [linePrice] = linePriceId
    ? await tx
        .select({ product: products })
        .from(productPrices)
        .innerJoin(products, eq(products.id, productPrices.productId))
        .where(and(eq(productPrices.provider, 'stripe'), eq(productPrices.providerPriceId, linePriceId)))
    : [];
  const planProduct = linePrice?.product ?? product;

  const paid = invoice.amount_paid > 0 ? invoice.payments?.data.find((p) => p.status === 'paid' && p.payment.payment_intent) : undefined;
  if (invoice.amount_paid > 0) {
    await tx
      .insert(payments)
      .values({
        subscriptionId: row.id,
        kind: 'charge',
        status: 'succeeded',
        amountMinor: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        provider: 'stripe',
        // Paid outside a payment intent (rare): the invoice id stands in
        providerPaymentId: paid?.payment.payment_intent ?? invoice.id,
        providerInvoiceId: invoice.id,
        occurredAt: ctx.occurredAt,
      })
      .onConflictDoNothing();
  }
  // A billing address in a restricted place, or a subscription refused before: no period, the
  // subscription is cancelled and this payment refunded (./restricted.ts)
  const place = restrictedBillingPlace(invoice.customer_address) ?? (await refusedPlace(tx, 'subscription', row.id));
  if (place) {
    await revokeRefusedPeriods(tx, row.id, ctx.now);
    await refusePayment(
      tx,
      { type: 'subscription', subscriptionId: row.id, organizationId: row.organizationId! },
      {
        what: 'subscription',
        place,
        subscription: subscription.id,
        paymentIntent: invoice.amount_paid > 0 ? (paid?.payment.payment_intent ?? invoice.id) : null,
        amountMinor: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        key: invoice.id,
      },
      { invoice: invoice.id },
    );
    return;
  }
  // A subscription that has already ended gets no new period
  if (ended) return;
  const [earlier] = await tx
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(and(eq(entitlements.subscriptionId, row.id), eq(entitlements.type, 'pro_plan')))
    .limit(1);
  const granted = await tx
    .insert(entitlements)
    .values({
      type: 'pro_plan',
      organizationId: row.organizationId!,
      subscriptionId: row.id,
      providerInvoiceId: invoice.id,
      startsAt: fromUnix(line.period.start),
      endsAt: new Date(fromUnix(line.period.end).getTime() + PRO_GRACE_MS),
      features: planProduct.features,
    })
    .onConflictDoNothing({ target: entitlements.providerInvoiceId, where: sql`provider_invoice_id IS NOT NULL` })
    .returning({ id: entitlements.id });
  // The owner gets "Pro is active" (first period) or "renewed", with the invoice (./notices.ts)
  if (granted.length > 0) {
    const until = fromUnix(line.period.end).toISOString();
    await queuePaymentNotice(
      tx,
      row.organizationId!,
      earlier
        ? { kind: 'pro_renewed', invoiceId: invoice.id, until }
        : { kind: 'pro_started', invoiceId: invoice.id, trial: subscription.status === 'trialing', until },
    );
  }
}

// ---------------------------------------------------------------------------
// Refunds and disputes
// ---------------------------------------------------------------------------

/** The charge a refund or dispute belongs to, locked */
async function chargeOf(tx: Queryable, paymentIntent: string | null, what: string) {
  const [charge] = paymentIntent
    ? await tx
        .select()
        .from(payments)
        .where(and(eq(payments.provider, 'stripe'), eq(payments.providerPaymentId, paymentIntent), eq(payments.kind, 'charge')))
        .for('update')
    : [];
  if (!charge) throw new NotReady(`${what}: no charge for payment ${paymentIntent}`);
  return charge;
}

/** The rows a charge granted: an order's entitlements, or the invoice's Pro period */
function grantedBy(charge: typeof payments.$inferSelect) {
  return charge.orderId
    ? eq(entitlements.orderId, charge.orderId)
    : charge.providerInvoiceId
      ? and(eq(entitlements.subscriptionId, charge.subscriptionId!), eq(entitlements.providerInvoiceId, charge.providerInvoiceId))
      : null;
}

type Granted = { type: string; endsAt: Date | null; appliedAt: Date | null };
/** Something the person still had: running time, or a bump that hadn't run */
const stillHeld = (rows: Granted[], now: Date) => rows.some((r) => (r.type === 'bump' ? r.appliedAt === null : r.endsAt !== null && r.endsAt > now));

/** The buyer (an order) or the business (Pro) hears what ended or came back (owner's rule: users are always told) */
async function tellGranted(tx: Queryable, charge: typeof payments.$inferSelect, change: 'revoked' | 'restored', reason: 'refund' | 'dispute') {
  if (charge.orderId) {
    await queuePaymentNotice(tx, charge.orderId, change === 'revoked' ? { kind: 'order_revoked', reason } : { kind: 'order_restored' });
    return;
  }
  const [sub] = await tx.select({ organizationId: subscriptions.organizationId }).from(subscriptions).where(eq(subscriptions.id, charge.subscriptionId!));
  if (!sub?.organizationId) return;
  await queuePaymentNotice(tx, sub.organizationId, change === 'revoked' ? { kind: 'pro_revoked', reason } : { kind: 'pro_restored' });
}

/**
 * Revokes everything a charge granted, and tells the person when that took something they still
 * had (check B, Nov 1, 2026: a Dashboard refund or a chargeback ended Pro or featured time
 * silently). `tell: false` for a withdrawal's refund, whose own notice says it.
 */
async function revokeGranted(tx: Queryable, charge: typeof payments.$inferSelect, reason: 'refund' | 'dispute', now: Date, tell = true): Promise<void> {
  const where = grantedBy(charge);
  if (!where) return;
  const revoked = await tx
    .update(entitlements)
    .set({ revokedAt: now, revokeReason: reason })
    .where(and(where, isNull(entitlements.revokedAt)))
    .returning({ type: entitlements.type, endsAt: entitlements.endsAt, appliedAt: entitlements.appliedAt });
  if (tell && stillHeld(revoked, now)) await tellGranted(tx, charge, 'revoked', reason);
}

const REFUND_STATUS: Record<string, 'pending' | 'succeeded' | 'failed'> = {
  pending: 'pending',
  requires_action: 'pending',
  succeeded: 'succeeded',
  failed: 'failed',
  canceled: 'failed',
};

/**
 * A refund is its own payments row. A full refund (all refunds of the charge, pending or done,
 * reach its amount) revokes what the charge granted; a partial one leaves it (decided
 * Oct 22, 2026), except a consumer's withdrawal, whose refund ends what is left of the order
 * (./withdrawals.ts). Revoked entitlements never come back, even if a refund fails later; only a
 * dispute closed in our favour gives back what it took.
 */
async function refundChanged(tx: Queryable, refund: Refund, ctx: Ctx): Promise<void> {
  const charge = await chargeOf(tx, refund.payment_intent, `refund ${refund.id}`);
  const status = REFUND_STATUS[refund.status ?? 'pending'] ?? 'pending';
  await tx
    .insert(payments)
    .values({
      orderId: charge.orderId,
      subscriptionId: charge.subscriptionId,
      kind: 'refund',
      status,
      amountMinor: refund.amount,
      currency: refund.currency.toUpperCase(),
      provider: charge.provider,
      providerPaymentId: refund.id,
      providerInvoiceId: charge.providerInvoiceId,
      occurredAt: fromUnix(refund.created),
    })
    .onConflictDoUpdate({ target: [payments.provider, payments.providerPaymentId], set: { status } });
  const withdrawn = charge.orderId ? await endWithdrawnOrder(tx, charge.orderId, refund.metadata, ctx.now) : false;

  const [sum] = await tx.execute<{ refunded: number }>(sql`
    SELECT coalesce(sum(amount_minor), 0)::bigint AS refunded FROM payments
    WHERE kind = 'refund' AND status IN ('pending', 'succeeded')
      AND ${charge.orderId ? sql`order_id = ${charge.orderId}` : sql`subscription_id = ${charge.subscriptionId} AND provider_invoice_id = ${charge.providerInvoiceId}`}`);
  const refunded = Number(sum?.refunded ?? 0);
  const full = refunded >= charge.amountMinor;
  if (full) await revokeGranted(tx, charge, 'refund', ctx.now, !withdrawn);
  if (charge.orderId) {
    await tx
      .update(orders)
      .set({ status: full ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'paid' })
      .where(and(eq(orders.id, charge.orderId), inArray(orders.status, ['paid', 'partially_refunded'])));
  }
}

/** A dispute (chargeback, SEPA return) revokes what the payment granted, like a full refund */
async function disputed(tx: Queryable, dispute: ReturnType<typeof disputeSchema.parse>, ctx: Ctx): Promise<void> {
  const charge = await chargeOf(tx, dispute.payment_intent, `dispute ${dispute.id}`);
  await revokeGranted(tx, charge, 'dispute', ctx.now);
  await tx.insert(auditLog).values({
    actorType: 'webhook',
    action: 'payment.disputed',
    targetType: charge.orderId ? 'order' : 'subscription',
    targetId: charge.orderId ?? charge.subscriptionId,
    data: { dispute: dispute.id, reason: dispute.reason, amount_minor: dispute.amount },
  });
}

/** Closed in our favour (`won`, or an inquiry that never became a chargeback) */
const KEPT = ['won', 'warning_closed'];

/**
 * A closed dispute. When the money stays with us, what the dispute revoked comes back, if its time
 * hasn't run out, and the person is told (check B, Nov 1, 2026: a won dispute never gave it back).
 * Only rows revoked for a dispute: a refund's revocation stays.
 */
async function disputeClosed(tx: Queryable, dispute: ReturnType<typeof disputeSchema.parse>, ctx: Ctx): Promise<void> {
  const charge = await chargeOf(tx, dispute.payment_intent, `dispute ${dispute.id}`);
  const where = grantedBy(charge);
  const kept = KEPT.includes(dispute.status);
  const restored =
    kept && where
      ? await tx
          .update(entitlements)
          .set({ revokedAt: null, revokeReason: null })
          .where(and(where, eq(entitlements.revokeReason, 'dispute'), sql`(${entitlements.endsAt} IS NULL OR ${entitlements.endsAt} > ${ctx.now.toISOString()}::timestamptz)`))
          .returning({ type: entitlements.type, endsAt: entitlements.endsAt, appliedAt: entitlements.appliedAt })
      : [];
  await tx.insert(auditLog).values({
    actorType: 'webhook',
    action: 'payment.dispute_closed',
    targetType: charge.orderId ? 'order' : 'subscription',
    targetId: charge.orderId ?? charge.subscriptionId,
    data: { dispute: dispute.id, status: dispute.status, restored: restored.length },
  });
  if (stillHeld(restored, ctx.now)) await tellGranted(tx, charge, 'restored', 'dispute');
}
