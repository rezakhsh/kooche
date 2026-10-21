import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { writeWeeklyDigests } from '../src/modules/events/digest';
import { cancelEvent, copyEvent, createEventDraft, saveEvent, EVENTS_PER_DAY } from '../src/modules/events/events';
import { eventInputSchema, type EventInput } from '../src/modules/events/input';
import { cityBySlug, myEvents, upcomingEvents } from '../src/modules/events/queries';
import {
  canApply,
  changeDraftCategory,
  changeListingStatus,
  createDraft,
  expireDueListings,
  listingInputSchema,
  saveListing,
  type ListingInput,
} from '../src/modules/listings/listings';
import { myListings } from '../src/modules/listings/queries';
import { browseListings } from '../src/modules/search/browse';
import { runListingChecks } from '../src/modules/moderation/checks';
import { sendExpiryReminders } from '../src/modules/notifications/expiry-reminder';
import type { Mail } from '../src/modules/notifications/mailer';
import { appDb, redis, workerDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, rollback, setRole } from './db';
import { categoryBySlug, city, events, listing, outbox, user } from './listings-fixtures';

// The events section (decided Oct 18, 2026): an event is a listing in the events section with its
// details and dates. Run as classifieds_app (posting) and classifieds_worker (expiry, checks,
// digest). Times are relative to a fixed "now" passed to the functions.

const DAY = 86_400_000;
const NOW = new Date('2026-10-18T10:00:00Z');

function listingIn(over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'شب یلدا با موسیقی زنده',
    description: 'شام ایرانی، حافظ‌خوانی و موسیقی زنده با گروه نوا.',
    priceType: 'fixed',
    amount: '25',
    countryCode: 'DE',
    place: '12045',
    ...over,
  });
}

function eventIn(over: Partial<EventInput> = {}): EventInput {
  return eventInputSchema.parse({
    startDate: '2026-12-19',
    startTime: '20:00',
    endTime: '23:30',
    venueName: 'Kulturhaus Neukölln',
    streetAddress: 'Karl-Marx-Straße 141',
    organizerName: 'انجمن فرهنگی نوا',
    languages: ['fa'],
    ...over,
  });
}

async function draftFor(userId: string, slug = 'event-celebrations') {
  const r = await createEventDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!r.ok) throw new Error(`createEventDraft refused: ${r.reason}`);
  return r.listingId;
}

async function publishEvent(userId: string, opts: { listing?: Partial<ListingInput>; event?: Partial<EventInput>; slug?: string; now?: Date } = {}) {
  const id = await draftFor(userId, opts.slug);
  const r = await saveEvent(appDb, {
    userId,
    listingId: id,
    input: listingIn(opts.listing),
    event: eventIn(opts.event),
    intent: 'publish',
    now: opts.now ?? NOW,
  });
  if (!r.ok) throw new Error(`publish refused: ${JSON.stringify(r)}`);
  return id;
}

async function dates(listingId: string) {
  return db.select().from(schema.eventDates).where(eq(schema.eventDates.listingId, listingId)).orderBy(schema.eventDates.startsAt);
}

async function details(listingId: string) {
  const [d] = await db.select().from(schema.eventDetails).where(eq(schema.eventDetails.listingId, listingId));
  return d!;
}

describe('who may post events', () => {
  it('only a verified user, like listings', async () => {
    const u = await user({ verified: false });
    expect(await createEventDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('event-concerts')).id })).toEqual({
      ok: false,
      reason: 'phone_required',
    });
  });

  it('events only in the events section, and only through the events module', async () => {
    const u = await user();
    // An event type through the plain listing path, and a listing category through the events path
    expect(await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('event-concerts')).id })).toEqual({
      ok: false,
      reason: 'category_not_postable',
    });
    expect(await createEventDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('mobile-phones')).id })).toEqual({
      ok: false,
      reason: 'category_not_postable',
    });
    // An event can't be saved without its dates, nor moved out of the section
    const id = await draftFor(u.id);
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: listingIn(), intent: 'publish', now: NOW })).toEqual({
      ok: false,
      reason: 'category_not_postable',
    });
    expect(await changeDraftCategory(appDb, { userId: u.id, listingId: id, categoryId: (await categoryBySlug('mobile-phones')).id })).toEqual({
      ok: false,
      reason: 'category_not_postable',
    });
    expect(await changeDraftCategory(appDb, { userId: u.id, listingId: id, categoryId: (await categoryBySlug('event-concerts')).id })).toEqual({ ok: true });
  });

  it('nobody but the organizer edits, cancels or copies an event', async () => {
    const owner = await user();
    const other = await user();
    const id = await publishEvent(owner.id);
    const r = await saveEvent(appDb, { userId: other.id, listingId: id, input: listingIn({ title: 'ربوده' }), event: eventIn(), intent: 'save', now: NOW });
    expect(r).toEqual({ ok: false, reason: 'not_found' });
    expect(await cancelEvent(appDb, { userId: other.id, listingId: id })).toEqual({ ok: false, reason: 'not_found' });
    expect(await copyEvent(appDb, { userId: other.id, listingId: id })).toEqual({ ok: false, reason: 'not_found' });
    expect(await changeListingStatus(appDb, { userId: other.id, listingId: id, action: 'pause' })).toEqual({ ok: false, reason: 'not_found' });
    expect((await listing(id)).title).toBe('شب یلدا با موسیقی زنده');
  });

  it(`at most ${EVENTS_PER_DAY} new events a day per account`, async () => {
    const u = await user();
    for (let i = 0; i < EVENTS_PER_DAY; i++) await publishEvent(u.id);
    const id = await draftFor(u.id);
    expect(await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn(), intent: 'publish', now: NOW })).toEqual({
      ok: false,
      reason: 'too_many_events',
    });
  });

  it('only free, a ticket price or "at the door"; no negotiating or exchange', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const r = await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn({ priceType: 'negotiable' }), event: eventIn(), intent: 'publish', now: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'invalid', errors: { priceType: 'not_allowed' } });
  });
});

