import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { auditLog, entitlements, listings, orders, orderWithdrawals, outboxEvents, payments, products, users } from '../../db/schema';
import type { PaymentGateway } from './gateway';
import { queuePaymentNotice } from './notices';

// The withdrawal button for consumers (§ 356a BGB, in force since Jun 19, 2026; wave 0,
// docs/wave0-plan.md item 6). A private person's one-time order (bump, 3 bumps, featured) can be
// withdrawn from /my/orders for 14 days after payment, in two steps: «انصراف از قرارداد (Vertrag
// widerrufen)», then the details and «تأیید انصراف (Widerruf bestätigen)». The receipt is emailed
// at once. The worker then works out what was not used yet (§ 357a (2) BGB: the consumer pays for
// what was provided until the withdrawal) and asks Stripe for that refund, tagged with the
// withdrawal. Its webhook ends what is left of the order (./apply.ts): entitlements still change
// only through webhooks. Orders for a business's listing are B2B and have no button; Pro is sold to
// businesses only (the tick at checkout, ./checkout.ts).

export const WITHDRAWAL_DAYS = 14;
const DAY_MS = 86_400_000;

/** Outbox: a withdrawal was recorded; the worker refunds what wasn't used */
export const WITHDRAWAL_RECEIVED = 'order.withdrawn';

type Eligibility = {
  status: (typeof orders.$inferSelect)['status'];
  paidAt: Date | null;
  /** The order's or its listing's business: a B2B purchase */
  business: boolean;
  withdrawnAt: Date | null;
};

/** Whether the button shows: a consumer's paid order, within 14 days, not withdrawn yet */
export function canWithdraw(o: Eligibility, now = new Date()): boolean {
  if (o.business || o.withdrawnAt || !o.paidAt) return false;
  if (o.status !== 'paid' && o.status !== 'partially_refunded') return false;
  return now.getTime() < o.paidAt.getTime() + WITHDRAWAL_DAYS * DAY_MS;
}

/** The columns canWithdraw() needs, for the order queries (./orders.ts) */
export const eligibilityColumns = {
  business: sql<boolean>`(${orders.organizationId} IS NOT NULL OR ${listings.organizationId} IS NOT NULL)`,
  withdrawnAt: sql<Date | null>`(SELECT w.created_at FROM order_withdrawals w WHERE w.order_id = ${orders.id})`.mapWith((v) => (v ? new Date(v) : null)),
};

export type WithdrawResult = { ok: true; withdrawalId: string } | { ok: false; reason: 'not_found' | 'not_allowed' | 'already' };

/**
 * The second step's button. Records the withdrawal (once per order: pressing again does nothing),
 * the IP and browser in audit_log, the receipt email and the refund job, in one transaction.
 */
export async function withdrawOrder(
  db: Db,
  opts: { userId: string; orderId: string; ip?: string | null; userAgent?: string | null; now?: Date },
): Promise<WithdrawResult> {
  if (!/^[0-9a-f-]{36}$/.test(opts.orderId)) return { ok: false, reason: 'not_found' };
  return db.transaction(async (tx) => {
    const [o] = await tx
      .select({ id: orders.id, status: orders.status, paidAt: orders.paidAt, currency: orders.currency, product: products.code, email: users.email, ...eligibilityColumns })
      .from(orders)
      .innerJoin(products, eq(products.id, orders.productId))
      .innerJoin(users, eq(users.id, orders.buyerUserId))
      .leftJoin(listings, eq(listings.id, orders.listingId))
      .where(and(eq(orders.id, opts.orderId), eq(orders.buyerUserId, opts.userId)));
    if (!o) return { ok: false, reason: 'not_found' };
    if (o.withdrawnAt) return { ok: false, reason: 'already' };
    if (!canWithdraw(o, opts.now)) return { ok: false, reason: 'not_allowed' };
    // The app may insert only these columns (migration 0021), hence plain SQL
    const [w] = await tx.execute<{ id: string }>(sql`
      INSERT INTO order_withdrawals (order_id, user_id, receipt_email, currency)
      VALUES (${o.id}, ${opts.userId}, ${o.email}, ${o.currency})
      ON CONFLICT (order_id) DO NOTHING
      RETURNING id`);
    if (!w) return { ok: false, reason: 'already' };
    await tx.insert(auditLog).values({
      actorType: 'user',
      actorUserId: opts.userId,
      action: 'order.withdrawn',
      targetType: 'order',
      targetId: o.id,
      ipAddress: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      data: { product: o.product },
    });
    // The receipt on a durable medium, at once (./notices.ts), and the refund (worker)
    await queuePaymentNotice(tx, o.id, { kind: 'withdrawal_received', withdrawalId: w.id });
    await tx.insert(outboxEvents).values({ eventType: WITHDRAWAL_RECEIVED, aggregateType: 'order', aggregateId: o.id, payload: { withdrawal_id: w.id } });
    return { ok: true, withdrawalId: w.id };
  });
}

type Granted = { type: string; startsAt: Date; endsAt: Date | null; appliedAt: Date | null; revokedAt: Date | null };

/**
 * What a withdrawal refunds (§ 357a (2) BGB): the part not provided when it was received. Bumps
 * count as provided once run (a single bump that ran refunds nothing: the waiver); featured time
 * pro rata to the minute. Minus what was refunded already; in minor units.
 */
