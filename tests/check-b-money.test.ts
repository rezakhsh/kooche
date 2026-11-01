import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Queue, QueueEvents } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema, type EventInput } from '../src/modules/events/input';
import { addFavorite } from '../src/modules/listings/favorites';
import { listingInputSchema, type ListingInput } from '../src/modules/listings/listings';
import type { Mail } from '../src/modules/notifications/mailer';
import { sendOnce } from '../src/modules/notifications/send-once';
import type { TelegramClient } from '../src/modules/notifications/telegram-api';
import { allowancesLeft, grantAllowance, requestAllowance } from '../src/modules/payments/allowances';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { applyDueBumps } from '../src/modules/payments/bumps';
import { startListingCheckout } from '../src/modules/payments/checkout';
import { sendFoundingReminders } from '../src/modules/payments/founding';
import type { RefundInput } from '../src/modules/payments/gateway';
import { PAYMENT_NOTICE, parsePaymentNotice, sendPaymentNotice } from '../src/modules/payments/notices';
import { canWithdraw, processWithdrawal, withdrawalEnd, withdrawOrder } from '../src/modules/payments/withdrawals';
import { startEventJobs } from '../src/worker/events';
import { startModerationJobs } from '../src/worker/moderation';
import { logText } from '../src/worker/monitoring';
import { appDb, redis, workerDb } from './accounts';
import { db, publicToken } from './db';
import { categoryBySlug, openEverywhereForTests, user } from './listings-fixtures';
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

// Check B, package 4 (money and background jobs, approved Nov 1, 2026): a withdrawal retried after
// Stripe refunded still says what comes back; the button stays to the end of the 14th day; refunds
// and chargebacks that end paid time are told, and a won chargeback gives it back; one included
// bump per press; each channel of a notice once; reminders survive a failed send and a late run;
// the owner's alert once per slot; no addresses in the worker log.

const DAY = 86_400_000;
const APP = 'https://peydoo.test';

let closeAgain: () => Promise<void>;
beforeAll(async () => {
  await seedCatalog();
  closeAgain = await openEverywhereForTests();
});
afterAll(async () => {
  await closeAgain();
});

/** A private seller's paid order for a listing of theirs */
async function paidOrder(productCode: string) {
  const gateway = new FakeGateway();
  const { seller, listing } = await sellerWithListing();
  const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode, waiver: true, appUrl: APP });
  if (!r.ok) throw new Error(r.reason);
  const order = await orderRow(r.orderId!);
  const session = paidSession(order, gateway.checkouts[0]!.id);
  await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', session)));
  return { seller, listing, order: await orderRow(order.id), paymentIntent: session.payment_intent as string };
}

async function paymentNotices(aggregateId: string) {
  const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_NOTICE), eq(schema.outboxEvents.aggregateId, aggregateId))).orderBy(schema.outboxEvents.id);
  return rows.map((r) => parsePaymentNotice(r.payload as Record<string, unknown>)!);
}

/** A business on Pro, its invoice paid (the charge's payment intent: `pi_test_inv_<sub>`) */
async function subscribed() {
  const gateway = new FakeGateway();
  const { org, ownerId } = await business();
  const priceId = stripePriceId('pro', 'month');
  const start = new Date(Date.now() - DAY);
  const end = new Date(start.getTime() + 30 * DAY);
  const sub = stripeSubscription({ organizationId: org.id, priceId, start, end });
  gateway.subscriptions.set(sub.id, sub);
  const invoice = stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid: 2400, start, end, paymentIntent: `pi_test_inv_${sub.id}` });
  gateway.invoices.set(invoice.id, invoice);
  await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
  return { org, ownerId, paymentIntent: `pi_test_inv_${sub.id}` };
}

const dispute = (paymentIntent: string, id: string, status: string) => ({ id, object: 'dispute', payment_intent: paymentIntent, amount: 699, reason: 'fraudulent', status });

