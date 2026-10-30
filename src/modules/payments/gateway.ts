import Stripe from 'stripe';
import { eventSchema, type ProviderEvent } from './stripe-objects';

// The payment provider behind one interface (docs/setup.md, "Payments"). This is the only file
// that talks to Stripe; the rest of the payments module works with the provider's ids and the
// shapes in ./stripe-objects.ts. A second provider later is a second implementation plus its
// `provider` value in the tables, which already have that column.

export const STRIPE_API_VERSION = '2026-09-30.endive' as const;

/**
 * Footer of every invoice (set on each customer, so subscription and one-off invoices both carry
 * it): the owner uses the small-business VAT exemption (Kleinunternehmer, §19 UStG). German legal
 * text, not interface text. Remove it the day the exemption ends (docs/setup.md, "Payments").
 */
export const INVOICE_FOOTER = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';

/**
 * How long a Checkout page stays open without being paid (wave 1, abandoned payments). Stripe
 * allows 30 minutes to 24 hours and defaults to 24; an hour is enough to pay and short enough
 * that an open page isn't paid by surprise a day later. Then Stripe sends checkout.session.expired.
 */
export const CHECKOUT_OPEN_MS = 60 * 60_000;

/** One-time products: cards (with Apple Pay and Google Pay in Checkout), PayPal, EPS (Austria) */
export const ONE_TIME_METHODS = ['card', 'paypal', 'eps'] as const;
/** Subscriptions: cards (with the wallets), PayPal, SEPA Direct Debit. EPS can't recur. */
export const SUBSCRIPTION_METHODS = ['card', 'paypal', 'sepa_debit'] as const;

export type CheckoutInput = {
  mode: 'payment' | 'subscription';
  customerId: string;
  priceId: string;
  /** orders.id for a one-time product, organizations.id for a subscription */
  clientReferenceId: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  /**
   * Subscriptions: whether Checkout shows the promotion-code field. Only monthly plans: the launch
   * coupon is 100% off for 6 months, and Stripe discounts every invoice issued in those months, so
   * a yearly plan's first invoice (12 months) would be free in full (found in the test-mode run,
   * Oct 22, 2026).
   */
  promotionCodes?: boolean;
  /**
   * Founding Pro (src/modules/payments/founding.ts): a free trial until this moment, no card asked,
   * and the subscription is cancelled at the end unless the business has added a payment method.
   */
  trialEnd?: Date;
  /** When the page closes unpaid; an hour from now unless the test says otherwise */
  expiresAt?: Date;
};

/** A Checkout page as Stripe has it now: still open (and its address), paid, or closed */
export type CheckoutState = { id: string; status: 'open' | 'complete' | 'expired' | null; url: string | null; metadata: Record<string, string> };

export type CustomerInput = { email: string; name: string; metadata: Record<string, string> };

/** One invoice as the billing page lists it (Stripe's own pages show and download it) */
export type InvoiceSummary = { id: string; number: string | null; created: Date; totalMinor: number; currency: string; status: string | null; url: string | null };

export interface PaymentGateway {
  readonly provider: 'stripe';
  createCustomer(input: CustomerInput): Promise<string>;
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  getCheckout(id: string): Promise<CheckoutState>;
  /** The customer's subscription Checkout pages that are still open */
  openSubscriptionCheckouts(customerId: string): Promise<CheckoutState[]>;
  /** Closes an open Checkout page, so it can't be paid any more */
  expireCheckout(id: string): Promise<void>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Checks the signature and parses the event; null when either fails */
  verifyEvent(rawBody: string, signature: string | null): ProviderEvent | null;
  /** The subscription as it is now (subscription events can arrive out of order) */
  getSubscription(id: string): Promise<unknown>;
  /** The invoice with its payments, which webhook payloads leave out */
  getInvoice(id: string): Promise<unknown>;
  /** A customer's latest invoices, €0 trial invoices included (the Customer Portal leaves some out) */
  listInvoices(customerId: string, limit?: number): Promise<InvoiceSummary[]>;
  /**
   * Refunds part or all of a payment (a consumer's withdrawal, ./withdrawals.ts). The key makes a
   * retried job ask once. What the refund ends is applied from its webhook, never from here.
   */
  createRefund(input: RefundInput): Promise<{ id: string }>;
  /**
   * Admin › prices (./prices.ts): the provider's price for an amount, found by its lookup key
   * (switched on again if it was retired) or created. Returns its id.
   */
  ensurePrice(input: PriceInput): Promise<string>;
  /** The old price after a change: no new Checkout can use it; subscriptions on it go on */
  archivePrice(priceId: string): Promise<void>;
  /** The Customer Portal's plan switch: the monthly price each plan product offers now */
  setPortalPlans(plans: { productId: string; priceIds: string[] }[]): Promise<void>;
}

export type PriceInput = { productId: string; currency: string; amountMinor: number; interval: 'month' | 'year' | null; lookupKey: string; metadata: Record<string, string> };

export type RefundInput = { paymentIntentId: string; amountMinor: number; metadata: Record<string, string>; idempotencyKey: string };

