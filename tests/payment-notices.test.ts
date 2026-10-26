import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { Mail } from '../src/modules/notifications/mailer';
import type { TelegramClient } from '../src/modules/notifications/telegram-api';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { businessInvoices, startListingCheckout } from '../src/modules/payments/checkout';
import { PAYMENT_NOTICE, parsePaymentNotice, sendBumpNotice, sendPaymentNotice } from '../src/modules/payments/notices';
import { appDb, redis, workerDb } from './accounts';
import { db } from './db';
import { business, event, FakeGateway, orderRow, paidSession, seedCatalog, sellerWithListing, storeEvent, stripeInvoice, stripePriceId, stripeSubscription } from './payments-fixtures';

// Payment notices (owner's rule, Oct 26, 2026: users are always told): Pro started, renewed and
// ended, a paid order, a bump that moved a listing; each with the invoice's link when there is one.

const APP = 'https://app.example.test';
const DAY = 86_400_000;

beforeAll(async () => {
  await seedCatalog();
});

async function notices(aggregateId: string) {
  const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_NOTICE), eq(schema.outboxEvents.aggregateId, aggregateId))).orderBy(schema.outboxEvents.id);
  return rows.map((r) => parsePaymentNotice(r.payload as Record<string, unknown>));
}

function deps(gateway: FakeGateway) {
  const mails: Mail[] = [];
  const tg: string[] = [];
  const telegram = { sendMessage: async (_: number, text: string) => void tg.push(text) } as unknown as TelegramClient;
  return { mails, tg, d: { mail: async (m: Mail) => void mails.push(m), telegram, appUrl: APP, gateway } };
}

describe('Pro notices', () => {
  it('first period: started (a trial says free), next period: renewed, end: ended once', async () => {
    const gateway = new FakeGateway();
    const { org } = await business();
    const priceId = stripePriceId('pro', 'month');
    const start = new Date();
    const end = new Date(start.getTime() + 30 * DAY);
    const sub = { ...stripeSubscription({ organizationId: org.id, priceId, start, end, status: 'trialing' }), trial_end: Math.floor(end.getTime() / 1000) };
    gateway.subscriptions.set(sub.id, sub);
    const first = { ...stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid: 0, start, end }), hosted_invoice_url: 'https://invoice.stripe.com/i/first' };
    gateway.invoices.set(first.id, first);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', first)));

    const active = { ...sub, status: 'active' };
    gateway.subscriptions.set(sub.id, active);
    const second = stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid: 2400, start: end, end: new Date(end.getTime() + 30 * DAY), paymentIntent: `pi_test_${sub.id}` });
    gateway.invoices.set(second.id, second);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', second)));

    const ended = { ...active, status: 'canceled', ended_at: Math.floor(Date.now() / 1000) };
    gateway.subscriptions.set(sub.id, ended);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.deleted', ended)));
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.updated', ended)));

    const kinds = await notices(org.id);
    expect(kinds.map((k) => k!.kind)).toEqual(['pro_started', 'pro_renewed', 'pro_ended']);
    expect(kinds[0]).toMatchObject({ trial: true, invoiceId: first.id });

    // The emails: the first carries the invoice's link and says it's free
    const o = deps(gateway);
    await sendPaymentNotice(workerDb, redis, o.d, org.id, kinds[0]!);
    expect(o.mails[0]!.subject).toContain('فعال شد');
    expect(o.mails[0]!.text).toContain('رایگان');
    expect(o.mails[0]!.text).toContain('https://invoice.stripe.com/i/first');
    await sendPaymentNotice(workerDb, redis, o.d, org.id, kinds[2]!);
    expect(o.mails[1]!.subject).toContain('تمام شد');
  });
});

describe('order and bump notices', () => {
  it('a paid order queues a receipt for the buyer, with the invoice', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP });
    if (!r.ok) throw new Error(r.reason);
    const order = await orderRow(r.orderId!);
    const session = paidSession(order, gateway.checkouts[0]!.id);
    gateway.invoices.set(session.invoice, { id: session.invoice, object: 'invoice', hosted_invoice_url: 'https://invoice.stripe.com/i/order' });
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', session)));
    const [notice] = await notices(order.id);
    expect(notice).toEqual({ kind: 'order_paid', invoiceId: session.invoice });

    const o = deps(gateway);
    expect(await sendPaymentNotice(workerDb, redis, o.d, order.id, notice!)).toEqual({ email: true, telegram: false });
    expect(o.mails[0]!.subject).toContain('پرداخت انجام شد');
    expect(o.mails[0]!.text).toContain('https://invoice.stripe.com/i/order');
  });

  it('a bump tells the seller (email, and Telegram when linked)', async () => {
    const { seller, listing } = await sellerWithListing();
    await db.update(schema.users).set({ telegramUserId: 7_400_000_000 + Math.floor(Math.random() * 1e6) }).where(eq(schema.users.id, seller.id));
    const o = deps(new FakeGateway());
    expect(await sendBumpNotice(workerDb, redis, o.d, listing.id)).toEqual({ email: true, telegram: true });
    expect(o.mails[0]!.subject).toContain('بالای فهرست');
    const { listing: paused } = await sellerWithListing({ status: 'paused' });
    expect(await sendBumpNotice(workerDb, redis, o.d, paused.id)).toEqual({ email: false, telegram: false });
  });
});

describe('the billing page’s invoices', () => {
  it('come from the provider for the business’s customer, none before the first checkout', async () => {
    const gateway = new FakeGateway();
    gateway.listed = [{ id: 'in_1', number: 'A-1', created: new Date(), totalMinor: 0, currency: 'EUR', status: 'paid', url: 'https://invoice.stripe.com/i/1' }];
    const { org } = await business();
    expect(await businessInvoices(db, gateway, org.id)).toEqual([]);
    await db.insert(schema.billingCustomers).values({ provider: 'stripe', providerCustomerId: `cus_${org.id.slice(0, 8)}`, organizationId: org.id });
    expect(await businessInvoices(db, gateway, org.id)).toHaveLength(1);
    expect(await businessInvoices(db, null, org.id)).toEqual([]);
  });
});
