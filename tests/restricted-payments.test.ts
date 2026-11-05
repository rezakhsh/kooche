import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import {
  isRestrictedCountryRequest,
  PAYMENT_BLOCKED_COUNTRIES,
  PAYMENT_BLOCKED_REGIONS,
  restrictedBillingPlace,
  restrictedPaymentPlace,
} from '../src/lib/region';
import { admin, messages } from '../src/messages/fa';
import { refusedPaymentPayload } from '../src/modules/admin/alert';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { openBillingPortal, resumeOrderCheckout, startListingCheckout, startPlanCheckout } from '../src/modules/payments/checkout';
import { startFoundingCheckout } from '../src/modules/payments/founding';
import type { Mail } from '../src/modules/notifications/mailer';
import { PAYMENT_NOTICE, parsePaymentNotice, sendPaymentNotice } from '../src/modules/payments/notices';
import { PAYMENT_REFUSED, parseRefusedPayment, processRefusedPayment, REFUSED_ACTION } from '../src/modules/payments/restricted';
import { SIGNATURE_HEADER } from '../src/modules/admin/alert';
import { startPaymentJobs } from '../src/worker/payments';
import { appDb, redis, workerDb } from './accounts';
import { db } from './db';
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

// Stripe's restricted jurisdictions (owner, Nov 4, 2026; src/lib/region.ts): no payment is started
// from a request there (the checkout functions refuse with `restricted_country` before Stripe is
// called), and a payment whose billing address is there grants nothing, is refunded in full and its
// subscription cancelled (src/modules/payments/restricted.ts).

const APP = 'https://app.example.test';
const DAY = 86_400_000;
const CLOUDFLARE = '172.71.10.20'; // a Cloudflare address, as Traefik writes it
const at = (country: string, region: Record<string, string> = {}) => new Headers({ 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': country, ...region });

/** Every kind of request the payment block covers, with the place it is refused for */
const BLOCKED: Array<[string, Headers, string]> = [
  ...PAYMENT_BLOCKED_COUNTRIES.map((c): [string, Headers, string] => [c, at(c), c]),
  ['Tor', at('T1'), 'T1'],
  ...PAYMENT_BLOCKED_REGIONS.UA!.map((r): [string, Headers, string] => [`UA-${r}`, at('UA', { 'cf-region-code': r, 'cf-region': 'Oblast' }), `UA-${r}`]),
  ['Ukraine without a region', at('UA'), 'UA'],
  ['Crimea placed in Russia', at('RU', { 'cf-region-code': 'CR', 'cf-region': 'Republic of Crimea' }), 'RU-region'],
];

beforeAll(async () => {
  await seedCatalog();
});

/** Records every gateway method called, so a test can say Stripe was never asked */
function watched() {
  const gateway = new FakeGateway();
  const asked: string[] = [];
  const proxy = new Proxy(gateway, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v === 'function') {
        return (...args: unknown[]) => {
          asked.push(String(prop));
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return v;
    },
  });
  return { gateway: proxy, asked };
}

async function notices(aggregateId: string) {
  const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_NOTICE), eq(schema.outboxEvents.aggregateId, aggregateId)));
  return rows.map((r) => parsePaymentNotice(r.payload as Record<string, unknown>)!);
}

async function refusals(aggregateId: string) {
  const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_REFUSED), eq(schema.outboxEvents.aggregateId, aggregateId)));
  return rows.map((r) => parseRefusedPayment(r.payload as Record<string, unknown>)!);
}

async function audits(targetId: string) {
  return db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, REFUSED_ACTION), eq(schema.auditLog.targetId, targetId)));
}

