import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { follow, isFollowing, organizerFacts, unfollow } from '../src/modules/events/follows';
import { eventInputSchema, type EventInput } from '../src/modules/events/input';
import {
  claimReminder,
  dueReminders,
  followMessage,
  followNews,
  reminderMessage,
  takeFollowSlot,
  weeklyMessageFor,
  weeklyRecipients,
  FOLLOW_NEWS_PER_DAY,
} from '../src/modules/events/notices';
import { countEvents, eventDays, upcomingEvents, venueSuggestions, type EventFilter } from '../src/modules/events/queries';
import { seasonByKey } from '../src/modules/events/seasons';
import { addFavorite } from '../src/modules/listings/favorites';
import { listingInputSchema, type ListingInput } from '../src/modules/listings/listings';
import { setWeeklyEvents } from '../src/modules/users/notification-prefs';
import { appDb, redis, workerDb } from './accounts';
import { db, publicToken } from './db';
import { categoryBySlug, city, listing, openEverywhereForTests, user } from './listings-fixtures';

// Wave 1, part 6 (mockups final/events, events-filters, event, post-event1–2): the list's new
// filters and day dots, venues from earlier events, following a business, the reminder of a saved
// event, the follower notice with its daily limit, and the weekly message. Run as
// classifieds_app (the web) and classifieds_worker (the notices). Other test files post events
// too, so every check is about this file's own events.

const NOW = new Date('2026-10-18T10:00:00Z');
/** Older than a week: new accounts publish at most two events a day */
const SETTLED = { createdAt: new Date('2026-09-01T10:00:00Z') };
const APP = 'https://peydoo.test';

function listingIn(over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'کنسرت موسیقی ایرانی: گروه نوا',
    description: 'گروه نوا با تار، کمانچه، تنبک و آواز، شبی با تصنیف‌های قدیمی.',
    priceType: 'fixed',
    amount: '35',
    countryCode: 'DE',
    place: '12043',
    ...over,
  });
}

function eventIn(over: Partial<EventInput> = {}): EventInput {
  return eventInputSchema.parse({
    startDate: '2026-11-08',
    startTime: '20:00',
    endTime: '23:00',
    venueName: `Heimathafen ${publicToken()}`,
    streetAddress: 'Karl-Marx-Straße 141',
    languages: ['fa'],
    ...over,
  });
}

async function publish(userId: string, opts: { listing?: Partial<ListingInput>; event?: Partial<EventInput>; slug?: string } = {}) {
  const d = await createEventDraft(appDb, { userId, categoryId: (await categoryBySlug(opts.slug ?? 'event-concerts')).id });
  if (!d.ok) throw new Error(d.reason);
  const r = await saveEvent(appDb, { userId, listingId: d.listingId, input: listingIn(opts.listing), event: eventIn(opts.event), intent: 'publish', now: NOW });
  if (!r.ok) throw new Error(`publish refused: ${JSON.stringify(r)}`);
  return d.listingId;
}

async function business(ownerId: string, verified = true) {
  const name = `نوا پروداکشن ${publicToken()}`;
  const [org] = await db
    .insert(schema.organizations)
    .values({ slug: `org-${publicToken()}`, name, nameNormalized: normalizePersian(name), countryCode: 'DE', createdByUserId: ownerId, verificationStatus: verified ? 'verified' : 'unverified' })
    .returning();
  await db.insert(schema.organizationMembers).values({ organizationId: org!.id, userId: ownerId, role: 'owner' });
  return org!;
}

let closeAgain: () => Promise<void>;
beforeAll(async () => {
  closeAgain = await openEverywhereForTests();
});
afterAll(async () => {
  await closeAgain();
});