describe('withdrawals', () => {
  it('a retry after Stripe refunded (and its webhook ran) still refunds and says how much', async () => {
    const { seller, order, paymentIntent } = await paidOrder('featured-7d');
    await withdrawOrder(appDb, { userId: seller.id, orderId: order.id });
    const [w] = await db.select().from(schema.orderWithdrawals).where(eq(schema.orderWithdrawals.orderId, order.id));
    // Stripe makes the refund, then the answer is lost
    class Flaky extends FakeGateway {
      failed = false;
      async createRefund(input: RefundInput) {
        const r = await super.createRefund(input);
        if (!this.failed) {
          this.failed = true;
          throw new Error('socket hang up');
        }
        return r;
      }
    }
    const gateway = new Flaky();
    await expect(processWithdrawal(workerDb, gateway, w!.id)).rejects.toThrow('socket hang up');
    const asked = gateway.refunds[0]!;
    // The refund's webhook runs during the backoff
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('refund.created', { ...stripeRefund(paymentIntent, asked.amountMinor), metadata: asked.metadata })));
    expect(await processWithdrawal(workerDb, gateway, w!.id)).toBe('refunded');
    const [after] = await db.select().from(schema.orderWithdrawals).where(eq(schema.orderWithdrawals.id, w!.id));
    expect(after).toMatchObject({ status: 'refunded', refundMinor: asked.amountMinor });
    expect(after!.providerRefundId).toBeTruthy();
    // One refund at Stripe (same key), and the withdrawal's own notice tells it: no second one
    expect(gateway.refunds).toHaveLength(1);
    expect((await paymentNotices(order.id)).map((n) => n.kind)).not.toContain('order_revoked');
  });

  it('the button stays to the end of the 14th day after the payment day, Berlin time', () => {
    // Paid Monday Nov 2 at 15:00 in Berlin: the period ends at midnight after Monday Nov 16
    const paidAt = new Date('2026-11-02T14:00:00Z');
    const o = { status: 'paid' as const, paidAt, business: false, withdrawnAt: null };
    expect(withdrawalEnd(paidAt)).toEqual(new Date('2026-11-16T23:00:00Z'));
    expect(canWithdraw(o, new Date('2026-11-16T19:00:00Z'))).toBe(true);
    expect(canWithdraw(o, new Date('2026-11-16T22:59:59Z'))).toBe(true);
    expect(canWithdraw(o, new Date('2026-11-16T23:00:00Z'))).toBe(false);
    // Paid just after midnight in summer, ending in winter: still the end of a Berlin day
    expect(withdrawalEnd(new Date('2026-10-20T22:30:00Z'))).toEqual(new Date('2026-11-04T23:00:00Z'));
  });
});

describe('refunds and chargebacks are told', () => {
  it('a full refund of an order tells the buyer, with the order’s page', async () => {
    const { order, paymentIntent, seller } = await paidOrder('featured-7d');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(paymentIntent, 699))));
    expect(await paymentNotices(order.id)).toContainEqual({ kind: 'order_revoked', reason: 'refund' });
    const mails: Mail[] = [];
    await sendPaymentNotice(workerDb, redis, { mail: async (m) => void mails.push(m), telegram: null, appUrl: APP, gateway: null }, order.id, { kind: 'order_revoked', reason: 'refund' });
    expect(mails[0]).toMatchObject({ to: seller.email });
    expect(mails[0]!.text).toContain(`${APP}/my/orders/${order.id}`);
    expect(mails[0]!.text).toContain('کامل برگشت داده شد');
  });

  it('a chargeback tells the buyer; won, the featured time comes back and they hear it', async () => {
    const { order, paymentIntent, listing } = await paidOrder('featured-7d');
    const id = `dp_test_${publicToken()}`;
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('charge.dispute.created', dispute(paymentIntent, id, 'needs_response'))));
    expect((await entitlementsOf({ orderId: order.id }))[0]).toMatchObject({ revokeReason: 'dispute' });
    expect(await paymentNotices(order.id)).toContainEqual({ kind: 'order_revoked', reason: 'dispute' });
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('charge.dispute.closed', dispute(paymentIntent, id, 'won'))));
    const [back] = await entitlementsOf({ orderId: order.id });
    expect(back).toMatchObject({ revokedAt: null, revokeReason: null, listingId: listing.id });
    expect(await paymentNotices(order.id)).toContainEqual({ kind: 'order_restored' });
    const [log] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.targetId, order.id), eq(schema.auditLog.action, 'payment.dispute_closed')));
    expect(log!.data).toMatchObject({ status: 'won', restored: 1 });
  });

  it('a lost chargeback leaves it revoked, and a refund’s revocation never comes back', async () => {
    const lost = await paidOrder('featured-7d');
    const id = `dp_test_${publicToken()}`;
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('charge.dispute.created', dispute(lost.paymentIntent, id, 'needs_response'))));
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('charge.dispute.closed', dispute(lost.paymentIntent, id, 'lost'))));
    expect((await entitlementsOf({ orderId: lost.order.id }))[0]).toMatchObject({ revokeReason: 'dispute' });
    expect((await paymentNotices(lost.order.id)).map((n) => n.kind)).not.toContain('order_restored');

    const refunded = await paidOrder('featured-7d');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(refunded.paymentIntent, 699))));
    const other = `dp_test_${publicToken()}`;
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('charge.dispute.closed', dispute(refunded.paymentIntent, other, 'won'))));
    expect((await entitlementsOf({ orderId: refunded.order.id }))[0]).toMatchObject({ revokeReason: 'refund' });
  });

  it('a refunded Pro invoice tells the business’s owner', async () => {
    const { org, paymentIntent } = await subscribed();
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(paymentIntent, 2400))));
    expect(await paymentNotices(org.id)).toContainEqual({ kind: 'pro_revoked', reason: 'refund' });
    const mails: Mail[] = [];
    await sendPaymentNotice(workerDb, redis, { mail: async (m) => void mails.push(m), telegram: null, appUrl: APP, gateway: null }, org.id, { kind: 'pro_revoked', reason: 'refund' });
    expect(mails[0]!.subject).toContain('متوقف شد');
  });
});

