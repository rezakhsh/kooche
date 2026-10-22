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

// The worker applies stored webhooks (docs/schema.md, section 12), as classifieds_worker, the only
// role that may write payments, subscriptions and entitlements. One webhook_events row is applied
// in one transaction that locks it first, so a duplicate delivery or a retried job is applied once.
// Calls back to the provider (the current subscription, an invoice's payments) happen before that
// transaction, never while the row is locked.

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

export type ApplyOutcome = 'applied' | 'duplicate';

/** Applies one stored webhook. Throws on failure, after recording the error on the row. */
export async function applyWebhookEvent(db: Db, gateway: PaymentGateway, webhookEventId: string, now = new Date()): Promise<ApplyOutcome> {
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, webhookEventId));
  if (!row) throw new Error(`webhook event ${webhookEventId} not found`);
  if (row.processedAt) return 'duplicate';
  try {
    const event = eventSchema.parse(row.payload);
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
    await db
      .update(webhookEvents)
      .set({ attempts: sql`least(${webhookEvents.attempts} + 1, 32767)`, lastError: message.slice(0, 1000) })
      .where(eq(webhookEvents.id, webhookEventId));
    throw e;
  }
}

type Fetched = { subscription?: Subscription; invoice?: Invoice };

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
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      if (fetched.subscription) await syncSubscription(tx, fetched.subscription, ctx);
      return;
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
      return refundChanged(tx, refundSchema.parse(object), ctx);
    case 'charge.dispute.created':
      return disputed(tx, disputeSchema.parse(object), ctx);
    default:
      // The endpoint stores only handled types (./webhook.ts); nothing to do for anything else
      return;
  }
}

// ---------------------------------------------------------------------------
// One-time products
// ---------------------------------------------------------------------------

async function lockOrder(tx: Queryable, session: CheckoutSession): Promise<Order> {
  const id = session.client_reference_id;
  const [order] = id && /^[0-9a-f-]{36}$/.test(id)
    ? await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.providerCheckoutId, session.id))).for('update')
    : [];
  if (!order) throw new NotReady(`no order for checkout ${session.id}`);
  return order;
}

async function checkoutPaid(tx: Queryable, session: CheckoutSession, fetched: Fetched, ctx: Ctx): Promise<void> {
  if (session.mode === 'subscription') {
    // The subscription itself; its invoice.paid grants the plan
    if (fetched.subscription) await syncSubscription(tx, fetched.subscription, ctx);
    return;
  }
  if (session.mode !== 'payment') return;
  // A delayed payment method completes the session unpaid; async_payment_succeeded follows
  if (session.payment_status !== 'paid') return;
  const order = await lockOrder(tx, session);
  if (order.status !== 'pending' && order.status !== 'expired' && order.status !== 'failed') return;

  const subtotal = session.amount_subtotal ?? 0;
  const discount = session.total_details?.amount_discount ?? 0;
  const tax = session.total_details?.amount_tax ?? 0;
  const total = session.amount_total ?? 0;
  if (total !== subtotal - discount + tax) throw new Error(`checkout ${session.id}: amounts don't add up`);
  const currency = (session.currency ?? order.currency).toUpperCase();
  if (currency !== order.currency) throw new Error(`checkout ${session.id}: paid in ${currency}, ordered in ${order.currency}`);

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
  const [product] = await tx.select().from(products).where(eq(products.id, order.productId));
  await grantForOrder(tx, order, product!, ctx.occurredAt);
}

async function checkoutClosed(tx: Queryable, session: CheckoutSession, status: 'failed' | 'expired'): Promise<void> {
  if (session.mode !== 'payment') return;
  const order = await lockOrder(tx, session);
  if (order.status === 'pending') await tx.update(orders).set({ status }).where(eq(orders.id, order.id));
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

  if (ENDED.has(sub.status)) {
    // What is left of the plan (its grace included) ends with the subscription
    await tx
      .update(entitlements)
      .set({ revokedAt: ctx.now, revokeReason: 'subscription_ended' })
      .where(and(eq(entitlements.subscriptionId, row!.id), eq(entitlements.type, 'pro_plan'), isNull(entitlements.revokedAt), gt(entitlements.endsAt, ctx.now)));
  }
  return { row: row!, product: price.product, ended: ENDED.has(sub.status) };
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
  throw new Error(`subscription ${sub.id}: no business found`);
}

/** A paid invoice grants its period of Pro (a €0 invoice from the launch coupon too) */
async function invoicePaid(tx: Queryable, fetched: Fetched, ctx: Ctx): Promise<void> {
  const { invoice, subscription } = fetched;
  if (!invoice || !subscription) return; // not a subscription invoice (one-off invoices of orders)
  const { row, product, ended } = await syncSubscription(tx, subscription, ctx);

  // The plan of the invoice's own line (a later upgrade doesn't change what this period bought)
  const line = invoice.lines.data[0];
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

  if (invoice.amount_paid > 0) {
    const paid = invoice.payments?.data.find((p) => p.status === 'paid' && p.payment.payment_intent);
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
  // A subscription that has already ended gets no new period
  if (ended) return;
  await tx
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
    .onConflictDoNothing({ target: entitlements.providerInvoiceId, where: sql`provider_invoice_id IS NOT NULL` });
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

/** Revokes everything a charge granted: an order's entitlements, or the invoice's Pro period */
async function revokeGranted(tx: Queryable, charge: typeof payments.$inferSelect, reason: string, now: Date): Promise<void> {
  const where = charge.orderId
    ? eq(entitlements.orderId, charge.orderId)
    : charge.providerInvoiceId
      ? and(eq(entitlements.subscriptionId, charge.subscriptionId!), eq(entitlements.providerInvoiceId, charge.providerInvoiceId))
      : null;
  if (!where) return;
  await tx.update(entitlements).set({ revokedAt: now, revokeReason: reason }).where(and(where, isNull(entitlements.revokedAt)));
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
 * Oct 22, 2026). Revoked entitlements never come back, even if a refund fails later.
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

  const [sum] = await tx.execute<{ refunded: number }>(sql`
    SELECT coalesce(sum(amount_minor), 0)::bigint AS refunded FROM payments
    WHERE kind = 'refund' AND status IN ('pending', 'succeeded')
      AND ${charge.orderId ? sql`order_id = ${charge.orderId}` : sql`subscription_id = ${charge.subscriptionId} AND provider_invoice_id = ${charge.providerInvoiceId}`}`);
  const refunded = Number(sum?.refunded ?? 0);
  const full = refunded >= charge.amountMinor;
  if (full) await revokeGranted(tx, charge, 'refund', ctx.now);
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
