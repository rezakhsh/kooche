import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { auditLog, billingCustomers, eventDates, listings, orders, organizationMembers, organizations, productPrices, products, users } from '../../db/schema';
import { manageableBy } from '../organizations/limits';
import { legalComplete } from '../organizations/organizations';
import { activeSubscription } from './plans';
import { CHECKOUT_OPEN_MS, type InvoiceSummary, type PaymentGateway } from './gateway';

// Starting a purchase (docs/schema.md, section 12), as classifieds_app. The app may insert a
// pending order and the billing customer and store the Checkout Session's id, nothing more: the
// order is marked paid, and anything is granted, only by the worker from the provider's webhook.
// Coming back to the success page grants nothing.
//
// The same purchase started again while its Checkout page is still open (a second tab, the back
// button, «ادامهٔ پرداخت») goes back to that page instead of making a second one, so it can't be
// paid twice (wave 1, abandoned payments).

export type CheckoutRefusal =
  | 'payments_off'
  /** A business's legal details (the Impressum) aren't complete yet (wave 1: they can wait until now) */
  | 'legal_missing'
  | 'sign_in_required'
  | 'account_disabled'
  | 'not_found'
  | 'not_allowed'
  /** The withdrawal waiver for an immediate start wasn't ticked */
  | 'waiver_required'
  /** Paying isn't possible from Iran (src/lib/region.ts); everything else is */
  | 'from_iran'
  /** Pro is sold to businesses only: the "for my business" tick wasn't ticked */
  | 'business_required'
  | 'already_subscribed'
  /** Founding Pro's founders rules (./founding.ts, foundingRuleBreaks) */
  | 'owner_number'
  | 'owner_has_founding';
export type CheckoutResult = { ok: true; url: string; orderId?: string } | { ok: false; reason: CheckoutRefusal };

/** Products a private seller can buy for a listing or an event */
export const LISTING_PRODUCTS = ['bump-1', 'bump-3', 'featured-7d'] as const;
export const EVENT_PRODUCTS = ['featured-event'] as const;
export const PLAN_PRODUCTS = ['pro', 'pro-plus'] as const;
export type PlanCode = (typeof PLAN_PRODUCTS)[number];

/**
 * Every price is in euros, wherever the buyer is (owner, Oct 30, 2026: the business is in Germany).
 * Stripe's Adaptive Pricing offers the buyer's own money on the Checkout page (./gateway.ts); we
 * are always paid in euros.
 */
export const PAYMENT_CURRENCY = 'EUR';

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
export async function customerFor(
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

/** Where the request comes from: Stripe's checkout and portal are never opened from Iran (src/lib/region.ts) */
export type Where = { fromIran?: boolean };

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
  opts: { userId: string; listingId: string; productCode: string; waiver: boolean; appUrl: string; ip?: string | null; userAgent?: string | null } & Where,
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  if (opts.fromIran) return { ok: false, reason: 'from_iran' };
  const user = await activeUser(db, opts.userId);
  if (!user) return { ok: false, reason: 'sign_in_required' };
  if (user.status !== 'active') return { ok: false, reason: 'account_disabled' };

  const [listing] = await db
    .select({ id: listings.id, status: listings.status })
    .from(listings)
    // Own listings, and a business's for its owners and managers
    .where(and(eq(listings.id, opts.listingId), manageableBy(opts.userId)));
  if (!listing) return { ok: false, reason: 'not_found' };
  if (listing.status !== 'active') return { ok: false, reason: 'not_allowed' };
  const [event] = await db.select({ id: eventDates.listingId }).from(eventDates).where(eq(eventDates.listingId, listing.id)).limit(1);
  const allowed: readonly string[] = event ? EVENT_PRODUCTS : LISTING_PRODUCTS;
  if (!allowed.includes(opts.productCode)) return { ok: false, reason: 'not_allowed' };
  if (!opts.waiver) return { ok: false, reason: 'waiver_required' };

  const found = await activePrice(db, opts.productCode, PAYMENT_CURRENCY);
  if (!found) return { ok: false, reason: 'not_allowed' };

  const open = await openOrderCheckout(db, gateway, { userId: user.id, listingId: listing.id, productId: found.product.id });
  if (open) return { ok: true, url: open.url, orderId: open.orderId };

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
    successUrl: `${opts.appUrl}/my/orders/${order!.id}?done=1`,
    cancelUrl: `${opts.appUrl}/my/listings/${listing.id}/promote?cancelled=1&product=${opts.productCode}`,
  });
  await db.update(orders).set({ providerCheckoutId: session.id }).where(eq(orders.id, order!.id));
  return { ok: true, url: session.url, orderId: order!.id };
}