describe('where payments can’t come from (by the request)', () => {
  it('places every listed country, Tor, the Ukrainian regions and Ukraine without a region', () => {
    for (const [name, headers, place] of BLOCKED) {
      expect(restrictedPaymentPlace(headers), name).toBe(place);
      expect(isRestrictedCountryRequest(headers), name).toBe(true);
    }
  });

  it('lets everyone else pay: our countries, the rest of Ukraine, unknown, no Cloudflare', () => {
    for (const h of [at('DE'), at('AT'), at('US'), at('XX'), at('UA', { 'cf-region-code': '30', 'cf-region': 'Kyiv City' }), at('RU', { 'cf-region-code': 'MOW', 'cf-region': 'Moscow' })]) {
      expect(restrictedPaymentPlace(h)).toBeNull();
    }
    // CF-IPCountry and the region sent straight to the server aren't trusted (the origin lock stops this anyway)
    expect(restrictedPaymentPlace(new Headers({ 'x-forwarded-for': '203.0.113.9', 'cf-ipcountry': 'CU' }))).toBeNull();
    expect(restrictedPaymentPlace(new Headers())).toBeNull();
  });
});

describe('the four payment functions refuse first, so Stripe is never called', () => {
  it('refuses every listed place in the listing checkout, the plan checkout, founding Pro, the portal and «ادامهٔ پرداخت»', async () => {
    // A pending order whose Checkout page is still open: «ادامهٔ پرداخت» would ask Stripe for it
    const { seller, listing, order } = await pendingOrder('bump-1');
    const { org, ownerId } = await business();
    for (const [name, headers] of BLOCKED) {
      const { gateway, asked } = watched();
      const fromRestrictedCountry = isRestrictedCountryRequest(headers);
      const refused = { ok: false, reason: 'restricted_country' };
      expect(await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP, fromRestrictedCountry }), name).toEqual(refused);
      const plan = { userId: ownerId, organizationId: org.id, appUrl: APP, business: true, fromRestrictedCountry };
      expect(await startPlanCheckout(appDb, gateway, { ...plan, plan: 'pro', interval: 'month' }), name).toEqual(refused);
      expect(await startFoundingCheckout(appDb, gateway, plan), name).toEqual(refused);
      expect(await openBillingPortal(appDb, gateway, plan), name).toEqual(refused);
      expect(await resumeOrderCheckout(appDb, gateway, { userId: seller.id, orderId: order.id, fromRestrictedCountry }), name).toEqual(refused);
      expect(asked, name).toEqual([]);
    }
    // Nothing was recorded either: no order, no business-buyer tick
    expect((await db.select().from(schema.orders).where(eq(schema.orders.listingId, listing.id))).length).toBe(1);
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'subscription.business_buyer'), eq(schema.auditLog.targetId, org.id)))).toHaveLength(0);
  });

  it('lets a request from a country that isn’t listed go to Stripe', async () => {
    const { seller, listing } = await sellerWithListing();
    const { gateway, asked } = watched();
    const ok = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP, fromRestrictedCountry: isRestrictedCountryRequest(at('DE')) });
    expect(ok).toMatchObject({ ok: true });
    expect(asked).toContain('createCheckout');
    const { org, ownerId } = await business();
    expect(await startPlanCheckout(appDb, gateway, { userId: ownerId, organizationId: org.id, plan: 'pro', interval: 'month', appUrl: APP, business: true, fromRestrictedCountry: isRestrictedCountryRequest(at('UA', { 'cf-region-code': '30' })) })).toMatchObject({ ok: true });
  });
});

describe('where a billing address is', () => {
  it('places the listed countries and the Ukrainian regions by postcode or name', () => {
    for (const c of PAYMENT_BLOCKED_COUNTRIES) expect(restrictedBillingPlace({ country: c })).toBe(c);
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '95000' })).toBe('UA-postcode-95'); // Simferopol
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '99011' })).toBe('UA-postcode-99'); // Sevastopol
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '83 001' })).toBe('UA-postcode-83'); // Donetsk
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '91000' })).toBe('UA-postcode-91'); // Luhansk
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '69000' })).toBe('UA-postcode-69'); // Zaporizhzhia
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '73000' })).toBe('UA-postcode-73'); // Kherson
    expect(restrictedBillingPlace({ country: 'UA', state: 'Donetska oblast' })).toBe('UA-region');
    expect(restrictedBillingPlace({ country: 'UA' })).toBe('UA');
    expect(restrictedBillingPlace({ country: 'RU', state: 'Republic of Crimea' })).toBe('RU-region');
  });

  it('lets other addresses through', () => {
    expect(restrictedBillingPlace({ country: 'DE', postal_code: '10115' })).toBeNull();
    expect(restrictedBillingPlace({ country: 'UA', postal_code: '01001', city: 'Kyiv' })).toBeNull();
    expect(restrictedBillingPlace({ country: 'UA', city: 'Lviv' })).toBeNull();
    expect(restrictedBillingPlace(null)).toBeNull();
    expect(restrictedBillingPlace({ country: null })).toBeNull();
  });
});