describe('publishing', () => {
  it('stores the dates in UTC, read in the city time zone, and the listing ends with the event', async () => {
    const u = await user();
    const id = await publishEvent(u.id, { event: { startTime: '22:00', endTime: '03:00' } });
    const l = await listing(id);
    expect(l).toMatchObject({ status: 'active', countryCode: 'DE', postalCode: '12045', currency: 'EUR', priceMinor: 2500, kind: 'offer' });
    const d = await dates(id);
    expect(d.map((x) => [x.startsAt.toISOString(), x.endsAt.toISOString()])).toEqual([['2026-12-19T21:00:00.000Z', '2026-12-20T02:00:00.000Z']]);
    expect(d[0]).toMatchObject({ countryCode: 'DE', locationId: (await city('berlin')).id });
    expect(l.expiresAt).toEqual(new Date('2026-12-20T02:00:00.000Z'));
    expect(await details(id)).toMatchObject({ timeZone: 'Europe/Berlin', venueName: 'Kulturhaus Neukölln', organizerName: 'انجمن فرهنگی نوا' });
    expect(await outbox(id)).toEqual(['listing.created', 'listing.published', 'event.published']);
  });

  it('a repeating event: one row per date, ending with the last', async () => {
    const u = await user();
    const id = await publishEvent(u.id, { slug: 'event-workshops', event: { startDate: '2026-11-04', startTime: '18:30', endTime: '20:00', repeat: 'weekly', repeatUntil: '2026-12-02' } });
    const d = await dates(id);
    expect(d).toHaveLength(5);
    expect((await listing(id)).expiresAt).toEqual(d.at(-1)!.endsAt);
  });

  it('in Austria: the Vienna time zone and city, the country currency', async () => {
    const u = await user();
    const id = await publishEvent(u.id, { listing: { countryCode: 'AT', place: '1100' } });
    expect(await listing(id)).toMatchObject({ countryCode: 'AT', currency: 'EUR' });
    expect(await details(id)).toMatchObject({ timeZone: 'Europe/Vienna' });
    expect((await dates(id))[0]).toMatchObject({ countryCode: 'AT', locationId: (await city('wien')).id });
  });

  it('not in a closed country, and not without a place', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const closed = await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn({ countryCode: 'TR', place: 'Istanbul' }), event: eventIn(), intent: 'publish', now: NOW });
    expect(closed).toMatchObject({ ok: false, errors: { countryCode: 'invalid' } });
    const nowhere = await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn({ place: '' }), event: eventIn(), intent: 'publish', now: NOW });
    expect(nowhere).toMatchObject({ ok: false, errors: { place: 'required' } });
  });

  it('listing and event errors come back together', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const r = await saveEvent(appDb, {
      userId: u.id,
      listingId: id,
      input: listingIn({ title: '' }),
      event: eventIn({ startDate: '2026-10-01', ticketUrl: 'https://bit.ly/x' }),
      intent: 'publish',
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, errors: { title: 'required', startDate: 'in_past', ticketUrl: 'short_link' } });
    expect((await listing(id)).status).toBe('draft');
  });

  it('a draft keeps its dates once it has a place; drafts write no outbox', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const r = await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn({ title: '' }), event: eventIn(), intent: 'save', now: NOW });
    expect(r).toMatchObject({ ok: true, status: 'draft' });
    expect(await dates(id)).toHaveLength(1);
    expect(await outbox(id)).toEqual(['listing.created']);
  });
});