describe('included bumps', () => {
  it('two presses before the worker ran use one bump', async () => {
    const { org, ownerId } = await subscribed();
    const { listing } = await sellerWithListing({ userId: ownerId, organizationId: org.id });
    const before = (await allowancesLeft(db, org.id)).bumps;
    expect(await requestAllowance(appDb, { userId: ownerId, listingId: listing.id, kind: 'bump' })).toEqual({ ok: true });
    expect(await requestAllowance(appDb, { userId: ownerId, listingId: listing.id, kind: 'bump' })).toEqual({ ok: true });
    const grant = () => workerDb.transaction((t) => grantAllowance(t, { listingId: listing.id, organizationId: org.id, kind: 'bump' }));
    expect(await grant()).toBe('granted');
    expect(await grant()).toBe('already_waiting');
    // Pressed again after the redirect, before the bump ran
    expect(await requestAllowance(appDb, { userId: ownerId, listingId: listing.id, kind: 'bump' })).toEqual({ ok: false, reason: 'already_waiting' });
    await applyDueBumps(workerDb, new Date());
    expect((await allowancesLeft(db, org.id)).bumps).toBe(before - 1);
    // Once it ran, the next one may be asked
    expect(await requestAllowance(appDb, { userId: ownerId, listingId: listing.id, kind: 'bump' })).toEqual({ ok: true });
  });
});

