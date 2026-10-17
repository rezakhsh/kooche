import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { countries, listingImages, listings, locations, moderationDecisions, users } from '../../db/schema';

// Reads for the posting pages, "my listings" and the public listing page.

export type City = { id: string; nameFa: string; regionFa: string | null; countryCode: string; defaultCurrency: string };

const globalForCities = globalThis as typeof globalThis & { cities?: { value: Promise<City[]>; at: number } };

/** Active cities in active countries, largest first; reference data, kept 10 minutes */
export function activeCities(db: Queryable): Promise<City[]> {
  const cached = globalForCities.cities;
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value;
  const regions = sql`(SELECT r.name_fa FROM locations r WHERE r.id = ${locations.parentId})`;
  const value = db
    .select({
      id: locations.id,
      nameFa: locations.nameFa,
      regionFa: sql<string | null>`${regions}`,
      countryCode: locations.countryCode,
      defaultCurrency: countries.defaultCurrency,
    })
    .from(locations)
    .innerJoin(countries, eq(countries.code, locations.countryCode))
    .where(and(eq(locations.kind, 'city'), eq(locations.isActive, true), eq(countries.isActive, true)))
    .orderBy(desc(sql`coalesce(${locations.population}, 0)`), asc(locations.nameFa));
  globalForCities.cities = { value, at: Date.now() };
  value.catch(() => {
    if (globalForCities.cities?.value === value) globalForCities.cities = undefined;
  });
  return value;
}

/** The owner's listings, newest first, with the cover photo's key */
export async function myListings(db: Queryable, userId: string) {
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.userId, userId), ne(listings.status, 'deleted')))
    .orderBy(desc(listings.createdAt))
    .limit(200);
  const covers = await coverKeys(db, rows.map((r) => r.id));
  return rows.map((listing) => ({ listing, coverKey: covers.get(listing.id) ?? null }));
}

/** Storage key of the first ready photo of each listing */
export async function coverKeys(db: Queryable, listingIds: string[]): Promise<Map<string, string>> {
  if (listingIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([listingImages.listingId], { listingId: listingImages.listingId, key: listingImages.storageKey })
    .from(listingImages)
    .where(and(inArray(listingImages.listingId, listingIds), eq(listingImages.status, 'ready')))
    .orderBy(listingImages.listingId, asc(listingImages.position));
  return new Map(rows.map((r) => [r.listingId, r.key]));
}

/** Why a listing was taken down: the latest restricting decision's statement */
export async function takeDownStatement(db: Queryable, listingId: string): Promise<string | null> {
  const [row] = await db
    .select({ statement: moderationDecisions.statementFa })
    .from(moderationDecisions)
    .where(and(eq(moderationDecisions.listingId, listingId), inArray(moderationDecisions.decision, ['reject', 'remove'])))
    .orderBy(desc(moderationDecisions.createdAt))
    .limit(1);
  return row?.statement ?? null;
}

/** Everything the public listing page shows, by public token. Deleted listings are not found. */
export async function publicListing(db: Queryable, token: string) {
  const [row] = await db
    .select({
      listing: listings,
      cityFa: locations.nameFa,
      seller: { displayName: users.displayName, publicToken: users.publicToken, createdAt: users.createdAt },
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(and(eq(listings.publicToken, token), ne(listings.status, 'deleted')));
  if (!row) return null;
  const images = await db
    .select({
      id: listingImages.id,
      key: listingImages.storageKey,
      width: listingImages.width,
      height: listingImages.height,
      blur: listingImages.blurPlaceholder,
    })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, row.listing.id), eq(listingImages.status, 'ready')))
    .orderBy(asc(listingImages.position));
  return { ...row, images };
}

/**
 * The seller's verified number for "show number": only for an active listing whose seller allows
 * phone contact. Never part of the page's HTML.
 */
export async function listingPhone(db: Queryable, token: string): Promise<string | null> {
  const [row] = await db
    .select({ phone: users.phoneE164 })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(
      and(
        eq(listings.publicToken, token),
        eq(listings.status, 'active'),
        eq(listings.allowPhoneContact, true),
        eq(users.status, 'active'),
      ),
    );
  return row?.phone ?? null;
}
