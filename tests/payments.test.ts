import { and, eq, sql } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import Stripe from 'stripe';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { parseWebEnv } from '../src/lib/env';
import { applyWebhookEvent, NotReady, PRO_GRACE_MS } from '../src/modules/payments/apply';
import { allowancesLeft, grantAllowance, requestAllowance } from '../src/modules/payments/allowances';
import { applyDueBumps } from '../src/modules/payments/bumps';
import { openBillingPortal, startListingCheckout, startPlanCheckout } from '../src/modules/payments/checkout';
import { checkoutParams, INVOICE_FOOTER, StripeGateway } from '../src/modules/payments/gateway';
import { businessPlan, featuredListingIds } from '../src/modules/payments/plans';
import { receiveWebhook } from '../src/modules/payments/webhook';
import { contentSecurityPolicy } from '../src/proxy';
import { startPaymentJobs } from '../src/worker/payments';
import { appDb, workerDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, rollback, setRole } from './db';
import { listing as listingRow, outbox, user } from './listings-fixtures';
import {
  business,
  entitlementsOf,
  event,
  FakeGateway,
  orderRow,
  paidSession,
  sellerWithListing,
  seedCatalog,
  storeEvent,
  stripeInvoice,
  stripePriceId,
  stripeRefund,
  stripeSubscription,
} from './payments-fixtures';

// Payments (roadmap step 6, approved Oct 22, 2026): starting a checkout as the app, storing
// webhooks as the app, applying them as the worker. The rule "money and entitlements change only
// through payment-provider webhooks" is checked against the database roles themselves.

const DAY = 86_400_000;
const APP_URL = 'https://app.example.test';

beforeAll(async () => {
  await seedCatalog();
});

async function buy(productCode: string, values: Partial<typeof schema.listings.$inferInsert> = {}) {
  const gateway = new FakeGateway();
  const { seller, listing } = await sellerWithListing(values);
  const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode, waiver: true, appUrl: APP_URL });
  if (!r.ok) throw new Error(`checkout refused: ${r.reason}`);
  const order = await orderRow(r.orderId!);
  return { gateway, seller, listing, order, checkoutId: gateway.checkouts[0]!.id };
}

async function pay(order: { id: string; totalMinor: number }, checkoutId: string, gateway = new FakeGateway(), extra: Record<string, unknown> = {}) {
  const session = paidSession(order, checkoutId, extra);
  const eventId = await storeEvent(event('checkout.session.completed', session));
  expect(await applyWebhookEvent(workerDb, gateway, eventId)).toBe('applied');
  return session;
}

