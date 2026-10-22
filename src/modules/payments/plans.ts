import { and, desc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { entitlements, productPrices, products, subscriptions } from '../../db/schema';
import { FREE_BUSINESS, planFeatures, type PlanFeatures } from './features';

// What a business has paid for, read from entitlements (docs/schema.md, section 7: "whether a
// business is Pro is not a column"). Both web and worker read it.

/** Subscription statuses that still hold a plan (past_due: retries and SEPA are under way) */
const HOLDING = ['trialing', 'active', 'past_due', 'incomplete'] as const;

export type BusinessPlan = {
  /** Product code of the plan (`pro`, `pro-plus`), or null without Pro */
  code: string | null;
  features: PlanFeatures;
  /** The entitlement and subscription it comes from; allowances are counted against them */
  entitlementId: string | null;
  subscriptionId: string | null;
  endsAt: Date | null;
};

/** The business's current plan: the active pro_plan entitlement with the most listings, else free */
export async function businessPlan(db: Queryable, organizationId: string, now: Date = new Date()): Promise<BusinessPlan> {
  const rows = await db
    .select({
      id: entitlements.id,
      features: entitlements.features,
      subscriptionId: entitlements.subscriptionId,
      endsAt: entitlements.endsAt,
      code: products.code,
    })
    .from(entitlements)
    .leftJoin(subscriptions, eq(subscriptions.id, entitlements.subscriptionId))
    .leftJoin(productPrices, eq(productPrices.id, subscriptions.productPriceId))
    .leftJoin(products, eq(products.id, productPrices.productId))
    .where(
      and(
        eq(entitlements.organizationId, organizationId),
        eq(entitlements.type, 'pro_plan'),
        isNull(entitlements.revokedAt),
        lte(entitlements.startsAt, now),
        gt(entitlements.endsAt, now),
      ),
    );
  let best: BusinessPlan = { code: null, features: FREE_BUSINESS, entitlementId: null, subscriptionId: null, endsAt: null };
  for (const r of rows) {
    const features = planFeatures(r.features);
    if (!best.entitlementId || features.activeListings > best.features.activeListings) {
      best = { code: r.code ?? 'pro', features, entitlementId: r.id, subscriptionId: r.subscriptionId, endsAt: r.endsAt };
    }
  }
  return best;
}

/** The business's subscription that still runs, if any (one at a time; changes go through the portal) */
export async function activeSubscription(db: Queryable, organizationId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, organizationId), inArray(subscriptions.status, [...HOLDING])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return row ?? null;
}

/** The business's latest subscription with its plan code and interval, for the billing page */
export async function latestSubscription(db: Queryable, organizationId: string) {
  const [row] = await db
    .select({ subscription: subscriptions, code: products.code, interval: productPrices.interval, amountMinor: productPrices.amountMinor })
    .from(subscriptions)
    .innerJoin(productPrices, eq(productPrices.id, subscriptions.productPriceId))
    .innerJoin(products, eq(products.id, productPrices.productId))
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return row ?? null;
}

/** Which of these listings are featured right now (cards show the badge) */
export async function featuredListingIds(db: Queryable, listingIds: readonly string[], now: Date = new Date()): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ id: entitlements.listingId })
    .from(entitlements)
    .where(
      and(
        inArray(entitlements.listingId, [...listingIds]),
        eq(entitlements.type, 'featured'),
        isNull(entitlements.revokedAt),
        lte(entitlements.startsAt, now),
        gt(entitlements.endsAt, now),
      ),
    );
  return new Set(rows.map((r) => r.id!));
}

/** Whether one listing is featured right now */
export async function isFeatured(db: Queryable, listingId: string, now: Date = new Date()): Promise<boolean> {
  return (await featuredListingIds(db, [listingId], now)).has(listingId);
}

/** A listing's paid promotions that are still running or waiting, for its owner */
export async function listingPromotions(db: Queryable, listingId: string, now: Date = new Date()) {
  const rows = await db
    .select({ type: entitlements.type, startsAt: entitlements.startsAt, endsAt: entitlements.endsAt, appliedAt: entitlements.appliedAt })
    .from(entitlements)
    .where(and(eq(entitlements.listingId, listingId), isNull(entitlements.revokedAt), sql`(${entitlements.endsAt} > ${now.toISOString()}::timestamptz OR (${entitlements.type} = 'bump' AND ${entitlements.appliedAt} IS NULL))`))
    .orderBy(entitlements.startsAt);
  return {
    featuredUntil: rows.filter((r) => r.type === 'featured').reduce<Date | null>((m, r) => (r.endsAt && (!m || r.endsAt > m) ? r.endsAt : m), null),
    pendingBumps: rows.filter((r) => r.type === 'bump').map((r) => r.startsAt),
  };
}

/** Live events in a country (and city) with a running `featured` entitlement, for the events list */
export async function featuredEventIds(db: Queryable, countryCode: string, locationId: string | null, now: Date = new Date()): Promise<string[]> {
  const at = now.toISOString();
  const rows = await db.execute<{ id: string }>(sql`
    SELECT DISTINCT e.listing_id AS id
    FROM entitlements e
    JOIN listings l ON l.id = e.listing_id AND l.status = 'active'
    JOIN event_dates d ON d.listing_id = l.id AND d.country_code = ${countryCode} AND d.ends_at > ${at}::timestamptz
      ${locationId ? sql`AND d.location_id = ${locationId}` : sql``}
    WHERE e.type = 'featured' AND e.revoked_at IS NULL AND e.starts_at <= ${at}::timestamptz AND e.ends_at > ${at}::timestamptz
    LIMIT 8`);
  return rows.map((r) => r.id);
}
