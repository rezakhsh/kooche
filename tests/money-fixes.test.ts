import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { Db } from '../src/db/drizzle';
import type { StaffContext } from '../src/modules/admin/audit';
import { grantWaitlistRewards, usableRewards, useReward } from '../src/modules/launch/rewards';
import { applyWebhookEvent, periodLine, PRO_GRACE_MS } from '../src/modules/payments/apply';
import { applyDueRewards } from '../src/modules/payments/bumps';
import { startListingCheckout, startPlanCheckout } from '../src/modules/payments/checkout';
import { planFeatures } from '../src/modules/payments/features';
import { startFoundingCheckout } from '../src/modules/payments/founding';
import { businessPlan } from '../src/modules/payments/plans';
import { changePrice } from '../src/modules/payments/prices';
import { appDb, workerDb } from './accounts';
import { db, location, makeListing, makeUser, rollback, setRole, type Tx } from './db';
import {
  business,
  entitlementsOf,
  event,
  FakeGateway,
  orderRow,
  paidSession,
  seedCatalog,
  sellerWithListing,
  storeEvent,
  stripeInvoice,
  stripePriceId,
  stripeRefund,
  stripeSubscription,
} from './payments-fixtures';

// Money, fixed after the code check of Oct 30, 2026 (package 2): a plan switch in the portal,
// paying twice, purchases applied late, refunds out of order, a price change finished later, and
// a waitlist reward on a listing that isn't live.

const DAY = 86_400_000;
const APP_URL = 'https://app.example.test';
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

beforeAll(async () => {
  await seedCatalog();
});

async function features(code: string) {
  const [p] = await db.select({ features: schema.products.features }).from(schema.products).where(eq(schema.products.code, code));
  return planFeatures(p!.features);
}

describe('a plan switch in the Customer Portal', () => {
  it('the renewal grants the new period, not the switch’s price differences', async () => {
    const gateway = new FakeGateway();
    const { org } = await business();
    const [pro, proPlus] = [stripePriceId('pro', 'month'), stripePriceId('pro-plus', 'month')];
    const switched = new Date(Date.now() - 15 * DAY);
    const start = new Date(Date.now() - DAY);
    const end = new Date(start.getTime() + 30 * DAY);
    const sub = stripeSubscription({ organizationId: org.id, priceId: proPlus, start, end });
    gateway.subscriptions.set(sub.id, sub);
    const invoice = stripeInvoice({ subscriptionId: sub.id, priceId: proPlus, amountPaid: 4900, start, end, paymentIntent: 'pi_test_' + sub.id });
    const proration = (price: string) => ({ period: { start: unix(switched), end: unix(start) }, pricing: { price_details: { price } }, parent: { subscription_item_details: { proration: true } } });
    invoice.lines.data = [proration(pro), proration(proPlus), { ...invoice.lines.data[0]!, parent: { subscription_item_details: { proration: false } } }] as never;
    expect(periodLine(invoice as never)!.period.end).toBe(unix(end));
    gateway.invoices.set(invoice.id, invoice);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    const [granted] = await entitlementsOf({ organizationId: org.id });
    expect(granted!.endsAt!.getTime()).toBe(unix(end) * 1000 + PRO_GRACE_MS);
    const plan = await businessPlan(db, org.id, new Date(start.getTime() + 10 * DAY));
    expect(plan.code).toBe('pro-plus');
    expect(plan.features).toEqual(await features('pro-plus'));
  });

  it('the new plan’s limits count from the switch (the difference is on the next invoice)', async () => {
    const gateway = new FakeGateway();
    const { org } = await business();
    const start = new Date(Date.now() - DAY);
    const end = new Date(start.getTime() + 30 * DAY);
    const sub = stripeSubscription({ organizationId: org.id, priceId: stripePriceId('pro', 'month'), start, end });
    gateway.subscriptions.set(sub.id, sub);
    const invoice = stripeInvoice({ subscriptionId: sub.id, priceId: stripePriceId('pro', 'month'), amountPaid: 2400, start, end, paymentIntent: 'pi_test_' + sub.id });
    gateway.invoices.set(invoice.id, invoice);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    expect((await businessPlan(db, org.id)).features).toEqual(await features('pro'));
    // Switched to Pro Plus in the portal
    const switched = stripeSubscription({ id: sub.id, organizationId: org.id, priceId: stripePriceId('pro-plus', 'month'), start, end, customer: sub.customer });
    gateway.subscriptions.set(sub.id, switched);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.updated', switched)));
    expect(await businessPlan(db, org.id)).toMatchObject({ code: 'pro-plus', features: await features('pro-plus') });
  });
});

describe('paying twice for Pro', () => {
  it('is refused while Stripe already has the subscription, before our webhook arrives', async () => {
    const gateway = new FakeGateway();
    const { org, ownerId } = await business();
    const start = () => startPlanCheckout(appDb, gateway, { userId: ownerId, organizationId: org.id, plan: 'pro', interval: 'month', appUrl: APP_URL, business: true });
    expect(await start()).toMatchObject({ ok: true });
    gateway.closed.add(gateway.checkouts[0]!.id);
    const [customer] = await db.select().from(schema.billingCustomers).where(eq(schema.billingCustomers.organizationId, org.id));
    const sub = stripeSubscription({ organizationId: org.id, priceId: stripePriceId('pro', 'month'), start: new Date(), end: new Date(Date.now() + 30 * DAY), customer: customer!.providerCustomerId, status: 'incomplete' });
    gateway.subscriptions.set(sub.id, sub);
    expect(await start()).toEqual({ ok: false, reason: 'already_subscribed' });
    expect(await startFoundingCheckout(appDb, gateway, { userId: ownerId, organizationId: org.id, appUrl: APP_URL, business: true } as never)).toMatchObject({ ok: false });
    expect(gateway.checkouts).toHaveLength(1);
  });
});

