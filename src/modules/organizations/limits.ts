import { sql, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings } from '../../db/schema';
import { ancestry, type Catalog } from '../listings/catalog';
import { businessPlan } from '../payments/plans';
import { restrictedRoots } from './suspicions';

// Who may publish what, privately or as a business (decided Oct 22, 2026, "the middle way";
// wave 2 part 4 with rounds 9 and 11; private limits like Kleinanzeigen's, owner Oct 29, 2026):
// - licensed services (tax, legal and immigration advice, health, estate agents, finance, driving
//   schools, sworn translation) and job offers from employers need a business; licensed ones a
//   verified business, whose licence is checked at verification;
// - private people's offers have Kleinanzeigen's free limits (hilfe.kleinanzeigen.de, "Gebühren
//   bei Kleinanzeigen", read Oct 29, 2026), counted as new ones (first published, whatever happened
//   to them since, so deleting and posting again doesn't reset them) and, for homes, also as live
//   ones: goods, services and lessons 100 new in 30 days; cars 2 new in 30 days; motorbikes, vans,
//   boats and caravans 5; flats and houses (rent, sale, WG, short stays) 2 live and 2 new in 30
//   days; land, garages and commercial property 1. Regular service providers are found by the
//   «احتمالاً کسب‌وکار» queue (./suspicions.ts), not by a separate limit. Wanted posts, community
//   posts and events have none;
// - a business has 3 active listings without Pro, 25 with Pro, 100 with Pro Plus (verified or not);
// - a business's listings and events go live only once its legal details (the Impressum) are
//   complete (owner, Oct 28, 2026; like Kleinanzeigen's «Rechtliche Angaben» for PRO accounts,
//   § 5 DDG). Its page and drafts can start earlier.
// Checked when a listing goes live: published, sent again, renewed or resumed. Listings already
// live are never taken down by these rules.

/** Top categories whose offers count as services */
export const SERVICE_ROOTS = ['services', 'lessons-courses'] as const;
/** Offers in this top category come from employers */
export const JOBS_ROOT = 'jobs';
/** Licensed services: verified businesses only (the seed marks them business-only too) */
export const LICENSED = ['tax-accounting', 'legal-immigration', 'health-services', 'real-estate-agents', 'finance-insurance', 'driving-school'] as const;
/** Vehicles with their own limit besides cars (Kleinanzeigen: 5 free) */
const BIG_VEHICLES = ['motorcycles', 'campers', 'commercial-vehicles', 'boats'] as const;
/** Flats and houses (Kleinanzeigen: 2 live, 2 new); the rest of property has 1 */
const HOMES = ['apartments-rent', 'houses-rent', 'shared-rooms', 'short-term-rent', 'apartments-sale', 'houses-sale'] as const;

export type PrivateGroup = 'goods' | 'cars' | 'vehicles' | 'homes' | 'property';
/** A private person's limits per group: live listings, and new ones within `days` */
export const PRIVATE_LIMITS: Record<PrivateGroup, { active: number | null; fresh: { n: number; days: number } }> = {
  goods: { active: null, fresh: { n: 100, days: 30 } },
  cars: { active: null, fresh: { n: 2, days: 30 } },
  vehicles: { active: null, fresh: { n: 5, days: 30 } },
  homes: { active: 2, fresh: { n: 2, days: 30 } },
  property: { active: 1, fresh: { n: 1, days: 30 } },
};
/** Top categories without private limits (besides events and wanted posts) */
const NO_LIMIT_ROOTS = ['community', 'events-calendar', 'jobs'];

export type PostingRefusal =
  | 'business_only'
  /** Restricted after «احتمالاً کسب‌وکار» (./suspicions.ts): private offers in these top categories */
  | 'business_required'
  | 'licence_required'
  | 'private_goods_limit'
  | 'private_car_limit'
  | 'private_vehicle_limit'
  | 'private_home_limit'
  | 'private_property_limit'
  | 'business_limit'
  | 'legal_missing';

const LIMIT_REFUSAL: Record<PrivateGroup, PostingRefusal> = {
  goods: 'private_goods_limit',
  cars: 'private_car_limit',
  vehicles: 'private_vehicle_limit',
  homes: 'private_home_limit',
  property: 'private_property_limit',
};

/** Whether a category (or the sworn-translation tick) is a licensed service */
export function isLicensed(catalog: Catalog, categoryId: string, attributes: Record<string, unknown> = {}): boolean {
  const chain = ancestry(catalog, categoryId).map((c) => c.slug);
  if (chain.some((slug) => (LICENSED as readonly string[]).includes(slug))) return true;
  return chain.includes('translation') && (attributes.certified === true || attributes.certified === 'true');
}

