import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { eventDates, eventDetails, listings, locations } from '../../db/schema';
import { normalizePersian } from '../../lib/normalize-persian';
import { placeLabel, placeOfListing, placeValue } from '../listings/places';
import { coverKeys, publicListing } from '../listings/queries';
import type { ActiveSeason } from './seasons';
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
  /** One city's events, with the country's online ones (wave 1: online events are for anyone) */
  locationId?: string | null;
  /** With `locationId`: also events up to this far from the city's centre */
  withinKm?: number | null;
  categoryIds?: string[] | null;
  from: Date;
  to: Date | null;
  /** Online or hybrid only */
  online?: boolean;
  /** In person or hybrid only */
  inPerson?: boolean;
  free?: boolean;
  /** Free, or a ticket up to this much (minor units) */
  maxPriceMinor?: number | null;
  /** Any of these languages */
  languages?: string[] | null;
  /** Words in the title, venue or organiser (the header's box on the events pages) */
  text?: string | null;
  /** For all ages */
  family?: boolean;
  /** 18 and over only */
  adults?: boolean;
  stepFree?: boolean;
  /** A season's events (./seasons.ts): dates in its window and a title naming it */
  season?: ActiveSeason | null;
  /** The next date's start and the listing id of the last event on the previous page */
  after?: { startsAt: Date; id: string } | null;
  /** Only these events (found by keyword search) */
  listingIds?: string[];
  /** Leave this one out (similar events) */
  notId?: string;
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
  /** The neighbourhood covering the venue's point («نویکلن»), when the city has them */
  neighbourhood: string | null;
  attendance: string;
  venueName: string | null;
  organizerName: string | null;
  /** Posted by a verified business */
  organizerVerified: boolean;
  scheduleStatus: string;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  /** Dates in the window that haven't ended, this one included */
  dateCount: number;
  /** People who saved it («۸۶ نفر علاقه‌مند») */
  going: number;
  coverKey: string | null;
};