describe('starting a checkout (app role)', () => {
  it('creates a pending order, a customer with the §19 footer and a Checkout Session; nothing is granted', async () => {
    const { gateway, seller, listing, order, checkoutId } = await buy('bump-1');
    expect(order).toMatchObject({ status: 'pending', buyerUserId: seller.id, listingId: listing.id, currency: 'EUR', totalMinor: 199, providerCheckoutId: checkoutId, paidAt: null });
    expect(gateway.customers).toHaveLength(1);
    const checkout = gateway.checkouts[0]!;
    expect(checkout).toMatchObject({ mode: 'payment', priceId: stripePriceId('bump-1'), clientReferenceId: order.id, successUrl: `${APP_URL}/my/orders/${order.id}` });
    // Coming back to the success page grants nothing: only the worker does, from the webhook
    expect(await entitlementsOf({ orderId: order.id })).toEqual([]);
    const [waiver] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.targetId, order.id), eq(schema.auditLog.action, 'order.withdrawal_waived')));
    expect(waiver).toMatchObject({ actorType: 'user', actorUserId: seller.id });
  });

  it('reuses the buyer’s Stripe customer', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    for (const code of ['bump-1', 'featured-7d']) {
      expect((await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: code, waiver: true, appUrl: APP_URL })).ok).toBe(true);
    }
    expect(gateway.customers).toHaveLength(1);
    expect(new Set(gateway.checkouts.map((c) => c.customerId)).size).toBe(1);
  });

  it('refuses someone else’s listing, a listing that isn’t live, the wrong product and a missing waiver', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    const stranger = await user();
    const { listing: paused } = await sellerWithListing({ status: 'paused', userId: seller.id });
    const start = (userId: string, listingId: string, productCode: string, waiver = true) =>
      startListingCheckout(appDb, gateway, { userId, listingId, productCode, waiver, appUrl: APP_URL });
    expect(await start(stranger.id, listing.id, 'bump-1')).toEqual({ ok: false, reason: 'not_found' });
    expect(await start(seller.id, paused.id, 'bump-1')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await start(seller.id, listing.id, 'featured-event')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await start(seller.id, listing.id, 'pro')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await start(seller.id, listing.id, 'bump-1', false)).toEqual({ ok: false, reason: 'waiver_required' });
    expect(await startListingCheckout(appDb, null, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP_URL })).toEqual({ ok: false, reason: 'payments_off' });
    expect(gateway.checkouts).toHaveLength(0);
  });

  it('asks Stripe for the right methods, an invoice with the §19 note and no tax', () => {
    const base = { customerId: 'cus_1', priceId: 'price_1', clientReferenceId: 'x', metadata: {}, successUrl: 's', cancelUrl: 'c' };
    const once = checkoutParams({ ...base, mode: 'payment' });
    expect(once).toMatchObject({ mode: 'payment', allowed_payment_method_types: ['card', 'paypal', 'eps'], invoice_creation: { enabled: true, invoice_data: { footer: INVOICE_FOOTER } } });
    expect(once).not.toHaveProperty('automatic_tax');
    expect(once).not.toHaveProperty('allow_promotion_codes');
    const plan = checkoutParams({ ...base, mode: 'subscription', promotionCodes: true });
    expect(plan).toMatchObject({ mode: 'subscription', allowed_payment_method_types: ['card', 'paypal', 'sepa_debit'], allow_promotion_codes: true, payment_method_collection: 'if_required', billing_address_collection: 'required' });
    // No launch code on a yearly plan: 6 free months would make its 12-month invoice free
    expect(checkoutParams({ ...base, mode: 'subscription' })).toMatchObject({ allow_promotion_codes: false });
    expect(plan).not.toHaveProperty('automatic_tax');
    expect(INVOICE_FOOTER).toBe('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
  });

  it('lets only the business owner subscribe, once, and open the portal', async () => {
    const gateway = new FakeGateway();
    const { org, ownerId } = await business();
    const manager = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: manager.id, role: 'manager' });
    const start = (userId: string) => startPlanCheckout(appDb, gateway, { userId, organizationId: org.id, plan: 'pro', interval: 'year', appUrl: APP_URL });
    expect(await start(manager.id)).toEqual({ ok: false, reason: 'not_found' });
    expect(await start(ownerId)).toMatchObject({ ok: true });
    expect(gateway.checkouts[0]).toMatchObject({ mode: 'subscription', priceId: stripePriceId('pro', 'year'), clientReferenceId: org.id, metadata: { organization_id: org.id }, promotionCodes: false });
    expect(await openBillingPortal(appDb, gateway, { userId: manager.id, organizationId: org.id, appUrl: APP_URL })).toEqual({ ok: false, reason: 'not_found' });
    expect(await openBillingPortal(appDb, gateway, { userId: ownerId, organizationId: org.id, appUrl: APP_URL })).toMatchObject({ ok: true });

    // While a subscription runs, a second checkout is refused (changes go through the portal)
    const sub = stripeSubscription({ organizationId: org.id, priceId: stripePriceId('pro', 'year'), start: new Date(), end: new Date(Date.now() + 365 * DAY) });
    gateway.subscriptions.set(sub.id, sub);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.created', sub)));
    expect(await start(ownerId)).toEqual({ ok: false, reason: 'already_subscribed' });
  });
});

