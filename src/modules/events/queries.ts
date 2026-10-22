import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { eventDates, eventDetails, listings, locations } from '../../db/schema';
import { coverKeys, publicListing } from '../listings/queries';
import { addDays, dayNumber, localParts, zonedToUtc, type LocalDate } from './time';

// Reads for the events pages: upcoming events of a country (optionally one city, type, online or
// free), one event's page and "my events". Only active listings are shown; an event that has
// ended is expired by the listing expiry job, and its dates stay for its page ("has ended").

export const EVENTS_PAGE_SIZE = 24;

export type When = 'all' | 'today' | 'weekend' | 'week' | 'month';
export const WHEN: readonly When[] = ['all', 'today', 'weekend', 'week', 'month'];

/**
 * The time window of a "when" filter in a time zone: from now (or the start of the weekend) to the
 * end of today, of Sunday, or of the month. The week runs Monday to Sunday, as in Germany and
 * Austria; the weekend is Friday to Sunday.
 */
export function whenWindow(when: When, now: Date, timeZone: string): { from: Date; to: Date | null } {
  if (when === 'all') return { from: now, to: null };
  const p = localParts(now, timeZone);
  const today: LocalDate = { y: p.y, m: p.m, d: p.d };
  const midnight = (day: LocalDate) => zonedToUtc({ ...day, h: 0, mi: 0 }, timeZone);
  // 0 = Monday … 6 = Sunday
  const weekday = (dayNumber(today) + 3) % 7;
  switch (when) {
    case 'today':
      return { from: now, to: midnight(addDays(today, 1)) };
    case 'week':
      return { from: now, to: midnight(addDays(today, 7 - weekday)) };
    case 'weekend': {
      const friday = addDays(today, 4 - weekday);
      const start = weekday >= 4 ? now : midnight(friday);
      return { from: start, to: midnight(addDays(today, 7 - weekday)) };
    }
    case 'month': {
      const next = p.m === 12 ? { y: p.y + 1, m: 1, d: 1 } : { y: p.y, m: p.m + 1, d: 1 };
      return { from: now, to: midnight(next) };
    }
  }
}

export type EventFilter = {
  /** A country's events, or (without it) one seller's events everywhere */
  countryCode?: string;
  /** Only this seller's own events, not their organizations' (the seller page) */
  sellerId?: string;
  locationId?: string | null;
  categoryIds?: string[] | null;
  from: Date;
  to: Date | null;
  online?: boolean;
  free?: boolean;
  /** The next date's start and the listing id of the last event on the previous page */
  after?: { startsAt: Date; id: string } | null;
  /** Only these events (found by keyword search) */
  listingIds?: string[];
};

export type EventCardRow = {
  id: string;
  publicToken: string;
  title: string;
  categoryId: string | null;
  priceType: string;
  priceMinor: number | null;
  currency: string | null;
  postalCode: string | null;
  placeName: string | null;
  cityFa: string | null;
  attendance: string;
  venueName: string | null;
  scheduleStatus: string;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  /** Dates in the window that haven't ended, this one included */
  dateCount: number;
  coverKey: string | null;
};

/**
 * Upcoming events, each with its next date in the window, soonest first, one page at a time
 * (keyset on the date's start and the listing id). The dates are found through
 * event_dates_country_ends_idx or event_dates_location_ends_idx: only rows not over yet.
 */