/** A pending bump order with its Checkout page */
async function pendingOrder(productCode = 'bump-3') {
  const gateway = new FakeGateway();
  const { seller, listing } = await sellerWithListing();
  const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode, waiver: true, appUrl: APP });
  if (!r.ok) throw new Error(r.reason);
  return { seller, listing, order: await orderRow(r.orderId!), checkoutId: gateway.checkouts[0]!.id };
}

describe('a paid checkout with a billing address in a listed place', () => {
  it('grants nothing, refunds in full, tells the buyer once, and a replay changes nothing', async () => {
    const { seller, order, checkoutId } = await pendingOrder();
    const session = paidSession(order, checkoutId, { customer_details: { address: { country: 'CU' } } });
    const e = event('checkout.session.completed', session);
    const first = await storeEvent(e);
    expect(await applyWebhookEvent(workerDb, new FakeGateway(), first)).toBe('applied');

    expect(await entitlementsOf({ orderId: order.id })).toHaveLength(0);
    expect(await orderRow(order.id)).toMatchObject({ status: 'paid', buyerCountry: 'CU' });
    expect(await notices(order.id)).toEqual([{ kind: 'order_refused' }]);
    expect(await refusals(order.id)).toEqual([
      { what: 'order', place: 'CU', subscription: null, paymentIntent: session.payment_intent, amountMinor: order.totalMinor, currency: 'EUR', key: session.id },
    ]);
    expect(await audits(order.id)).toHaveLength(1);
    expect((await audits(order.id))[0]).toMatchObject({ actorType: 'webhook', targetType: 'order', data: { place: 'CU', checkout: session.id } });

    // The same event again, and a second delivery of the same checkout under a new event id
    expect(await applyWebhookEvent(workerDb, new FakeGateway(), first)).toBe('duplicate');
    expect(await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.completed', session)))).toBe('applied');
    expect(await entitlementsOf({ orderId: order.id })).toHaveLength(0);
    expect(await notices(order.id)).toHaveLength(1);
    expect(await refusals(order.id)).toHaveLength(1);
    expect(await audits(order.id)).toHaveLength(1);

    // The worker refunds it in full, once however often the job runs
    const gateway = new FakeGateway();
    const refused = (await refusals(order.id))[0]!;
    expect(await processRefusedPayment(gateway, refused)).toEqual({ cancelled: false, refunded: true });
    await processRefusedPayment(gateway, refused);
    expect(gateway.refunds).toEqual([{ paymentIntentId: session.payment_intent, amountMinor: order.totalMinor, metadata: { refused: 'restricted_country', place: 'CU' }, idempotencyKey: `refused-${session.id}` }]);

    // Its webhook marks the order refunded, without a second notice
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('refund.created', stripeRefund(session.payment_intent, order.totalMinor))));
    expect(await orderRow(order.id)).toMatchObject({ status: 'refunded' });
    expect(await notices(order.id)).toEqual([{ kind: 'order_refused' }]);

    // The buyer's email names what happened, never "sanctions"
    const mails: Mail[] = [];
    await sendPaymentNotice(workerDb, redis, { mail: async (m) => void mails.push(m), telegram: null, appUrl: APP, gateway: null }, order.id, { kind: 'order_refused' });
    expect(mails[0]).toMatchObject({ to: seller.email });
    expect(mails[0]!.text).toContain(`${APP}/my/orders/${order.id}`);
    expect(mails[0]!.text).toContain('مبلغ کامل برگشت داده می‌شود');
    expect(mails[0]!.text).not.toContain('تحریم');
  });

  it('a Crimean postcode is refused; a Kyiv address is granted as usual', async () => {
    const crimea = await pendingOrder('bump-1');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.completed', paidSession(crimea.order, crimea.checkoutId, { customer_details: { address: { country: 'UA', postal_code: '95000' } } }))));
    expect(await entitlementsOf({ orderId: crimea.order.id })).toHaveLength(0);
    expect((await refusals(crimea.order.id))[0]).toMatchObject({ place: 'UA-postcode-95' });

    const kyiv = await pendingOrder('bump-1');
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.completed', paidSession(kyiv.order, kyiv.checkoutId, { customer_details: { address: { country: 'UA', postal_code: '01001' } } }))));
    expect(await entitlementsOf({ orderId: kyiv.order.id })).toHaveLength(1);
    expect(await refusals(kyiv.order.id)).toHaveLength(0);
    expect(await notices(kyiv.order.id)).toEqual([{ kind: 'order_paid', invoiceId: expect.any(String) }]);
  });
});