describe('the webhook-only rule (database roles)', () => {
  it('lets the app insert only a pending order, never mark one paid or write money tables', async () => {
    await rollback(async (tx) => {
      const { seller, listing } = await sellerWithListing();
      const [price] = await tx.select().from(schema.productPrices).where(eq(schema.productPrices.providerPriceId, stripePriceId('bump-1')));
      await setRole(tx, 'classifieds_app');
      await expectError(
        tx.transaction((sp) =>
          sp.execute(sql`INSERT INTO orders (buyer_user_id, product_id, product_price_id, listing_id, currency, subtotal_minor, discount_minor, tax_minor, total_minor, status, paid_at)
            VALUES (${seller.id}, ${price!.productId}, ${price!.id}, ${listing.id}, 'EUR', 199, 0, 0, 199, 'paid', now())`),
        ),
        INSUFFICIENT_PRIVILEGE,
      );
      for (const table of ['payments', 'subscriptions', 'entitlements']) {
        await expectError(tx.transaction((sp) => sp.execute(sql.raw(`UPDATE ${table} SET created_at = created_at WHERE false`))), INSUFFICIENT_PRIVILEGE);
      }
      await expectError(
        tx.transaction((sp) => sp.execute(sql`INSERT INTO entitlements (type, user_id, listing_id, order_id, starts_at) VALUES ('bump', ${seller.id}, ${listing.id}, gen_random_uuid(), now())`)),
        INSUFFICIENT_PRIVILEGE,
      );
    });
  });
});

describe('receiving webhooks (app role)', () => {
  const secret = 'whsec_test_0123456789abcdef';
  const stripe = new StripeGateway('sk_test_0123456789abcdef', secret);
  const signed = (body: string) => Stripe.webhooks.generateTestHeaderString({ payload: body, secret });

  it('stores a signed event once and hands it to the worker once', async () => {
    const e = event('checkout.session.expired', { id: 'cs_test_x', object: 'checkout.session' });
    const body = JSON.stringify(e);
    expect(await receiveWebhook(appDb, stripe, body, signed(body))).toBe('stored');
    expect(await receiveWebhook(appDb, stripe, body, signed(body))).toBe('duplicate');
    const rows = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.providerEventId, e.id));
    expect(rows).toHaveLength(1);
    expect(await outbox(rows[0]!.id)).toEqual(['webhook.received']);
  });

  it('refuses a bad or missing signature and stores nothing', async () => {
    const e = event('checkout.session.completed', { id: 'cs_test_y', object: 'checkout.session' });
    const body = JSON.stringify(e);
    const tampered = body.replace('cs_test_y', 'cs_test_z');
    expect(await receiveWebhook(appDb, stripe, tampered, signed(body))).toBe('invalid');
    expect(await receiveWebhook(appDb, stripe, body, null)).toBe('invalid');
    const other = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_test_another_secret_000' });
    expect(await receiveWebhook(appDb, stripe, body, other)).toBe('invalid');
    expect(await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.providerEventId, e.id))).toEqual([]);
  });

  it('ignores event types it isn’t meant to get', async () => {
    const e = event('customer.created', { id: 'cus_1', object: 'customer' });
    const body = JSON.stringify(e);
    expect(await receiveWebhook(appDb, stripe, body, signed(body))).toBe('ignored');
  });
});

