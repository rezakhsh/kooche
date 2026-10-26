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
};

export type CustomerInput = { email: string; name: string; metadata: Record<string, string> };

/** One invoice as the billing page lists it (Stripe's own pages show and download it) */
export type InvoiceSummary = { id: string; number: string | null; created: Date; totalMinor: number; currency: string; status: string | null; url: string | null };

export interface PaymentGateway {
  readonly provider: 'stripe';
  createCustomer(input: CustomerInput): Promise<string>;
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Checks the signature and parses the event; null when either fails */
  verifyEvent(rawBody: string, signature: string | null): ProviderEvent | null;
  /** The subscription as it is now (subscription events can arrive out of order) */
  getSubscription(id: string): Promise<unknown>;
  /** The invoice with its payments, which webhook payloads leave out */
  getInvoice(id: string): Promise<unknown>;
  /** A customer's latest invoices, €0 trial invoices included (the Customer Portal leaves some out) */
  listInvoices(customerId: string, limit?: number): Promise<InvoiceSummary[]>;
}

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
}