/** The conditions on an event's next date (alias d), its listing (l) and its details (e) */
function eventConditions(f: EventFilter, now: Date) {
  const dates = sql`
    ${f.countryCode ? sql`d.country_code = ${f.countryCode}` : sql`true`}
    ${f.sellerId ? sql`AND d.listing_id IN (SELECT id FROM listings WHERE user_id = ${f.sellerId} AND organization_id IS NULL)` : sql``}
    AND d.ends_at > ${now.toISOString()}::timestamptz
    AND d.ends_at > ${f.from.toISOString()}::timestamptz
    ${f.to ? sql`AND d.starts_at < ${f.to.toISOString()}::timestamptz` : sql``}
    ${f.season ? sql`AND d.starts_at >= ${f.season.from.toISOString()}::timestamptz AND d.starts_at < ${f.season.to.toISOString()}::timestamptz` : sql``}
    ${f.listingIds ? sql`AND d.listing_id IN (${f.listingIds.length ? sql.join(f.listingIds.map((id) => sql`${id}::uuid`), sql`, `) : sql`NULL`})` : sql``}
    ${f.notId ? sql`AND d.listing_id <> ${f.notId}::uuid` : sql``}`;
  const near = f.locationId
    ? f.withinKm
      ? sql`AND (l.location_id = ${f.locationId} OR e.attendance <> 'in_person'
               OR ST_DWithin(coalesce(l.point, lc.center), (SELECT center FROM locations WHERE id = ${f.locationId}), ${f.withinKm * 1000}))`
      : sql`AND (l.location_id = ${f.locationId} OR e.attendance <> 'in_person')`
    : sql``;
  const words = f.season?.words ?? [];
  const text = f.text ? `%${normalizePersian(f.text).toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const rest = sql`
    ${near}
    ${f.categoryIds?.length ? sql`AND l.category_id IN (${sql.join(f.categoryIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
    ${f.online ? sql`AND e.attendance <> 'in_person'` : sql``}
    ${f.inPerson ? sql`AND e.attendance <> 'online'` : sql``}
    ${f.free ? sql`AND l.price_type = 'free'` : sql``}
    ${f.maxPriceMinor != null ? sql`AND (l.price_type = 'free' OR (l.price_type = 'fixed' AND l.price_minor <= ${f.maxPriceMinor}))` : sql``}
    ${f.languages?.length ? sql`AND e.languages && ARRAY[${sql.join(f.languages.map((x) => sql`${x}`), sql`, `)}]::text[]` : sql``}
    ${text ? sql`AND (lower(l.title_normalized) LIKE ${text} OR lower(coalesce(e.venue_name_normalized, '')) LIKE ${text} OR lower(coalesce(e.organizer_name_normalized, '')) LIKE ${text})` : sql``}
    ${f.family ? sql`AND e.min_age IS NULL` : sql``}
    ${f.adults ? sql`AND e.min_age >= 18` : sql``}
    ${f.stepFree ? sql`AND e.step_free` : sql``}
    ${words.length ? sql`AND (${sql.join(words.map((w) => sql`replace(l.title_normalized, chr(8204), ' ') LIKE ${`%${w.replace(/\u200c/g, ' ')}%`}`), sql` OR `)})` : sql``}`;
  return { dates, rest };
}

/**
 * Upcoming events, each with its next date in the window, soonest first, one page at a time
 * (keyset on the date's start and the listing id). The dates are found through
 * event_dates_country_ends_idx or event_dates_location_ends_idx: only rows not over yet.
 */
export async function upcomingEvents(db: Queryable, f: EventFilter, now = new Date(), pageSize = EVENTS_PAGE_SIZE) {
  if (!f.countryCode && !f.sellerId) throw new Error('upcomingEvents needs a country or a seller');
  const where = eventConditions(f, now);
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
    neighbourhood: string | null;
    attendance: string;
    venue_name: string | null;
    organizer_name: string | null;
    organizer_verified: boolean;
    schedule_status: string;
    time_zone: string;
    starts_at: Date;
    ends_at: Date;
    date_count: number;
    going: number;
  }>(sql`
    WITH next AS (
      SELECT DISTINCT ON (d.listing_id) d.listing_id, d.starts_at, d.ends_at,
             count(*) OVER (PARTITION BY d.listing_id)::int AS date_count
      FROM event_dates d
      WHERE ${where.dates}
      ORDER BY d.listing_id, d.starts_at
    )
    SELECT l.id, l.public_token, l.title, l.category_id, l.price_type, l.price_minor, l.currency,
           l.postal_code, l.place_name, lc.name_fa AS city_fa,
           (SELECT n.name_fa FROM neighbourhoods n
            WHERE l.location_precision IN ('postal_code', 'area') AND n.location_id = l.location_id AND n.is_active
              AND ST_Covers(n.boundary, l.point)
            ORDER BY n.key LIMIT 1) AS neighbourhood,
           e.attendance, e.venue_name, coalesce(e.organizer_name, o.name) AS organizer_name,
           coalesce(o.verification_status = 'verified', false) AS organizer_verified, e.schedule_status, e.time_zone,
           n.starts_at, n.ends_at, n.date_count,
           (SELECT count(*)::int FROM favorites f WHERE f.listing_id = l.id) AS going
    FROM next n
    JOIN listings l ON l.id = n.listing_id AND l.status = 'active'
    JOIN event_details e ON e.listing_id = l.id
    LEFT JOIN locations lc ON lc.id = l.location_id
    LEFT JOIN organizations o ON o.id = l.organization_id
    WHERE true ${where.rest}
      ${f.after ? sql`AND (n.starts_at, l.id) > (${f.after.startsAt.toISOString()}::timestamptz, ${f.after.id}::uuid)` : sql``}
    ORDER BY n.starts_at, l.id
    LIMIT ${pageSize + 1}
  `);
  const page = rows.slice(0, pageSize);
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
    neighbourhood: r.neighbourhood,
    attendance: r.attendance,
    venueName: r.venue_name,
    organizerName: r.organizer_name,
    organizerVerified: r.organizer_verified,
    scheduleStatus: r.schedule_status,
    timeZone: r.time_zone,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    dateCount: r.date_count,
    going: r.going,
    coverKey: covers.get(r.id) ?? null,
  }));
  const last = items.at(-1);
  return { items, next: rows.length > pageSize && last ? { startsAt: last.startsAt, id: last.id } : null };
}