describe('applying one-time purchases (worker role)', () => {
  it('marks the order paid with Stripe’s amounts, records the charge and grants a due bump', async () => {
    const { order, checkoutId, listing } = await buy('bump-1');
    const session = await pay(order, checkoutId);
    const paid = await orderRow(order.id);
    expect(paid).toMatchObject({ status: 'paid', totalMinor: 199, taxMinor: 0, buyerCountry: 'DE', providerInvoiceId: session.invoice });
    expect(paid.paidAt).not.toBeNull();
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    expect(payment).toMatchObject({ kind: 'charge', status: 'succeeded', amountMinor: 199, providerPaymentId: session.payment_intent });
    const granted = await entitlementsOf({ orderId: order.id });
    expect(granted).toHaveLength(1);
    expect(granted[0]).toMatchObject({ type: 'bump', listingId: listing.id, endsAt: null, appliedAt: null });
  });

  it('spreads a 3-bump package over 7 days', async () => {
    const { order, checkoutId } = await buy('bump-3');
    await pay(order, checkoutId);
    const starts = (await entitlementsOf({ orderId: order.id })).map((e) => e.startsAt.getTime());
    expect(starts).toHaveLength(3);
    expect(starts[1]! - starts[0]!).toBe(3 * DAY);
    expect(starts[2]! - starts[0]!).toBe(6 * DAY);
  });

  it('features a listing for 7 days, and a second purchase extends it', async () => {
    const { order, checkoutId, listing, seller } = await buy('featured-7d');
    await pay(order, checkoutId);
    const [first] = await entitlementsOf({ orderId: order.id });
    expect(first!.endsAt!.getTime() - first!.startsAt.getTime()).toBe(7 * DAY);
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(true);

    const gateway = new FakeGateway();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'featured-7d', waiver: true, appUrl: APP_URL });
    const second = await orderRow(r.ok ? r.orderId! : '');
    await pay(second, gateway.checkouts[0]!.id);
    const [next] = await entitlementsOf({ orderId: second.id });
    expect(next!.startsAt.getTime()).toBe(first!.endsAt!.getTime());
  });

  it('applies a duplicate delivery once, also when two jobs run at the same time', async () => {
    const { order, checkoutId } = await buy('bump-1');
    const e = event('checkout.session.completed', paidSession(order, checkoutId));
    const eventId = await storeEvent(e);
    const outcomes = await Promise.all([applyWebhookEvent(workerDb, new FakeGateway(), eventId), applyWebhookEvent(workerDb, new FakeGateway(), eventId)]);
    expect(outcomes.sort()).toEqual(['applied', 'duplicate']);
    expect(await applyWebhookEvent(workerDb, new FakeGateway(), eventId)).toBe('duplicate');
    // Stripe can also send the same session again under a new event id
    const again = await storeEvent(event('checkout.session.completed', paidSession(order, checkoutId)));
    expect(await applyWebhookEvent(workerDb, new FakeGateway(), again)).toBe('applied');
    expect(await entitlementsOf({ orderId: order.id })).toHaveLength(1);
    expect(await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id))).toHaveLength(1);
  });

  it('waits for an unpaid (delayed) session, then grants on async_payment_succeeded', async () => {
    const { order, checkoutId } = await buy('bump-1');
    const session = paidSession(order, checkoutId, { payment_status: 'unpaid' });
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.completed', session)));
    expect((await orderRow(order.id)).status).toBe('pending');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.async_payment_succeeded', { ...session, payment_status: 'paid' })));
    expect((await orderRow(order.id)).status).toBe('paid');
    expect(await entitlementsOf({ orderId: order.id })).toHaveLength(1);
  });

  it('closes expired and failed checkouts without granting anything', async () => {
    const a = await buy('bump-1');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.expired', paidSession(a.order, a.checkoutId, { payment_status: 'unpaid', status: 'expired' }))));
    expect((await orderRow(a.order.id)).status).toBe('expired');
    const b = await buy('bump-1');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.async_payment_failed', paidSession(b.order, b.checkoutId, { payment_status: 'unpaid' }))));
    expect((await orderRow(b.order.id)).status).toBe('failed');
    expect([...(await entitlementsOf({ orderId: a.order.id })), ...(await entitlementsOf({ orderId: b.order.id }))]).toEqual([]);
  });

  it('refuses a session whose amounts don’t add up and records the error for a retry', async () => {
    const { order, checkoutId } = await buy('bump-1');
    const eventId = await storeEvent(event('checkout.session.completed', paidSession(order, checkoutId, { amount_total: 1 })));
    await expect(applyWebhookEvent(workerDb, new FakeGateway(), eventId)).rejects.toThrow(/don't add up/);
    const [row] = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.id, eventId));
    expect(row).toMatchObject({ processedAt: null, attempts: 1 });
    expect(row!.lastError).toMatch(/add up/);
    expect((await orderRow(order.id)).status).toBe('pending');
  });
});

