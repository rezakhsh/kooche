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
  foundingRuleBreaks,
  foundingState,
  foundingTrialEnd,
  offerFounding,
  sendFoundingReminders,
  startFoundingCheckout,
} from '../src/modules/payments/founding';
import { checkoutParams } from '../src/modules/payments/gateway';
import { businessPlan } from '../src/modules/payments/plans';
import { cardsByIds } from '../src/modules/search/browse';
import type { Mail } from '../src/modules/notifications/mailer';
import { appDb, redis, workerDb } from './accounts';
import { db, publicToken } from './db';
import { city, user } from './listings-fixtures';
import { business, entitlementsOf, event, FakeGateway, seedCatalog, sellerWithListing, storeEvent, stripeInvoice, stripePriceId, stripeSubscription, unix } from './payments-fixtures';

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
async function verifiedBusiness(citySlug = 'berlin', ownerId?: string) {
  const b = await business(ownerId);
  const c = await city(citySlug);
  await db.update(schema.organizations).set({ verificationStatus: 'verified', locationId: c.id }).where(eq(schema.organizations.id, b.org.id));
  return b;
}

async function offered(citySlug = 'berlin', ownerId?: string) {
  const b = await verifiedBusiness(citySlug, ownerId);
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

/** An Austrian mobile number, for an owner whose number isn't from the business's country (Germany) */
const austrianNumber = () => `+43664${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

const refusals = (organizationId: string) =>
  db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'organization.founding_refused'), eq(schema.auditLog.targetId, organizationId)));

describe('the founders rules (wave 2)', () => {
  it('the owner’s verified number must be from the business’s country; refusals go to audit_log', async () => {
    const ctx = await staff();
    const austrian = await verifiedBusiness();
    await db.update(schema.users).set({ phoneE164: austrianNumber() }).where(eq(schema.users.id, austrian.ownerId));
    expect(await db.transaction((tx) => offerFounding(tx, ctx, austrian.org.id))).toEqual({ ok: false, reason: 'owner_number', country: 'DE' });
    expect((await refusals(austrian.org.id))[0]).toMatchObject({ actorUserId: ctx.userId, data: { reason: 'owner_number', country: 'DE' } });

    const noNumber = await verifiedBusiness('berlin', (await user({ verified: false })).id);
    expect(await db.transaction((tx) => offerFounding(tx, ctx, noNumber.org.id))).toMatchObject({ ok: false, reason: 'owner_number' });
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, noNumber.org.id));
    expect(org!.foundingOfferedAt).toBeNull();
  });

  it('only owners count: a manager’s German number doesn’t help', async () => {
    const ctx = await staff();
    const b = await verifiedBusiness();
    await db.update(schema.users).set({ phoneE164: austrianNumber() }).where(eq(schema.users.id, b.ownerId));
    await db.insert(schema.organizationMembers).values({ organizationId: b.org.id, userId: (await user()).id, role: 'manager' });
    expect(await db.transaction((tx) => offerFounding(tx, ctx, b.org.id))).toMatchObject({ ok: false, reason: 'owner_number' });
  });

  it('one founding place per person', async () => {
    const ctx = await staff();
    const first = await offered();
    const second = await verifiedBusiness('berlin', first.ownerId);
    expect(await db.transaction((tx) => offerFounding(tx, ctx, second.org.id))).toEqual({ ok: false, reason: 'owner_has_founding', country: 'DE' });
    // A closed business's place still counts
    await db.update(schema.organizations).set({ status: 'deleted', deletedAt: new Date() }).where(eq(schema.organizations.id, first.org.id));
    expect(await db.transaction((tx) => offerFounding(tx, ctx, second.org.id))).toMatchObject({ ok: false, reason: 'owner_has_founding' });
  });

  it('are checked again when the free months start (a changed number)', async () => {
    const gateway = new FakeGateway();
    const b = await offered();
    await db.update(schema.users).set({ phoneE164: austrianNumber() }).where(eq(schema.users.id, b.ownerId));
    expect(await startFoundingCheckout(db, gateway, { userId: b.ownerId, organizationId: b.org.id, appUrl: APP, business: true })).toEqual({ ok: false, reason: 'owner_number' });
    expect(gateway.checkouts).toHaveLength(0);
    expect((await refusals(b.org.id))[0]).toMatchObject({ actorType: 'user', actorUserId: b.ownerId, data: { reason: 'owner_number', at: 'free_months' } });
  });

  it('businesses offered before the rules keep their place; the earlier one is fine, the later one is flagged', async () => {
    const owner = await user();
    const a = await verifiedBusiness('berlin', owner.id);
    const b = await verifiedBusiness('berlin', owner.id);
    await db.update(schema.organizations).set({ foundingOfferedAt: new Date(Date.now() - DAY) }).where(eq(schema.organizations.id, a.org.id));
    await db.update(schema.organizations).set({ foundingOfferedAt: new Date() }).where(eq(schema.organizations.id, b.org.id));
    expect(await foundingRuleBreaks(db, a.org.id)).toEqual({ country: 'DE', breaks: [] });
    expect(await foundingRuleBreaks(db, b.org.id)).toEqual({ country: 'DE', breaks: ['owner_has_founding'] });
    expect(await foundingState(appDb, b.org.id)).toBe('offered');
    expect(await startFoundingCheckout(db, new FakeGateway(), { userId: owner.id, organizationId: b.org.id, appUrl: APP, business: true })).toEqual({ ok: false, reason: 'owner_has_founding' });
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
      cancelUrl: `${APP}/b/${b.org.slug}/billing?cancelled=1`,
    });
    // Pressed again while Stripe's page is open (wave 1): the same page, not a second trial
    const count = gateway.checkouts.length;
    expect(await startFoundingCheckout(db, gateway, { userId: b.ownerId, organizationId: b.org.id, appUrl: APP, now, business: true })).toMatchObject({ ok: true });
    expect(gateway.checkouts).toHaveLength(count);
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

  it('shows on the business’s listing cards for the same year (wave 1)', async () => {
    const { org } = await business();
    const { listing } = await sellerWithListing({ organizationId: org.id });
    const { listing: privateOne } = await sellerWithListing();
    const founding = async () => Object.fromEntries((await cardsByIds(appDb, [listing.id, privateOne.id], null)).map((c) => [c.id, c.founding]));
    expect(await founding()).toEqual({ [listing.id]: false, [privateOne.id]: false });
    await db.update(schema.organizations).set({ foundingOfferedAt: new Date() }).where(eq(schema.organizations.id, org.id));
    expect(await founding()).toEqual({ [listing.id]: true, [privateOne.id]: false });
    // A year after the page was created the badge ends, on cards as on the page
    await db.update(schema.organizations).set({ createdAt: new Date(Date.now() - 366 * DAY) }).where(eq(schema.organizations.id, org.id));
    expect(await founding()).toEqual({ [listing.id]: false, [privateOne.id]: false });
  });
});
