import { and, asc, eq, gt, ne, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { eventDates, eventDetails, listings, locations, outboxEvents, users } from '../../db/schema';
import { cachedCatalog, isEventCategory } from '../listings/catalog';
import { recordChange } from '../listings/events';
import {
  createDraft,
  publishedInLastDay,
  saveListing,
  type FieldErrors,
  type ListingExtension,
  type ListingInput,
  type Refused,
  type SaveResult,
} from '../listings/listings';
import { isNewAccount } from '../users/new-account';
import { canPostListing, loadActor } from '../users/permissions';
import { EVENT_PRICE_TYPES, prepareEventFields, type EventDate, type EventDetailsValues, type EventInput } from './input';
import { isTimeZone } from './time';

// Posting and managing events (decided Oct 18, 2026). An event is a listing in the events
// section plus its event_details row and one event_dates row per date. Everything the listings
// module does for a listing (owner check, verified phone, history, outbox, post-checks, photos)
// happens for an event too: this module creates and saves events through it, adding its fields
// with a ListingExtension in the same transaction. The listing's expires_at is the end of the last
// date, so the listing expiry job ends the event.

type Listing = typeof listings.$inferSelect;
type Details = typeof eventDetails.$inferSelect;

/** event.<what>: outbox events for channel posting (n8n to Telegram, later) */
export const EVENT_OUTBOX = {
  published: 'event.published',
  /** Dates, place or postponement changed */
  changed: 'event.changed',
  cancelled: 'event.cancelled',
  /** Monday morning: the coming week's events of one country (./digest.ts) */
  weeklyDigest: 'event_digest.weekly',
} as const;

/** A new account may publish this many events in 24 hours */
export const EVENTS_PER_DAY = 5;
/** The same for accounts in their first 7 days (src/modules/users/new-account.ts) */
export const NEW_ACCOUNT_EVENTS_PER_DAY = 2;
/** Until the event has a place, its times are read in this zone (both open countries use it) */
export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

async function writeOutbox(tx: Queryable, eventType: string, listingId: string, payload: Record<string, unknown>) {
  await tx.insert(outboxEvents).values({ eventType, aggregateType: 'event', aggregateId: listingId, payload });
}

/** Starts an event in one of the section's categories (the event type) */
export function createEventDraft(
  db: Db,
  { userId, categoryId }: { userId: string; categoryId: string },
): Promise<{ ok: true; listingId: string } | Refused> {
  return createDraft(db, {
    userId,
    categoryId,
    afterCreate: async (tx, listingId) => {
      await tx.insert(eventDetails).values({ listingId, timeZone: DEFAULT_TIME_ZONE });
    },
  });
}

async function cityTimeZone(tx: Queryable, locationId: string): Promise<string | null> {
  const [row] = await tx.select({ tz: locations.timezone }).from(locations).where(eq(locations.id, locationId));
  return row && isTimeZone(row.tz) ? row.tz : null;
}

const sameDates = (a: EventDate[], b: EventDate[]) =>
  a.length === b.length && a.every((d, i) => d.startsAt.getTime() === b[i]!.startsAt.getTime() && d.endsAt.getTime() === b[i]!.endsAt.getTime());

const DETAIL_FIELDS = [
  'attendance',
  'venueName',
  'streetAddress',
  'onlineUrl',
  'ticketUrl',
  'organizerName',
  'languages',
  'minAge',
  'timeZone',
  'repeat',
  'repeatUntil',
  'scheduleStatus',
] as const;

function detailsDiff(before: Details, after: EventDetailsValues): Record<string, [unknown, unknown]> {
  const diff: Record<string, [unknown, unknown]> = {};
  for (const f of DETAIL_FIELDS) {
    if (JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null)) diff[f] = [before[f] ?? null, after[f] ?? null];
  }
  return diff;
}