describe('refunds and disputes (worker role)', () => {
  it('a full refund revokes the order’s entitlements, and pending bumps never run', async () => {
    const { order, checkoutId, listing } = await buy('bump-3');
    const session = await pay(order, checkoutId);
    await applyDueBumps(workerDb, new Date()); // the first bump runs now
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(session.payment_intent, 449))));
    expect((await orderRow(order.id)).status).toBe('refunded');
    const granted = await entitlementsOf({ orderId: order.id });
    expect(granted.every((e) => e.revokedAt && e.revokeReason === 'refund')).toBe(true);
    const ranked = (await listingRow(listing.id)).rankedAt;
    await applyDueBumps(workerDb, new Date(Date.now() + 10 * DAY));
    expect((await listingRow(listing.id)).rankedAt).toEqual(ranked);
    expect((await entitlementsOf({ orderId: order.id })).filter((e) => e.appliedAt)).toHaveLength(1);
    const refunds = await db.select().from(schema.payments).where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.kind, 'refund')));
    expect(refunds).toHaveLength(1);
  });

  it('a partial refund keeps them; refunds add up to a full one', async () => {
    const { order, checkoutId, listing } = await buy('featured-7d');
    const session = await pay(order, checkoutId);
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(session.payment_intent, 300))));
    expect((await orderRow(order.id)).status).toBe('partially_refunded');
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(true);
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(session.payment_intent, 399))));
    expect((await orderRow(order.id)).status).toBe('refunded');
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(false);
  });

  it('a PayPal refund (pyr_… id) revokes like any other', async () => {
    const { order, checkoutId } = await buy('featured-7d');
    const session = await pay(order, checkoutId);
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(session.payment_intent, 699, 'succeeded', 'pyr_test_1PayPalRefund'))));
    expect((await orderRow(order.id)).status).toBe('refunded');
    expect((await entitlementsOf({ orderId: order.id }))[0]).toMatchObject({ revokeReason: 'refund' });
  });

  it('records a refund’s later status on the same row', async () => {
    const { order, checkoutId } = await buy('bump-1');
    const session = await pay(order, checkoutId);
    const refund = stripeRefund(session.payment_intent, 199, 'pending');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', refund)));
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.updated', { ...refund, status: 'succeeded' })));
    const rows = await db.select().from(schema.payments).where(eq(schema.payments.providerPaymentId, refund.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('succeeded');
  });

  it('a refund that arrives before its payment is retried later', async () => {
    const eventId = await storeEvent(event('refund.created', stripeRefund('pi_test_unknown', 199)));
    await expect(applyWebhookEvent(workerDb, new FakeGateway(), eventId)).rejects.toBeInstanceOf(NotReady);
  });

  it('a dispute revokes what the payment granted and is logged', async () => {
    const { order, checkoutId } = await buy('featured-7d');
    const session = await pay(order, checkoutId);
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('charge.dispute.created', { id: 'dp_test_1', object: 'dispute', payment_intent: session.payment_intent, amount: 699, reason: 'fraudulent', status: 'needs_response' })));
    expect((await entitlementsOf({ orderId: order.id }))[0]).toMatchObject({ revokeReason: 'dispute' });
    const [log] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.targetId, order.id), eq(schema.auditLog.action, 'payment.disputed')));
    expect(log).toMatchObject({ actorType: 'webhook' });
  });
});

