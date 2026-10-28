import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { countries, currencies, listingImages, listings, locations, moderationDecisions, organizations, postalPlaces, users } from '../../db/schema';
import { eventPath } from '../events/slug';
import { lastTakeDown } from '../moderation/history';
import type { Place } from './places';
import { listingNeighbourhood } from './neighbourhood';
import { listingPath } from './slug';
import { hideTest } from '../users/test-accounts';

// Reads for the posting pages, "my listings" and the public listing page.

export type Country = {
  code: string;
  slug: string;
  nameFa: string;
  nameLocal: string;
  currency: { code: string; symbol: string; minorUnit: number; nameFa: string };
};

const globalForCountries = globalThis as typeof globalThis & { countries?: { value: Promise<Country[]>; at: number } };

/** Countries open for listings, in seed order; reference data, kept 10 minutes */
export function activeCountries(db: Queryable): Promise<Country[]> {
  const cached = globalForCountries.countries;
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value;
  const value = db
    .select({
      code: countries.code,
      slug: countries.slug,
      nameFa: countries.nameFa,
      nameLocal: countries.nameLocal,
      currency: { code: currencies.code, symbol: currencies.symbol, minorUnit: currencies.minorUnit, nameFa: currencies.nameFa },
    })
    .from(countries)
    .innerJoin(currencies, eq(currencies.code, countries.defaultCurrency))
    .where(and(eq(countries.isActive, true), sql`${countries.slug} IS NOT NULL`))
    .orderBy(asc(countries.sortOrder), asc(countries.code))
    .then((rows) => rows.map((r) => ({ ...r, slug: r.slug! })));
  globalForCountries.countries = { value, at: Date.now() };
  value.catch(() => {
    if (globalForCountries.countries?.value === value) globalForCountries.countries = undefined;
  });
  return value;
}

/** A country that isn't open yet, by its slug: only its waitlist cities have pages (round 12) */
export async function closedCountry(db: Queryable, slug: string): Promise<Country | null> {
  const [row] = await db
    .select({
      code: countries.code,
      slug: countries.slug,
      nameFa: countries.nameFa,
      nameLocal: countries.nameLocal,
      currency: { code: currencies.code, symbol: currencies.symbol, minorUnit: currencies.minorUnit, nameFa: currencies.nameFa },
    })
    .from(countries)
    .innerJoin(currencies, eq(currencies.code, countries.defaultCurrency))
    .where(and(eq(countries.isActive, false), eq(countries.slug, slug)));
  return row ? { ...row, slug: row.slug! } : null;
}

/**
 * The account's saved place (users.home_*), pre-filled in new listings. The postal code and place
 * are looked up again, so a place that left the postal data is simply not offered any more.
 */
export async function savedPlace(db: Queryable, userId: string): Promise<{ place: Place; district: string } | null> {
  const [u] = await db
    .select({
      locationId: users.homeLocationId,
      postalCode: users.homePostalCode,
      placeName: users.homePlaceName,
      district: users.homeDistrict,
      countryCode: locations.countryCode,
      nameFa: locations.nameFa,
      nameLocal: locations.nameLocal,
      center: locations.center,
    })
    .from(users)
    .innerJoin(locations, and(eq(locations.id, users.homeLocationId), eq(locations.isActive, true)))
    .where(eq(users.id, userId));
  if (!u?.locationId) return null;
  const district = u.district ?? '';
  if (!u.postalCode || !u.placeName) {
    return { place: { kind: 'city', id: u.locationId, locationId: u.locationId, countryCode: u.countryCode, nameFa: u.nameFa, nameLocal: u.nameLocal, center: u.center }, district };
  }
  const [p] = await db
    .select({ id: postalPlaces.id, locationId: postalPlaces.locationId, center: postalPlaces.center })
    .from(postalPlaces)
    .where(
      and(
        eq(postalPlaces.countryCode, u.countryCode),
        eq(postalPlaces.postalCode, u.postalCode),
        eq(postalPlaces.placeName, u.placeName),
        eq(postalPlaces.isActive, true),
      ),
    );
  if (!p?.locationId) return null;
  return {
    place: { kind: 'postal', id: p.id, countryCode: u.countryCode, postalCode: u.postalCode, placeName: u.placeName, locationId: p.locationId, center: p.center },
    district,
  };
}

