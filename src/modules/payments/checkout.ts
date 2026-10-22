import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { auditLog, billingCustomers, eventDates, listings, orders, organizationMembers, organizations, productPrices, products, users } from '../../db/schema';
import { activeSubscription } from './plans';
import type { PaymentGateway } from './gateway';

// Starting a purchase (docs/schema.md, section 12), as classifieds_app. The app may insert a
// pending order and the billing customer and store the Checkout Session's id, nothing more: the
// order is marked paid, and anything is granted, only by the worker from the provider's webhook.
// Coming back to the success page grants nothing.

export type CheckoutRefusal =
  | 'payments_off'
  | 'sign_in_required'
  | 'account_disabled'
  | 'not_found'
  | 'not_allowed'
  /** The withdrawal waiver for an immediate start wasn't ticked */
  | 'waiver_required'
  | 'already_subscribed';
export type CheckoutResult = { ok: true; url: string; orderId?: string } | { ok: false; reason: CheckoutRefusal };

/** Products a private seller can buy for a listing or an event */
export const LISTING_PRODUCTS = ['bump-1', 'bump-3', 'featured-7d'] as const;
export const EVENT_PRODUCTS = ['featured-event'] as const;
export const PLAN_PRODUCTS = ['pro', 'pro-plus'] as const;
export type PlanCode = (typeof PLAN_PRODUCTS)[number];

/** The active price of a product in a currency (and interval, for plans) */
export async function activePrice(db: Queryable, code: string, currency: string, interval: 'month' | 'year' | null = null) {
  const [row] = await db
    .select({ product: products, price: productPrices })
    .from(products)
    .innerJoin(productPrices, eq(productPrices.productId, products.id))
    .where(
      and(
        eq(products.code, code),
        eq(products.isActive, true),
        eq(productPrices.isActive, true),
        eq(productPrices.currency, currency),
        interval ? eq(productPrices.interval, interval) : isNull(productPrices.interval),
      ),
    );
  return row ?? null;
}

