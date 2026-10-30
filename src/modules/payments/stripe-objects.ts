import { z } from 'zod';

// The few fields of Stripe's objects that applying a webhook needs (API version pinned in
// ./gateway.ts), checked with Zod. Payloads are stored as Stripe sent them (webhook_events.payload)
// and read through these schemas, so a field Stripe moves fails loudly instead of granting the
// wrong thing. Ids may arrive expanded (an object with an id), so `ref` accepts both.

const ref = z.union([z.string(), z.object({ id: z.string() }).transform((o) => o.id)]);
const country = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .nullish()
  .transform((c) => c ?? null);

export const checkoutSessionSchema = z.object({
  id: z.string().startsWith('cs_'),
  object: z.literal('checkout.session'),
  mode: z.enum(['payment', 'subscription', 'setup']),
  client_reference_id: z.string().nullable(),
  payment_status: z.enum(['paid', 'unpaid', 'no_payment_required']),
  status: z.enum(['open', 'complete', 'expired']).nullable(),
  currency: z.string().nullable(),
  amount_subtotal: z.int().nullable(),
  amount_total: z.int().nullable(),
  total_details: z.object({ amount_discount: z.int(), amount_tax: z.int() }).nullable(),
  payment_intent: ref.nullable(),
  invoice: ref.nullable(),
  subscription: ref.nullable(),
  customer: ref.nullable(),
  customer_details: z.object({ address: z.object({ country }).nullable() }).nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
});
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;

export const subscriptionSchema = z.object({
  id: z.string().startsWith('sub_'),
  object: z.literal('subscription'),
  customer: ref,
  status: z.enum(['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused']),
  cancel_at_period_end: z.boolean(),
  canceled_at: z.int().nullable(),
  ended_at: z.int().nullable(),
  trial_end: z.int().nullable(),
  metadata: z.record(z.string(), z.string()),
  items: z.object({
    data: z
      .array(
        z.object({
          price: z.object({ id: z.string() }),
          current_period_start: z.int(),
          current_period_end: z.int(),
        }),
      )
      .min(1),
  }),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const invoiceSchema = z.object({
  id: z.string().startsWith('in_'),
  object: z.literal('invoice'),
  status: z.string().nullable(),
  customer: ref.nullable(),
  currency: z.string(),
  amount_paid: z.int(),
  customer_address: z.object({ country }).nullable().optional(),
  parent: z
    .object({ subscription_details: z.object({ subscription: ref }).nullable() })
    .nullable(),
  lines: z.object({
    data: z.array(
      z.object({
        period: z.object({ start: z.int(), end: z.int() }),
        pricing: z.object({ price_details: z.object({ price: ref }).optional() }).nullable(),
        /** A plan switch's price differences are proration lines (./apply.ts, periodLine) */
        parent: z.object({ subscription_item_details: z.object({ proration: z.boolean() }).nullish() }).nullish(),
      }),
    ),
  }),
  /** Only when the invoice was fetched with expand[]=payments */
  payments: z
    .object({
      data: z.array(
        z.object({
          status: z.string(),
          amount_paid: z.int().nullable(),
          payment: z.object({ payment_intent: ref.optional() }),
        }),
      ),
    })
    .optional(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const refundSchema = z.object({
  // re_… for cards and most methods, pyr_… for PayPal (found in the test-mode run, Oct 22, 2026)
  id: z.string().regex(/^[a-z]+_\w+$/),
  object: z.literal('refund'),
  amount: z.int().positive(),
  currency: z.string(),
  status: z.string().nullable(),
  payment_intent: ref.nullable(),
  created: z.int(),
  /** withdrawal_id on a withdrawal's refund (./withdrawals.ts) */
  metadata: z.record(z.string(), z.string()).nullish(),
});
export type Refund = z.infer<typeof refundSchema>;

export const disputeSchema = z.object({
  id: z.string().startsWith('dp_'),
  object: z.literal('dispute'),
  payment_intent: ref.nullable(),
  amount: z.int(),
  reason: z.string(),
  status: z.string(),
});
export type Dispute = z.infer<typeof disputeSchema>;

/** The envelope of every event */
export const eventSchema = z.object({
  id: z.string().startsWith('evt_'),
  object: z.literal('event'),
  type: z.string(),
  created: z.int(),
  livemode: z.boolean(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});
export type ProviderEvent = z.infer<typeof eventSchema>;

/** Event types the webhook endpoint is subscribed to and the worker applies */
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'refund.created',
  'refund.updated',
  'refund.failed',
  'charge.dispute.created',
] as const;
export type HandledEvent = (typeof HANDLED_EVENTS)[number];
export const isHandled = (type: string): type is HandledEvent => (HANDLED_EVENTS as readonly string[]).includes(type);

/** Seconds since the epoch (Stripe) → Date */
export const fromUnix = (s: number) => new Date(s * 1000);
