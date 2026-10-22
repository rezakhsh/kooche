import { sql, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings } from '../../db/schema';
import { ancestry, type Catalog } from '../listings/catalog';
import { businessPlan } from '../payments/plans';

// Who may publish what, privately or as a business (decided Oct 22, 2026, "the middle way"):
// - private people post for free, but at most 2 active service or lesson offers;
// - job offers from employers and the business-only categories (tax and accounting) need a
//   business;
// - a business has 3 active listings without Pro, 25 with Pro, 100 with Pro Plus.
// Checked when a listing goes live: published, sent again, renewed or resumed. Listings already
// live are never taken down by these rules.

/** Top categories whose offers count as services when posted privately */
export const SERVICE_ROOTS = ['services', 'lessons-courses'] as const;
export const PRIVATE_SERVICE_OFFERS = 2;
/** Offers in this top category come from employers */
export const JOBS_ROOT = 'jobs';

export type PostingRefusal = 'business_only' | 'private_service_limit' | 'business_limit';

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
  l: { id: string; userId: string; organizationId: string | null; categoryId: string | null; kind: 'offer' | 'wanted' },
  now: Date = new Date(),
): Promise<PostingRefusal | null> {
  if (!l.categoryId) return null;
  const category = catalog.byId.get(l.categoryId);
  const root = ancestry(catalog, l.categoryId)[0]?.slug;

  if (!l.organizationId) {
    if (category?.businessOnly) return 'business_only';
    if (l.kind === 'offer' && root === JOBS_ROOT) return 'business_only';
    if (l.kind === 'offer' && root && (SERVICE_ROOTS as readonly string[]).includes(root)) {
      const ids = SERVICE_ROOTS.flatMap((slug) => {
        const r = catalog.bySlug.get(slug);
        return r ? descendants(catalog, r.id) : [];
      });
      const [row] = await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM listings
        WHERE user_id = ${l.userId} AND organization_id IS NULL AND status = 'active' AND kind = 'offer' AND id <> ${l.id}
          AND category_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
      if ((row?.n ?? 0) >= PRIVATE_SERVICE_OFFERS) return 'private_service_limit';
    }
    return null;
  }

  const plan = await businessPlan(db, l.organizationId, now);
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM listings l
    WHERE l.organization_id = ${l.organizationId} AND l.status = 'active' AND l.id <> ${l.id}
      AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`);
  return (row?.n ?? 0) >= plan.features.activeListings ? 'business_limit' : null;
}

/** A category and every category under it */
function descendants(catalog: Catalog, id: string): string[] {
  const node = catalog.byId.get(id);
  if (!node) return [];
  return [id, ...node.childIds.flatMap((c) => descendants(catalog, c))];
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