describe('each channel once', () => {
  it('sendOnce: once per key, and free again when the send failed', async () => {
    const key = `test_${randomUUID()}`;
    let n = 0;
    await expect(sendOnce(redis, key, async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await sendOnce(redis, key, async () => void n++)).toBe(true);
    expect(await sendOnce(redis, key, async () => void n++)).toBe(false);
    expect(n).toBe(1);
  });

  it('a payment notice retried after its email went sends the email once', async () => {
    const { order } = await paidOrder('featured-7d');
    const tgUser = Math.floor(Math.random() * 1e9) + 1e9;
    await db.update(schema.users).set({ telegramUserId: tgUser }).where(eq(schema.users.id, order.buyerUserId));
    const mails: Mail[] = [];
    const tg: string[] = [];
    const telegram = { sendMessage: async (_: number, text: string) => void tg.push(text) } as unknown as TelegramClient;
    // Valkey fails once, right after the email went
    let failed = false;
    const flaky = new Proxy(redis, {
      get(target, prop, receiver) {
        if (prop === 'exists' && !failed) {
          failed = true;
          return async () => Promise.reject(new Error('valkey down'));
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const d = { mail: async (m: Mail) => void mails.push(m), telegram, appUrl: APP, gateway: null, once: randomUUID() };
    const notice = { kind: 'order_paid' as const, invoiceId: null };
    await expect(sendPaymentNotice(workerDb, flaky, d, order.id, notice)).rejects.toThrow('valkey down');
    await sendPaymentNotice(workerDb, redis, d, order.id, notice);
    await sendPaymentNotice(workerDb, redis, d, order.id, notice);
    expect(mails).toHaveLength(1);
    expect(tg).toHaveLength(1);
  });
});

describe('event reminders', () => {
  const eventListing = (): ListingInput =>
    listingInputSchema.parse({
      title: 'کنسرت موسیقی ایرانی: گروه نوا',
      description: 'گروه نوا با تار، کمانچه، تنبک و آواز، شبی با تصنیف‌های قدیمی.',
      priceType: 'fixed',
      amount: '35',
      countryCode: 'DE',
      place: '12043',
    });
  const eventIn = (over: Partial<EventInput> = {}): EventInput =>
    eventInputSchema.parse({ startDate: '2026-11-08', startTime: '20:00', endTime: '23:00', venueName: `Heimathafen ${publicToken()}`, streetAddress: 'Karl-Marx-Straße 141', languages: ['fa'], ...over });

  it('a failed hand-off is sent by the next run, and the Telegram copy that went is not sent again', async () => {
    const owner = await user();
    const fan = await user();
    const d = await createEventDraft(appDb, { userId: owner.id, categoryId: (await categoryBySlug('event-concerts')).id });
    if (!d.ok) throw new Error(d.reason);
    const r = await saveEvent(appDb, { userId: owner.id, listingId: d.listingId, input: eventListing(), event: eventIn(), intent: 'publish', now: new Date('2026-10-18T10:00:00Z') });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [l] = await db.select({ token: schema.listings.publicToken }).from(schema.listings).where(eq(schema.listings.id, d.listingId));
    expect(await addFavorite(appDb, null, fan.id, l!.token)).toMatchObject({ ok: true });
    const tgUser = Math.floor(Math.random() * 1e9) + 1e9;
    await db
      .update(schema.users)
      .set({ telegramUserId: tgUser, notificationPrefs: { channels: { reminders: { telegram: true, email: true } } } })
      .where(eq(schema.users.id, fan.id));

    const prefix = `test-${publicToken()}`;
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const email = new Queue('email-send', { connection, prefix });
    const telegram = new Queue('telegram-send', { connection, prefix });
    // The email hand-off fails once (after the Telegram copy was queued)
    let failed = false;
    const flakyEmail = new Proxy(email, {
      get(target, prop, receiver) {
        if (prop === 'add' && !failed) {
          failed = true;
          return async () => Promise.reject(new Error('valkey down'));
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const jobs = await startEventJobs(workerDb, connection, { appUrl: APP, send: { email: flakyEmail, telegram }, prefix, schedules: false, now: () => new Date('2026-11-07T10:00:00Z') });
    const events = new QueueEvents('events', { connection: connection.duplicate(), prefix });
    const mine = async (q: Queue) => (await q.getJobs(['waiting', 'delayed'])).filter((j) => String(j.id).includes(`${d.listingId}_${fan.id}`));
    try {
      await expect((await jobs.queue.add('event-reminders', {}, { attempts: 1 })).waitUntilFinished(events, 30_000)).rejects.toThrow('valkey down');
      expect(await mine(telegram)).toHaveLength(1);
      expect(await mine(email)).toHaveLength(0);
      // The send queue finished the Telegram copy and forgot it
      await telegram.obliterate({ force: true });
      await (await jobs.queue.add('event-reminders', {}, { attempts: 1 })).waitUntilFinished(events, 30_000);
      expect(await mine(email)).toHaveLength(1);
      expect(await mine(telegram)).toHaveLength(0);
    } finally {
      await events.close();
      await jobs.close();
      await email.close();
      await telegram.close();
      await connection.quit();
    }
  });
});

describe('founding Pro reminders', () => {
  async function trial(endsAt: Date) {
    const { org } = await business();
    const [price] = await db.select({ id: schema.productPrices.id }).from(schema.productPrices).where(eq(schema.productPrices.providerPriceId, stripePriceId('pro', 'month')));
    const [s] = await db
      .insert(schema.subscriptions)
      .values({
        organizationId: org.id,
        productPriceId: price!.id,
        providerSubscriptionId: `sub_${randomUUID()}`,
        status: 'trialing',
        currentPeriodStart: new Date(endsAt.getTime() - 180 * DAY),
        currentPeriodEnd: endsAt,
        trialEndsAt: endsAt,
      })
      .returning();
    return { org, slug: org.slug, subscriptionId: s!.id };
  }
  const forSlug = (mails: Mail[], slug: string) => mails.filter((m) => m.text.includes(`/b/${slug}/billing`));

  it('a failed send is sent by the retry', async () => {
    const now = new Date('2027-03-10T08:05:00Z');
    const { slug } = await trial(new Date(now.getTime() + 2.5 * DAY));
    const down = async () => Promise.reject(new Error('SMTP timeout'));
    await expect(sendFoundingReminders(workerDb, redis, down, { appUrl: APP }, now)).rejects.toThrow('SMTP timeout');
    const sent: Mail[] = [];
    await sendFoundingReminders(workerDb, redis, async (m) => void sent.push(m), { appUrl: APP }, now);
    expect(forSlug(sent, slug)).toHaveLength(1);
  });

  it('a run late by a few hours still finds the trials yesterday’s window ended on', async () => {
    const yesterday = new Date('2027-04-10T08:05:00Z');
    // Ends just after yesterday's 14-day window
    const { slug } = await trial(new Date(yesterday.getTime() + 14 * DAY + 60 * 60_000));
    const sent: Mail[] = [];
    const mail = async (m: Mail) => void sent.push(m);
    await sendFoundingReminders(workerDb, redis, mail, { appUrl: APP }, yesterday);
    expect(forSlug(sent, slug)).toHaveLength(0);
    // Today's run starts two hours late
    await sendFoundingReminders(workerDb, redis, mail, { appUrl: APP }, new Date(yesterday.getTime() + DAY + 2 * 60 * 60_000));
    expect(forSlug(sent, slug)).toHaveLength(1);
  });
});

describe('the owner’s alert', () => {
  it('once per ten-minute slot, also after the finished job was trimmed away', async () => {
    const prefix = `test-mod-${randomUUID().slice(0, 8)}`;
    const bull = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const email = new Queue('email-send', { connection: redis, prefix });
    const telegram = new Queue('telegram-send', { connection: redis, prefix });
    const fakeFetch = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const jobs = await startModerationJobs(workerDb, bull, {
      appUrl: APP,
      send: { email, telegram },
      alert: { url: 'https://n8n.example.test/webhook/admin', secret: 'a'.repeat(40) },
      purge: null,
      seo: null,
      fetchFn: fakeFetch,
      prefix,
      gatherMs: 50,
    });
    const events = new QueueEvents('moderation', { connection: bull.duplicate(), prefix });
    await events.waitUntilReady();
    const report = () => jobs.queue.add('report_received', { outboxId: randomUUID(), eventType: 'report.created', aggregateId: randomUUID(), payload: {} }).then((j) => j.waitUntilFinished(events, 20_000));
    const alerts = async () => (await jobs.queue.getJobs(['delayed', 'waiting', 'active', 'completed'])).filter((j) => j.name === 'admin_alert');
    try {
      // Not at the very end of a slot, so both reports fall in the same one
      const intoSlot = Date.now() % (10 * 60_000);
      if (intoSlot > 9 * 60_000) await new Promise((r) => setTimeout(r, 10 * 60_000 - intoSlot + 1_000));
      await report();
      const [first] = await alerts();
      await first!.waitUntilFinished(events, 20_000).catch(() => undefined);
      // The minute jobs trimmed the finished list
      await jobs.queue.clean(0, 1_000, 'completed');
      await report();
      expect(await alerts()).toHaveLength(0);
    } finally {
      await jobs.close();
      await Promise.all([email.close(), telegram.close(), events.close()]);
      await bull.quit();
    }
  });
});

describe('the worker’s own wiring', () => {
  it('a refused address never reaches the log; our ids do', () => {
    const id = randomUUID();
    const line = logText(new Error(`Can't send mail - all recipients were rejected: 550 5.1.1 <someone.real@example.com>: Recipient address rejected (${id})`));
    expect(line).not.toContain('someone.real@example.com');
    expect(line).toContain('[email]');
    expect(line).toContain(id);
  });

  it('every job failure line goes through logText', () => {
    for (const f of ['accounts', 'chat', 'events', 'listings', 'moderation', 'payments', 'retention', 'search', 'search-alerts', 'seo']) {
      const src = readFileSync(`src/worker/${f}.ts`, 'utf8');
      expect(src, f).not.toMatch(/failed[^\n]*e\.message\)/);
    }
  });

  it('only the bot’s long poll takes the shutdown signal, not the send clients', () => {
    const src = readFileSync('src/worker/index.ts', 'utf8');
    expect(src).not.toMatch(/new TelegramClient\([^)]*abort\.signal/);
    expect(src).toMatch(/runTelegramBot\([^)]*abort\.signal\)/);
  });
});
