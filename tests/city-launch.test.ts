import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema } from '../src/modules/events/input';
import { listingArea } from '../src/modules/launch/cities';
import { waitingCountries } from '../src/modules/launch/waitlist';
import { createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { appDb } from './accounts';
import { db } from './db';
import { categoryBySlug, city, listing, user } from './listings-fixtures';

// City launch (round 12, docs/wave0-plan.md, item 1): only the Berlin area takes listings (Berlin
// and Potsdam, within 40 km of Berlin's centre); Hamburg, Cologne with Bonn, Düsseldorf and
// Frankfurt wait for their businesses; events go everywhere in Germany; Austria is closed.

function input(over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'دوچرخهٔ شهری سالم',
    description: 'دوچرخهٔ شهری با دنده، ترمز نو و چراغ. فقط تحویل حضوری.',
    attributes: { condition: 'like_new' },
    priceType: 'fixed',
    amount: '120',
    countryCode: 'DE',
    place: 'برلین',
    ...over,
  });
}

async function publish(over: Partial<ListingInput> = {}) {
  const u = await user();
  const draft = await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('bicycles')).id });
  if (!draft.ok) throw new Error(draft.reason);
  const r = await saveListing(appDb, { userId: u.id, listingId: draft.listingId, input: input(over), intent: 'publish' });
  return { r, id: draft.listingId, userId: u.id };
}

/** A postal code that joins Berlin but lies far outside the 40 km area */
async function farBerlinPostal() {
  const berlin = await city('berlin');
  const [p] = await db
    .select({ id: schema.postalPlaces.id, code: schema.postalPlaces.postalCode })
    .from(schema.postalPlaces)
    .innerJoin(schema.locations, eq(schema.locations.id, schema.postalPlaces.locationId))
    .where(
      and(
        eq(schema.postalPlaces.locationId, berlin.id),
        sql`ST_Distance(${schema.postalPlaces.center}, ${schema.locations.center}) > 60000`,
      ),
    )
    .limit(1);
  return p;
}

describe('city launch: seed', () => {
  it('opens only the Berlin area and sets the key cities’ goals', async () => {
    const rows = await db
      .select({ slug: schema.locations.slug, status: schema.locations.launchStatus, goal: schema.locations.businessGoal, radius: schema.locations.launchRadiusKm, withId: schema.locations.launchWithId })
      .from(schema.locations)
      .where(and(eq(schema.locations.kind, 'city'), eq(schema.locations.countryCode, 'DE')));
    const by = new Map(rows.map((r) => [r.slug, r]));
    expect(rows.filter((r) => r.status === 'open').map((r) => r.slug).sort()).toEqual(['berlin', 'potsdam']);
    expect(by.get('berlin')).toMatchObject({ radius: 40, withId: null });
    expect(by.get('potsdam')!.withId).toBe((await city('berlin')).id);
    expect(by.get('hamburg')).toMatchObject({ status: 'waitlist', goal: 20 });
    expect(by.get('koeln')).toMatchObject({ status: 'waitlist', goal: 25 });
    expect(by.get('bonn')).toMatchObject({ status: 'waitlist', withId: (await city('koeln')).id });
    expect(by.get('duesseldorf')).toMatchObject({ status: 'waitlist', goal: 20 });
    expect(by.get('frankfurt')).toMatchObject({ status: 'waitlist', goal: 20 });
    expect(by.get('muenchen')).toMatchObject({ status: 'later', goal: null });
  });

  it('closes Austria', async () => {
    const [at] = await db.select().from(schema.countries).where(eq(schema.countries.code, 'AT'));
    expect(at!.isActive).toBe(false);
  });

  it('gives each closed country of the plan its first city on a waitlist (city chooser)', async () => {
    const waiting = await waitingCountries(appDb);
    const by = new Map(waiting.map((w) => [w.code, w]));
    expect([...by.keys()].sort()).toEqual(['AT', 'AU', 'CA', 'GB', 'NL', 'US']);
    expect(by.get('AT')).toMatchObject({ slug: 'austria', city: { slug: 'wien', nameFa: 'وین' }, goal: 15, businesses: 0 });
    expect(by.get('CA')).toMatchObject({ city: { slug: 'toronto' }, goal: 30 });
    expect(by.get('NL')).toMatchObject({ city: { slug: 'amsterdam' }, goal: 15 });
    // Largest goal first
    expect(waiting.map((w) => w.goal)).toEqual([...waiting.map((w) => w.goal)].sort((a, b) => (b ?? 0) - (a ?? 0)));
    // Germany is open, so it isn't listed
    expect(by.has('DE')).toBe(false);
  });
});