export async function upcomingEvents(db: Queryable, f: EventFilter, now = new Date()) {
  if (!f.countryCode && !f.sellerId) throw new Error('upcomingEvents needs a country or a seller');
  const rows = await db.execute<{
    id: string;
    public_token: string;
    title: string;
    category_id: string | null;
    price_type: string;
    price_minor: string | null;
    currency: string | null;
    postal_code: string | null;
    place_name: string | null;
    city_fa: string | null;
    attendance: string;
    venue_name: string | null;
    schedule_status: string;
    time_zone: string;
    starts_at: Date;
    ends_at: Date;
    date_count: number;
  }>(sql`
    WITH next AS (
      SELECT DISTINCT ON (d.listing_id) d.listing_id, d.starts_at, d.ends_at,
             count(*) OVER (PARTITION BY d.listing_id)::int AS date_count
      FROM event_dates d
      WHERE ${f.countryCode ? sql`d.country_code = ${f.countryCode}` : sql`true`}
        ${f.sellerId ? sql`AND d.listing_id IN (SELECT id FROM listings WHERE user_id = ${f.sellerId} AND organization_id IS NULL)` : sql``}
        AND d.ends_at > ${now.toISOString()}::timestamptz
        AND d.ends_at > ${f.from.toISOString()}::timestamptz
        ${f.to ? sql`AND d.starts_at < ${f.to.toISOString()}::timestamptz` : sql``}
        ${f.locationId ? sql`AND d.location_id = ${f.locationId}` : sql``}
        ${f.listingIds ? sql`AND d.listing_id IN (${f.listingIds.length ? sql.join(f.listingIds.map((id) => sql`${id}::uuid`), sql`, `) : sql`NULL`})` : sql``}
      ORDER BY d.listing_id, d.starts_at
    )
    SELECT l.id, l.public_token, l.title, l.category_id, l.price_type, l.price_minor, l.currency,
           l.postal_code, l.place_name, c.name_fa AS city_fa,
           e.attendance, e.venue_name, e.schedule_status, e.time_zone,
           n.starts_at, n.ends_at, n.date_count
    FROM next n
    JOIN listings l ON l.id = n.listing_id AND l.status = 'active'
    JOIN event_details e ON e.listing_id = l.id
    LEFT JOIN locations c ON c.id = l.location_id
    WHERE true
      ${f.categoryIds?.length ? sql`AND l.category_id IN (${sql.join(f.categoryIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
      ${f.online ? sql`AND e.attendance <> 'in_person'` : sql``}
      ${f.free ? sql`AND l.price_type = 'free'` : sql``}
      ${f.after ? sql`AND (n.starts_at, l.id) > (${f.after.startsAt.toISOString()}::timestamptz, ${f.after.id}::uuid)` : sql``}
    ORDER BY n.starts_at, l.id
    LIMIT ${EVENTS_PAGE_SIZE + 1}
  `);
  const page = rows.slice(0, EVENTS_PAGE_SIZE);
  const covers = await coverKeys(db, page.map((r) => r.id));
  const items: EventCardRow[] = page.map((r) => ({
    id: r.id,
    publicToken: r.public_token,
    title: r.title,
    categoryId: r.category_id,
    priceType: r.price_type,
    priceMinor: r.price_minor === null ? null : Number(r.price_minor),
    currency: r.currency,
    postalCode: r.postal_code,
    placeName: r.place_name,
    cityFa: r.city_fa,
    attendance: r.attendance,
    venueName: r.venue_name,
    scheduleStatus: r.schedule_status,
    timeZone: r.time_zone,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    dateCount: r.date_count,
    coverKey: covers.get(r.id) ?? null,
  }));
  const last = items.at(-1);
  return { items, next: rows.length > EVENTS_PAGE_SIZE && last ? { startsAt: last.startsAt, id: last.id } : null };
}

/** Cities of a country with upcoming events, for the city filter, most events first */
export async function eventCities(db: Queryable, countryCode: string, now = new Date()) {
  const rows = await db.execute<{ id: string; slug: string; name_fa: string; n: number }>(sql`
    SELECT c.id, c.slug, c.name_fa, count(DISTINCT d.listing_id)::int AS n
    FROM event_dates d
    JOIN listings l ON l.id = d.listing_id AND l.status = 'active'
    JOIN locations c ON c.id = d.location_id
    WHERE d.country_code = ${countryCode} AND d.ends_at > ${now.toISOString()}::timestamptz
    GROUP BY c.id, c.slug, c.name_fa
    ORDER BY n DESC, c.name_fa
    LIMIT 50
  `);
  return rows.map((r) => ({ id: r.id, slug: r.slug, nameFa: r.name_fa, count: r.n }));
}

/** A city of the country by its slug, for ?city= */
export async function cityBySlug(db: Queryable, countryCode: string, slug: string) {
  const [row] = await db
    .select({ id: locations.id, slug: locations.slug, nameFa: locations.nameFa })
    .from(locations)
    .where(and(eq(locations.slug, slug), eq(locations.countryCode, countryCode), eq(locations.kind, 'city')));
  return row ?? null;
}

/** Everything the event page shows: the listing page's data plus the details and every date */
export async function publicEvent(db: Queryable, token: string) {
  const base = await publicListing(db, token);
  if (!base) return null;
  const [details] = await db.select().from(eventDetails).where(eq(eventDetails.listingId, base.listing.id));
  if (!details) return null;
  const dates = await db
    .select({ startsAt: eventDates.startsAt, endsAt: eventDates.endsAt })
    .from(eventDates)
    .where(eq(eventDates.listingId, base.listing.id))
    .orderBy(asc(eventDates.startsAt));
  return { ...base, details, dates };
}

/** Whether a listing is an event (has its details row) */
export async function isEventListing(db: Queryable, listingId: string): Promise<boolean> {
  const [row] = await db.select({ id: eventDetails.listingId }).from(eventDetails).where(eq(eventDetails.listingId, listingId));
  return !!row;
}

/** The owner's event for the edit form */
export async function ownEvent(db: Queryable, userId: string, listingId: string) {
  const [row] = await db
    .select({ listing: listings, details: eventDetails })
    .from(listings)
    .innerJoin(eventDetails, eq(eventDetails.listingId, listings.id))
    .where(and(eq(listings.id, listingId), eq(listings.userId, userId), ne(listings.status, 'deleted')));
  if (!row) return null;
  const dates = await db
    .select({ startsAt: eventDates.startsAt, endsAt: eventDates.endsAt })
    .from(eventDates)
    .where(eq(eventDates.listingId, listingId))
    .orderBy(asc(eventDates.startsAt));
  return { ...row, dates };
}

/** The owner's events, newest first, with the first date and the cover photo */
export async function myEvents(db: Queryable, userId: string) {
  const rows = await db
    .select({ listing: listings, details: eventDetails })
    .from(listings)
    .innerJoin(eventDetails, eq(eventDetails.listingId, listings.id))
    .where(and(eq(listings.userId, userId), ne(listings.status, 'deleted')))
    .orderBy(desc(listings.createdAt))
    .limit(200);
  const ids = rows.map((r) => r.listing.id);
  const [covers, firsts] = await Promise.all([
    coverKeys(db, ids),
    ids.length
      ? db
          .selectDistinctOn([eventDates.listingId], { listingId: eventDates.listingId, startsAt: eventDates.startsAt })
          .from(eventDates)
          .where(inArray(eventDates.listingId, ids))
          .orderBy(eventDates.listingId, asc(eventDates.startsAt))
      : Promise.resolve([]),
  ]);
  const first = new Map(firsts.map((f) => [f.listingId, f.startsAt]));
  return rows.map((r) => ({ ...r, coverKey: covers.get(r.listing.id) ?? null, firstStart: first.get(r.listing.id) ?? null }));
}