/** The extension that adds an event's fields to saveListing */
function eventExtension(input: EventInput, listingInput: ListingInput): ListingExtension {
  return {
    async prepare(tx, { current, place, mode, goingOut, now }) {
      const [details] = await tx.select().from(eventDetails).where(eq(eventDetails.listingId, current.id)).for('update');
      if (!details) throw new Error(`event ${current.id} has no event_details row`);
      const before = await tx
        .select({ startsAt: eventDates.startsAt, endsAt: eventDates.endsAt })
        .from(eventDates)
        .where(eq(eventDates.listingId, current.id))
        .orderBy(asc(eventDates.startsAt));

      const timeZone = (place && (await cityTimeZone(tx, place.locationId))) || details.timeZone;
      const r = prepareEventFields(input, { timeZone, mode, goingOut, now });
      const errors: FieldErrors = r.ok ? {} : { ...r.errors };
      if (!(EVENT_PRICE_TYPES as readonly string[]).includes(listingInput.priceType)) errors.priceType = 'not_allowed';
      if (!r.ok || Object.keys(errors).length) return { ok: false, errors };

      const { values, dates } = r;
      const diff = detailsDiff(details, values);
      const datesChanged = !sameDates(before, dates);
      if (datesChanged) diff.dates = [before.map((d) => d.startsAt), dates.map((d) => d.startsAt)];
      const expiresAt = dates.length ? new Date(Math.max(...dates.map((d) => d.endsAt.getTime()))) : null;

      return {
        ok: true,
        expiresAt,
        diff,
        async write(tx, { listing, status, goingOut }) {
          await tx.update(eventDetails).set(values).where(eq(eventDetails.listingId, listing.id));
          // Dates carry the listing's country and city; a draft without a place keeps none yet
          const placeChanged = listing.locationId !== current.locationId;
          if (datesChanged || placeChanged) {
            await tx.delete(eventDates).where(eq(eventDates.listingId, listing.id));
            if (dates.length && listing.countryCode && listing.locationId) {
              await tx.insert(eventDates).values(
                dates.map((d) => ({ listingId: listing.id, countryCode: listing.countryCode!, locationId: listing.locationId!, ...d })),
              );
            }
          }
          if (status === 'draft' || status === 'pending_review') return;
          const payload = { country: listing.countryCode, starts: dates.map((d) => d.startsAt.toISOString()) };
          if (goingOut) await writeOutbox(tx, EVENT_OUTBOX.published, listing.id, payload);
          else if (values.scheduleStatus === 'cancelled' && details.scheduleStatus !== 'cancelled') {
            await writeOutbox(tx, EVENT_OUTBOX.cancelled, listing.id, payload);
          } else if (datesChanged || placeChanged || values.scheduleStatus !== details.scheduleStatus) {
            await writeOutbox(tx, EVENT_OUTBOX.changed, listing.id, { ...payload, scheduleStatus: values.scheduleStatus });
          }
        },
      };
    },
  };
}

export type SaveEventResult = SaveResult | { ok: false; reason: 'too_many_events' };

/**
 * Saves the event form: the listing fields through the listings module, the event's own fields
 * with them. An event that has ended can't be edited; "post again" copies it instead.
 */
export async function saveEvent(
  db: Db,
  opts: { userId: string; listingId: string; input: ListingInput; event: EventInput; intent: 'save' | 'publish'; now?: Date },
): Promise<SaveEventResult> {
  const now = opts.now ?? new Date();
  const [current] = await db
    .select({ status: listings.status, publishedAt: listings.publishedAt })
    .from(listings)
    .where(and(eq(listings.id, opts.listingId), eq(listings.userId, opts.userId), ne(listings.status, 'deleted')));
  if (!current) return { ok: false, reason: 'not_found' };
  if (current.status === 'expired') return { ok: false, reason: 'not_allowed' };
  if (opts.intent === 'publish' && current.status === 'draft') {
    const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, opts.userId));
    const fresh = !!user && isNewAccount(user.createdAt, now);
    const published = await publishedInLastDay(db, opts.userId, now, 'events');
    if (published >= (fresh ? NEW_ACCOUNT_EVENTS_PER_DAY : EVENTS_PER_DAY)) {
      return { ok: false, reason: fresh ? 'new_account_limit' : 'too_many_events' };
    }
  }
  return saveListing(db, {
    userId: opts.userId,
    listingId: opts.listingId,
    // Events have no "wanted" kind, no shipping and no district (the venue and address say where)
    input: { ...opts.input, kind: 'offer', shippingOffered: false, district: '' },
    intent: opts.intent,
    now,
    extension: eventExtension(opts.event, opts.input),
  });
}

