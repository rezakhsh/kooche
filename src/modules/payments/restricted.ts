import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { auditLog, outboxEvents } from '../../db/schema';
import type { PaymentGateway } from './gateway';
import { queuePaymentNotice } from './notices';
import { subscriptionSchema } from './stripe-objects';

// Payments whose billing address is in a place payments can't come from (owner, Nov 4, 2026;
// src/lib/region.ts, restrictedBillingPlace: Stripe's restricted jurisdictions). The second control
// after the location check before checkout (src/modules/payments/checkout.ts): someone may pay from
// elsewhere with an address there. When the webhook of such a payment is applied (./apply.ts), in
// its transaction:
// - nothing is granted (no bump, featured time or Pro period);
// - audit_log gets `payment.restricted_country` (the place, the payment);
// - the buyer, or the business owner, is told by email and Telegram, once (owner's rule: users are
//   always told; payment notice `order_refused` / `pro_refused`);
// - outbox `payment.refused` hands the payment to the worker (queue `payments`, job
//   `refuse-payment`), which cancels the subscription at once and refunds the payment in full
//   (Stripe idempotency key `refused-<payment>`), then sends the owner's Telegram alert.
// The refund's own webhook then marks the order refunded (./apply.ts, refundChanged), and the
// subscription's end revokes what was left, without a second notice (`pro_ended` is skipped).
// A webhook delivered twice is applied once (webhook_events); a later event of a refused
// subscription (its invoice after its checkout, or the other way round) grants nothing either.

export const PAYMENT_REFUSED = 'payment.refused';
export const REFUSED_ACTION = 'payment.restricted_country';
/** entitlements.revoke_reason when a refused subscription had already been granted a period */
export const REFUSED_REVOKE_REASON = 'restricted_country';

const payloadSchema = z.object({
  what: z.enum(['order', 'subscription']),
  /** Where the billing address is (src/lib/region.ts) */
  place: z.string().max(40),
  /** Stripe's subscription id: cancelled at once */
  subscription: z.string().nullable(),
  /** The payment to refund in full (none for a €0 invoice) */
  paymentIntent: z.string().nullable(),
  amountMinor: z.int().nonnegative(),
  currency: z.string(),
  /** The checkout or invoice: the refund's idempotency key */
  key: z.string(),
});
export type RefusedPayment = z.infer<typeof payloadSchema>;

export function parseRefusedPayment(payload: Record<string, unknown>): RefusedPayment | null {
  const r = payloadSchema.safeParse(payload);
  return r.success ? r.data : null;
}

/** The place an order or subscription was refused for, or null if it never was */
export async function refusedPlace(tx: Queryable, targetType: 'order' | 'subscription', targetId: string): Promise<string | null> {
  const [row] = await tx
    .select({ place: sql<string | null>`${auditLog.data}->>'place'` })
    .from(auditLog)
    .where(and(eq(auditLog.action, REFUSED_ACTION), eq(auditLog.targetType, targetType), eq(auditLog.targetId, targetId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  return row ? (row.place ?? 'unknown') : null;
}

type Target = { type: 'order'; orderId: string } | { type: 'subscription'; subscriptionId: string; organizationId: string };

/**
 * In the webhook's transaction (./apply.ts): the audit entry, the buyer's notice (first time only)
 * and the worker's refund. The caller grants nothing.
 */
export async function refusePayment(tx: Queryable, target: Target, refused: RefusedPayment, details: Record<string, unknown> = {}): Promise<void> {
  const targetId = target.type === 'order' ? target.orderId : target.subscriptionId;
  const first = (await refusedPlace(tx, target.type, targetId)) === null;
  await tx.insert(auditLog).values({
    actorType: 'webhook',
    action: REFUSED_ACTION,
    targetType: target.type,
    targetId,
    data: { place: refused.place, payment_intent: refused.paymentIntent, amount_minor: refused.amountMinor, currency: refused.currency, ...details },
  });
  if (first) {
    if (target.type === 'order') await queuePaymentNotice(tx, target.orderId, { kind: 'order_refused' });
    else await queuePaymentNotice(tx, target.organizationId, { kind: 'pro_refused' });
  }
  await tx.insert(outboxEvents).values({ eventType: PAYMENT_REFUSED, aggregateType: target.type, aggregateId: targetId, payload: refused });
}

const ENDED = new Set(['canceled', 'incomplete_expired']);

/**
 * Worker (job `refuse-payment`): cancels the subscription if it still runs and refunds the payment
 * in full. Safe to repeat: a cancelled subscription is left alone, and the refund's idempotency key
 * makes a retried job ask Stripe once.
 */
export async function processRefusedPayment(gateway: PaymentGateway, p: RefusedPayment): Promise<{ cancelled: boolean; refunded: boolean }> {
  let cancelled = false;
  if (p.subscription) {
    const sub = subscriptionSchema.parse(await gateway.getSubscription(p.subscription));
    if (!ENDED.has(sub.status)) {
      await gateway.cancelSubscription(p.subscription);
      cancelled = true;
    }
  }
  let refunded = false;
  // Paid outside a payment intent (rare: ./apply.ts stores the invoice id instead), nothing to refund here
  if (p.paymentIntent?.startsWith('pi_') && p.amountMinor > 0) {
    await gateway.createRefund({
      paymentIntentId: p.paymentIntent,
      amountMinor: p.amountMinor,
      metadata: { refused: REFUSED_REVOKE_REASON, place: p.place },
      idempotencyKey: `refused-${p.key}`,
    });
    refunded = true;
  }
  return { cancelled, refunded };
}
