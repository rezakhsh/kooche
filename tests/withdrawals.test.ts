import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { Mail } from '../src/modules/notifications/mailer';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { applyDueBumps } from '../src/modules/payments/bumps';
import { startListingCheckout } from '../src/modules/payments/checkout';
import { PAYMENT_NOTICE, parsePaymentNotice, sendPaymentNotice } from '../src/modules/payments/notices';
import { ownOrder } from '../src/modules/payments/orders';
import { featuredListingIds } from '../src/modules/payments/plans';
import { canWithdraw, processWithdrawal, withdrawalRefund, withdrawOrder, WITHDRAWAL_RECEIVED } from '../src/modules/payments/withdrawals';
import { appDb, redis, workerDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE } from './db';
import { outbox } from './listings-fixtures';
import { business, entitlementsOf, event, FakeGateway, orderRow, paidSession, seedCatalog, sellerWithListing, storeEvent, stripeRefund } from './payments-fixtures';

// The withdrawal button for consumers (§ 356a BGB, wave 0 step 7): two steps, once per order, only
// a private person's paid order within 14 days; the receipt at once; the refund of what wasn't used
// (§ 357a (2) BGB) asked from Stripe by the worker; what is left ends only with the refund's webhook.

const APP = 'https://app.example.test';
const DAY = 86_400_000;

beforeAll(async () => {
  await seedCatalog();
});

/** A private seller's paid order of a product, for a listing of theirs */
async function paidOrder(productCode: string, listingValues: Partial<typeof schema.listings.$inferInsert> = {}) {
  const gateway = new FakeGateway();
  const { seller, listing } = await sellerWithListing(listingValues);
  const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode, waiver: true, appUrl: APP });
  if (!r.ok) throw new Error(r.reason);
  const order = await orderRow(r.orderId!);
  const session = paidSession(order, gateway.checkouts[0]!.id);
  await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', session)));
  return { seller, listing, order: await orderRow(order.id), paymentIntent: session.payment_intent as string };
}

async function withdrawalRow(orderId: string) {
  const [w] = await db.select().from(schema.orderWithdrawals).where(eq(schema.orderWithdrawals.orderId, orderId));
  return w!;
}

async function notices(orderId: string) {
  const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_NOTICE), eq(schema.outboxEvents.aggregateId, orderId))).orderBy(schema.outboxEvents.id);
  return rows.map((r) => parsePaymentNotice(r.payload as Record<string, unknown>)!);
}

describe('the button', () => {
  it('shows for a consumer’s paid order for 14 days, never for a business, an unpaid or a withdrawn one', () => {
    const paidAt = new Date('2026-11-01T10:00:00Z');
    const o = { status: 'paid' as const, paidAt, business: false, withdrawnAt: null };
    expect(canWithdraw(o, new Date('2026-11-15T09:59:00Z'))).toBe(true);
    expect(canWithdraw(o, new Date('2026-11-15T10:00:00Z'))).toBe(false);
    expect(canWithdraw({ ...o, status: 'partially_refunded' }, paidAt)).toBe(true);
    expect(canWithdraw({ ...o, business: true }, paidAt)).toBe(false);
    expect(canWithdraw({ ...o, status: 'refunded' }, paidAt)).toBe(false);
    expect(canWithdraw({ ...o, status: 'pending', paidAt: null }, paidAt)).toBe(false);
    expect(canWithdraw({ ...o, withdrawnAt: paidAt }, paidAt)).toBe(false);
  });

  it('is on the buyer’s own order only, not on a business listing’s order, and not after 14 days', async () => {
    const { seller, order } = await paidOrder('featured-7d');
    expect(canWithdraw((await ownOrder(appDb, seller.id, order.id))!)).toBe(true);
    const stranger = await sellerWithListing();
    expect(await withdrawOrder(appDb, { userId: stranger.seller.id, orderId: order.id })).toEqual({ ok: false, reason: 'not_found' });
    expect(await withdrawOrder(appDb, { userId: seller.id, orderId: order.id, now: new Date(order.paidAt!.getTime() + 14 * DAY + 1) })).toEqual({ ok: false, reason: 'not_allowed' });

    const { org, ownerId } = await business();
    const forBusiness = await paidOrderFor(ownerId, org.id);
    expect(canWithdraw((await ownOrder(appDb, ownerId, forBusiness))!)).toBe(false);
    expect(await withdrawOrder(appDb, { userId: ownerId, orderId: forBusiness })).toEqual({ ok: false, reason: 'not_allowed' });
  });
});

