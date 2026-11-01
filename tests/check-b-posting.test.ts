import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { detectRisks } from '../src/modules/chat/risk';
import { writeWeeklyDigests } from '../src/modules/events/digest';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema, type EventInput } from '../src/modules/events/input';
import { dueReminders, reminderMessage, weeklyMessageFor } from '../src/modules/events/notices';
import { localParts } from '../src/modules/events/time';
import { addFavorite } from '../src/modules/listings/favorites';
import { createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { appealDeadline } from '../src/modules/moderation/appeals';
import { runListingChecks } from '../src/modules/moderation/checks';
import { restoreListing, takeDownListing, type Grounds } from '../src/modules/moderation/decide';
import { createBusiness, updateBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { applyWebhookEvent, followEventEnd } from '../src/modules/payments/apply';
import { startListingCheckout } from '../src/modules/payments/checkout';
import { withdrawalRefund } from '../src/modules/payments/withdrawals';
import { checkDisplayName } from '../src/modules/users/profile';
import { appDb, workerDb } from './accounts';
import { db, makeListing, publicToken, type Tx } from './db';
import { categoryBySlug, city, listing, openEverywhereForTests, user } from './listings-fixtures';
import { event, FakeGateway, orderRow, paidSession, seedCatalog, storeEvent } from './payments-fixtures';

// Check B, package 2 (posting, chat and events, approved Nov 1, 2026): the posting rules hold on
// live edits, events keep their own end and their featured time, postponed events aren't announced
// at their old time, «فردا» means tomorrow, automatic take-downs are told, the chat filter sees
// through disguised numbers, and nobody opens a business as Peydoo's support.

const DAY = 86_400_000;
const APP = 'https://peydoo.test';
const NOW = new Date('2026-10-18T10:00:00Z');
const tx = db as unknown as Tx;

let closeAgain: () => Promise<void>;
beforeAll(async () => {
  await seedCatalog();
  closeAgain = await openEverywhereForTests();
});
afterAll(async () => {
  await closeAgain();
});

function eventListing(over: Partial<ListingInput> = {}): ListingInput {
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

async function publishEvent(userId: string, opts: { listing?: Partial<ListingInput>; event?: Partial<EventInput>; now?: Date } = {}) {
  const d = await createEventDraft(appDb, { userId, categoryId: (await categoryBySlug('event-concerts')).id });
  if (!d.ok) throw new Error(d.reason);
  const r = await saveEvent(appDb, { userId, listingId: d.listingId, input: eventListing(opts.listing), event: eventIn(opts.event), intent: 'publish', now: opts.now ?? NOW });
  if (!r.ok) throw new Error(`publish refused: ${JSON.stringify(r)}`);
  return d.listingId;
}

async function staffMember() {
  const u = await user({ createdAt: new Date(Date.now() - 90 * DAY) });
  await db.update(schema.users).set({ staffRole: 'moderator' }).where(eq(schema.users.id, u.id));
  return { userId: u.id, role: 'moderator', sessionId: randomUUID(), ip: '203.0.113.7', userAgent: 'test' } as const;
}
const scam: Grounds = { reason: 'scam', section: '6.1', legalGround: null, facts: 'در توضیحات پیش‌پرداخت با کارت هدیه خواسته شده است.' };

describe('editing a live listing keeps to the posting rules', () => {
  const job = (over: Partial<ListingInput> = {}) =>
    listingInputSchema.parse({
      kind: 'wanted',
      title: 'برنامه‌نویس وب',
      description: 'سه سال تجربه با React و Node، دنبال کار تمام‌وقت در برلین.',
      attributes: { employment_type: 'full_time' },
      priceType: 'on_request',
      countryCode: 'DE',
      place: 'برلین',
      ...over,
    });

  it('a private wanted post can’t be turned into a job offer', async () => {
    const me = await user({ createdAt: new Date(Date.now() - 60 * DAY) });
    const d = await createDraft(appDb, { userId: me.id, categoryId: (await categoryBySlug('it-jobs')).id });
    if (!d.ok) throw new Error(d.reason);
    expect(await saveListing(appDb, { userId: me.id, listingId: d.listingId, input: job(), intent: 'publish' })).toMatchObject({ ok: true, status: 'active' });
    expect(await saveListing(appDb, { userId: me.id, listingId: d.listingId, input: job({ kind: 'offer' }), intent: 'save' })).toEqual({ ok: false, reason: 'business_only' });
    expect((await listing(d.listingId)).kind).toBe('wanted');
    // Other edits go through
    expect(await saveListing(appDb, { userId: me.id, listingId: d.listingId, input: job({ title: 'برنامه‌نویس وب (React)' }), intent: 'save' })).toMatchObject({ ok: true });
  });

  it('a listing that broke a rule before (posted before the rule) can still be edited', async () => {
    const me = await user({ createdAt: new Date(Date.now() - 60 * DAY) });
    const l = await makeListing(tx, me.id, { categoryId: (await categoryBySlug('it-jobs')).id, kind: 'offer', priceType: 'on_request', priceMinor: null, currency: null, attributes: { employment_type: 'full_time' } });
    expect(
      await saveListing(appDb, { userId: me.id, listingId: l.id, input: job({ kind: 'offer', attributes: { employment_type: 'part_time' }, description: 'کار پاره‌وقت برنامه‌نویسی وب در برلین، دو روز در هفته.' }), intent: 'save' }),
    ).toMatchObject({ ok: true });
  });
});

describe('an event that goes live again ends on its own last date', () => {
  // 8 November, 20:00–23:00 in Berlin
  const LAST_END = new Date('2026-11-08T22:00:00Z');

  it('after an automatic take-down and a resubmission', async () => {
    const me = await user({ createdAt: new Date(Date.now() - 60 * DAY) });
    const id = await publishEvent(me.id, { event: { organizerName: 'صرافی و حواله ارز به ایران' } });
    expect(await runListingChecks(workerDb, id)).toBe('taken_down');
    // The poster is told, as after a staff take-down
    const [decision] = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, id));
    const told = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, 'moderation.decided'), eq(schema.outboxEvents.aggregateId, decision!.id)));
    expect(told.map((o) => o.payload)).toEqual([{ notifyUser: true }]);

    const again = await saveEvent(appDb, { userId: me.id, listingId: id, input: eventListing(), event: eventIn({ organizerName: 'انجمن فرهنگی نوا' }), intent: 'publish', now: NOW });
    expect(again).toMatchObject({ ok: true, status: 'pending_review' });
    expect(await runListingChecks(workerDb, id)).toBe('published');
    expect(await listing(id)).toMatchObject({ status: 'active', expiresAt: LAST_END });
  });

  it('after a staff take-down, a resubmission and a restore', async () => {
    const mod = await staffMember();
    const me = await user({ createdAt: new Date(Date.now() - 60 * DAY) });
    const id = await publishEvent(me.id);
    expect(await takeDownListing(appDb, mod, id, scam, { timeZone: 'Europe/Berlin' })).toMatchObject({ ok: true });
    expect(await saveEvent(appDb, { userId: me.id, listingId: id, input: eventListing(), event: eventIn(), intent: 'publish', now: NOW })).toMatchObject({ ok: true, status: 'pending_review' });
    expect(await restoreListing(appDb, mod, id, '', { timeZone: 'Europe/Berlin' })).toMatchObject({ ok: true });
    expect(await listing(id)).toMatchObject({ status: 'active', expiresAt: LAST_END });
  });
});

