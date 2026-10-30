import { inArray } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { eventRowOf } from '../src/modules/events/card';
import { countEvents, upcomingEvents } from '../src/modules/events/queries';
import { loadCatalog, type Catalog } from '../src/modules/listings/catalog';
import { onlineCounts, onlineListings, sectionOf } from '../src/modules/listings/online';
import { category, db, location, makeListing, makeUser, rollback, type Tx } from './db';
import { seedCatalog } from './payments-fixtures';

// The online layer (wave 2 part 6): online services and lessons from every open country, remote
// jobs from the open countries of the same zone, events held only online from every open country
// (also in the events lists), never test accounts' for others, prices compared in one currency.

const DAY = 86_400_000;
/** A word only these tests' titles have, so counts aren't disturbed by other tests' listings */
const WORD = 'زبرجدنما';
let catalog: Catalog;

beforeAll(async () => {
  await seedCatalog();
  catalog = await loadCatalog(db);
});

/** Germany is open in the seed; the test opens Austria, the UK and Canada (the US stays closed) */
async function open(tx: Tx) {
  await tx.update(schema.countries).set({ isActive: true, mode: 'open' }).where(inArray(schema.countries.code, ['AT', 'GB', 'CA']));
}

const PLACES = { DE: ['berlin', 'EUR'], AT: ['wien', 'EUR'], GB: ['london', 'GBP'], CA: ['toronto', 'CAD'], US: ['los-angeles', 'USD'] } as const;

async function post(tx: Tx, userId: string, country: keyof typeof PLACES, slug: string, attributes: Record<string, unknown>, title = `${WORD} ${slug}`) {
  const [citySlug, currency] = PLACES[country];
  const city = await location(tx, citySlug);
  return makeListing(tx, userId, {
    categoryId: (await category(tx, slug)).id,
    title,
    titleNormalized: normalizePersian(title),
    attributes,
    countryCode: country,
    currency,
    locationId: city.id,
    point: city.center,
  });
}

async function event(tx: Tx, userId: string, country: 'DE' | 'GB', attendance: 'online' | 'hybrid' | 'in_person', price: { priceType: 'free' | 'fixed'; priceMinor: number | null } = { priceType: 'free', priceMinor: null }) {
  const [citySlug, currency] = PLACES[country];
  const city = await location(tx, citySlug);
  const title = `${WORD} رویداد ${attendance}`;
  const l = await makeListing(tx, userId, {
    categoryId: (await category(tx, 'event-concerts')).id,
    title,
    titleNormalized: normalizePersian(title),
    ...price,
    currency: price.priceType === 'fixed' ? currency : null,
    countryCode: country,
    locationId: city.id,
    point: city.center,
  });
  await tx.insert(schema.eventDetails).values({ listingId: l.id, timeZone: country === 'GB' ? 'Europe/London' : 'Europe/Berlin', attendance });
  const startsAt = new Date(Date.now() + 3 * DAY);
  await tx.insert(schema.eventDates).values({ listingId: l.id, countryCode: country, locationId: city.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) });
  return l;
}

const ids = (r: { items: { id: string }[] }) => r.items.map((i) => i.id);

describe('online services and lessons', () => {
  it('reach every open country; in-person ones and closed countries’ stay home', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      const de = await post(tx, u.id, 'DE', 'it-services', { online_possible: true });
      const lesson = await post(tx, u.id, 'DE', 'computer-courses', { lesson_format: 'online' });
      const both = await post(tx, u.id, 'GB', 'computer-courses', { lesson_format: 'both' });
      const inPerson = await post(tx, u.id, 'DE', 'it-services', {});
      const classroom = await post(tx, u.id, 'DE', 'computer-courses', { lesson_format: 'in_person' });
      const closed = await post(tx, u.id, 'US', 'it-services', { online_possible: true });
      const inAustria = ids(await onlineListings(tx, catalog, 'services', { countryCode: 'AT', keyword: WORD }));
      expect(inAustria).toEqual(expect.arrayContaining([de.id, lesson.id, both.id]));
      expect(inAustria).not.toContain(inPerson.id);
      expect(inAustria).not.toContain(classroom.id);
      expect(inAustria).not.toContain(closed.id);
      // Germany's own page has its own, plus the UK's; "from other countries" only the UK's
      expect(ids(await onlineListings(tx, catalog, 'services', { countryCode: 'DE', keyword: WORD }))).toEqual(expect.arrayContaining([de.id, both.id]));
      const elsewhere = ids(await onlineListings(tx, catalog, 'services', { countryCode: 'DE', keyword: WORD, elsewhereOnly: true }));
      expect(elsewhere).toContain(both.id);
      expect(elsewhere).not.toContain(de.id);
    });
  });

  it('pages newest first, narrows to a category, and hides test accounts’ unless asked', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      const tester = await makeUser(tx, { testAccount: 'country' });
      const older = await post(tx, u.id, 'DE', 'it-services', { online_possible: true });
      await tx.update(schema.listings).set({ rankedAt: new Date(Date.now() - DAY) }).where(inArray(schema.listings.id, [older.id]));
      const newer = await post(tx, u.id, 'DE', 'computer-courses', { lesson_format: 'online' });
      const test = await post(tx, tester.id, 'DE', 'it-services', { online_possible: true });
      const first = await onlineListings(tx, catalog, 'services', { countryCode: 'AT', keyword: WORD }, 1);
      expect(ids(first)).toEqual([newer.id]);
      expect(ids(await onlineListings(tx, catalog, 'services', { countryCode: 'AT', keyword: WORD, after: first.next }, 1))).toEqual([older.id]);
      const courses = (await category(tx, 'lessons-courses')).id;
      expect(ids(await onlineListings(tx, catalog, 'services', { countryCode: 'AT', keyword: WORD, categoryIds: [courses, ...catalog.byId.get(courses)!.childIds] }))).toEqual([newer.id]);
      expect(ids(await onlineListings(tx, catalog, 'services', { countryCode: 'AT', keyword: WORD, withTest: true }))).toContain(test.id);
    });
  });
});