describe('bump scheduling (worker role)', () => {
  it('moves ranked_at once per due bump, with history and an outbox event', async () => {
    const { order, checkoutId, listing } = await buy('bump-1', { rankedAt: new Date(Date.now() - 5 * DAY) });
    await pay(order, checkoutId);
    const at = new Date();
    const runs = await Promise.all([applyDueBumps(workerDb, at), applyDueBumps(workerDb, at)]);
    expect(runs.reduce((s, r) => s + r.applied, 0)).toBe(1);
    expect((await listingRow(listing.id)).rankedAt!.getTime()).toBe(at.getTime());
    expect((await entitlementsOf({ orderId: order.id }))[0]!.appliedAt).not.toBeNull();
    expect(await outbox(listing.id)).toContain('listing.bumped');
    const history = await db.select().from(schema.listingEvents).where(and(eq(schema.listingEvents.listingId, listing.id), eq(schema.listingEvents.eventType, 'bumped')));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ actorType: 'payment' });
    await applyDueBumps(workerDb, new Date(at.getTime() + 60_000));
    expect((await listingRow(listing.id)).rankedAt!.getTime()).toBe(at.getTime());
  });

  it('a later bump of a package waits for its day', async () => {
    const { order, checkoutId } = await buy('bump-3');
    await pay(order, checkoutId);
    await applyDueBumps(workerDb, new Date());
    expect((await entitlementsOf({ orderId: order.id })).filter((e) => e.appliedAt)).toHaveLength(1);
    await applyDueBumps(workerDb, new Date(Date.now() + 3 * DAY + 60_000));
    expect((await entitlementsOf({ orderId: order.id })).filter((e) => e.appliedAt)).toHaveLength(2);
  });

  it('a paused listing’s bump waits; a sold one’s is revoked', async () => {
    const a = await buy('bump-1');
    await pay(a.order, a.checkoutId);
    await db.update(schema.listings).set({ status: 'paused' }).where(eq(schema.listings.id, a.listing.id));
    const b = await buy('bump-1');
    await pay(b.order, b.checkoutId);
    await db.update(schema.listings).set({ status: 'sold' }).where(eq(schema.listings.id, b.listing.id));
    await applyDueBumps(workerDb, new Date());
    expect((await entitlementsOf({ orderId: a.order.id }))[0]).toMatchObject({ appliedAt: null, revokedAt: null });
    expect((await entitlementsOf({ orderId: b.order.id }))[0]).toMatchObject({ appliedAt: null, revokeReason: 'listing_closed' });
    await db.update(schema.listings).set({ status: 'active' }).where(eq(schema.listings.id, a.listing.id));
    await applyDueBumps(workerDb, new Date());
    expect((await entitlementsOf({ orderId: a.order.id }))[0]!.appliedAt).not.toBeNull();
  });
});

