import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { startPlanCheckout } from '../src/modules/payments/checkout';
import {
  dueFoundingReminders,
  foundingBadge,
  foundingState,
  foundingTrialEnd,
  offerFounding,
  sendFoundingReminders,
  startFoundingCheckout,
} from '../src/modules/payments/founding';
import { checkoutParams } from '../src/modules/payments/gateway';
import { businessPlan } from '../src/modules/payments/plans';
import type { Mail } from '../src/modules/notifications/mailer';
import { appDb, redis, workerDb } from './accounts';
import { db, publicToken } from './db';
import { city } from './listings-fixtures';
import { business, entitlementsOf, event, FakeGateway, seedCatalog, storeEvent, stripeInvoice, stripePriceId, stripeSubscription, unix } from './payments-fixtures';

// Founding Pro (wave 0, step 6): a trial without a card that ends by itself; the owner's offer in
// admin within the city's places; reminders; the badge for a year from the page's creation.

const DAY = 86_400_000;
const APP = 'https://app.example.test';

beforeAll(async () => {
  await seedCatalog();
});

async function staff(): Promise<StaffContext> {
  const [u] = await db
    .insert(schema.users)
    .values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'مدیر', displayNameNormalized: 'مدیر' })
    .returning();
  return { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}

/** A verified business in a city (Berlin by default), offered or not */
async function verifiedBusiness(citySlug = 'berlin') {
  const b = await business();
  const c = await city(citySlug);
  await db.update(schema.organizations).set({ verificationStatus: 'verified', locationId: c.id }).where(eq(schema.organizations.id, b.org.id));
  return b;
}

async function offered(citySlug = 'berlin') {
  const b = await verifiedBusiness(citySlug);
  const ctx = await staff();
  const r = await db.transaction((tx) => offerFounding(tx, ctx, b.org.id));
  expect(r).toEqual({ ok: true });
  return b;
}

describe('the checkout', () => {
  it('is a trial without a card that Stripe cancels at the end', () => {
    const end = new Date('2027-05-26T10:00:00Z');
    const p = checkoutParams({ mode: 'subscription', customerId: 'cus_x', priceId: 'price_x', clientReferenceId: 'o', metadata: { a: 'b' }, successUrl: APP, cancelUrl: APP, trialEnd: end });
    expect(p).toMatchObject({
      mode: 'subscription',
      payment_method_collection: 'if_required',
      allow_promotion_codes: false,
      subscription_data: { trial_end: unix(end), trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } },
    });
  });

  it('lasts six calendar months', () => {
    expect(foundingTrialEnd(new Date('2026-11-20T09:00:00Z')).toISOString()).toBe('2027-05-20T09:00:00.000Z');
  });

  it('the normal Pro checkout no longer offers the retired launch code', async () => {
    const gateway = new FakeGateway();
    const { org, ownerId } = await business();
    expect(await startPlanCheckout(db, gateway, { userId: ownerId, organizationId: org.id, plan: 'pro', interval: 'month', appUrl: APP, business: true })).toMatchObject({ ok: true });
    expect(gateway.checkouts[0]!.promotionCodes).toBe(false);
  });
});

describe('the offer (admin)', () => {
  it('needs a verified business with a city, once, and is written to audit_log', async () => {
    const ctx = await staff();
    const unverified = await business();
    expect(await db.transaction((tx) => offerFounding(tx, ctx, unverified.org.id))).toEqual({ ok: false, reason: 'not_verified' });
    await db.update(schema.organizations).set({ verificationStatus: 'verified' }).where(eq(schema.organizations.id, unverified.org.id));
    expect(await db.transaction((tx) => offerFounding(tx, ctx, unverified.org.id))).toEqual({ ok: false, reason: 'no_city' });

    const b = await offered();
    expect(await db.transaction((tx) => offerFounding(tx, ctx, b.org.id))).toEqual({ ok: false, reason: 'already' });
    const [audit] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'organization.founding_offered'), eq(schema.auditLog.targetId, b.org.id)));
    expect(audit!.data).toMatchObject({ city: 'برلین', of: 30 });
  });

  it('stops at the city’s places (its business goal; Bonn counts with Cologne)', async () => {
    const koeln = await city('koeln');
    await db.update(schema.locations).set({ businessGoal: 1 }).where(eq(schema.locations.id, koeln.id));
    try {
      await offered('bonn');
      const ctx = await staff();
      const second = await verifiedBusiness('koeln');
      expect(await db.transaction((tx) => offerFounding(tx, ctx, second.org.id))).toEqual({ ok: false, reason: 'full' });
    } finally {
      await db.update(schema.locations).set({ businessGoal: 25 }).where(eq(schema.locations.id, koeln.id));
    }
  });
});

