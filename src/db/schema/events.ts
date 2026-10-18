import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, isIn, matches, textArrayWithin, tstz, updatedAt } from './_columns';
import { countries, listings, locations } from './listings';

// Events («رویدادها», decided Oct 18, 2026): a section of its own for visitors, but each event is
// a listing underneath (title, description, price, place, photos, post-checks, reports, chat),
// plus one event_details row and one event_dates row per date (migration 0010). The listing's
// expires_at is the end of its last date, so the listing expiry job ends the event.

export const EVENT_ATTENDANCE = ['in_person', 'online', 'hybrid'] as const;
export const EVENT_LANGUAGES = ['fa', 'de', 'en', 'other'] as const;
export const EVENT_REPEATS = ['none', 'weekly', 'monthly'] as const;
export const EVENT_SCHEDULE_STATUSES = ['scheduled', 'postponed', 'cancelled'] as const;

const httpsUrl = '^https://[^\\s]{4,}$';

export const eventDetails = pgTable(
  'event_details',
  {
    listingId: uuid('listing_id')
      .primaryKey()
      .references(() => listings.id, { onDelete: 'cascade' }),
    attendance: text('attendance', { enum: EVENT_ATTENDANCE }).notNull().default('in_person'),
    // Public, unlike a listing's place: people have to find the venue
    venueName: text('venue_name'),
    venueNameNormalized: text('venue_name_normalized'),
    streetAddress: text('street_address'),
    /** Shown only to signed-in visitors */
    onlineUrl: text('online_url'),
    ticketUrl: text('ticket_url'),
    organizerName: text('organizer_name'),
    organizerNameNormalized: text('organizer_name_normalized'),
    languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
    /** null: all ages */
    minAge: smallint('min_age'),
    /** IANA zone of the event's city; the form's local times are read in it */
    timeZone: text('time_zone').notNull(),
    repeat: text('repeat', { enum: EVENT_REPEATS }).notNull().default('none'),
    /** Last day a repeating event may fall on, in the event's time zone */
    repeatUntil: date('repeat_until'),
    scheduleStatus: text('schedule_status', { enum: EVENT_SCHEDULE_STATUSES }).notNull().default('scheduled'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('event_details_attendance_check', isIn(t.attendance, EVENT_ATTENDANCE)),
    check('event_details_venue_name_check', sql`char_length(${t.venueName}) BETWEEN 1 AND 100`),
    check('event_details_venue_name_normalized_check', sql`(${t.venueName} IS NULL) = (${t.venueNameNormalized} IS NULL)`),
    check('event_details_street_address_check', sql`char_length(${t.streetAddress}) BETWEEN 1 AND 120`),
    check('event_details_online_url_check', sql`${matches(t.onlineUrl, httpsUrl)} AND char_length(${t.onlineUrl}) <= 500`),
    check('event_details_ticket_url_check', sql`${matches(t.ticketUrl, httpsUrl)} AND char_length(${t.ticketUrl}) <= 500`),
    check('event_details_organizer_name_check', sql`char_length(${t.organizerName}) BETWEEN 1 AND 80`),
    check(
      'event_details_organizer_name_normalized_check',
      sql`(${t.organizerName} IS NULL) = (${t.organizerNameNormalized} IS NULL)`,
    ),
    check('event_details_languages_check', textArrayWithin(t.languages, EVENT_LANGUAGES)),
    check('event_details_min_age_check', sql`${t.minAge} BETWEEN 1 AND 21`),
    check('event_details_time_zone_check', matches(t.timeZone, '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$')),
    check('event_details_repeat_check', isIn(t.repeat, EVENT_REPEATS)),
    check('event_details_repeat_until_check', sql`(${t.repeat} = 'none') = (${t.repeatUntil} IS NULL)`),
    check('event_details_schedule_status_check', isIn(t.scheduleStatus, EVENT_SCHEDULE_STATUSES)),
  ],
);

/**
 * One row per date of an event: one for a one-off or multi-day event, up to 26 for a repeating
 * one. Written only by the events module, which replaces the rows when the dates change. Country
 * and city are copied from the listing, so "upcoming in a country or city" needs no join to sort.
 */
export const eventDates = pgTable(
  'event_dates',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    locationId: uuid('location_id').notNull(),
    startsAt: tstz('starts_at').notNull(),
    endsAt: tstz('ends_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('event_dates_order_check', sql`${t.endsAt} > ${t.startsAt}`),
    // A festival may run over a long weekend, not for weeks
    check('event_dates_duration_check', sql`${t.endsAt} <= ${t.startsAt} + interval '14 days'`),
    foreignKey({
      name: 'event_dates_location_fkey',
      columns: [t.locationId, t.countryCode],
      foreignColumns: [locations.id, locations.countryCode],
    }),
    unique('event_dates_listing_id_starts_at_key').on(t.listingId, t.startsAt),
    // "Not over yet in this country / city": the range on ends_at leaves the past out; the few
    // upcoming rows are then sorted by starts_at
    index('event_dates_country_ends_idx').on(t.countryCode, t.endsAt),
    index('event_dates_location_ends_idx').on(t.locationId, t.endsAt),
  ],
);
