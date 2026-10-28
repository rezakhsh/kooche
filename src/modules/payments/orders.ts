import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings, orders, products, users } from '../../db/schema';
import { CHECKOUT_OPEN_MS } from './gateway';
import { eligibilityColumns } from './withdrawals';

// Purchases as their buyer sees them (/my/orders), and the worker's clean-up of checkouts that
// were started and never finished.

/**
 * A checkout left pending this long is closed. Stripe closes its page after an hour (./gateway.ts)
 * and says so by webhook; this catches a webhook that never came.
 */
const STALE_MS = 2 * 86_400_000;

/** Pending orders older than two days become `expired`. Worker only (the app can't set a status). */
export async function expireStaleOrders(db: Queryable, now: Date = new Date()): Promise<number> {
  const rows = await db
    .update(orders)
    .set({ status: 'expired' })
    .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, new Date(now.getTime() - STALE_MS))))
    .returning({ id: orders.id });
  return rows.length;
}

/** One of the buyer's own orders, with its product and listing */
export async function ownOrder(db: Queryable, userId: string, orderId: string) {
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return null;
  const [row] = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      providerInvoiceId: orders.providerInvoiceId,
      productCode: products.code,
      productName: products.nameFa,
      listingId: listings.id,
      listingTitle: listings.title,
      listingToken: listings.publicToken,
      buyerName: users.displayName,
      buyerEmail: users.email,
      ...eligibilityColumns,
    })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .innerJoin(users, eq(users.id, orders.buyerUserId))
    .leftJoin(listings, eq(listings.id, orders.listingId))
    .where(and(eq(orders.id, orderId), eq(orders.buyerUserId, userId)));
  return row ?? null;
}

/** A pending order whose Checkout page may still be open: «ادامهٔ پرداخت» (wave 1) */
export function checkoutOpen(o: { status: string; createdAt: Date }, now = new Date()): boolean {
  return o.status === 'pending' && now.getTime() - o.createdAt.getTime() < CHECKOUT_OPEN_MS;
}

/** The buyer's orders, newest first; checkouts never finished are left out once their page has closed */
export async function ownOrders(db: Queryable, userId: string, limit = 50) {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      productName: products.nameFa,
      listingTitle: listings.title,
      paidAt: orders.paidAt,
      ...eligibilityColumns,
    })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .leftJoin(listings, eq(listings.id, orders.listingId))
    .where(
      and(
        eq(orders.buyerUserId, userId),
        sql`(${orders.status} NOT IN ('pending', 'expired') OR ${orders.paidAt} IS NOT NULL
          OR (${orders.status} = 'pending' AND ${orders.createdAt} > now() - make_interval(secs => ${CHECKOUT_OPEN_MS / 1000})))`,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