describe('Pro subscriptions (worker role)', () => {
  async function subscribed(opts: { amountPaid?: number; plan?: 'pro' | 'pro-plus' } = {}) {
    const gateway = new FakeGateway();
    const { org, ownerId } = await business();
    const priceId = stripePriceId(opts.plan ?? 'pro', 'month');
    const start = new Date(Date.now() - DAY);
    const end = new Date(start.getTime() + 30 * DAY);
    const sub = stripeSubscription({ organizationId: org.id, priceId, start, end });
    gateway.subscriptions.set(sub.id, sub);
    const amountPaid = opts.amountPaid ?? 2400;
    const invoice = stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid, start, end, paymentIntent: amountPaid ? 'pi_test_inv_' + sub.id : undefined });
    gateway.invoices.set(invoice.id, invoice);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    return { gateway, org, ownerId, sub, invoice, start, end, priceId };
  }

  it('a paid invoice mirrors the subscription and grants its period of Pro plus 7 days’ grace', async () => {
    const { org, sub, invoice, end } = await subscribed();
    const [mirror] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.providerSubscriptionId, sub.id));
    expect(mirror).toMatchObject({ organizationId: org.id, status: 'active' });
    const [pro] = await entitlementsOf({ organizationId: org.id });
    expect(pro).toMatchObject({ type: 'pro_plan', providerInvoiceId: invoice.id, subscriptionId: mirror!.id, features: { activeListings: 25, bumpsPerMonth: 3, featuredSlots: 0, staffSeats: 1 } });
    expect(pro!.endsAt!.getTime()).toBe(Math.floor(end.getTime() / 1000) * 1000 + PRO_GRACE_MS);
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.subscriptionId, mirror!.id));
    expect(payment).toMatchObject({ kind: 'charge', amountMinor: 2400, providerInvoiceId: invoice.id });
    expect((await businessPlan(db, org.id)).code).toBe('pro');
  });

  it('the launch coupon’s €0 invoice grants Pro with no payment row', async () => {
    const { org } = await subscribed({ amountPaid: 0 });
    expect(await entitlementsOf({ organizationId: org.id })).toHaveLength(1);
    const [mirror] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.organizationId, org.id));
    expect(await db.select().from(schema.payments).where(eq(schema.payments.subscriptionId, mirror!.id))).toEqual([]);
    expect((await businessPlan(db, org.id)).features.activeListings).toBe(25);
  });

  it('the same invoice under a new event id grants one period', async () => {
    const { gateway, org, invoice } = await subscribed();
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    expect(await entitlementsOf({ organizationId: org.id })).toHaveLength(1);
  });

  it('subscription events out of order end in Stripe’s current state', async () => {
    const { gateway, org, sub } = await subscribed();
    // updated (cancel at period end) is delivered first, created afterwards: both read the current subscription
    const current = { ...sub, cancel_at_period_end: true };
    gateway.subscriptions.set(sub.id, current);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.updated', current)));
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.created', sub)));
    const [mirror] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.organizationId, org.id));
    expect(mirror!.cancelAtPeriodEnd).toBe(true);
  });

  it('when the free months end unpaid, the deleted subscription revokes the plan', async () => {
    const { gateway, org, sub } = await subscribed({ amountPaid: 0 });
    const ended = { ...sub, status: 'canceled', ended_at: Math.floor(Date.now() / 1000) };
    gateway.subscriptions.set(sub.id, ended);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.deleted', ended)));
    expect((await entitlementsOf({ organizationId: org.id }))[0]).toMatchObject({ revokeReason: 'subscription_ended' });
    expect((await businessPlan(db, org.id)).code).toBeNull();
  });

  it('refunding a Pro invoice revokes that period', async () => {
    const { org, invoice } = await subscribed();
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(`pi_test_inv_${(invoice.parent.subscription_details.subscription)}`, 2400))));
    expect((await entitlementsOf({ organizationId: org.id }))[0]).toMatchObject({ revokeReason: 'refund' });
  });

  it('included bumps and featured slots: requested by members, granted by the worker within the plan', async () => {
    const { org, ownerId } = await subscribed({ plan: 'pro-plus' });
    const staff = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: staff.id, role: 'staff' });
    const { listing } = await sellerWithListing({ userId: ownerId, organizationId: org.id });
    const { listing: staffListing } = await sellerWithListing({ userId: staff.id, organizationId: org.id });
    // Staff only on their own listings
    expect(await requestAllowance(appDb, { userId: staff.id, listingId: listing.id, kind: 'bump' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await requestAllowance(appDb, { userId: staff.id, listingId: staffListing.id, kind: 'bump' })).toEqual({ ok: true });
    expect(await outbox(staffListing.id)).toContain('allowance.requested');

    const grant = (listingId: string, kind: 'bump' | 'featured') => workerDb.transaction((tx) => grantAllowance(tx, { listingId, organizationId: org.id, kind }));
    for (let i = 0; i < 15; i++) expect(await grant(listing.id, 'bump')).toBe('granted');
    expect(await grant(listing.id, 'bump')).toBe('none_left');
    expect(await grant(listing.id, 'featured')).toBe('granted');
    expect(await grant(listing.id, 'featured')).toBe('already_featured');
    expect(await grant(staffListing.id, 'featured')).toBe('granted');
    const { listing: third } = await sellerWithListing({ userId: ownerId, organizationId: org.id });
    expect(await grant(third.id, 'featured')).toBe('none_left');
    expect(await allowancesLeft(db, org.id)).toMatchObject({ bumps: 0, featured: 0 });
    const fromPlan = (await entitlementsOf({ listingId: listing.id })).filter((e) => e.subscriptionId);
    expect(fromPlan.length).toBe(16);
  });

  it('a business without Pro has no allowances', async () => {
    const { org, ownerId } = await business();
    const { listing } = await sellerWithListing({ userId: ownerId, organizationId: org.id });
    expect(await requestAllowance(appDb, { userId: ownerId, listingId: listing.id, kind: 'bump' })).toEqual({ ok: false, reason: 'none_left' });
    expect(await workerDb.transaction((tx) => grantAllowance(tx, { listingId: listing.id, organizationId: org.id, kind: 'bump' }))).toBe('none_left');
    expect(await businessPlan(db, org.id)).toMatchObject({ code: null, features: { activeListings: 3 } });
  });
});