/** A business with a subscription Stripe knows about */
async function subscription() {
  const gateway = new FakeGateway();
  const { org, ownerId } = await business();
  const start = new Date();
  const sub = stripeSubscription({ organizationId: org.id, priceId: stripePriceId('pro', 'month'), start, end: new Date(start.getTime() + 30 * DAY) });
  gateway.subscriptions.set(sub.id, sub);
  return { gateway, org, ownerId, sub, start };
}

async function subscriptionRow(providerId: string) {
  const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.providerSubscriptionId, providerId));
  return row!;
}

describe('a subscription invoice with the customer in a listed place', () => {
  it('grants no Pro, cancels the subscription, refunds the payment, tells the owner once', async () => {
    const { gateway, org, sub, start } = await subscription();
    const pi = `pi_test_restricted_${sub.id.slice(-8)}`;
    const invoice = { ...stripeInvoice({ subscriptionId: sub.id, priceId: stripePriceId('pro', 'month'), amountPaid: 2400, start, end: new Date(start.getTime() + 30 * DAY), paymentIntent: pi }), customer_address: { country: 'SY' } };
    gateway.invoices.set(invoice.id, invoice);
    const paid = await storeEvent(event('invoice.paid', invoice));
    expect(await applyWebhookEvent(workerDb, gateway, paid)).toBe('applied');

    const row = await subscriptionRow(sub.id);
    expect(await entitlementsOf({ organizationId: org.id })).toHaveLength(0);
    expect(await notices(org.id)).toEqual([{ kind: 'pro_refused' }]);
    expect(await refusals(row.id)).toEqual([{ what: 'subscription', place: 'SY', subscription: sub.id, paymentIntent: pi, amountMinor: 2400, currency: 'EUR', key: invoice.id }]);
    expect(await audits(row.id)).toHaveLength(1);
    // The charge is recorded, so its refund's webhook finds it
    expect(await db.select().from(schema.payments).where(eq(schema.payments.providerPaymentId, pi))).toHaveLength(1);

    // A replay changes nothing
    expect(await applyWebhookEvent(workerDb, gateway, paid)).toBe('duplicate');
    expect(await refusals(row.id)).toHaveLength(1);

    // The worker cancels and refunds; a second run asks for nothing new
    expect(await processRefusedPayment(gateway, (await refusals(row.id))[0]!)).toEqual({ cancelled: true, refunded: true });
    expect(await processRefusedPayment(gateway, (await refusals(row.id))[0]!)).toEqual({ cancelled: false, refunded: true });
    expect(gateway.cancelled).toEqual([sub.id]);
    expect(gateway.refunds).toEqual([{ paymentIntentId: pi, amountMinor: 2400, metadata: { refused: 'restricted_country', place: 'SY' }, idempotencyKey: `refused-${invoice.id}` }]);

    // Stripe's end of the subscription and the refund: nothing granted, no second message («اشتراک تمام شد»)
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('customer.subscription.deleted', gateway.subscriptions.get(sub.id)!)));
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('refund.created', stripeRefund(pi, 2400))));
    expect(await subscriptionRow(sub.id)).toMatchObject({ status: 'canceled' });
    expect(await entitlementsOf({ organizationId: org.id })).toHaveLength(0);
    expect(await notices(org.id)).toEqual([{ kind: 'pro_refused' }]);
  });

  it('founding Pro’s €0 invoice from a listed place: cancelled, nothing to refund', async () => {
    const { gateway, org, sub, start } = await subscription();
    const invoice = { ...stripeInvoice({ subscriptionId: sub.id, priceId: stripePriceId('pro', 'month'), amountPaid: 0, start, end: new Date(start.getTime() + 180 * DAY) }), customer_address: { country: 'KP' } };
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    const row = await subscriptionRow(sub.id);
    expect(await entitlementsOf({ organizationId: org.id })).toHaveLength(0);
    const [refused] = await refusals(row.id);
    expect(refused).toMatchObject({ place: 'KP', paymentIntent: null, amountMinor: 0 });
    expect(await processRefusedPayment(gateway, refused!)).toEqual({ cancelled: true, refunded: false });
    expect(gateway.refunds).toHaveLength(0);
  });

  it('a checkout that arrives after its invoice was granted takes the period back and refunds that invoice', async () => {
    const { gateway, org, sub, start } = await subscription();
    const pi = `pi_test_late_${sub.id.slice(-8)}`;
    // The invoice carries no address (events out of order): Pro is granted as usual
    const invoice = { ...stripeInvoice({ subscriptionId: sub.id, priceId: stripePriceId('pro', 'month'), amountPaid: 2400, start, end: new Date(start.getTime() + 30 * DAY), paymentIntent: pi }), customer_address: null };
    gateway.invoices.set(invoice.id, invoice);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    expect((await entitlementsOf({ organizationId: org.id })).filter((x) => !x.revokedAt)).toHaveLength(1);

    const session = { ...paidSession({ id: org.id, totalMinor: 2400 }, `cs_test_sub_${sub.id.slice(-8)}`), mode: 'subscription', subscription: sub.id, invoice: invoice.id, payment_intent: null, customer_details: { address: { country: 'UA', postal_code: '83001' } } };
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', session)));
    const row = await subscriptionRow(sub.id);
    expect((await entitlementsOf({ organizationId: org.id })).filter((x) => !x.revokedAt)).toHaveLength(0);
    expect((await entitlementsOf({ organizationId: org.id }))[0]).toMatchObject({ revokeReason: 'restricted_country' });
    expect(await refusals(row.id)).toEqual([{ what: 'subscription', place: 'UA-postcode-83', subscription: sub.id, paymentIntent: pi, amountMinor: 2400, currency: 'EUR', key: invoice.id }]);

    // A renewal invoice of the refused subscription grants nothing and is refunded too, without a second notice
    const next = { ...stripeInvoice({ subscriptionId: sub.id, priceId: stripePriceId('pro', 'month'), amountPaid: 2400, start: new Date(start.getTime() + 30 * DAY), end: new Date(start.getTime() + 60 * DAY), paymentIntent: `${pi}_2` }), customer_address: { country: 'DE' } };
    gateway.invoices.set(next.id, next);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', next)));
    expect((await entitlementsOf({ organizationId: org.id })).filter((x) => !x.revokedAt)).toHaveLength(0);
    expect(await refusals(row.id)).toHaveLength(2);
    expect((await notices(org.id)).filter((n) => n.kind === 'pro_refused')).toHaveLength(1);
  });

  it('a customer elsewhere gets Pro as before', async () => {
    const { gateway, org, sub, start } = await subscription();
    const invoice = stripeInvoice({ subscriptionId: sub.id, priceId: stripePriceId('pro', 'month'), amountPaid: 2400, start, end: new Date(start.getTime() + 30 * DAY), paymentIntent: `pi_test_de_${sub.id.slice(-8)}` });
    gateway.invoices.set(invoice.id, invoice);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', invoice)));
    expect(await entitlementsOf({ organizationId: org.id })).toHaveLength(1);
    expect(await refusals((await subscriptionRow(sub.id)).id)).toHaveLength(0);
  });
});