export function withdrawalRefund(input: { totalMinor: number; refundedMinor: number; granted: Granted[]; receivedAt: Date }): number {
  const { totalMinor, granted, receivedAt } = input;
  if (totalMinor <= 0 || granted.length === 0) return 0;
  let unused = 0;
  const bumps = granted.filter((g) => g.type === 'bump');
  if (bumps.length > 0) {
    const ran = bumps.filter((b) => b.appliedAt && b.appliedAt <= receivedAt).length;
    unused = (bumps.length - ran) / bumps.length;
  } else {
    const f = granted.find((g) => g.type === 'featured' && g.endsAt);
    if (!f) return 0;
    const length = f.endsAt!.getTime() - f.startsAt.getTime();
    const stop = Math.min(receivedAt.getTime(), f.revokedAt?.getTime() ?? Infinity, f.endsAt!.getTime());
    const used = Math.min(Math.max(stop - f.startsAt.getTime(), 0), length);
    unused = (length - used) / length;
  }
  return Math.max(0, Math.round(totalMinor * unused) - input.refundedMinor);
}

/** The withdrawal's refund tag on Stripe's refund, read back by the webhook */
export const WITHDRAWAL_META = 'withdrawal_id';

/**
 * Worker: refunds what a withdrawal didn't use (or records that nothing is left), then tells the
 * buyer. A retried job asks Stripe once (the idempotency key); a done withdrawal is left alone.
 */
export async function processWithdrawal(db: Db, gateway: PaymentGateway, withdrawalId: string): Promise<'refunded' | 'no_refund' | 'done'> {
  const [w] = await db.select().from(orderWithdrawals).where(eq(orderWithdrawals.id, withdrawalId));
  if (!w) throw new Error(`withdrawal ${withdrawalId} not found`);
  if (w.status !== 'received') return 'done';
  const [order] = await db.select({ totalMinor: orders.totalMinor }).from(orders).where(eq(orders.id, w.orderId));
  const [charge] = await db
    .select({ paymentIntent: payments.providerPaymentId })
    .from(payments)
    .where(and(eq(payments.orderId, w.orderId), eq(payments.kind, 'charge'), eq(payments.status, 'succeeded')));
  const [refunded] = await db
    .select({ sum: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::bigint`.mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.orderId, w.orderId), eq(payments.kind, 'refund'), inArray(payments.status, ['pending', 'succeeded'])));
  const granted = await db
    .select({ type: entitlements.type, startsAt: entitlements.startsAt, endsAt: entitlements.endsAt, appliedAt: entitlements.appliedAt, revokedAt: entitlements.revokedAt })
    .from(entitlements)
    .where(eq(entitlements.orderId, w.orderId));
  const amount = charge ? withdrawalRefund({ totalMinor: order!.totalMinor, refundedMinor: refunded?.sum ?? 0, granted, receivedAt: w.createdAt }) : 0;

  let outcome: 'refunded' | 'no_refund' = 'no_refund';
  let refundId: string | null = null;
  if (amount > 0) {
    ({ id: refundId } = await gateway.createRefund({
      paymentIntentId: charge!.paymentIntent,
      amountMinor: amount,
      metadata: { [WITHDRAWAL_META]: w.id, order_id: w.orderId },
      idempotencyKey: `withdrawal-${w.id}`,
    }));
    outcome = 'refunded';
  }
  await db.transaction(async (tx) => {
    const done = await tx
      .update(orderWithdrawals)
      .set({ status: outcome, refundMinor: amount, providerRefundId: refundId, processedAt: sql`now()` })
      .where(and(eq(orderWithdrawals.id, w.id), eq(orderWithdrawals.status, 'received')))
      .returning({ id: orderWithdrawals.id });
    // The buyer hears how much comes back, or why nothing does
    if (done.length > 0) await queuePaymentNotice(tx, w.orderId, { kind: 'withdrawal_processed', withdrawalId: w.id });
  });
  return outcome;
}

/**
 * Webhook (./apply.ts): a withdrawal's refund ends what is left of its order: featured time and
 * bumps that haven't run. Only when the refund carries a withdrawal of that same order.
 */
export async function endWithdrawnOrder(tx: Queryable, orderId: string, metadata: Record<string, string> | null | undefined, now: Date): Promise<boolean> {
  const id = metadata?.[WITHDRAWAL_META];
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return false;
  const [w] = await tx.select({ id: orderWithdrawals.id }).from(orderWithdrawals).where(and(eq(orderWithdrawals.id, id), eq(orderWithdrawals.orderId, orderId)));
  if (!w) return false;
  await tx
    .update(entitlements)
    .set({ revokedAt: now, revokeReason: 'withdrawal' })
    .where(and(eq(entitlements.orderId, orderId), isNull(entitlements.revokedAt), sql`(${entitlements.type} <> 'bump' OR ${entitlements.appliedAt} IS NULL)`));
  return true;
}

/** The buyer's withdrawal of an order, for the order page */
export async function withdrawalOf(db: Queryable, orderId: string) {
  const [w] = await db.select().from(orderWithdrawals).where(eq(orderWithdrawals.orderId, orderId));
  return w ?? null;
}