/** Events have their own section, pages and "my events" (src/modules/events/) */
export const notAnEvent = sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`;

/** Active listings per open country, for the home page */
export async function countryCounts(db: Queryable): Promise<Map<string, number>> {
  const rows = await db
    .select({ code: listings.countryCode, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.status, 'active'), notAnEvent, hideTest(false, listings.userId)))
    .groupBy(listings.countryCode);
  return new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.n]));
}

/** The owner's listings, newest first, with the cover photo's key */
export async function myListings(db: Queryable, userId: string) {
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.userId, userId), ne(listings.status, 'deleted'), notAnEvent))
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

/** Why a listing was taken down: the statement of its last take-down (also a suspension's) */
export async function takeDownStatement(db: Queryable, listingId: string): Promise<{ statement: string | null; policyGround: string | null } | null> {
  const last = await lastTakeDown(db, listingId);
  return last ? { statement: last.statement, policyGround: last.policyGround } : null;
}

/** «۲ آگهی دیگر» in the seller box: the seller's (or business's) other active listings */
export async function otherActiveListings(db: Queryable, l: { id: string; userId: string; organizationId: string | null }): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(l.organizationId ? eq(listings.organizationId, l.organizationId) : eq(listings.userId, l.userId), eq(listings.status, 'active'), ne(listings.id, l.id)));
  return row?.n ?? 0;
}

/** Everything the public listing page shows, by public token. Deleted listings are not found. */
export async function publicListing(db: Queryable, token: string) {
  const [row] = await db
    .select({
      listing: listings,
      cityFa: locations.nameFa,
      cityLocal: locations.nameLocal,
      neighbourhood: listingNeighbourhood,
      seller: { displayName: users.displayName, publicToken: users.publicToken, createdAt: users.createdAt },
      /** Posted by a test account: the page shows it only to staff and test accounts */
      testOwner: sql<boolean>`${users.testAccount} IS NOT NULL`,
      // Posted for a business (roadmap step 6): the business is the seller shown
      business: { name: organizations.name, slug: organizations.slug, verificationStatus: organizations.verificationStatus, createdAt: organizations.createdAt },
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .leftJoin(organizations, and(eq(organizations.id, listings.organizationId), eq(organizations.status, 'active')))
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
  return { ...row, business: row.business?.slug ? row.business : null, images };
}

/**
 * The seller's verified number for "show number": only for an active listing whose seller allows
 * phone contact. Never part of the page's HTML.
 */
export async function listingPhone(db: Queryable, token: string): Promise<{ listingId: string; phone: string } | null> {
  const [row] = await db
    .select({ listingId: listings.id, phone: users.phoneE164 })
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
  return row?.phone ? { listingId: row.listingId, phone: row.phone } : null;
}

/**
 * The page of the live listing or event with this code (the 9 digits on every listing page, typed
 * into a search box in Persian or Latin digits), else null
 */
export async function pathOfListingCode(db: Queryable, text: string): Promise<string | null> {
  const digits = text.trim().replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) - (d >= '۰' ? 0x06f0 : 0x0660)));
  if (!/^[1-9][0-9]{8}$/.test(digits)) return null;
  const [l] = await db
    .select({ title: listings.title, token: listings.publicToken, isEvent: sql<boolean>`EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})` })
    .from(listings)
    .where(and(eq(listings.refNumber, Number(digits)), eq(listings.status, 'active'), hideTest(false, listings.userId)));
  if (!l) return null;
  return l.isEvent ? eventPath(l.title, l.token) : listingPath(l.title, l.token);
}