describe('the events list (mockups final/events, events-filters)', () => {
  it('filters by who it suits, price, language, how it is held and the season', async () => {
    const u = await user(SETTLED);
    const berlin = await city('berlin');
    const family = await publish(u.id, { event: { languages: ['fa', 'de'] }, listing: { priceType: 'free', amount: '' } });
    const adults = await publish(u.id, { event: { minAge: '18', stepFree: 'yes', languages: ['en'] }, listing: { amount: '15' } });
    const pricey = await publish(u.id, { listing: { amount: '45', title: 'جشن شب یلدا با موسیقی زنده' }, event: { startDate: '2026-12-19', seating: 'numbered' } });
    const online = await publish(u.id, { event: { attendance: 'online', onlineUrl: 'https://zoom.us/j/123', venueName: '' }, listing: { place: '20095' } });
    const mine = [family, adults, pricey, online];
    const base: EventFilter = { countryCode: 'DE', locationId: berlin.id, from: NOW, to: null, listingIds: mine };
    const found = async (f: Partial<EventFilter>) => (await upcomingEvents(appDb, { ...base, ...f }, NOW)).items.map((e) => e.id).sort();

    // A city's list has the country's online events too (Hamburg's here)
    expect(await found({})).toEqual([...mine].sort());
    expect(await found({ family: true })).toEqual([family, online, pricey].sort());
    expect(await found({ adults: true })).toEqual([adults]);
    expect(await found({ stepFree: true })).toEqual([adults]);
    expect(await found({ maxPriceMinor: 2000 })).toEqual([adults, family].sort());
    expect(await found({ languages: ['de', 'en'] })).toEqual([adults, family].sort());
    expect(await found({ inPerson: true })).toEqual([adults, family, pricey].sort());
    expect(await found({ online: true })).toEqual([online]);
    expect(await found({ season: seasonByKey('yalda', NOW, 'Europe/Berlin') })).toEqual([pricey]);
    expect(await found({ text: 'یلدا' })).toEqual([pricey]);
    expect(await found({ text: 'heimathafen' })).toEqual([adults, family, pricey].sort());
    expect(await countEvents(appDb, { ...base, adults: true }, NOW)).toBe(1);

    // The row carries what the list shows
    const [row] = (await upcomingEvents(appDb, { ...base, listingIds: [adults] }, NOW)).items;
    expect(row).toMatchObject({ going: 0, organizerVerified: false, neighbourhood: expect.any(String) });
  });

  it('«تا ۱۰۰ کیلومتر» takes in nearby towns', async () => {
    const u = await user();
    const berlin = await city('berlin');
    // 14167 (Zehlendorf) belongs to Potsdam's area in the postal data
    const potsdam = await publish(u.id, { listing: { place: '14167' } });
    const base: EventFilter = { countryCode: 'DE', locationId: berlin.id, from: NOW, to: null, listingIds: [potsdam] };
    expect((await upcomingEvents(appDb, base, NOW)).items).toHaveLength(0);
    expect((await upcomingEvents(appDb, { ...base, withinKm: 100 }, NOW)).items.map((e) => e.id)).toEqual([potsdam]);
  });

  it('marks the days with something on: a night out only its evening, a festival every day', async () => {
    const u = await user(SETTLED);
    const party = await publish(u.id, { event: { startDate: '2026-10-24', startTime: '23:00', endTime: '04:00' } });
    const festival = await publish(u.id, { event: { startDate: '2026-10-29', endDate: '2026-10-31', startTime: '12:00', endTime: '20:00' } });
    const partyDays = await eventDays(appDb, { countryCode: 'DE', listingIds: [party] }, 'Europe/Berlin', 14, NOW);
    expect([...partyDays]).toEqual(['2026-10-24']);
    const festivalDays = await eventDays(appDb, { countryCode: 'DE', listingIds: [festival] }, 'Europe/Berlin', 14, NOW);
    expect([...festivalDays].sort()).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
  });
});

describe('posting an event (mockups final/post-event1–2)', () => {
  it('suggests venues already on Peydoo, with how many events they had', async () => {
    const u = await user();
    const venue = `Heimathafen ${publicToken()}`;
    await publish(u.id, { event: { venueName: venue } });
    await publish(u.id, { event: { venueName: venue, startDate: '2026-11-20' } });
    const [hit] = await venueSuggestions(appDb, 'DE', venue.slice(0, 18).toLowerCase());
    expect(hit).toMatchObject({ name: venue, street: 'Karl-Marx-Straße 141', events: 2, place: { label: expect.stringContaining('12043') } });
    expect(await venueSuggestions(appDb, 'AT', venue)).toEqual([]);
  });

  it('«ادامه» says what publishing would still refuse, the event fields too', async () => {
    const u = await user();
    const d = await createEventDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('event-concerts')).id });
    if (!d.ok) throw new Error(d.reason);
    const r = await saveEvent(appDb, { userId: u.id, listingId: d.listingId, input: listingIn({ description: '' }), event: eventIn({ startDate: '', venueName: '' }), intent: 'save', now: NOW, check: true });
    expect(r).toMatchObject({ ok: true, missing: { startDate: 'required', venueName: 'required', description: expect.any(String) } });
    expect((await listing(d.listingId)).status).toBe('draft');
  });

  it('keeps the page facts and posts for a business', async () => {
    const owner = await user();
    const org = await business(owner.id);
    const id = await publish(owner.id, {
      listing: { organizationId: org.id },
      event: { seating: 'numbered', stepFree: 'yes', doorSales: 'yes', refundNote: 'تا ۷ روز پیش از کنسرت', performers: [{ name: 'رها صادقی', role: 'آواز' }], endTime: '' },
    });
    const [d] = await db.select().from(schema.eventDetails).where(eq(schema.eventDetails.listingId, id));
    expect(d).toMatchObject({ seating: 'numbered', stepFree: true, doorSales: true, refundNote: 'تا ۷ روز پیش از کنسرت', performers: [{ name: 'رها صادقی', role: 'آواز' }], openEnd: true });
    expect((await listing(id)).organizationId).toBe(org.id);
    expect(await organizerFacts(appDb, { userId: owner.id, organizationId: org.id })).toMatchObject({ events: 1, organizationId: org.id });
  });
});