/** The buyer's pending order for this product and listing whose Checkout page is still open */
async function openOrderCheckout(db: Queryable, gateway: PaymentGateway, o: { userId: string; listingId: string; productId: string }) {
  const [order] = await db
    .select({ id: orders.id, checkoutId: orders.providerCheckoutId })
    .from(orders)
    .where(
      and(
        eq(orders.buyerUserId, o.userId),
        eq(orders.listingId, o.listingId),
        eq(orders.productId, o.productId),
        eq(orders.status, 'pending'),
        isNotNull(orders.providerCheckoutId),
        gt(orders.createdAt, new Date(Date.now() - CHECKOUT_OPEN_MS)),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (!order?.checkoutId) return null;
  const state = await gateway.getCheckout(order.checkoutId);
  return state.status === 'open' && state.url ? { orderId: order.id, url: state.url } : null;
}

/**
 * The business's open plan Checkout page for the same choice, if there is one. Any other open plan
 * page is closed first: two pages paid in two tabs would make two subscriptions.
 */
export async function openPlanCheckout(gateway: PaymentGateway, customerId: string, metadata: Record<string, string>): Promise<string | null> {
  const same = (m: Record<string, string>) => m.plan === metadata.plan && m.interval === metadata.interval && (m.founding ?? '') === (metadata.founding ?? '');
  let url: string | null = null;
  for (const c of await gateway.openSubscriptionCheckouts(customerId)) {
    if (!url && c.url && same(c.metadata)) url = c.url;
    else await gateway.expireCheckout(c.id);
  }
  return url;
}

/** «ادامهٔ پرداخت»: back to the buyer's own pending order's Checkout page while it is open */
export async function resumeOrderCheckout(db: Queryable, gateway: PaymentGateway | null, opts: { userId: string; orderId: string } & Where): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  if (opts.fromIran) return { ok: false, reason: 'from_iran' };
  const [order] = await db
    .select({ status: orders.status, checkoutId: orders.providerCheckoutId })
    .from(orders)
    .where(and(eq(orders.id, opts.orderId), eq(orders.buyerUserId, opts.userId)));
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status !== 'pending' || !order.checkoutId) return { ok: false, reason: 'not_allowed' };
  const state = await gateway.getCheckout(order.checkoutId);
  return state.status === 'open' && state.url ? { ok: true, url: state.url, orderId: opts.orderId } : { ok: false, reason: 'not_allowed' };
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

/** What a plan checkout records about who buys: the business tick, with the request's IP and browser */
export type BusinessBuyer = { business: boolean; ip?: string | null; userAgent?: string | null };

/**
 * Pro is sold to businesses only (terms 14.5, wave 0): the owner ticks "for my business, not as a
 * consumer" before every plan checkout, recorded in audit_log. So Pro has no consumer withdrawal
 * button (./withdrawals.ts); the lawyer confirms.
 */
export async function confirmBusinessBuyer(db: Queryable, userId: string, organizationId: string, buyer: BusinessBuyer, plan: string): Promise<boolean> {
  if (!buyer.business) return false;
  await db.insert(auditLog).values({
    actorType: 'user',
    actorUserId: userId,
    action: 'subscription.business_buyer',
    targetType: 'organization',
    targetId: organizationId,
    ipAddress: buyer.ip ?? null,
    userAgent: buyer.userAgent ?? null,
    data: { plan },
  });
  return true;
}

/** Pro or Pro Plus for a business, monthly or yearly. Owner only; one subscription at a time. */
export async function startPlanCheckout(
  db: Db,
  gateway: PaymentGateway | null,
  opts: { userId: string; organizationId: string; plan: PlanCode; interval: 'month' | 'year'; appUrl: string } & BusinessBuyer & Where,
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  if (opts.fromIran) return { ok: false, reason: 'from_iran' };
  const user = await activeUser(db, opts.userId);
  if (!user) return { ok: false, reason: 'sign_in_required' };
  if (user.status !== 'active') return { ok: false, reason: 'account_disabled' };
  if (!(await isOwner(db, user.id, opts.organizationId))) return { ok: false, reason: 'not_found' };
  if (!PLAN_PRODUCTS.includes(opts.plan)) return { ok: false, reason: 'not_allowed' };
  // A change of plan goes through the Customer Portal, never a second subscription
  if (await activeSubscription(db, opts.organizationId)) return { ok: false, reason: 'already_subscribed' };

  const [org] = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name, legalName: organizations.legalName, legalForm: organizations.legalForm, addressLine1: organizations.addressLine1, postalCode: organizations.postalCode, email: organizations.email })
    .from(organizations)
    .where(eq(organizations.id, opts.organizationId));
  const found = await activePrice(db, opts.plan, PAYMENT_CURRENCY, opts.interval);
  if (!org || !found) return { ok: false, reason: 'not_allowed' };
  if (!legalComplete(org)) return { ok: false, reason: 'legal_missing' };
  if (!(await confirmBusinessBuyer(db, user.id, org.id, opts, opts.plan))) return { ok: false, reason: 'business_required' };

  const customerId = await customerFor(db, gateway, { organizationId: org.id }, { email: org.email ?? user.email, name: org.legalName ?? org.name });
  // Paid a moment ago, before the webhook arrived: Stripe already has the subscription
  if (await gateway.hasRunningSubscription(customerId)) return { ok: false, reason: 'already_subscribed' };
  const metadata = { organization_id: org.id, plan: opts.plan, interval: opts.interval };
  const open = await openPlanCheckout(gateway, customerId, metadata);
  if (open) return { ok: true, url: open };
  const session = await gateway.createCheckout({
    mode: 'subscription',
    customerId,
    priceId: found.price.providerPriceId,
    clientReferenceId: org.id,
    metadata,
    successUrl: `${opts.appUrl}/b/${org.slug}/billing?done=1`,
    cancelUrl: `${opts.appUrl}/b/${org.slug}/billing?cancelled=1`,
    // The 6-month launch code is retired: founding businesses get a trial without a card instead
    // (./founding.ts), which never charges by itself
    promotionCodes: false,
  });
  return { ok: true, url: session.url };
}

/** The Customer Portal for a business's subscription: plan, payment method, invoices, cancel */
export async function openBillingPortal(
  db: Db,
  gateway: PaymentGateway | null,
  opts: { userId: string; organizationId: string; appUrl: string } & Where,
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  // Stripe's portal takes payments too (a new card, a plan change); a running plan just goes on
  if (opts.fromIran) return { ok: false, reason: 'from_iran' };
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

/** The business's invoices from the provider, newest first; empty before its first checkout */
export async function businessInvoices(db: Queryable, gateway: PaymentGateway | null, organizationId: string): Promise<InvoiceSummary[]> {
  if (!gateway) return [];
  const [row] = await db
    .select({ customerId: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(and(eq(billingCustomers.provider, gateway.provider), eq(billingCustomers.organizationId, organizationId)));
  if (!row) return [];
  try {
    return await gateway.listInvoices(row.customerId);
  } catch (e) {
    console.error('payments: invoices unavailable:', e instanceof Error ? e.message : e);
    return [];
  }
}
