import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings, locations, users } from '../../db/schema';
import { coverKeys } from '../listings/queries';
import { cardColumns, type BrowseItem } from '../search/browse';

// What business pages read: the public grid of a business's live listings, and the manage view
// with every listing of the business and its simple stats (roadmap step 6).

const PUBLIC_LIMIT = 48;

/** The business's live listings for its public page, newest first (events have their own list) */
export async function businessListingCards(db: Queryable, organizationId: string): Promise<BrowseItem[]> {
  const rows = await db
    .select(cardColumns)
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(
      and(
        eq(listings.organizationId, organizationId),
        eq(listings.status, 'active'),
        sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
      ),
    )
    .orderBy(desc(listings.rankedAt), desc(listings.id))
    .limit(PUBLIC_LIMIT);
  const covers = await coverKeys(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, coverKey: covers.get(r.id) ?? null, distanceKm: null }));
}

export type ManagedListing = {
  id: string;
  publicToken: string;
  title: string;
  status: (typeof listings.$inferSelect)['status'];
  postedBy: string;
  posterId: string;
  views: number;
  saves: number;
  chats: number;
  phoneReveals: number;
  isEvent: boolean;
};

/**
 * Every listing of the business that isn't deleted, with its stats since it was published: views
 * (counted in Valkey, flushed by the worker), saves, chats started and phone numbers shown.
 * Staff see only their own; owners and managers all.
 */
export async function managedListings(db: Queryable, organizationId: string, opts: { onlyPostedBy?: string } = {}): Promise<ManagedListing[]> {
  const rows = await db
    .select({
      id: listings.id,
      publicToken: listings.publicToken,
      title: listings.title,
      status: listings.status,
      postedBy: users.displayName,
      posterId: listings.userId,
      views: sql<number>`${listings.viewCount}::int`,
      saves: sql<number>`(SELECT count(*)::int FROM favorites f WHERE f.listing_id = ${listings.id})`,
      chats: sql<number>`(SELECT count(*)::int FROM conversations c WHERE c.listing_id = ${listings.id})`,
      phoneReveals: sql<number>`(SELECT count(*)::int FROM audit_log a WHERE a.target_type = 'listing' AND a.target_id = ${listings.id} AND a.action = 'listing.phone_revealed')`,
      isEvent: sql<boolean>`EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(and(eq(listings.organizationId, organizationId), ne(listings.status, 'deleted'), opts.onlyPostedBy ? eq(listings.userId, opts.onlyPostedBy) : undefined))
    .orderBy(desc(listings.createdAt))
    .limit(500);
  return rows;
}