/** How many events a filter finds (the filter sheet's «نمایش ۴ رویداد»), up to `cap` */
export async function countEvents(db: Queryable, f: EventFilter, now = new Date(), cap = 500): Promise<number> {
  const where = eventConditions(f, now);
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT 1
      FROM (SELECT DISTINCT d.listing_id FROM event_dates d WHERE ${where.dates}) n
      JOIN listings l ON l.id = n.listing_id AND l.status = 'active'
      JOIN event_details e ON e.listing_id = l.id
      LEFT JOIN locations lc ON lc.id = l.location_id
      WHERE true ${where.rest}
      LIMIT ${cap}
    ) x`);
  return row?.n ?? 0;
}

/**
 * The local days from `from` on (`days` of them) that have an event, for the dots of the day
 * strip: "2026-10-29". A date over several days marks each of them.
 */
export async function eventDays(db: Queryable, f: Omit<EventFilter, 'from' | 'to'>, timeZone: string, days: number, now = new Date()): Promise<Set<string>> {
  const p = localParts(now, timeZone);
  const end = zonedToUtc({ ...addDays({ y: p.y, m: p.m, d: p.d }, days), h: 0, mi: 0 }, timeZone);
  const where = eventConditions({ ...f, from: now, to: end }, now);
  const rows = await db.execute<{ day: string }>(sql`
    SELECT DISTINCT to_char(g, 'YYYY-MM-DD') AS day
    FROM event_dates d
    JOIN listings l ON l.id = d.listing_id AND l.status = 'active'
    JOIN event_details e ON e.listing_id = l.id
    LEFT JOIN locations lc ON lc.id = l.location_id
    CROSS JOIN LATERAL generate_series(
      date_trunc('day', greatest(d.starts_at, ${now.toISOString()}::timestamptz) AT TIME ZONE ${timeZone}),
      -- A night out (under a day) marks only the evening it starts
      date_trunc('day', (CASE WHEN d.ends_at - d.starts_at < interval '1 day' THEN greatest(d.starts_at, ${now.toISOString()}::timestamptz)
                              ELSE least(d.ends_at, ${end.toISOString()}::timestamptz) - interval '1 second' END) AT TIME ZONE ${timeZone}),
      interval '1 day') AS g
    WHERE ${where.dates} ${where.rest}`);
  return new Set(rows.map((r) => r.day));
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
    .select({ id: locations.id, slug: locations.slug, nameFa: locations.nameFa, timeZone: locations.timezone })
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

export type VenueSuggestion = {
  name: string;
  street: string | null;
  /** The place field's value and label (src/components/place-field.tsx) */
  place: { value: string; label: string; center: { lat: number; lng: number } } | null;
  /** «نویکلن», when the city has neighbourhoods */
  neighbourhood: string | null;
  events: number;
};

/**
 * Venues already on Peydoo in a country whose name has the typed text («Heimathafen» →
 * Heimathafen Neukölln, 3 events), most used first: the posting steps fill the venue, street and
 * place from one tap (wave 1, mockup final/post-event2).
 */
export async function venueSuggestions(db: Queryable, countryCode: string, text: string, limit = 5): Promise<VenueSuggestion[]> {
  const needle = normalizePersian(text).toLowerCase();
  if (needle.length < 2) return [];
  const rows = await db.execute<{ venue_name: string; street_address: string | null; country_code: string; location_id: string; postal_code: string | null; place_name: string | null; neighbourhood: string | null; n: number }>(sql`
    SELECT DISTINCT ON (lower(e.venue_name_normalized), coalesce(e.street_address, ''))
           e.venue_name, e.street_address, l.country_code, l.location_id, l.postal_code, l.place_name,
           (SELECT n.name_fa FROM neighbourhoods n
            WHERE l.location_precision IN ('postal_code', 'area') AND n.location_id = l.location_id AND n.is_active
              AND ST_Covers(n.boundary, l.point)
            ORDER BY n.key LIMIT 1) AS neighbourhood,
           count(*) OVER (PARTITION BY lower(e.venue_name_normalized), coalesce(e.street_address, ''))::int AS n
    FROM event_details e
    JOIN listings l ON l.id = e.listing_id AND l.status IN ('active', 'expired') AND l.country_code = ${countryCode}
    WHERE e.venue_name_normalized IS NOT NULL
      AND strpos(lower(e.venue_name_normalized), ${needle}) > 0
    ORDER BY lower(e.venue_name_normalized), coalesce(e.street_address, ''), l.published_at DESC NULLS LAST
  `);
  const top = rows.sort((a, b) => b.n - a.n).slice(0, limit);
  return Promise.all(
    top.map(async (r) => {
      const p = await placeOfListing(db, { countryCode: r.country_code, locationId: r.location_id, postalCode: r.postal_code, placeName: r.place_name });
      return { name: r.venue_name, street: r.street_address, place: p ? { value: placeValue(p), label: placeLabel(p), center: p.center } : null, neighbourhood: r.neighbourhood, events: r.n };
    }),
  );
}

/** Whether the user has any event that isn't deleted («آگهی‌ها / رویدادها» on «آگهی‌های من») */
export async function hasOwnEvents(db: Queryable, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .innerJoin(eventDetails, eq(eventDetails.listingId, listings.id))
    .where(and(eq(listings.userId, userId), ne(listings.status, 'deleted')))
    .limit(1);
  return !!row;
}
