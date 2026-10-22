import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { entitlements, listings, organizationMembers, organizations, outboxEvents } from '../../db/schema';
import { businessPlan } from './plans';

// Bumps and featured slots included in Pro (decided Oct 22, 2026). The app can't write
// entitlements, so using one is a request through the outbox; the worker checks the paid plan
// and inserts the entitlement with the subscription as its source. Every entitlement still comes
// from something paid through the provider's webhook.

export const ALLOWANCE_REQUESTED = 'allowance.requested';
const DAY_MS = 86_400_000;
/** Included bumps are counted over the last 30 days, on monthly and yearly plans alike */
const BUMP_WINDOW_MS = 30 * DAY_MS;
/** One included featured slot lasts 7 days, like the paid product */
const FEATURED_FROM_PLAN_MS = 7 * DAY_MS;

export type AllowanceKind = 'bump' | 'featured';
export type AllowanceRefusal = 'not_found' | 'not_allowed' | 'none_left' | 'already_featured';

/** What is left of the plan's allowances right now */
export async function allowancesLeft(db: Queryable, organizationId: string, now: Date = new Date()) {
  const plan = await businessPlan(db, organizationId, now);
  if (!plan.subscriptionId) return { plan, bumps: 0, featured: 0 };
  const [used] = await db.execute<{ bumps: number; featured: number }>(sql`
    SELECT
      count(*) FILTER (WHERE type = 'bump' AND created_at > ${new Date(now.getTime() - BUMP_WINDOW_MS).toISOString()}::timestamptz)::int AS bumps,
      count(*) FILTER (WHERE type = 'featured' AND ends_at > ${now.toISOString()}::timestamptz)::int AS featured
    FROM entitlements
    WHERE subscription_id = ${plan.subscriptionId} AND organization_id = ${organizationId} AND listing_id IS NOT NULL AND revoked_at IS NULL`);
  return {
    plan,
    bumps: Math.max(0, plan.features.bumpsPerMonth - (used?.bumps ?? 0)),
    featured: Math.max(0, plan.features.featuredSlots - (used?.featured ?? 0)),
  };
}

/**
 * A member asks to use an included bump or featured slot on one of the business's live listings
 * (owner and manager on any, staff on their own). Checked here for a quick answer and again by
 * the worker, which has the last word.
 */
export async function requestAllowance(
  db: Queryable,
  opts: { userId: string; listingId: string; kind: AllowanceKind; now?: Date },
): Promise<{ ok: true } | { ok: false; reason: AllowanceRefusal }> {
  const now = opts.now ?? new Date();
  const [row] = await db
    .select({ organizationId: listings.organizationId, posterId: listings.userId, status: listings.status, role: organizationMembers.role })
    .from(listings)
    .innerJoin(organizationMembers, and(eq(organizationMembers.organizationId, listings.organizationId), eq(organizationMembers.userId, opts.userId)))
    .innerJoin(organizations, and(eq(organizations.id, listings.organizationId), eq(organizations.status, 'active')))
    .where(eq(listings.id, opts.listingId));
  if (!row?.organizationId) return { ok: false, reason: 'not_found' };
  if (row.role === 'staff' && row.posterId !== opts.userId) return { ok: false, reason: 'not_found' };
  if (row.status !== 'active') return { ok: false, reason: 'not_allowed' };
  const left = await allowancesLeft(db, row.organizationId, now);
  if ((opts.kind === 'bump' ? left.bumps : left.featured) <= 0) return { ok: false, reason: 'none_left' };
  await db.insert(outboxEvents).values({
    eventType: ALLOWANCE_REQUESTED,
    aggregateType: 'listing',
    aggregateId: opts.listingId,
    payload: { organization_id: row.organizationId, kind: opts.kind, user_id: opts.userId },
  });
  return { ok: true };
}

/**
 * The worker grants a requested allowance, or refuses it when the plan has none left, the listing
 * is no longer live or no longer the business's. The business row is locked so two requests at
 * once can't both take the last one.
 */
export async function grantAllowance(
  db: Queryable,
  opts: { listingId: string; organizationId: string; kind: AllowanceKind; now?: Date },
): Promise<'granted' | AllowanceRefusal> {
  const now = opts.now ?? new Date();
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.id, opts.organizationId), eq(organizations.status, 'active')))
    .for('update');
  if (!org) return 'not_found';
  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, opts.listingId), eq(listings.organizationId, org.id), eq(listings.status, 'active')));
  if (!listing) return 'not_allowed';
  const left = await allowancesLeft(db, org.id, now);
  if (!left.plan.subscriptionId) return 'none_left';
  if ((opts.kind === 'bump' ? left.bumps : left.featured) <= 0) return 'none_left';

  const base = { organizationId: org.id, listingId: listing.id, subscriptionId: left.plan.subscriptionId, features: {} };
  if (opts.kind === 'bump') {
    await db.insert(entitlements).values({ ...base, type: 'bump', startsAt: now });
    return 'granted';
  }
  const [running] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(and(eq(entitlements.listingId, listing.id), eq(entitlements.type, 'featured'), isNull(entitlements.revokedAt), lte(entitlements.startsAt, now), gt(entitlements.endsAt, now)))
    .limit(1);
  if (running) return 'already_featured';
  await db.insert(entitlements).values({ ...base, type: 'featured', startsAt: now, endsAt: new Date(now.getTime() + FEATURED_FROM_PLAN_MS) });
  return 'granted';
}