describe('«ویژه تا پایان رویداد» follows an event moved later', () => {
  async function featuredEvent(endsIn: number) {
    const [berlin, concerts] = await Promise.all([city('berlin'), categoryBySlug('event-concerts')]);
    const seller = await user();
    const l = await makeListing(tx, seller.id, { categoryId: concerts.id, priceType: 'free', priceMinor: null, currency: null });
    await db.insert(schema.eventDetails).values({ listingId: l.id, timeZone: 'Europe/Berlin', venueName: 'سالن', venueNameNormalized: normalizePersian('سالن') });
    await db.insert(schema.eventDates).values({ listingId: l.id, countryCode: 'DE', locationId: berlin.id, startsAt: new Date(Date.now() + endsIn - 3_600_000), endsAt: new Date(Date.now() + endsIn) });
    const gateway = new FakeGateway();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: l.id, productCode: 'featured-event', waiver: true, appUrl: APP });
    if (!r.ok) throw new Error(r.reason);
    const order = await orderRow(r.orderId!);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', paidSession(order, gateway.checkouts[0]!.id))));
    return { listingId: l.id, orderId: order.id };
  }
  const periods = (orderId: string) => db.select().from(schema.entitlements).where(eq(schema.entitlements.orderId, orderId)).orderBy(schema.entitlements.startsAt);
  const moveTo = (listingId: string, endsAt: Date) => db.update(schema.eventDates).set({ startsAt: new Date(endsAt.getTime() - 3_600_000), endsAt }).where(eq(schema.eventDates.listingId, listingId));

  it('adds the days up to the new end, at most 30 days from the start, once', async () => {
    const f = await featuredEvent(5 * DAY);
    const [bought] = await periods(f.orderId);
    const later = new Date(Date.now() + 12 * DAY);
    await moveTo(f.listingId, later);
    expect(await workerDb.transaction((t) => followEventEnd(t, f.listingId))).toBe(1);
    const [, extra] = await periods(f.orderId);
    expect(extra).toMatchObject({ type: 'featured', listingId: f.listingId, startsAt: bought!.endsAt, endsAt: later });
    expect(await workerDb.transaction((t) => followEventEnd(t, f.listingId))).toBe(0);

    // Much later: up to 30 days from when it started
    await moveTo(f.listingId, new Date(Date.now() + 90 * DAY));
    expect(await workerDb.transaction((t) => followEventEnd(t, f.listingId))).toBe(1);
    const all = await periods(f.orderId);
    expect(all.at(-1)!.endsAt).toEqual(new Date(bought!.startsAt.getTime() + 30 * DAY));
    // A withdrawal still divides the price over the period bought
    const granted = all.map((g) => ({ type: g.type, startsAt: g.startsAt, endsAt: g.endsAt, appliedAt: g.appliedAt, revokedAt: g.revokedAt }));
    const halfway = new Date(bought!.startsAt.getTime() + (bought!.endsAt!.getTime() - bought!.startsAt.getTime()) / 2);
    expect(withdrawalRefund({ totalMinor: 1000, refundedMinor: 0, granted, receivedAt: halfway })).toBe(500);
  });

  it('leaves an event moved earlier, and a refunded order, alone', async () => {
    const f = await featuredEvent(5 * DAY);
    await moveTo(f.listingId, new Date(Date.now() + 2 * DAY));
    expect(await workerDb.transaction((t) => followEventEnd(t, f.listingId))).toBe(0);
    await db.update(schema.entitlements).set({ revokedAt: new Date(), revokeReason: 'refund' }).where(eq(schema.entitlements.orderId, f.orderId));
    await moveTo(f.listingId, new Date(Date.now() + 12 * DAY));
    expect(await workerDb.transaction((t) => followEventEnd(t, f.listingId))).toBe(0);
  });
});

