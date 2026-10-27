import { and, eq, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { organizationFollows, organizations } from '../../db/schema';

// Following a business (wave 1, part 6, mockup final/event «دنبال کردن»): its new events reach
// the follower (src/modules/events/notices.ts). Only active businesses can be followed; a member
// following their own business gets nothing from it.

export const FOLLOWS_MAX = 500;

export type FollowResult = { ok: true; following: boolean } | { ok: false; reason: 'not_found' | 'limit' };

export async function follow(db: Queryable, userId: string, organizationId: string): Promise<FollowResult> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'active')));
  if (!org) return { ok: false, reason: 'not_found' };
  const [count] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM organization_follows WHERE user_id = ${userId}`);
  if ((count?.n ?? 0) >= FOLLOWS_MAX) return { ok: false, reason: 'limit' };
  await db.insert(organizationFollows).values({ organizationId, userId }).onConflictDoNothing();
  return { ok: true, following: true };
}

export async function unfollow(db: Queryable, userId: string, organizationId: string): Promise<FollowResult> {
  await db.delete(organizationFollows).where(and(eq(organizationFollows.organizationId, organizationId), eq(organizationFollows.userId, userId)));
  return { ok: true, following: false };
}

export async function isFollowing(db: Queryable, userId: string, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organizationFollows.organizationId })
    .from(organizationFollows)
    .where(and(eq(organizationFollows.organizationId, organizationId), eq(organizationFollows.userId, userId)));
  return !!row;
}

/**
 * The organiser box of an event page: the business (with how many events it has put on Peydoo)
 * or, for a private organiser, their own events.
 */
export async function organizerFacts(db: Queryable, l: { userId: string; organizationId: string | null }): Promise<{ events: number; organizationId: string | null; logoKey: string | null }> {
  if (l.organizationId) {
    const [row] = await db.execute<{ n: number; logo_key: string | null }>(sql`
      SELECT (SELECT count(*)::int FROM listings x JOIN event_details e ON e.listing_id = x.id
              WHERE x.organization_id = o.id AND x.status IN ('active', 'expired')) AS n, o.logo_key
      FROM organizations o WHERE o.id = ${l.organizationId}`);
    return { events: row?.n ?? 0, organizationId: l.organizationId, logoKey: row?.logo_key ?? null };
  }
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM listings x JOIN event_details e ON e.listing_id = x.id
    WHERE x.user_id = ${l.userId} AND x.organization_id IS NULL AND x.status IN ('active', 'expired')`);
  return { events: row?.n ?? 0, organizationId: null, logoKey: null };
}