describe('the worker job', () => {
  it('takes the refusal from the outbox, refunds through Stripe and sends the owner one signed alert', async () => {
    const { order, checkoutId } = await pendingOrder('featured-7d');
    const session = paidSession(order, checkoutId, { customer_details: { address: { country: 'IR' } } });
    await applyWebhookEvent(workerDb, new FakeGateway(), await storeEvent(event('checkout.session.completed', session)));
    const [ev] = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_REFUSED), eq(schema.outboxEvents.aggregateId, order.id)));

    const prefix = `test-refused-${Date.now()}`;
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const gateway = new FakeGateway();
    const sent: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent.push({ headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      return new Response('ok');
    }) as unknown as typeof fetch;
    const jobs = await startPaymentJobs(workerDb, connection, { gateway, prefix, schedule: false, appUrl: APP, adminPath: 'a'.repeat(24), alert: { url: 'https://n8n.example.test/hook', secret: 's'.repeat(32) }, fetchFn });
    try {
      const [handler] = jobs.handlers[PAYMENT_REFUSED]!;
      expect(handler!.name).toBe('refuse-payment');
      await handler!.queue.add(handler!.name, { outboxId: ev!.id, eventType: ev!.eventType, aggregateId: order.id, payload: ev!.payload }, { jobId: `${ev!.id}_${handler!.name}` });
      const deadline = Date.now() + 10_000;
      while (sent.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      expect(gateway.refunds).toEqual([expect.objectContaining({ paymentIntentId: session.payment_intent, amountMinor: order.totalMinor, idempotencyKey: `refused-${session.id}` })]);
      expect(sent).toHaveLength(1);
      expect(sent[0]!.headers[SIGNATURE_HEADER]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
      expect(sent[0]!.body).toMatchObject({ kind: 'payment_restricted', place: 'IR', what: 'order' });
      expect(String(sent[0]!.body.text)).not.toContain(seller(order));
    } finally {
      await jobs.close();
      const q = new Queue('payments', { connection, prefix });
      await q.obliterate({ force: true });
      await q.close();
      await connection.quit();
    }
  });
});