describe('editing and ending', () => {
  it('new dates move the end, and the change goes to history and the outbox', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    const r = await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn({ startDate: '2026-12-20' }), intent: 'save', now: NOW });
    expect(r).toMatchObject({ ok: true, status: 'active' });
    expect((await listing(id)).expiresAt).toEqual(new Date('2026-12-20T22:30:00.000Z'));
    const edited = (await events(id)).find((e) => e.eventType === 'edited');
    expect(Object.keys(edited!.data as object)).toContain('dates');
    expect(await outbox(id)).toEqual(['listing.created', 'listing.published', 'event.published', 'listing.updated', 'event.changed']);
  });

  it('expires after its last date, and an ended event is copied, not renewed or edited', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    const end = (await listing(id)).expiresAt!;
    expect(await expireDueListings(workerDb, new Date(end.getTime() - 60_000))).toBeGreaterThanOrEqual(0);
    expect((await listing(id)).status).toBe('active');
    await expireDueListings(workerDb, new Date(end.getTime() + 60_000));
    expect((await listing(id)).status).toBe('expired');
    expect(await dates(id)).toHaveLength(1);

    const after = new Date(end.getTime() + DAY);
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'renew', now: after })).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn({ startDate: '2027-01-10' }), intent: 'save', now: after })).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    const copy = await copyEvent(appDb, { userId: u.id, listingId: id });
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(await listing(copy.listingId)).toMatchObject({ status: 'draft', title: 'شب یلدا با موسیقی زنده', postalCode: '12045' });
    expect(await details(copy.listingId)).toMatchObject({ venueName: 'Kulturhaus Neukölln', scheduleStatus: 'scheduled', repeat: 'none' });
    expect(await dates(copy.listingId)).toHaveLength(0);
  });

  it('no "sold", no renewing in its last days, no resuming once over', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    const end = (await listing(id)).expiresAt!;
    const lastDays = new Date(end.getTime() - DAY);
    expect(canApply('renew', { status: 'active', expiresAt: end, isEvent: true }, lastDays)).toBe(false);
    expect(canApply('renew', { status: 'active', expiresAt: end }, lastDays)).toBe(true);
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'sold', now: NOW })).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'pause', now: NOW })).toEqual({ ok: true, status: 'paused' });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'resume', now: new Date(end.getTime() + 60_000) })).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'resume', now: NOW })).toEqual({ ok: true, status: 'active' });
    expect((await listing(id)).expiresAt).toEqual(end);
  });

  it('gets no "renew your listing" email', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    const now = new Date((await listing(id)).expiresAt!.getTime() - 2.5 * DAY);
    const sent: Mail[] = [];
    await sendExpiryReminders(workerDb, redis, async (m: Mail) => void sent.push(m), 'https://staging.example.test', now);
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(0);
  });

  it('cancelling keeps it visible, marked, and tells the outbox', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    expect(await cancelEvent(appDb, { userId: u.id, listingId: id })).toEqual({ ok: true });
    expect(await cancelEvent(appDb, { userId: u.id, listingId: id })).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await details(id)).toMatchObject({ scheduleStatus: 'cancelled' });
    expect((await listing(id)).status).toBe('active');
    expect((await outbox(id)).at(-1)).toBe('event.cancelled');
  });
});

