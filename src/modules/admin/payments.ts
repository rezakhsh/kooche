import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';

// Payments on the admin page, read only (roadmap step 8): money and entitlements change only
// through Stripe's webhooks (CLAUDE.md), refunds and disputes are handled in Stripe itself.

export function recentOrders(db: Queryable, limit = 100) {
  return db.execute<{ id: string; created_at: string | Date; paid_at: string | Date | null; status: string; total_minor: string; currency: string; product: string; buyer: string | null; business: string | null; checkout: string | null; charge: string | null }>(sql`
    SELECT o.id, o.created_at, o.paid_at, o.status, o.total_minor, o.currency, p.name_fa AS product, u.display_name AS buyer, org.name AS business,
      o.provider_checkout_id AS checkout,
      (SELECT pay.provider_payment_id FROM payments pay WHERE pay.order_id = o.id AND pay.kind = 'charge' ORDER BY pay.occurred_at LIMIT 1) AS charge
    FROM orders o JOIN products p ON p.id = o.product_id
    LEFT JOIN users u ON u.id = o.buyer_user_id LEFT JOIN organizations org ON org.id = o.organization_id
    ORDER BY o.created_at DESC LIMIT ${limit}`);
}

export function subscriptionsList(db: Queryable, limit = 100) {
  return db.execute<{ id: string; status: string; current_period_end: string | Date; cancel_at_period_end: boolean; plan: string; business: string | null; person: string | null; provider_id: string }>(sql`
    SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end, p.name_fa AS plan, org.name AS business, u.display_name AS person, s.provider_subscription_id AS provider_id
    FROM subscriptions s JOIN product_prices pp ON pp.id = s.product_price_id JOIN products p ON p.id = pp.product_id
    LEFT JOIN organizations org ON org.id = s.organization_id LEFT JOIN users u ON u.id = s.user_id
    ORDER BY s.current_period_end DESC LIMIT ${limit}`);
}

export async function unappliedWebhooks(db: Queryable): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM webhook_events WHERE processed_at IS NULL`);
  return r?.n ?? 0;
}

/** The Stripe dashboard page of an object id (test or live mode from the secret key) */
export function stripeLink(id: string | null, live: boolean): string | null {
  if (!id) return null;
  const base = `https://dashboard.stripe.com${live ? '' : '/test'}`;
  if (id.startsWith('pi_') || id.startsWith('py_')) return `${base}/payments/${id}`;
  if (id.startsWith('cs_')) return `${base}/checkout/sessions/${id}`;
  if (id.startsWith('sub_')) return `${base}/subscriptions/${id}`;
  return null;
}