describe('city launch: posting', () => {
  it('publishes in Berlin and in Potsdam', async () => {
    expect((await publish()).r).toMatchObject({ ok: true });
    const potsdam = await publish({ place: 'پوتسدام' });
    expect(potsdam.r).toMatchObject({ ok: true });
    expect((await listing(potsdam.id)).locationId).toBe((await city('potsdam')).id);
  });

  it('refuses a waitlist city and a later city, but keeps the draft', async () => {
    for (const place of ['هامبورگ', 'مونیخ', 'بن']) {
      const { r, id } = await publish({ place });
      expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'invalid', errors: { place: 'city_not_open' } }));
      expect((await listing(id)).status).toBe('draft');
    }
    const u = await user();
    const draft = await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('bicycles')).id });
    if (!draft.ok) throw new Error(draft.reason);
    expect(await saveListing(appDb, { userId: u.id, listingId: draft.listingId, input: input({ place: 'هامبورگ' }), intent: 'save' })).toMatchObject({ ok: true, status: 'draft' });
  });

  it('refuses a postal code that joins Berlin but lies outside the 40 km area', async () => {
    const far = await farBerlinPostal();
    expect(far).toBeDefined();
    const { r } = await publish({ place: far!.code, placeValue: `p:${far!.id}` });
    expect(r).toEqual(expect.objectContaining({ ok: false, errors: { place: 'outside_area' } }));
  });

  it('publishes events everywhere in Germany', async () => {
    const u = await user();
    const draft = await createEventDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('event-parties')).id });
    if (!draft.ok) throw new Error(draft.reason);
    const r = await saveEvent(appDb, {
      userId: u.id,
      listingId: draft.listingId,
      input: input({ title: 'جشن یلدا در هامبورگ', description: 'شام ایرانی، حافظ‌خوانی و موسیقی زنده.', attributes: {}, amount: '20', place: 'هامبورگ' }),
      event: eventInputSchema.parse({ startDate: '2026-12-19', startTime: '20:00', endTime: '23:30', venueName: 'Kulturhaus', organizerName: 'انجمن فرهنگی', languages: ['fa'] }),
      intent: 'publish',
      now: new Date('2026-10-26T10:00:00Z'),
    });
    expect(r).toEqual(expect.objectContaining({ ok: true }));
    expect((await listing(draft.listingId)).locationId).toBe((await city('hamburg')).id);
  });

  it('refuses Austria', async () => {
    const { r } = await publish({ countryCode: 'AT', place: '1010' });
    expect(r).toEqual(expect.objectContaining({ ok: false, errors: expect.objectContaining({ countryCode: 'invalid' }) }));
  });

  it('checks the area from the city it opens with', async () => {
    const berlin = await city('berlin');
    const potsdam = await city('potsdam');
    expect(await listingArea(appDb, potsdam.id, potsdam.center)).toBe('open');
    expect(await listingArea(appDb, berlin.id, { lat: berlin.center.lat + 0.5, lng: berlin.center.lng })).toBe('outside_area');
    expect(await listingArea(appDb, (await city('hamburg')).id, (await city('hamburg')).center)).toBe('city_not_open');
  });
});
