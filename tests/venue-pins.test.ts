import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema, type EventInput } from '../src/modules/events/input';
import { listingInputSchema } from '../src/modules/listings/listings';
import { businessBySlug, createBusiness, updateBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { appDb } from './accounts';
import { db, publicToken } from './db';
import { categoryBySlug, user } from './listings-fixtures';
import { seedCatalog } from './payments-fixtures';

// A venue's or a shop's pin found from its street address when it is saved (docs/setup.md, "The
// street map"; owner, Oct 28, 2026), against a stand-in for the Nominatim server: the event and the
// business get the point, a far-away match is left out instead of refusing the form, and the
// organizer's own pin always wins.

vi.hoisted(() => {
  process.env.GEOCODER_URL = 'https://geocoder.test';
});
vi.mock('../src/lib/env', () => ({ webEnv: () => ({ APP_URL: 'https://peydoo.test', GEOCODER_URL: 'https://geocoder.test' }) }));

const NOW = new Date('2026-10-18T10:00:00Z');
const SETTLED = { createdAt: new Date('2026-09-01T10:00:00Z') };
const asked: string[] = [];
/** What the stand-in answers for each address */
const PLACES: Record<string, { lat: string; lon: string }> = {
  'Karl-Marx-Straße 141': { lat: '52.4796120', lon: '13.4362550' },
  'Sonnenallee 1': { lat: '52.4874020', lon: '13.4251200' },
  // A wrong match in Hamburg
  'Reeperbahn 1': { lat: '53.5496', lon: '9.9662' },
};

beforeAll(async () => {
  await seedCatalog();
  vi.stubGlobal('fetch', async (url: URL) => {
    const q = new URL(url).searchParams.get('q') ?? '';
    asked.push(q);
    const hit = Object.entries(PLACES).find(([street]) => q.startsWith(street));
    return Response.json(hit ? [hit[1]] : []);
  });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  asked.length = 0;
});

const listingIn = () =>
  listingInputSchema.parse({ title: 'کنسرت موسیقی ایرانی: گروه نوا', description: 'گروه نوا با تار، کمانچه، تنبک و آواز.', priceType: 'fixed', amount: '35', countryCode: 'DE', place: '12043' });
const eventIn = (over: Partial<EventInput> = {}) =>
  eventInputSchema.parse({ startDate: '2026-11-08', startTime: '20:00', endTime: '23:00', venueName: `Heimathafen ${publicToken()}`, streetAddress: 'Karl-Marx-Straße 141', languages: ['fa'], ...over });
const pinOf = async (listingId: string) => (await db.select({ pin: schema.eventDetails.venuePin }).from(schema.eventDetails).where(eq(schema.eventDetails.listingId, listingId)))[0]?.pin;

async function draft(userId: string) {
  const d = await createEventDraft(appDb, { userId, categoryId: (await categoryBySlug('event-concerts')).id });
  if (!d.ok) throw new Error(d.reason);
  return d.listingId;
}

describe('an event’s venue', () => {
  it('gets its pin from the street address, once', async () => {
    const u = await user(SETTLED);
    const id = await draft(u.id);
    expect(await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn(), intent: 'publish', now: NOW })).toMatchObject({ ok: true });
    expect(await pinOf(id)).toEqual({ lat: 52.479612, lng: 13.436255 });
    expect(asked).toEqual(['Karl-Marx-Straße 141, 12043']);
    // Saved again with the same address and the pin the form shows: no new lookup
    const again = await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn({ pin: '52.479612,13.436255' }), intent: 'save', now: NOW });
    expect(again).toMatchObject({ ok: true });
    expect(asked).toHaveLength(1);
  });

  it('keeps the organizer’s own pin, and drops a match far from the postal code without an error', async () => {
    const u = await user(SETTLED);
    const own = await draft(u.id);
    await saveEvent(appDb, { userId: u.id, listingId: own, input: listingIn(), event: eventIn({ pin: '52.4801,13.4355' }), intent: 'publish', now: NOW });
    expect(await pinOf(own)).toEqual({ lat: 52.4801, lng: 13.4355 });
    expect(asked).toHaveLength(0);

    const wrong = await draft(u.id);
    const r = await saveEvent(appDb, { userId: u.id, listingId: wrong, input: listingIn(), event: eventIn({ streetAddress: 'Reeperbahn 1' }), intent: 'publish', now: NOW });
    expect(r).toMatchObject({ ok: true });
    expect(await pinOf(wrong)).toBeNull();
  });

  it('moves with a changed address; online events are never looked up', async () => {
    const u = await user(SETTLED);
    const id = await draft(u.id);
    await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn({ streetAddress: 'Sonnenallee 1' }), intent: 'publish', now: NOW });
    expect(await pinOf(id)).toEqual({ lat: 52.487402, lng: 13.42512 });
    await saveEvent(appDb, { userId: u.id, listingId: id, input: listingIn(), event: eventIn({ pin: '52.487402,13.42512' }), intent: 'save', now: NOW });
    expect(await pinOf(id)).toEqual({ lat: 52.479612, lng: 13.436255 });

    asked.length = 0;
    const online = await draft(u.id);
    await saveEvent(appDb, { userId: u.id, listingId: online, input: listingIn(), event: eventIn({ attendance: 'online', onlineUrl: 'https://zoom.us/j/123456', venueName: '', streetAddress: 'Karl-Marx-Straße 141' }), intent: 'publish', now: NOW });
    expect(await pinOf(online)).toBeNull();
    expect(asked).toHaveLength(0);
  });
});

describe('a business’s shop', () => {
  const details = (over: Partial<BusinessInput> = {}): BusinessInput => ({
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
  });

  it('gets its pin from the address; a removed pin stays removed until the address changes', async () => {
    const me = await user({ verified: true });
    const r = await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details() });
    if (!r.ok) throw new Error(r.reason);
    const pin = async () => (await businessBySlug(db, r.slug))?.org.pin;
    expect(await pin()).toEqual({ lat: 52.487402, lng: 13.42512 });
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: r.id, input: details({ slug: r.slug }) })).toEqual({ ok: true });
    expect(await pin()).toBeNull();
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: r.id, input: details({ slug: r.slug, addressLine1: 'Reeperbahn 1' }) })).toEqual({ ok: true });
    expect(await pin()).toBeNull();
    expect(asked).toHaveLength(2);
  });
});