/** A paid order for a business's listing (bought by its owner) */
async function paidOrderFor(ownerId: string, organizationId: string): Promise<string> {
  const { listing } = await sellerWithListing();
  await db.update(schema.listings).set({ userId: ownerId, organizationId }).where(eq(schema.listings.id, listing.id));
  const gateway = new FakeGateway();
  const r = await startListingCheckout(appDb, gateway, { userId: ownerId, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP });
  if (!r.ok) throw new Error(r.reason);
  const order = await orderRow(r.orderId!);
  await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', paidSession(order, gateway.checkouts[0]!.id))));
  return order.id;
}

describe('what comes back (§ 357a (2) BGB)', () => {
  const at = new Date('2026-11-10T12:00:00Z');
  const bump = (appliedAt: Date | null) => ({ type: 'bump', startsAt: at, endsAt: null, appliedAt, revokedAt: null });
  const ran = new Date(at.getTime() - DAY);

  it('bumps: the ones not run yet', () => {
    expect(withdrawalRefund({ totalMinor: 199, refundedMinor: 0, granted: [bump(ran)], receivedAt: at })).toBe(0);
    expect(withdrawalRefund({ totalMinor: 199, refundedMinor: 0, granted: [bump(null)], receivedAt: at })).toBe(199);
    expect(withdrawalRefund({ totalMinor: 449, refundedMinor: 0, granted: [bump(ran), bump(null), bump(null)], receivedAt: at })).toBe(299);
    expect(withdrawalRefund({ totalMinor: 449, refundedMinor: 0, granted: [bump(ran), bump(ran), bump(null)], receivedAt: at })).toBe(150);
  });

  it('featured: the time left, pro rata; minus what was refunded before', () => {
    const featured = (startsAt: Date, days: number) => ({ type: 'featured', startsAt, endsAt: new Date(startsAt.getTime() + days * DAY), appliedAt: null, revokedAt: null });
    expect(withdrawalRefund({ totalMinor: 699, refundedMinor: 0, granted: [featured(new Date(at.getTime() - DAY), 7)], receivedAt: at })).toBe(599);
    // Bought while still featured: its own period hasn't started, so all of it comes back
    expect(withdrawalRefund({ totalMinor: 699, refundedMinor: 0, granted: [featured(new Date(at.getTime() + DAY), 7)], receivedAt: at })).toBe(699);
    // A featured event over its 4 days, half gone
    expect(withdrawalRefund({ totalMinor: 999, refundedMinor: 0, granted: [featured(new Date(at.getTime() - 2 * DAY), 4)], receivedAt: at })).toBe(500);
    expect(withdrawalRefund({ totalMinor: 699, refundedMinor: 100, granted: [featured(new Date(at.getTime() - DAY), 7)], receivedAt: at })).toBe(499);
  });
});

