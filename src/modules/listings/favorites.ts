import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { favorites, listings, locations } from '../../db/schema';
import { hit, type Limit } from '../../lib/rate-limit';
import { coverKeys } from './queries';

// Favorites (approved Oct 18, 2026): signed-in users only; browsing and favorites need no
// verified phone (docs/setup.md, "Permissions"). Only active listings can be saved, and not your
// own. "My favorites" keeps listings that went away and shows them as no longer available. The
// seller sees how many people saved each of their listings; nobody else does.

export const FAVORITES_MAX = 1000;
export const FAVORITES_PAGE_SIZE = 24;
export const FAVORITE_LIMIT: Limit = { name: 'favorite:user:1m', max: 60, windowSeconds: 60 };

const TOKEN = /^[0-9a-hjkmnp-tv-z]{10}$/;

export type FavoriteResult = { ok: true; saved: boolean } | { ok: false; reason: 'not_found' | 'own' | 'limit' | 'rate_limited' };

/** Saves an active listing for the user. Saving twice changes nothing. */
export async function addFavorite(db: Queryable, redis: Redis | null, userId: string, token: string): Promise<FavoriteResult> {
  if (!TOKEN.test(token)) return { ok: false, reason: 'not_found' };
  if (redis && !(await hit(redis, [[FAVORITE_LIMIT, userId]])).ok) return { ok: false, reason: 'rate_limited' };
  return db.transaction(async (tx) => {
    const [l] = await tx
      .select({ id: listings.id, userId: listings.userId, status: listings.status })
      .from(listings)
      .where(eq(listings.publicToken, token));
    if (!l || l.status !== 'active') return { ok: false, reason: 'not_found' } as const;
    if (l.userId === userId) return { ok: false, reason: 'own' } as const;
    // One user's favorites in a row, so two saves at once can't pass the limit together
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`favorites:${userId}`}, 0))`);
    const [counted] = await tx.select({ n: sql<number>`count(*)::int` }).from(favorites).where(eq(favorites.userId, userId));
    const [existing] = await tx.select({ id: favorites.listingId }).from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.listingId, l.id)));
    if (existing) return { ok: true, saved: true } as const;
    if ((counted?.n ?? 0) >= FAVORITES_MAX) return { ok: false, reason: 'limit' } as const;
    await tx.insert(favorites).values({ userId, listingId: l.id }).onConflictDoNothing();
    return { ok: true, saved: true } as const;
  });
}

/** Removes one of the user's own favorites, whatever state the listing is in now */
export async function removeFavorite(db: Queryable, userId: string, token: string): Promise<FavoriteResult> {
  if (!TOKEN.test(token)) return { ok: false, reason: 'not_found' };
  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), sql`${favorites.listingId} = (SELECT id FROM ${listings} WHERE ${listings.publicToken} = ${token})`));
  return { ok: true, saved: false };
}

/** Which of these listings the user saved (the filled hearts on a page of cards) */
export async function savedAmong(db: Queryable, userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db
    .select({ id: favorites.listingId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), inArray(favorites.listingId, listingIds)));
  return new Set(rows.map((r) => r.id));
}

/**
 * How many people saved each listing, for its seller only: listings of other sellers are left
 * out, whatever ids are asked for.
 */
export async function favoriteCounts(db: Queryable, ownerId: string, listingIds: string[]): Promise<Map<string, number>> {
  if (listingIds.length === 0) return new Map();
  const rows = await db
    .select({ id: favorites.listingId, n: sql<number>`count(*)::int` })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .where(and(eq(listings.userId, ownerId), inArray(favorites.listingId, listingIds)))
    .groupBy(favorites.listingId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** Cursor of "my favorites": when it was saved and the listing id, newest first */
function parseCursor(cursor: string | null): { at: string; id: string } | null {
  const m = cursor ? /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_([0-9a-f-]{36})$/.exec(cursor) : null;
  return m ? { at: m[1]!, id: m[2]! } : null;
}

/**
 * The user's favorites, newest saved first, one page at a time. Listings that are no longer
 * active stay in the list: `available` is false, and `linkable` says whether their page still
 * opens for visitors (paused, sold and expired pages explain themselves; deleted and taken-down
 * ones are gone).
 */
export async function myFavorites(db: Queryable, userId: string, cursor: string | null) {
  const after = parseCursor(cursor);
  const savedAt = sql<string>`to_char(${favorites.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
  const rows = await db
    .select({
      id: listings.id,
      publicToken: listings.publicToken,
      title: listings.title,
      status: listings.status,
      priceType: listings.priceType,
      priceMinor: listings.priceMinor,
      currency: listings.currency,
      categoryId: listings.categoryId,
      postalCode: listings.postalCode,
      placeName: listings.placeName,
      district: listings.district,
      cityFa: locations.nameFa,
      publishedAt: listings.publishedAt,
      kind: listings.kind,
      savedAt,
    })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(
      and(
        eq(favorites.userId, userId),
        after ? sql`(${favorites.createdAt}, ${favorites.listingId}) < (${after.at}::timestamptz, ${after.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(favorites.createdAt), desc(favorites.listingId))
    .limit(FAVORITES_PAGE_SIZE + 1);
  const page = rows.slice(0, FAVORITES_PAGE_SIZE);
  const live = page.filter((r) => r.status !== 'deleted' && r.status !== 'rejected');
  const covers = await coverKeys(db, live.map((r) => r.id));
  const last = page.at(-1);
  return {
    items: page.map(({ savedAt: _s, ...r }) => ({
      ...r,
      available: r.status === 'active',
      linkable: r.status === 'active' || r.status === 'paused' || r.status === 'sold' || r.status === 'expired',
      coverKey: covers.get(r.id) ?? null,
    })),
    next: rows.length > FAVORITES_PAGE_SIZE && last ? `${last.savedAt}_${last.id}` : null,
  };
}