describe('the payments queue', () => {
  it('takes a received webhook from the outbox and applies it', async () => {
    const { order, checkoutId } = await buy('bump-1');
    const prefix = `test-payments-${Date.now()}`;
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const gateway = new FakeGateway();
    const jobs = await startPaymentJobs(workerDb, connection, { gateway, prefix, schedule: false });
    try {
      const e = event('checkout.session.completed', paidSession(order, checkoutId));
      const body = JSON.stringify(e);
      expect(await receiveWebhook(appDb, gateway, body, 'valid')).toBe('stored');
      // What processOutboxBatch does for this row (src/worker/outbox.ts)
      const [stored] = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.providerEventId, e.id));
      const [ev] = await db.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.aggregateId, stored!.id));
      const [handler] = jobs.handlers[ev!.eventType]!;
      expect(handler!.name).toBe('apply');
      await handler!.queue.add(handler!.name, { outboxId: ev!.id, eventType: ev!.eventType, aggregateId: stored!.id, payload: ev!.payload }, { jobId: `${ev!.id}_${handler!.name}` });
      const deadline = Date.now() + 10_000;
      while ((await orderRow(order.id)).status !== 'paid' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      expect((await orderRow(order.id)).status).toBe('paid');
      expect(await entitlementsOf({ orderId: order.id })).toHaveLength(1);
    } finally {
      await jobs.close();
      const q = new Queue('payments', { connection, prefix });
      await q.obliterate({ force: true });
      await q.close();
      await connection.quit();
    }
  });
});

describe('settings and headers', () => {
  const base = {
    APP_URL: 'https://staging.example.test',
    DATABASE_URL: 'postgres://u:p@h:5432/d',
    REDIS_URL: 'redis://h:6379',
    AUTH_SECRET: 'x'.repeat(32),
    TELEGRAM_BOT_USERNAME: 'peydoo_test_bot',
    PHONE_CODE_SECRET: 'y'.repeat(32),
  };
  it('refuses a live Stripe key unless PAYMENTS_LIVE=on, and wants the webhook secret with the key', () => {
    const live = { ...base, STRIPE_SECRET_KEY: 'sk_live_0123456789abcdef', STRIPE_WEBHOOK_SECRET: 'whsec_0123456789abcdef' };
    expect(parseWebEnv(live).success).toBe(false);
    expect(parseWebEnv({ ...live, PAYMENTS_LIVE: 'on' }).success).toBe(true);
    expect(parseWebEnv({ ...live, STRIPE_SECRET_KEY: 'sk_test_0123456789abcdef' }).success).toBe(true);
    expect(parseWebEnv({ ...base, STRIPE_SECRET_KEY: 'sk_test_0123456789abcdef' }).success).toBe(false);
    expect(parseWebEnv(base).success).toBe(true);
  });

  it('lets forms go on to Stripe’s Checkout and portal, and nowhere else', () => {
    const csp = contentSecurityPolicy('n', { IMAGE_URL: undefined, S3_ENDPOINT: undefined });
    expect(csp).toContain("form-action 'self' https://checkout.stripe.com https://billing.stripe.com;");
    expect(csp).not.toContain('js.stripe.com');
  });
});