describe('postponed events and the day before', () => {
  async function savedEvent(over: Partial<EventInput>) {
    const owner = await user();
    const fan = await user();
    const id = await publishEvent(owner.id, { event: over });
    expect(await addFavorite(appDb, null, fan.id, (await listing(id)).publicToken)).toMatchObject({ ok: true });
    return { id, mine: async (now: Date) => (await dueReminders(workerDb, APP, now)).filter((r) => r.listingId === id) };
  }

  it('«فردا» goes out on the day before, not two days early for a morning event', async () => {
    // Sunday 8 November, 9:00 in Berlin
    const { mine } = await savedEvent({ startTime: '09:00', endTime: '12:00' });
    // Friday 22:30 is within 36 hours, but Sunday is the day after tomorrow
    expect(await mine(new Date('2026-11-06T21:30:00Z'))).toHaveLength(0);
    const [due] = await mine(new Date('2026-11-07T06:00:00Z'));
    expect(reminderMessage(due!, ['email'], APP).mail?.subject).toMatch(/^فردا: /);
  });

  it('«امروز» when the day before went by', async () => {
    const { mine } = await savedEvent({ startTime: '22:00', endTime: '23:30' });
    const [due] = await mine(new Date('2026-11-08T06:00:00Z'));
    expect(reminderMessage(due!, ['email'], APP).mail?.subject).toMatch(/^امروز: /);
  });

  it('a postponed event gets no reminder at its old time, and is marked in the weekly email and the digest', async () => {
    // A week of its own: 1 to 7 March 2027
    const { id, mine } = await savedEvent({ startDate: '2027-03-03', startTime: '20:00' });
    await db.update(schema.eventDetails).set({ scheduleStatus: 'postponed' }).where(eq(schema.eventDetails.listingId, id));
    expect(await mine(new Date('2027-03-02T12:00:00Z'))).toHaveLength(0);

    const monday = new Date('2027-03-01T08:00:00Z');
    const weekly = await weeklyMessageFor(workerDb, (await city('berlin')).id, APP, monday);
    const text = weekly!.build({ userId: randomUUID(), email: 'fan@example.test', telegramUserId: null, prefs: {}, timeZone: 'Europe/Berlin' }, ['email']).mail!.text;
    expect(text).toContain('کنسرت موسیقی ایرانی: گروه نوا\n  به تعویق افتاده');

    await writeWeeklyDigests(workerDb, monday);
    const [digest] = await db.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.eventType, 'event_digest.weekly')).then((rows) => rows.filter((r) => (r.payload as { week: string; country: string }).week === '2027-03-01' && (r.payload as { country: string }).country === 'DE'));
    expect(digest!.payload).toMatchObject({ listingIds: expect.arrayContaining([id]), postponedIds: [id] });
  });
});