describe('withdrawing (app, worker, webhook)', () => {
  it('records once with a receipt; the worker refunds the rest; the webhook ends the featured time', async () => {
    const { seller, listing, order, paymentIntent } = await paidOrder('featured-7d');
    const r = await withdrawOrder(appDb, { userId: seller.id, orderId: order.id, ip: '203.0.113.9', userAgent: 'test' });
    expect(r).toMatchObject({ ok: true });
    // Pressing again does nothing
    expect(await withdrawOrder(appDb, { userId: seller.id, orderId: order.id })).toEqual({ ok: false, reason: 'already' });
    const w = await withdrawalRow(order.id);
    expect(w).toMatchObject({ status: 'received', userId: seller.id, receiptEmail: seller.email, currency: 'EUR', processedAt: null });
    const [audit] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'order.withdrawn'), eq(schema.auditLog.targetId, order.id)));
    expect(audit).toMatchObject({ actorUserId: seller.id, ipAddress: '203.0.113.9' });
    expect(await notices(order.id)).toContainEqual({ kind: 'withdrawal_received', withdrawalId: w.id });
    expect(await outbox(order.id)).toContain(WITHDRAWAL_RECEIVED);
    // Featured stays until the refund's webhook
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(true);

    const gateway = new FakeGateway();
    expect(await processWithdrawal(workerDb, gateway, w.id)).toBe('refunded');
    expect(await processWithdrawal(workerDb, gateway, w.id)).toBe('done');
    expect(gateway.refunds).toHaveLength(1);
    const asked = gateway.refunds[0]!;
    // Withdrawn seconds after paying: (almost) all of it
    expect(asked.amountMinor).toBeGreaterThanOrEqual(698);
    expect(asked).toMatchObject({ paymentIntentId: paymentIntent, metadata: { withdrawal_id: w.id, order_id: order.id }, idempotencyKey: `withdrawal-${w.id}` });
    expect(await withdrawalRow(order.id)).toMatchObject({ status: 'refunded', refundMinor: asked.amountMinor });
    expect((await notices(order.id)).map((n) => n.kind)).toContain('withdrawal_processed');
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(true);

    const refund = { ...stripeRefund(paymentIntent, asked.amountMinor), metadata: asked.metadata };
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('refund.created', refund)));
    expect((await entitlementsOf({ orderId: order.id }))[0]).toMatchObject({ revokeReason: 'withdrawal' });
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(false);
    expect(['partially_refunded', 'refunded']).toContain((await orderRow(order.id)).status);
  });

  it('3 bumps with one run: two thirds back, and the other two never run', async () => {
    const { seller, listing, order, paymentIntent } = await paidOrder('bump-3');
    await applyDueBumps(workerDb, new Date());
    await withdrawOrder(appDb, { userId: seller.id, orderId: order.id });
    const w = await withdrawalRow(order.id);
    const gateway = new FakeGateway();
    await processWithdrawal(workerDb, gateway, w.id);
    expect(gateway.refunds[0]!.amountMinor).toBe(299);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('refund.created', { ...stripeRefund(paymentIntent, 299), metadata: gateway.refunds[0]!.metadata })));
    const granted = await entitlementsOf({ orderId: order.id });
    expect(granted.filter((e) => e.appliedAt && !e.revokedAt)).toHaveLength(1);
    expect(granted.filter((e) => e.revokeReason === 'withdrawal')).toHaveLength(2);
    expect((await orderRow(order.id)).status).toBe('partially_refunded');
    const [{ rankedAt }] = await db.select({ rankedAt: schema.listings.rankedAt }).from(schema.listings).where(eq(schema.listings.id, listing.id)) as [{ rankedAt: Date }];
    await applyDueBumps(workerDb, new Date(Date.now() + 10 * DAY));
    const [after] = await db.select({ rankedAt: schema.listings.rankedAt }).from(schema.listings).where(eq(schema.listings.id, listing.id));
    expect(after!.rankedAt).toEqual(rankedAt);
  });

  it('a single bump that ran: nothing back, no refund asked, and the buyer is told why', async () => {
    const { seller, order } = await paidOrder('bump-1');
    await applyDueBumps(workerDb, new Date());
    await withdrawOrder(appDb, { userId: seller.id, orderId: order.id });
    const w = await withdrawalRow(order.id);
    const gateway = new FakeGateway();
    expect(await processWithdrawal(workerDb, gateway, w.id)).toBe('no_refund');
    expect(gateway.refunds).toHaveLength(0);
    expect(await withdrawalRow(order.id)).toMatchObject({ status: 'no_refund', refundMinor: 0 });

    const mails: Mail[] = [];
    const deps = { mail: async (m: Mail) => void mails.push(m), telegram: null, appUrl: APP, gateway: null };
    for (const n of await notices(order.id)) if (n.kind.startsWith('withdrawal')) await sendPaymentNotice(workerDb, redis, deps, order.id, n);
    expect(mails).toHaveLength(2);
    // The receipt: to the address shown, with the date and time, and the binding German text
    expect(mails[0]!.to).toBe(seller.email);
    expect(mails[0]!.subject).toContain('انصراف شما رسید');
    expect(mails[0]!.text).toContain('Eingangsbestätigung');
    expect(mails[0]!.text).toContain('Hochschieben einer Anzeige');
    expect(mails[0]!.html).toContain('dir="ltr"');
    expect(mails[1]!.text).toContain('پولی برنمی‌گردد');
  });

  it('a refund without the withdrawal tag still ends nothing when partial', async () => {
    const { order, paymentIntent } = await paidOrder('featured-7d');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', { ...stripeRefund(paymentIntent, 100), metadata: { withdrawal_id: '0190f0f0-0000-7000-8000-000000000000' } })));
    expect((await entitlementsOf({ orderId: order.id }))[0]!.revokedAt).toBeNull();
  });

  it('the app can’t change a withdrawal or say what was refunded', async () => {
    const { seller, order } = await paidOrder('bump-1');
    await withdrawOrder(appDb, { userId: seller.id, orderId: order.id });
    await expectError(appDb.update(schema.orderWithdrawals).set({ status: 'no_refund' }).where(eq(schema.orderWithdrawals.orderId, order.id)), INSUFFICIENT_PRIVILEGE);
    await expectError(appDb.delete(schema.orderWithdrawals).where(eq(schema.orderWithdrawals.orderId, order.id)), INSUFFICIENT_PRIVILEGE);
  });
});