describe('the free months (business owner)', () => {
  it('only the owner of an offered business starts them, once', async () => {
    const gateway = new FakeGateway();
    const plain = await verifiedBusiness();
    expect(await startFoundingCheckout(db, gateway, { userId: plain.ownerId, organizationId: plain.org.id, appUrl: APP, business: true })).toEqual({ ok: false, reason: 'not_allowed' });

    const b = await offered();
    const stranger = await business();
    expect(await startFoundingCheckout(db, gateway, { userId: stranger.ownerId, organizationId: b.org.id, appUrl: APP, business: true })).toEqual({ ok: false, reason: 'not_found' });
    expect(await foundingState(appDb, b.org.id)).toBe('offered');

    const now = new Date('2026-11-20T09:00:00Z');
    expect(await startFoundingCheckout(db, gateway, { userId: b.ownerId, organizationId: b.org.id, appUrl: APP, now, business: true })).toMatchObject({ ok: true });
    expect(gateway.checkouts.at(-1)).toMatchObject({
      mode: 'subscription',
      priceId: stripePriceId('pro', 'month'),
      metadata: { organization_id: b.org.id, plan: 'pro', founding: '1' },
      promotionCodes: false,
      trialEnd: new Date('2027-05-20T09:00:00Z'),
    });
  });

  it('the €0 trial invoice grants six months; ending without a card takes Pro away; it can’t start again', async () => {
    const gateway = new FakeGateway();
    const b = await offered();
    const priceId = stripePriceId('pro', 'month');
    const start = new Date();
    const end = foundingTrialEnd(start);
    const sub = { ...stripeSubscription({ organizationId: b.org.id, priceId, start, end, status: 'trialing' }), trial_end: unix(end) };
    gateway.subscriptions.set(sub.id, sub);
    const invoice = stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid: 0, start, end });
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    expect((await businessPlan(db, b.org.id)).code).toBe('pro');
    expect(await foundingState(appDb, b.org.id)).toBe('used');
    expect(await startFoundingCheckout(db, gateway, { userId: b.ownerId, organizationId: b.org.id, appUrl: APP, business: true })).toEqual({ ok: false, reason: 'not_allowed' });

    // Stripe's trial_settings: no payment method at the end, so it cancels
    const ended = { ...sub, status: 'canceled', ended_at: unix(new Date()) };
    gateway.subscriptions.set(sub.id, ended);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.deleted', ended)));
    expect((await businessPlan(db, b.org.id)).code).toBeNull();
    expect((await entitlementsOf({ organizationId: b.org.id }))[0]).toMatchObject({ revokeReason: 'subscription_ended' });
  });
});

describe('reminders', () => {
  it('14 and 3 days before the end, once each, in the business city’s time zone', async () => {
    const now = new Date('2027-01-10T08:05:00Z');
    const rows: Array<{ id: string; days: number }> = [];
    for (const days of [13.5, 2.5, 10]) {
      const b = await offered();
      const [price] = await db.select({ id: schema.productPrices.id }).from(schema.productPrices).where(eq(schema.productPrices.providerPriceId, stripePriceId('pro', 'month')));
      const [s] = await db
        .insert(schema.subscriptions)
        .values({
          organizationId: b.org.id,
          productPriceId: price!.id,
          providerSubscriptionId: `sub_${randomUUID()}`,
          status: 'trialing',
          currentPeriodStart: new Date(now.getTime() - 100 * DAY),
          currentPeriodEnd: new Date(now.getTime() + days * DAY),
          trialEndsAt: new Date(now.getTime() + days * DAY),
        })
        .returning();
      rows.push({ id: s!.id, days });
    }
    const due = await dueFoundingReminders(workerDb, now);
    expect(due.find((d) => d.subscriptionId === rows[0]!.id)).toMatchObject({ days: 14, timeZone: 'Europe/Berlin' });
    expect(due.find((d) => d.subscriptionId === rows[1]!.id)).toMatchObject({ days: 3 });
    expect(due.find((d) => d.subscriptionId === rows[2]!.id)).toBeUndefined();

    const sent: Mail[] = [];
    const mail = async (m: Mail) => void sent.push(m);
    await sendFoundingReminders(workerDb, redis, mail, { appUrl: APP }, now);
    const mine = sent.filter((m) => m.text.includes('/billing'));
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(mine[0]!.text).toContain('چیزی از شما برداشته نمی‌شود');
    const again: Mail[] = [];
    await sendFoundingReminders(workerDb, redis, async (m) => void again.push(m), { appUrl: APP }, now);
    expect(again).toHaveLength(0);
  });
});

describe('the badge', () => {
  it('shows for a year from the business page’s creation, only for founding businesses', () => {
    const createdAt = new Date('2026-11-01T00:00:00Z');
    expect(foundingBadge({ foundingOfferedAt: new Date('2026-12-01'), createdAt }, new Date('2027-10-31T00:00:00Z'))).toBe(true);
    expect(foundingBadge({ foundingOfferedAt: new Date('2026-12-01'), createdAt }, new Date('2027-11-02T00:00:00Z'))).toBe(false);
    expect(foundingBadge({ foundingOfferedAt: null, createdAt }, new Date('2026-12-01'))).toBe(false);
  });
});