describe('lists', () => {
  it('upcoming events of a country, soonest first, by city, type, online and free, one page at a time', async () => {
    const u = await user();
    // Far in the future, so other tests' events are all earlier and these are the last ones
    const base = new Date('2027-09-01T10:00:00Z');
    const later = await publishEvent(u.id, { now: base, event: { startDate: '2027-09-20' } });
    const sooner = await publishEvent(u.id, { now: base, slug: 'event-concerts', event: { startDate: '2027-09-10' }, listing: { priceType: 'free', amount: '' } });
    const online = await publishEvent(u.id, { now: base, slug: 'event-talks', event: { startDate: '2027-09-15', attendance: 'online', onlineUrl: 'https://zoom.us/j/1' } });
    const vienna = await publishEvent(u.id, { now: base, event: { startDate: '2027-09-12' }, listing: { countryCode: 'AT', place: '1100' } });

    const from = new Date('2027-09-05T00:00:00Z');
    const ids = async (f: Partial<Parameters<typeof upcomingEvents>[1]> = {}) =>
      (await upcomingEvents(appDb, { countryCode: 'DE', from, to: null, ...f }, from)).items.map((e) => e.id);
    expect(await ids()).toEqual([sooner, online, later]);
    expect(await ids({ countryCode: 'AT' })).toEqual([vienna]);
    expect(await ids({ free: true })).toEqual([sooner]);
    expect(await ids({ online: true })).toEqual([online]);
    expect(await ids({ categoryIds: [(await categoryBySlug('event-concerts')).id] })).toEqual([sooner]);
    const berlin = await cityBySlug(appDb, 'DE', 'berlin');
    expect(await ids({ locationId: berlin!.id })).toEqual([sooner, online, later]);
    expect(await cityBySlug(appDb, 'AT', 'berlin')).toBeNull();
    expect(await ids({ to: new Date('2027-09-16T00:00:00Z') })).toEqual([sooner, online]);
    // Keyset paging continues after the last one shown
    const first = (await upcomingEvents(appDb, { countryCode: 'DE', from, to: null }, from)).items[0]!;
    expect(await ids({ after: { startsAt: first.startsAt, id: first.id } })).toEqual([online, later]);
    // A paused event and an ended one are not listed
    await changeListingStatus(appDb, { userId: u.id, listingId: online, action: 'pause', now: base });
    expect(await ids()).toEqual([sooner, later]);
    expect((await upcomingEvents(appDb, { countryCode: 'DE', from, to: null }, new Date('2027-09-30T00:00:00Z'))).items).toEqual([]);
  });

  it('events stay out of the listing grid and "my listings", and are in "my events"', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    const grid = await browseListings(
      appDb,
      { countryCode: 'DE', categoryIds: null, locationId: null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest' },
      null,
    );
    expect(grid.items.some((l) => l.id === id)).toBe(false);
    expect((await myListings(appDb, u.id)).some((r) => r.listing.id === id)).toBe(false);
    expect((await myEvents(appDb, u.id)).map((r) => r.listing.id)).toEqual([id]);
  });
});

describe('post-checks and digest', () => {
  it('a banned term in the venue or organizer takes the event down', async () => {
    const u = await user();
    const id = await publishEvent(u.id, { event: { organizerName: 'صرافی و حواله ارز به ایران' } });
    expect(await runListingChecks(workerDb, id)).toBe('taken_down');
    expect((await listing(id)).status).toBe('rejected');
    const [decision] = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, id));
    expect(decision!.contentSnapshot).toMatchObject({ event: { text: expect.stringContaining('حواله') } });
  });

  it('a shortener link that slipped in is taken down too', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    await db.update(schema.eventDetails).set({ ticketUrl: 'https://bit.ly/abc' }).where(eq(schema.eventDetails.listingId, id));
    expect(await runListingChecks(workerDb, id)).toBe('taken_down');
    const [decision] = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, id));
    expect(decision).toMatchObject({ policyGround: 'terms-4.6', statementFa: expect.stringContaining('بند ۴.۶ شرایط استفاده') });
  });

  it('the weekly digest: one outbox event per country with events that week', async () => {
    const u = await user();
    const monday = new Date('2028-03-06T07:00:00Z');
    const de = await publishEvent(u.id, { now: new Date('2028-03-01T00:00:00Z'), event: { startDate: '2028-03-08' } });
    await publishEvent(u.id, { now: new Date('2028-03-01T00:00:00Z'), event: { startDate: '2028-03-20' } });
    expect(await writeWeeklyDigests(workerDb, 'Europe/Berlin', monday)).toBe(1);
    const [row] = await db
      .select()
      .from(schema.outboxEvents)
      .where(and(eq(schema.outboxEvents.eventType, 'event_digest.weekly'), eq(schema.outboxEvents.aggregateType, 'event_digest')))
      .orderBy(schema.outboxEvents.id);
    expect(row!.payload).toMatchObject({ country: 'DE', total: 1, listingIds: [de] });
  });
});

describe('grants', () => {
  it('the worker reads events but never writes them', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_worker');
      await expectError(
        tx.insert(schema.eventDetails).values({ listingId: '00000000-0000-7000-8000-000000000000', timeZone: 'Europe/Berlin' }),
        INSUFFICIENT_PRIVILEGE,
      );
    });
  });
});

describe('an event keeps its country (decided Oct 17, 2026, like every listing)', () => {
  it('a published event in Germany cannot be moved to Austria', async () => {
    const u = await user();
    const id = await publishEvent(u.id);
    const r = await saveEvent(appDb, {
      userId: u.id,
      listingId: id,
      input: listingIn({ countryCode: 'AT', place: '1010' }),
      event: eventIn(),
      intent: 'save',
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, errors: { countryCode: 'locked' } });
    expect(await listing(id)).toMatchObject({ countryCode: 'DE', postalCode: '12045' });
  });
});