describe('remote jobs', () => {
  it('reach the open countries of their zone only; on-site jobs stay home', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      const remote = await post(tx, u.id, 'DE', 'it-jobs', { work_mode: 'remote' });
      const onSite = await post(tx, u.id, 'DE', 'it-jobs', { work_mode: 'on_site' });
      const canadian = await post(tx, u.id, 'CA', 'it-jobs', { work_mode: 'remote' });
      const inUk = ids(await onlineListings(tx, catalog, 'jobs', { countryCode: 'GB', keyword: WORD }));
      expect(inUk).toContain(remote.id);
      expect(inUk).not.toContain(onSite.id);
      expect(inUk).not.toContain(canadian.id);
      const inCanada = ids(await onlineListings(tx, catalog, 'jobs', { countryCode: 'CA', keyword: WORD }));
      expect(inCanada).toEqual([canadian.id]);
    });
  });

  it('every category knows its section (the links on the category pages)', () => {
    const slug = (s: string) => catalog.bySlug.get(s)!.id;
    expect([sectionOf(catalog, slug('it-services')), sectionOf(catalog, slug('computer-courses')), sectionOf(catalog, slug('jobs')), sectionOf(catalog, slug('mobile-phones'))]).toEqual(['services', 'services', 'jobs', null]);
  });
});

describe('online events from other countries', () => {
  it('join a country’s and its cities’ events lists; hybrid and in-person events don’t', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      const online = await event(tx, u.id, 'DE', 'online');
      const hybrid = await event(tx, u.id, 'DE', 'hybrid');
      const inPerson = await event(tx, u.id, 'DE', 'in_person');
      const vienna = await location(tx, 'wien');
      const base = { countryCode: 'AT', from: new Date(), to: null, text: WORD };
      expect(ids(await upcomingEvents(tx, base))).toEqual([]);
      const austria = ids(await upcomingEvents(tx, { ...base, onlineElsewhere: 'also' }));
      expect(austria).toEqual([online.id]);
      expect(ids(await upcomingEvents(tx, { ...base, onlineElsewhere: 'also', locationId: vienna.id }))).toEqual([online.id]);
      // Germany's own list keeps all three
      expect(ids(await upcomingEvents(tx, { ...base, countryCode: 'DE', onlineElsewhere: 'also' }))).toEqual(expect.arrayContaining([online.id, hybrid.id, inPerson.id]));
      expect(await countEvents(tx, { ...base, countryCode: 'DE', onlineElsewhere: 'only' })).toBe(0);
    });
  });

  it('a price limit counts only prices in the country’s currency', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      const euros = await event(tx, u.id, 'DE', 'online', { priceType: 'fixed', priceMinor: 500 });
      const free = await event(tx, u.id, 'DE', 'online');
      const inUk = ids(await upcomingEvents(tx, { countryCode: 'GB', onlineElsewhere: 'also', from: new Date(), to: null, text: WORD, maxPriceMinor: 2000 }));
      expect(inUk).toContain(free.id);
      expect(inUk).not.toContain(euros.id);
    });
  });

  it('say where they are from and whose time they are in', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      await event(tx, u.id, 'DE', 'online');
      const [row] = (await upcomingEvents(tx, { countryCode: 'AT', onlineElsewhere: 'only', from: new Date(), to: null, text: WORD })).items;
      const abroad = eventRowOf(catalog, row!, { saved: new Set(), season: null, countryCode: 'AT' });
      expect(abroad.where).toBe('آنلاین، از آلمان');
      expect(abroad.time).toMatch(/ به وقت برلین$/);
      const home = eventRowOf(catalog, row!, { saved: new Set(), season: null, countryCode: 'DE' });
      expect(home.where).toBe('آنلاین');
      expect(home.time).not.toMatch(/به وقت/);
    });
  });
});

describe('the counts', () => {
  it('add up what the online page shows, or only what other countries add', async () => {
    await rollback(async (tx) => {
      await open(tx);
      const u = await makeUser(tx);
      await post(tx, u.id, 'DE', 'it-services', { online_possible: true });
      await post(tx, u.id, 'GB', 'computer-courses', { lesson_format: 'online' });
      await post(tx, u.id, 'DE', 'it-jobs', { work_mode: 'remote' });
      await event(tx, u.id, 'GB', 'online');
      expect(await onlineCounts(tx, catalog, { countryCode: 'DE', keyword: WORD })).toEqual({ events: 1, services: 2, jobs: 1 });
      expect(await onlineCounts(tx, catalog, { countryCode: 'DE', keyword: WORD, elsewhereOnly: true })).toEqual({ events: 1, services: 1, jobs: 0 });
    });
  });
});