describe('following a business and its new events', () => {
  it('follow and unfollow; only active businesses', async () => {
    const owner = await user();
    const fan = await user();
    const org = await business(owner.id);
    expect(await follow(appDb, fan.id, org.id)).toEqual({ ok: true, following: true });
    expect(await follow(appDb, fan.id, org.id)).toEqual({ ok: true, following: true });
    expect(await isFollowing(appDb, fan.id, org.id)).toBe(true);
    expect(await unfollow(appDb, fan.id, org.id)).toEqual({ ok: true, following: false });
    expect(await isFollowing(appDb, fan.id, org.id)).toBe(false);
    await db.update(schema.organizations).set({ status: 'suspended' }).where(eq(schema.organizations.id, org.id));
    expect(await follow(appDb, fan.id, org.id)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('a new event reaches followers, not the business’s own members, at most two a day', async () => {
    const owner = await user();
    const staff = await user();
    const fan = await user();
    const org = await business(owner.id);
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: staff.id, role: 'staff' });
    await follow(appDb, fan.id, org.id);
    await follow(appDb, staff.id, org.id);
    const id = await publish(owner.id, { listing: { organizationId: org.id } });
    const news = await followNews(workerDb, id, APP, NOW);
    expect(news?.followers.map((f) => f.userId)).toEqual([fan.id]);
    const out = followMessage(news!, news!.followers[0]!, ['email'], APP);
    expect(out.mail?.subject).toContain(org.name);
    expect(out.mail?.text).toContain('/e/');
    expect(out.telegram).toBeUndefined();

    for (let i = 0; i < FOLLOW_NEWS_PER_DAY; i++) expect(await takeFollowSlot(redis, fan.id, NOW, 'Europe/Berlin')).toBe(true);
    expect(await takeFollowSlot(redis, fan.id, NOW, 'Europe/Berlin')).toBe(false);
    // A private organiser's event has no followers to tell
    expect(await followNews(workerDb, await publish(fan.id), APP, NOW)).toBeNull();
  });
});

describe('reminders for saved events', () => {
  it('the day before, once per date', async () => {
    const owner = await user();
    const fan = await user();
    const id = await publish(owner.id, { event: { startDate: '2026-11-08', startTime: '20:00' } });
    const token = (await listing(id)).publicToken;
    expect(await addFavorite(appDb, null, fan.id, token)).toMatchObject({ ok: true });
    const dayBefore = new Date('2026-11-07T10:00:00Z');
    const mine = async (now: Date) => (await dueReminders(workerDb, APP, now)).filter((r) => r.listingId === id);
    expect(await mine(new Date('2026-11-05T10:00:00Z'))).toHaveLength(0);
    const [due] = await mine(dayBefore);
    expect(due).toMatchObject({ userId: fan.id, line: { title: 'کنسرت موسیقی ایرانی: گروه نوا' } });
    expect(reminderMessage(due!, ['email'], APP).mail?.subject).toContain('کنسرت');
    expect(await claimReminder(workerDb, id, fan.id, due!.startsAt)).toBe(true);
    expect(await claimReminder(workerDb, id, fan.id, due!.startsAt)).toBe(false);
    expect(await mine(dayBefore)).toHaveLength(0);
  });
});

describe('«رویدادهای این هفته در شهر»', () => {
  it('goes to those who asked, with their city’s events of the week', async () => {
    const owner = await user();
    const fan = await user();
    const berlin = await city('berlin');
    await publish(owner.id, { listing: { title: `دورهمی تازه‌واردها ${publicToken()}` }, event: { startDate: '2026-10-18' } });
    await setWeeklyEvents(appDb, fan.id, { cityId: berlin.id, telegramReady: false });
    const [r] = (await weeklyRecipients(workerDb)).filter((x) => x.userId === fan.id);
    expect(r).toMatchObject({ cityId: berlin.id });
    const message = await weeklyMessageFor(workerDb, berlin.id, APP, NOW);
    const out = message!.build(r!, ['email']);
    expect(out.mail?.text).toContain('دورهمی تازه‌واردها');
    expect(out.mail?.text).toContain('/germany/berlin/events');
    await setWeeklyEvents(appDb, fan.id, 'off');
    expect((await weeklyRecipients(workerDb)).filter((x) => x.userId === fan.id)).toHaveLength(0);
  });
});