/** Cancels a live event in one tap: it stays visible, marked cancelled, until its last date ends */
export async function cancelEvent(
  db: Db,
  { userId, listingId }: { userId: string; listingId: string },
): Promise<{ ok: true } | Refused> {
  return db.transaction(async (tx) => {
    const actor = await loadActor(tx, userId);
    if (!actor || actor.status !== 'active') return { ok: false, reason: actor ? 'account_disabled' : 'sign_in_required' };
    const [row] = await tx
      .select({ listing: listings, details: eventDetails })
      .from(listings)
      .innerJoin(eventDetails, eq(eventDetails.listingId, listings.id))
      .where(and(eq(listings.id, listingId), eq(listings.userId, userId)))
      .for('update');
    if (!row || !['active', 'paused'].includes(row.listing.status) || row.details.scheduleStatus === 'cancelled') {
      return { ok: false, reason: row ? 'not_allowed' : 'not_found' };
    }
    const revision = row.listing.revision + 1;
    await tx.update(eventDetails).set({ scheduleStatus: 'cancelled' }).where(eq(eventDetails.listingId, listingId));
    await tx.update(listings).set({ revision }).where(eq(listings.id, listingId));
    await recordChange(tx, {
      listingId,
      event: 'edited',
      outbox: null,
      actorType: 'user',
      actorUserId: userId,
      from: row.listing.status,
      to: row.listing.status,
      revision,
      data: { scheduleStatus: [row.details.scheduleStatus, 'cancelled'] },
    });
    await writeOutbox(tx, EVENT_OUTBOX.cancelled, listingId, { country: row.listing.countryCode });
    return { ok: true };
  });
}

/**
 * "Post again": a new draft with the same type, text, price, place and details, without dates
 * and photos. For an event that has ended, or the next one of a kind.
 */
export async function copyEvent(
  db: Db,
  { userId, listingId }: { userId: string; listingId: string },
): Promise<{ ok: true; listingId: string } | Refused> {
  const [source] = await db
    .select({ listing: listings, details: eventDetails })
    .from(listings)
    .innerJoin(eventDetails, eq(eventDetails.listingId, listings.id))
    .where(and(eq(listings.id, listingId), eq(listings.userId, userId), ne(listings.status, 'deleted')));
  if (!source?.listing.categoryId) return { ok: false, reason: 'not_found' };
  const catalog = await cachedCatalog(db);
  if (!isEventCategory(catalog, source.listing.categoryId)) return { ok: false, reason: 'not_found' };
  const s = source.listing;
  const d = source.details;
  return createDraft(db, {
    userId,
    categoryId: s.categoryId!,
    afterCreate: async (tx, newId) => {
      await tx
        .update(listings)
        .set({
          title: s.title,
          titleNormalized: s.titleNormalized,
          description: s.description,
          descriptionNormalized: s.descriptionNormalized,
          priceType: s.priceType,
          priceMinor: s.priceMinor,
          currency: s.currency,
          countryCode: s.countryCode,
          locationId: s.locationId,
          postalCode: s.postalCode,
          placeName: s.placeName,
          point: s.point,
          locationPrecision: s.locationPrecision,
          allowPhoneContact: s.allowPhoneContact,
        })
        .where(eq(listings.id, newId));
      await tx.insert(eventDetails).values({
        listingId: newId,
        attendance: d.attendance,
        venueName: d.venueName,
        venueNameNormalized: d.venueNameNormalized,
        streetAddress: d.streetAddress,
        onlineUrl: d.onlineUrl,
        ticketUrl: d.ticketUrl,
        organizerName: d.organizerName,
        organizerNameNormalized: d.organizerNameNormalized,
        languages: d.languages,
        minAge: d.minAge,
        timeZone: d.timeZone,
      });
    },
  });
}

/** Whether the user may post events now (the same rule as listings: a verified phone) */
export async function canPostEvent(db: Queryable, userId: string) {
  return canPostListing(await loadActor(db, userId));
}

/** The text and links of an event for the post-checks (src/modules/moderation/checks.ts) */
export async function eventCheckFields(
  db: Queryable,
  listingId: string,
): Promise<{ text: string; links: string[] } | null> {
  const [d] = await db.select().from(eventDetails).where(eq(eventDetails.listingId, listingId));
  if (!d) return null;
  return {
    text: [d.venueName, d.streetAddress, d.organizerName].filter(Boolean).join('\n'),
    links: [d.ticketUrl, d.onlineUrl].filter((l): l is string => !!l),
  };
}

/** The dates of an event that haven't ended, first first */
export async function upcomingDates(db: Queryable, listingId: string, now = new Date()): Promise<EventDate[]> {
  return db
    .select({ startsAt: eventDates.startsAt, endsAt: eventDates.endsAt })
    .from(eventDates)
    .where(and(eq(eventDates.listingId, listingId), gt(eventDates.endsAt, now)))
    .orderBy(asc(eventDates.startsAt));
}

export type { Listing as EventListing };