describe('a purchase applied late', () => {
  it('a featured week counts from when it is applied', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'featured-7d', waiver: true, appUrl: APP_URL });
    const order = await orderRow(r.ok ? r.orderId! : '');
    const paidAt = new Date();
    const id = await storeEvent(event('checkout.session.completed', paidSession(order, gateway.checkouts[0]!.id), paidAt));
    const now = new Date(paidAt.getTime() + 8 * DAY);
    await applyWebhookEvent(workerDb, gateway, id, now);
    const [featured] = await entitlementsOf({ orderId: order.id });
    expect(featured!.startsAt.getTime()).toBe(now.getTime());
    expect(featured!.endsAt!.getTime()).toBe(now.getTime() + 7 * DAY);
    // The record keeps when it was paid
    expect((await orderRow(order.id)).paidAt!.getTime()).toBe(Math.floor(paidAt.getTime() / 1000) * 1000);
  });
});

describe('refunds out of order', () => {
  it('an older "pending" event doesn’t undo a failed refund: Stripe’s status now counts', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP_URL });
    const order = await orderRow(r.ok ? r.orderId! : '');
    const session = paidSession(order, gateway.checkouts[0]!.id);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', session)));
    const refund = stripeRefund(session.payment_intent as string, 199, 'pending');
    gateway.refundsNow.set(refund.id, { ...refund, status: 'failed' });
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('refund.failed', { ...refund, status: 'failed' })));
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('refund.created', refund)));
    const [row] = await db.select().from(schema.payments).where(eq(schema.payments.providerPaymentId, refund.id));
    expect(row!.status).toBe('failed');
    expect((await orderRow(order.id)).status).toBe('paid');
    expect((await entitlementsOf({ orderId: order.id })).every((e) => !e.revokedAt)).toBe(true);
  });
});

describe('a price change that failed half-way', () => {
  it('is finished by trying again: every earlier price of the slot is retired', async () => {
    await rollback(async (tx) => {
      const staff = await makeUser(tx, { staffRole: 'admin' });
      await setRole(tx, 'classifieds_app');
      const ctx: StaffContext = { userId: staff.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
      const gateway = new FakeGateway();
      const old = stripePriceId('pro', 'month');
      let fail = true;
      gateway.setPortalPlans = async () => {
        if (fail) throw new Error('Stripe is down');
      };
      await expect(changePrice(tx as unknown as Db, gateway, ctx, { code: 'pro', interval: 'month', amountMinor: 2900 })).rejects.toThrow('Stripe is down');
      expect(gateway.archived).not.toContain(old);
      fail = false;
      expect(await changePrice(tx as unknown as Db, gateway, ctx, { code: 'pro', interval: 'month', amountMinor: 2900 })).toMatchObject({ ok: true, changed: false });
      expect(gateway.archived).toContain(old);
    });
  });
});

describe('a waitlist reward on a listing that isn’t live', () => {
  async function rewarded(tx: Tx) {
    const city = await location(tx, 'hamburg');
    const email = `reward-${randomUUID().slice(0, 8)}@example.test`;
    await tx.insert(schema.cityWaitlist).values({ locationId: city.id, email, role: 'private', confirmTokenHash: Buffer.from(randomUUID().replace(/-/g, ''), 'hex'), confirmedAt: new Date(Date.now() - 50 * DAY), leaveToken: randomUUID().replace(/-/g, '') });
    const opened = new Date(Date.now() - 4 * DAY);
    await grantWaitlistRewards(tx, [city.id], opened);
    const u = await makeUser(tx, { email, emailVerified: true });
    const l = await makeListing(tx, u.id);
    expect(await useReward(tx, { userId: u.id, listingId: l.id })).toEqual({ ok: true });
    return { u, l, opened };
  }

  it('is freed again while it lasts, instead of waiting for the listing', async () => {
    await rollback(async (tx) => {
      const { u, l } = await rewarded(tx);
      await tx.update(schema.listings).set({ status: 'paused' }).where(eq(schema.listings.id, l.id));
      await setRole(tx, 'classifieds_worker');
      expect(await applyDueRewards(tx)).toMatchObject({ applied: 0 });
      await tx.execute(sql`RESET ROLE`);
      expect((await usableRewards(tx, u.id)).length).toBe(1);
    });
  });

  it('is never applied after its last day', async () => {
    await rollback(async (tx) => {
      const { l, opened } = await rewarded(tx);
      await setRole(tx, 'classifieds_worker');
      expect(await applyDueRewards(tx, new Date(opened.getTime() + 61 * DAY))).toMatchObject({ applied: 0 });
      const [r] = await tx.select().from(schema.waitlistRewards).where(and(eq(schema.waitlistRewards.listingId, l.id)));
      expect(r).toBeUndefined();
    });
  });
});