/** The Checkout Session parameters for one checkout (exported for the tests) */
export function checkoutParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const common = {
    customer: input.customerId,
    client_reference_id: input.clientReferenceId,
    metadata: input.metadata,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Stripe has no Persian; the browser's language, else English
    locale: 'auto',
    // The name and address typed in Checkout go onto the customer (and so the invoice)
    customer_update: { name: 'auto', address: 'auto' },
    expires_at: Math.floor((input.expiresAt?.getTime() ?? Date.now() + CHECKOUT_OPEN_MS) / 1000),
    // Prices are in euros only (./checkout.ts, PAYMENT_CURRENCY); Adaptive Pricing offers the
    // buyer's own money at about today's rate, its 2–4% paid by the buyer, and we get euros. For
    // subscriptions from abroad it covers cards and the wallets only (Stripe's docs, Oct 2026).
    adaptive_pricing: { enabled: true },
  } satisfies Stripe.Checkout.SessionCreateParams;
  // No automatic tax and no tax rates: small-business VAT exemption (§19 UStG)
  if (input.mode === 'payment') {
    return {
      ...common,
      mode: 'payment',
      // A filter on the methods switched on in the Dashboard (this API version has no fixed list)
      allowed_payment_method_types: [...ONE_TIME_METHODS],
      // The country is enough here (EU VAT thresholds); cards ask for it anyway
      billing_address_collection: 'auto',
      payment_intent_data: { metadata: input.metadata },
      // A proper invoice with the §19 footer for every purchase, not only a receipt
      invoice_creation: { enabled: true, invoice_data: { metadata: input.metadata, footer: INVOICE_FOOTER } },
    };
  }
  return {
    ...common,
    mode: 'subscription',
    allowed_payment_method_types: [...SUBSCRIPTION_METHODS],
    // Businesses get invoices with their address
    billing_address_collection: 'required',
    // Launch businesses enter their code here (monthly plans only); a 100% code needs no payment
    // method until it ends
    allow_promotion_codes: !!input.promotionCodes,
    payment_method_collection: 'if_required',
    subscription_data: input.trialEnd
      ? {
          metadata: input.metadata,
          trial_end: Math.floor(input.trialEnd.getTime() / 1000),
          // Never an automatic charge: without a payment method the subscription simply ends
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        }
      : { metadata: input.metadata },
  };
}

function checkoutState(s: Stripe.Checkout.Session): CheckoutState {
  const known = ['open', 'complete', 'expired'] as const;
  const status = known.find((k) => k === s.status) ?? null;
  return { id: s.id, status, url: s.url, metadata: s.metadata ?? {} };
}

export class StripeGateway implements PaymentGateway {
  readonly provider = 'stripe' as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string | null = null,
  ) {
    this.stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20_000 });
  }

  async createCustomer(input: CustomerInput): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: input.metadata,
      // Invoices in German (the binding language of the legal texts), with the §19 note
      preferred_locales: ['de'],
      invoice_settings: { footer: INVOICE_FOOTER },
    });
    return customer.id;
  }

  async createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }> {
    const session = await this.stripe.checkout.sessions.create(checkoutParams(input));
    if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
    return { id: session.id, url: session.url };
  }

  async getCheckout(id: string): Promise<CheckoutState> {
    return checkoutState(await this.stripe.checkout.sessions.retrieve(id));
  }

  async openSubscriptionCheckouts(customerId: string): Promise<CheckoutState[]> {
    const list = await this.stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 20 });
    return list.data.filter((s) => s.mode === 'subscription').map(checkoutState);
  }

  async expireCheckout(id: string): Promise<void> {
    try {
      await this.stripe.checkout.sessions.expire(id);
    } catch (e) {
      // Paid or closed in the meantime: nothing left to close
      if (!(e instanceof Stripe.errors.StripeInvalidRequestError)) throw e;
    }
  }

  async createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  verifyEvent(rawBody: string, signature: string | null): ProviderEvent | null {
    if (!this.webhookSecret || !signature) return null;
    try {
      // Five minutes of tolerance against replays (Stripe's default)
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      const parsed = eventSchema.safeParse(JSON.parse(JSON.stringify(event)));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async getSubscription(id: string): Promise<unknown> {
    return this.stripe.subscriptions.retrieve(id);
  }

  async getInvoice(id: string): Promise<unknown> {
    return this.stripe.invoices.retrieve(id, { expand: ['payments'] });
  }

  async listInvoices(customerId: string, limit = 24): Promise<InvoiceSummary[]> {
    const list = await this.stripe.invoices.list({ customer: customerId, limit });
    return list.data
      .filter((i) => i.status !== 'draft')
      .map((i) => ({
        id: i.id!,
        number: i.number ?? null,
        created: new Date(i.created * 1000),
        totalMinor: i.total,
        currency: i.currency.toUpperCase(),
        status: i.status ?? null,
        url: i.hosted_invoice_url ?? null,
      }));
  }

  async ensurePrice(input: PriceInput): Promise<string> {
    const found = (await this.stripe.prices.list({ lookup_keys: [input.lookupKey], limit: 1 })).data[0];
    if (found) {
      if (!found.active) await this.stripe.prices.update(found.id, { active: true });
      return found.id;
    }
    const price = await this.stripe.prices.create({
      product: input.productId,
      currency: input.currency.toLowerCase(),
      unit_amount: input.amountMinor,
      lookup_key: input.lookupKey,
      ...(input.interval ? { recurring: { interval: input.interval } } : {}),
      metadata: input.metadata,
    });
    return price.id;
  }

  async archivePrice(priceId: string): Promise<void> {
    await this.stripe.prices.update(priceId, { active: false });
  }

  async setPortalPlans(plans: { productId: string; priceIds: string[] }[]): Promise<void> {
    // The default configuration, made by scripts/stripe-setup.ts; without one there is nothing to change
    const [config] = (await this.stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data;
    if (!config) return;
    await this.stripe.billingPortal.configurations.update(config.id, {
      features: { subscription_update: { products: plans.map((p) => ({ product: p.productId, prices: p.priceIds })) } },
    });
  }

  async createRefund(input: RefundInput): Promise<{ id: string }> {
    const refund = await this.stripe.refunds.create(
      { payment_intent: input.paymentIntentId, amount: input.amountMinor, reason: 'requested_by_customer', metadata: input.metadata },
      { idempotencyKey: input.idempotencyKey },
    );
    return { id: refund.id };
  }
}
