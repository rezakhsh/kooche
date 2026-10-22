import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { priceKey, syncCatalog } from '../src/modules/payments/catalog-sync';
import type { CheckoutInput, CustomerInput, PaymentGateway } from '../src/modules/payments/gateway';
import { eventSchema, type ProviderEvent } from '../src/modules/payments/stripe-objects';
import { products } from '../seed/products';
import { db, makeListing, publicToken, type Tx } from './db';
import { user } from './listings-fixtures';

// Payments test helpers: the catalog with fake Stripe price ids, a gateway that records what it
// was asked and answers like Stripe, and Stripe-shaped event payloads (only the fields
// src/modules/payments/stripe-objects.ts reads, plus envelope).

const owner = db as unknown as Tx;
let n = 0;
const id = (prefix: string) => `${prefix}_test_${Date.now().toString(36)}${(++n).toString(36)}`;
export const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/** products and product_prices as the setup script writes them, with fake price ids */
export async function seedCatalog(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const p of products) for (const price of p.prices) ids.set(priceKey(p.code, price), `price_${priceKey(p.code, price)}`);
  await db.transaction((tx) => syncCatalog(tx, products, ids));
  return ids;
}

export function stripePriceId(code: string, interval: 'month' | 'year' | null = null): string {
  const seed = products.find((p) => p.code === code)!;
  const price = seed.prices.find((p) => p.interval === interval)!;
  return `price_${priceKey(code, price)}`;
}

/** Answers like Stripe; subscriptions and invoices are what the test put in */
export class FakeGateway implements PaymentGateway {
  readonly provider = 'stripe' as const;
  customers: CustomerInput[] = [];
  checkouts: Array<CheckoutInput & { id: string }> = [];
  subscriptions = new Map<string, Record<string, unknown>>();
  invoices = new Map<string, Record<string, unknown>>();
  calls: string[] = [];

  async createCustomer(input: CustomerInput) {
    this.customers.push(input);
    return id('cus');
  }
  async createCheckout(input: CheckoutInput) {
    const sessionId = id('cs');
    this.checkouts.push({ ...input, id: sessionId });
    return { id: sessionId, url: `https://checkout.stripe.com/c/pay/${sessionId}` };
  }
  async createPortal(input: { customerId: string; returnUrl: string }) {
    return { url: `https://billing.stripe.com/p/session/${input.customerId}` };
  }
  verifyEvent(rawBody: string, signature: string | null): ProviderEvent | null {
    if (signature !== 'valid') return null;
    const parsed = eventSchema.safeParse(JSON.parse(rawBody));
    return parsed.success ? parsed.data : null;
  }
  async getSubscription(subId: string) {
    this.calls.push(`subscription ${subId}`);
    const s = this.subscriptions.get(subId);
    if (!s) throw new Error(`no subscription ${subId}`);
    return s;
  }
  async getInvoice(invoiceId: string) {
    this.calls.push(`invoice ${invoiceId}`);
    const i = this.invoices.get(invoiceId);
    if (!i) throw new Error(`no invoice ${invoiceId}`);
    return i;
  }
}

export function event(type: string, object: Record<string, unknown>, created = new Date()): ProviderEvent {
  return { id: id('evt'), object: 'event', type, created: unix(created), livemode: false, data: { object } };
}

/** A completed Checkout Session for an order (paid unless said otherwise) */
export function paidSession(order: { id: string; totalMinor: number }, checkoutId: string, extra: Record<string, unknown> = {}) {
  return {
    id: checkoutId,
    object: 'checkout.session',
    mode: 'payment',
    client_reference_id: order.id,
    payment_status: 'paid',
    status: 'complete',
    currency: 'eur',
    amount_subtotal: order.totalMinor,
    amount_total: order.totalMinor,
    total_details: { amount_discount: 0, amount_tax: 0 },
    payment_intent: id('pi'),
    invoice: id('in'),
    subscription: null,
    customer: id('cus'),
    customer_details: { address: { country: 'DE' } },
    metadata: { order_id: order.id },
    ...extra,
  };
}

export function stripeSubscription(opts: {
  id?: string;
  organizationId: string;
  priceId: string;
  status?: string;
  start: Date;
  end: Date;
  customer?: string;
  cancelAtPeriodEnd?: boolean;
  endedAt?: Date | null;
}) {
  return {
    id: opts.id ?? id('sub'),
    object: 'subscription',
    customer: opts.customer ?? id('cus'),
    status: opts.status ?? 'active',
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    canceled_at: null,
    ended_at: opts.endedAt ? unix(opts.endedAt) : null,
    trial_end: null,
    metadata: { organization_id: opts.organizationId, plan: 'pro' },
    items: { data: [{ price: { id: opts.priceId }, current_period_start: unix(opts.start), current_period_end: unix(opts.end) }] },
  };
}

export function stripeInvoice(opts: { subscriptionId: string; priceId: string; amountPaid: number; start: Date; end: Date; paymentIntent?: string; id?: string }) {
  return {
    id: opts.id ?? id('in'),
    object: 'invoice',
    status: 'paid',
    customer: id('cus'),
    currency: 'eur',
    amount_paid: opts.amountPaid,
    customer_address: { country: 'DE' },
    parent: { subscription_details: { subscription: opts.subscriptionId } },
    lines: { data: [{ period: { start: unix(opts.start), end: unix(opts.end) }, pricing: { price_details: { price: opts.priceId } } }] },
    payments: opts.paymentIntent
      ? { data: [{ status: 'paid', amount_paid: opts.amountPaid, payment: { payment_intent: opts.paymentIntent } }] }
      : { data: [] },
  };
}

export function stripeRefund(paymentIntent: string, amount: number, status = 'succeeded', refundId = id('re')) {
  return { id: refundId, object: 'refund', amount, currency: 'eur', status, payment_intent: paymentIntent, created: unix(new Date()) };
}

/** Stores an event the way the webhook route does, as the app role would (returns its row id) */
export async function storeEvent(e: ProviderEvent): Promise<string> {
  const [row] = await db
    .insert(schema.webhookEvents)
    .values({ provider: 'stripe', providerEventId: e.id, type: e.type, payload: e })
    .returning({ id: schema.webhookEvents.id });
  return row!.id;
}

/** A verified seller with an active listing */
export async function sellerWithListing(values: Partial<typeof schema.listings.$inferInsert> = {}) {
  const seller = await user();
  const l = await makeListing(owner, seller.id, values);
  return { seller, listing: l };
}

/** A business owned by a new verified user */
export async function business(ownerId?: string) {
  const o = ownerId ? { id: ownerId } : await user();
  const slug = `biz-${publicToken()}`;
  const [org] = await db
    .insert(schema.organizations)
    .values({ slug, name: 'فروشگاه آزمایشی', nameNormalized: normalizePersian('فروشگاه آزمایشی'), countryCode: 'DE', createdByUserId: o.id, email: `${slug}@example.test` })
    .returning();
  await db.insert(schema.organizationMembers).values({ organizationId: org!.id, userId: o.id, role: 'owner' });
  return { org: org!, ownerId: o.id };
}

export async function orderRow(orderId: string) {
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  return o!;
}

export async function entitlementsOf(where: { orderId?: string; organizationId?: string; listingId?: string }) {
  const col = where.orderId ? schema.entitlements.orderId : where.organizationId ? schema.entitlements.organizationId : schema.entitlements.listingId;
  return db.select().from(schema.entitlements).where(eq(col, (where.orderId ?? where.organizationId ?? where.listingId)!)).orderBy(schema.entitlements.startsAt);
}