/** The buyer's id, which the owner's alert never carries */
const seller = (order: { buyerUserId: string }) => order.buyerUserId;

describe('texts', () => {
  it('the owner’s alert names the place and the audit page; nothing tells the person "sanctions"', () => {
    const alert = { what: 'subscription' as const, place: 'SY', amount: '۲۴٫۰۰ €', cancelled: true, refunded: true };
    const p = refusedPaymentPayload(alert, APP, 'x'.repeat(24));
    expect(p).toMatchObject({ kind: 'payment_restricted', place: 'SY', url: `${APP}/${'x'.repeat(24)}/audit` });
    expect(p.text).toContain('SY');
    // n8n's Telegram node sends Markdown: an underscore outside backticks makes Telegram refuse the message
    for (const place of ['SY', 'UA-postcode-69', 'RU-region']) {
      const text = refusedPaymentPayload({ ...alert, place }, APP, 'x'.repeat(24)).text;
      expect(text.replace(/`[^`]*`/g, '')).not.toMatch(/[_*[]/);
    }
    const texts = JSON.stringify([messages.paymentPlace, messages.promote.errors, messages.business.billing.errors, messages.email.paymentNotice.orderRefused, messages.email.paymentNotice.proRefused, admin.refusedPaymentAlert(alert)]);
    expect(texts).not.toContain('تحریم');
    expect(texts).not.toMatch(/وی‌?پی‌?ان|VPN/i);
    // Iran keeps its own texts
    expect(messages.promote.errors.from_iran).toContain('ایران');
    expect(messages.promote.errors.restricted_country).not.toContain('ایران');
  });
});