describe('the chat filter sees through disguised numbers', () => {
  it.each([
    ['IBAN with dots', 'DE89.3704.0044.0532.0130.00', 'iban'],
    ['IBAN with direction marks', 'DE89‎3704‏0044‎0532‎0130‎00', 'iban'],
    ['IBAN with an isolate around it', '⁦DE89 3704 0044 0532 0130 00⁩', 'iban'],
    ['phone number with «٬»', 'شماره‌ام ۰۱۷۶٬۱۲۳۴۵۶۷۸', 'phone_number'],
    ['phone number with direction marks', '0176‎1234‎5678', 'phone_number'],
  ] as const)('%s', (_, body, flag) => {
    expect(detectRisks(body)).toContain(flag);
  });

  it('a price with «٬» is still no phone number', () => {
    expect(detectRisks('قیمت ۱٬۲۵۰ یورو')).toEqual([]);
  });
});

describe('appeals stay open six calendar months', () => {
  it('to the end of the same day six months later, on Berlin’s clock', () => {
    // 1 July + 6 months is 1 January: 184 days, one more than the old 183
    expect(appealDeadline(new Date('2026-07-01T10:00:00Z'))).toEqual(new Date('2027-01-01T23:00:00Z'));
    // 31 August: the last day of February
    expect(appealDeadline(new Date('2026-08-31T10:00:00Z'))).toEqual(new Date('2027-02-28T23:00:00Z'));
    // 23:30 UTC on 31 October is already 1 November in Berlin: open through 1 May
    expect(localParts(appealDeadline(new Date('2026-10-31T23:30:00Z')), 'Europe/Berlin')).toMatchObject({ y: 2027, m: 5, d: 2, h: 0, mi: 0 });
  });
});

describe('Peydoo’s names are not for businesses', () => {
  function details(over: Partial<BusinessInput> = {}): BusinessInput {
    return {
      name: 'نان‌وایی بربری',
      slug: `barbari-${publicToken()}`,
      businessType: 'food',
      tagline: '',
      instagram: '',
      telegram: '',
      legalName: 'Barbari Bäckerei',
      legalForm: 'Einzelunternehmen',
      representativeName: '',
      addressLine1: 'Sonnenallee 1',
      addressLine2: '',
      place: '12045',
      placeValue: '',
      phone: '030 1234567',
      email: 'kontakt@barbari.example',
      website: '',
      registerCourt: '',
      registrationNumber: '',
      vatId: '',
      imprintExtra: '',
      description: 'نان تازه هر روز',
      ...over,
    };
  }

  it('«پشتیبانی پیدو» or /b/peydoo-support is refused, at the start and when renaming', async () => {
    const me = await user();
    expect(await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details({ name: 'پشتیبانی پیدو' }) })).toMatchObject({ ok: false, fields: { name: 'reserved_name' } });
    expect(await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details({ slug: 'peydoo-support' }) })).toMatchObject({ ok: false, reason: 'slug_reserved' });
    expect(await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details({ slug: `pey-doo-${publicToken()}` }) })).toMatchObject({ ok: false, reason: 'slug_reserved' });
    const made = await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details() });
    if (!made.ok) throw new Error(made.reason);
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: made.id, input: details({ slug: made.slug, name: 'پیدو بربری' }) })).toMatchObject({ ok: false, fields: { name: 'reserved_name' } });
    // People's names follow the same rule as before
    expect(checkDisplayName('پشتیبانی پیدو')).toEqual({ ok: false, error: 'reserved' });
    expect(checkDisplayName('سارا')).toMatchObject({ ok: true });
  });
});
