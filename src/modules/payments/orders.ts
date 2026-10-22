import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings, orders, products } from '../../db/schema';

// Purchases as their buyer sees them (/my/orders), and the worker's clean-up of checkouts that
// were started and never finished.

/** A checkout left open this long without a webhook is closed (Stripe's sessions last 24 hours) */
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
      productCode: products.code,
      productName: products.nameFa,
      listingId: listings.id,
      listingTitle: listings.title,
      listingToken: listings.publicToken,
    })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .leftJoin(listings, eq(listings.id, orders.listingId))
    .where(and(eq(orders.id, orderId), eq(orders.buyerUserId, userId)));
  return row ?? null;
}

/** The buyer's orders, newest first; checkouts never finished are left out */
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
    })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .leftJoin(listings, eq(listings.id, orders.listingId))
    .where(and(eq(orders.buyerUserId, userId), sql`${orders.status} NOT IN ('pending', 'expired') OR ${orders.paidAt} IS NOT NULL`))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