/** The private limit group of an offer in this category, or null when it has none */
export function privateGroup(catalog: Catalog, categoryId: string): PrivateGroup | null {
  const chain = ancestry(catalog, categoryId).map((c) => c.slug);
  const root = chain[0];
  if (!root || NO_LIMIT_ROOTS.includes(root)) return null;
  if (root === 'real-estate') return chain.some((slug) => (HOMES as readonly string[]).includes(slug)) ? 'homes' : 'property';
  if (chain.includes('cars')) return 'cars';
  if (chain.some((slug) => (BIG_VEHICLES as readonly string[]).includes(slug))) return 'vehicles';
  return 'goods';
}

/** The categories of a group, for counting */
function groupCategoryIds(catalog: Catalog, group: PrivateGroup): string[] {
  return [...catalog.byId.values()].filter((c) => privateGroup(catalog, c.id) === group).map((c) => c.id);
}

/**
 * Listings the user may manage: their own, and every listing of a business where they are owner
 * or manager. Staff manage only what they posted (it is their own).
 */
export function manageableBy(userId: string): SQL {
  return sql`(${listings.userId} = ${userId} OR ${listings.organizationId} IN (SELECT organization_id FROM organization_members WHERE user_id = ${userId} AND role IN ('owner', 'manager')))`;
}

export async function postingRefusal(
  db: Queryable,
  catalog: Catalog,
  l: {
    id: string;
    userId: string;
    organizationId: string | null;
    categoryId: string | null;
    kind: 'offer' | 'wanted';
    attributes?: unknown;
  },
  now: Date = new Date(),
): Promise<PostingRefusal | null> {
  if (!l.categoryId) return null;
  const category = catalog.byId.get(l.categoryId);
  const root = ancestry(catalog, l.categoryId)[0]?.slug;
  const licensed = l.kind === 'offer' && isLicensed(catalog, l.categoryId, (l.attributes ?? {}) as Record<string, unknown>);

  if (!l.organizationId) {
    if (category?.businessOnly || licensed) return 'business_only';
    if (l.kind === 'offer' && root === JOBS_ROOT) return 'business_only';
    if (l.kind === 'offer' && root && (await restrictedRoots(db, l.userId)).includes(root)) return 'business_required';
    const group = l.kind === 'offer' ? privateGroup(catalog, l.categoryId) : null;
    if (!group) return null;
    const limit = PRIVATE_LIMITS[group];
    const ids = groupCategoryIds(catalog, group);
    if (ids.length === 0) return null;
    // Live ones besides this listing, and those first published within the window (whatever
    // their state now; this listing counts only if it was published before)
    const window = new Date(now.getTime() - limit.fresh.days * 86_400_000);
    const [row] = await db.execute<{ live: number; fresh: number }>(sql`
      SELECT count(*) FILTER (WHERE status = 'active' AND id <> ${l.id})::int AS live,
        count(*) FILTER (WHERE published_at > ${window.toISOString()}::timestamptz)::int AS fresh
      FROM listings
      WHERE user_id = ${l.userId} AND organization_id IS NULL AND kind = 'offer'
        AND category_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
    const [self] = await db.execute<{ published: boolean }>(sql`SELECT published_at IS NOT NULL AS published FROM listings WHERE id = ${l.id}`);
    if (limit.active !== null && (row?.live ?? 0) >= limit.active) return LIMIT_REFUSAL[group];
    // A listing that was out before (renewed, resumed, sent again) is not new
    if (!self?.published && (row?.fresh ?? 0) >= limit.fresh.n) return LIMIT_REFUSAL[group];
    return null;
  }

  if (licensed && !(await businessVerified(db, l.organizationId))) return 'licence_required';
  if (!(await businessLegalComplete(db, l.organizationId))) return 'legal_missing';
  const plan = await businessPlan(db, l.organizationId, now);
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM listings l
    WHERE l.organization_id = ${l.organizationId} AND l.status = 'active' AND l.id <> ${l.id}
      AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`);
  return (row?.n ?? 0) >= plan.features.activeListings ? 'business_limit' : null;
}

/** Whether the business is verified (licensed services need it) */
async function businessVerified(db: Queryable, organizationId: string): Promise<boolean> {
  const [row] = await db.execute<{ yes: boolean }>(sql`SELECT verification_status = 'verified' AS yes FROM organizations WHERE id = ${organizationId}`);
  return !!row?.yes;
}

/** Whether the business's Impressum is complete (the same fields as legalComplete()) */
export async function businessLegalComplete(db: Queryable, organizationId: string): Promise<boolean> {
  const [row] = await db.execute<{ yes: boolean }>(sql`
    SELECT (legal_name IS NOT NULL AND legal_form IS NOT NULL AND address_line1 IS NOT NULL AND postal_code IS NOT NULL AND email IS NOT NULL) AS yes
    FROM organizations WHERE id = ${organizationId}`);
  return !!row?.yes;
}

/** How many active listings the business has and may have (the business page, posting form) */
export async function businessUsage(db: Queryable, organizationId: string, now: Date = new Date()) {
  const plan = await businessPlan(db, organizationId, now);
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM listings l
    WHERE l.organization_id = ${organizationId} AND l.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`);
  return { active: row?.n ?? 0, limit: plan.features.activeListings, plan };
}