/** The provider's customer for a user or a business, created on first purchase */
async function customerFor(
  db: Db,
  gateway: PaymentGateway,
  payer: { userId: string } | { organizationId: string },
  details: { email: string; name: string },
): Promise<string> {
  const where = 'userId' in payer ? eq(billingCustomers.userId, payer.userId) : eq(billingCustomers.organizationId, payer.organizationId);
  const [existing] = await db
    .select({ id: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(and(eq(billingCustomers.provider, gateway.provider), where));
  if (existing) return existing.id;
  const metadata: Record<string, string> = 'userId' in payer ? { user_id: payer.userId } : { organization_id: payer.organizationId };
  const customerId = await gateway.createCustomer({ ...details, metadata });
  // Two first purchases at once: the second insert loses, and its Stripe customer stays unused
  const [row] = await db
    .insert(billingCustomers)
    .values({ provider: gateway.provider, providerCustomerId: customerId, ...payer })
    .onConflictDoNothing()
    .returning({ id: billingCustomers.providerCustomerId });
  if (row) return row.id;
  const [winner] = await db
    .select({ id: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(and(eq(billingCustomers.provider, gateway.provider), where));
  return winner!.id;
}

async function activeUser(db: Queryable, userId: string) {
  const [u] = await db.select({ id: users.id, email: users.email, name: users.displayName, status: users.status }).from(users).where(eq(users.id, userId));
  return u ?? null;
}

/**
 * Bump or featured for one of the user's own live listings or events. Returns the Checkout URL.
 * `waiver` is the tick that the service starts at once and the 14-day withdrawal right ends with
 * it (§356(4) BGB); it is recorded in audit_log with the order.
 */
export async function startListingCheckout(
  db: Db,
  gateway: PaymentGateway | null,
  opts: { userId: string; listingId: string; productCode: string; waiver: boolean; appUrl: string; ip?: string | null; userAgent?: string | null },
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  const user = await activeUser(db, opts.userId);
  if (!user) return { ok: false, reason: 'sign_in_required' };
  if (user.status !== 'active') return { ok: false, reason: 'account_disabled' };

  const [listing] = await db
    .select({ id: listings.id, status: listings.status, currency: listings.currency, countryCurrency: sql<string | null>`(SELECT default_currency FROM countries c WHERE c.code = ${listings.countryCode})` })
    .from(listings)
    .where(and(eq(listings.id, opts.listingId), eq(listings.userId, opts.userId)));
  if (!listing) return { ok: false, reason: 'not_found' };
  if (listing.status !== 'active') return { ok: false, reason: 'not_allowed' };
  const [event] = await db.select({ id: eventDates.listingId }).from(eventDates).where(eq(eventDates.listingId, listing.id)).limit(1);
  const allowed: readonly string[] = event ? EVENT_PRODUCTS : LISTING_PRODUCTS;
  if (!allowed.includes(opts.productCode)) return { ok: false, reason: 'not_allowed' };
  if (!opts.waiver) return { ok: false, reason: 'waiver_required' };

  // Prices are in the listing country's currency (EUR in Germany and Austria)
  const currency = listing.currency ?? listing.countryCurrency ?? 'EUR';
  const found = await activePrice(db, opts.productCode, currency);
  if (!found) return { ok: false, reason: 'not_allowed' };

  const customerId = await customerFor(db, gateway, { userId: user.id }, { email: user.email, name: user.name });
  // The app may insert only a pending order's columns (migration 0014), hence plain SQL
  const [order] = await db.execute<{ id: string }>(sql`
    INSERT INTO orders (buyer_user_id, product_id, product_price_id, listing_id, currency, subtotal_minor, discount_minor, tax_minor, total_minor, provider)
    VALUES (${user.id}, ${found.product.id}, ${found.price.id}, ${listing.id}, ${found.price.currency}, ${found.price.amountMinor}, 0, 0, ${found.price.amountMinor}, ${gateway.provider})
    RETURNING id`);
  await db.insert(auditLog).values({
    actorType: 'user',
    actorUserId: user.id,
    action: 'order.withdrawal_waived',
    targetType: 'order',
    targetId: order!.id,
    ipAddress: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
    data: { product: opts.productCode },
  });

  const session = await gateway.createCheckout({
    mode: 'payment',
    customerId,
    priceId: found.price.providerPriceId,
    clientReferenceId: order!.id,
    metadata: { order_id: order!.id, listing_id: listing.id, product: opts.productCode },
    successUrl: `${opts.appUrl}/my/orders/${order!.id}`,
    cancelUrl: `${opts.appUrl}/my/listings/${listing.id}/promote?cancelled=1`,
  });
  await db.update(orders).set({ providerCheckoutId: session.id }).where(eq(orders.id, order!.id));
  return { ok: true, url: session.url, orderId: order!.id };
}

/** Whether the user is the business's owner (billing is the owner's) */
export async function isOwner(db: Queryable, userId: string, organizationId: string): Promise<boolean> {
  const [m] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId), eq(organizations.status, 'active')));
  return m?.role === 'owner';
}

/** Pro or Pro Plus for a business, monthly or yearly. Owner only; one subscription at a time. */
export async function startPlanCheckout(
  db: Db,
  gateway: PaymentGateway | null,
  opts: { userId: string; organizationId: string; plan: PlanCode; interval: 'month' | 'year'; appUrl: string },
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  const user = await activeUser(db, opts.userId);
  if (!user) return { ok: false, reason: 'sign_in_required' };
  if (user.status !== 'active') return { ok: false, reason: 'account_disabled' };
  if (!(await isOwner(db, user.id, opts.organizationId))) return { ok: false, reason: 'not_found' };
  if (!PLAN_PRODUCTS.includes(opts.plan)) return { ok: false, reason: 'not_allowed' };
  // A change of plan goes through the Customer Portal, never a second subscription
  if (await activeSubscription(db, opts.organizationId)) return { ok: false, reason: 'already_subscribed' };

  const [org] = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name, legalName: organizations.legalName, email: organizations.email })
    .from(organizations)
    .where(eq(organizations.id, opts.organizationId));
  const found = await activePrice(db, opts.plan, 'EUR', opts.interval);
  if (!org || !found) return { ok: false, reason: 'not_allowed' };

  const customerId = await customerFor(db, gateway, { organizationId: org.id }, { email: org.email ?? user.email, name: org.legalName ?? org.name });
  const session = await gateway.createCheckout({
    mode: 'subscription',
    customerId,
    priceId: found.price.providerPriceId,
    clientReferenceId: org.id,
    metadata: { organization_id: org.id, plan: opts.plan },
    successUrl: `${opts.appUrl}/b/${org.slug}/billing?done=1`,
    cancelUrl: `${opts.appUrl}/b/${org.slug}/billing`,
  });
  return { ok: true, url: session.url };
}

/** The Customer Portal for a business's subscription: plan, payment method, invoices, cancel */
export async function openBillingPortal(
  db: Db,
  gateway: PaymentGateway | null,
  opts: { userId: string; organizationId: string; appUrl: string },
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  if (!(await isOwner(db, opts.userId, opts.organizationId))) return { ok: false, reason: 'not_found' };
  const [row] = await db
    .select({ customerId: billingCustomers.providerCustomerId, slug: organizations.slug })
    .from(billingCustomers)
    .innerJoin(organizations, eq(organizations.id, billingCustomers.organizationId))
    .where(and(eq(billingCustomers.provider, gateway.provider), eq(billingCustomers.organizationId, opts.organizationId)));
  if (!row) return { ok: false, reason: 'not_found' };
  const portal = await gateway.createPortal({ customerId: row.customerId, returnUrl: `${opts.appUrl}/b/${row.slug}/billing` });
  return { ok: true, url: portal.url };
}
