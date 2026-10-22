import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { cachedCatalog, type Catalog } from '../src/modules/listings/catalog';
import { searchListings } from '../src/modules/search';
import { COUNT_CAP, PAGE_SIZE, type SearchFilters } from '../src/modules/search/browse';
import { browseQuery, cleanKeyword, filterContext, parseBrowseParams, without, KEYWORD_MAX_LENGTH } from '../src/modules/search/filters';
import { decodeOffsetCursor, encodeOffsetCursor, keywordMatches, meiliFilter } from '../src/modules/search/keyword';
import { Meili } from '../src/modules/search/meili';
import { synonymSettings } from '../src/modules/search/synonyms';
import { syncListings } from '../src/modules/search/sync';
import { browseCacheControl } from '../src/proxy';
import { appDb, workerDb } from './accounts';
import { category, db, location, makeListing, makeUser, type Tx } from './db';
import { meili, testIndex } from './meili';

// Keyword search (approved Oct 22, 2026): the normalized Persian text through Meilisearch's own
// tokenizer, the browse filters translated to Meilisearch, paging, cards from PostgreSQL, and the
// PostgreSQL fallback. Listings are committed (the worker reads them on its own connection) and
// carry a made-up word, so the shared test database's other listings never match.

const ZWNJ = '‌';
let catalog: Catalog;
let index: string;
const tx = db as unknown as Tx;

beforeAll(async () => {
  catalog = await cachedCatalog(workerDb);
  index = await testIndex('kw');
});

async function indexed(...ids: string[]) {
  const r = await syncListings(workerDb, meili, index, catalog, ids);
  for (const t of r.tasks) await meili.wait(t);
}

const base = (over: Partial<SearchFilters> = {}): SearchFilters => ({
  countryCode: 'DE',
  keyword: null,
  categoryIds: null,
  locationId: null,
  postalCode: null,
  around: null,
  price: null,
  shipping: false,
  attributes: [],
  sort: 'relevance',
  ...over,
});

const search = (f: Partial<SearchFilters>, cursor: string | null = null) => searchListings(appDb, base(f), cursor, { meili, index });
const ids = async (f: Partial<SearchFilters>) => (await search(f)).items.map((l) => l.id);

async function listing(userId: string, title: string, over: Partial<typeof schema.listings.$inferInsert> = {}) {
  return makeListing(tx, userId, { title, titleNormalized: normalizePersian(title), ...over });
}

describe('Persian text through the index', () => {
  it('Arabic ي/ك, digits, diacritics and ZWNJ variants all find the same listing', async () => {
    const u = await makeUser(tx);
    const a = await listing(u.id, `کتاب${ZWNJ}های درسی زیگولو ۱۲`);
    const b = await listing(u.id, 'پژو ۲۰۶ زیگولو تمیز');
    await indexed(a.id, b.id);
    for (const q of ['كتاب زیگولو', 'کتاب‌های زیگولو', 'کتابهای زیگولو', 'کتاب های زیگولو', 'کِتاب زیگولو', 'زيگولو كتاب']) {
      expect(await ids({ keyword: q }), q).toEqual([a.id]);
    }
    for (const q of ['۲۰۶ زیگولو', '206 زیگولو', '٢٠٦ زیگولو']) expect(await ids({ keyword: q }), q).toEqual([b.id]);
  });

  it('synonyms work both ways, and a typo in a long word is forgiven', async () => {
    const u = await makeUser(tx);
    // Each in its own category: the phones category's name («گوشی موبایل») is searchable too
    const car = await listing(u.id, 'خودرو خانوادگی هوبرتوس', { categoryId: (await category(tx, 'cars')).id });
    const phone = await listing(u.id, 'سالم هوبرتوس');
    const laptop = await listing(u.id, `دل هوبرتوس`, { categoryId: (await category(tx, 'laptops')).id });
    await indexed(car.id, phone.id, laptop.id);
    expect(await ids({ keyword: 'ماشین هوبرتوس' })).toEqual([car.id]);
    expect(await ids({ keyword: 'اتومبیل هوبرتوس' })).toEqual([car.id]);
    expect(await ids({ keyword: 'موبایل هوبرتوس' })).toEqual([phone.id]);
    expect(await ids({ keyword: 'تلفن همراه هوبرتوس' })).toEqual([phone.id]);
    expect(await ids({ keyword: 'لپتاپ هوبرتوس' })).toEqual([laptop.id]);
    expect(await ids({ keyword: 'نوت بوک هوبرتوس' })).toEqual([laptop.id]);
    expect(await ids({ keyword: 'notebook هوبرتوس' })).toEqual([laptop.id]);
    expect(await ids({ keyword: 'هوبرتوص' })).toHaveLength(3);
  });

  it('the synonym list is normalized and two-way', () => {
    const s = synonymSettings();
    expect(s['ماشین']).toContain('خودرو');
    expect(s['خودرو']).toContain('ماشین');
    for (const [word, others] of Object.entries(s)) {
      expect(normalizePersian(word)).toBe(word);
      for (const o of others) expect(s[o], `${o} → ${word}`).toContain(word);
    }
  });

  it('the category name, the make and the city are searchable too', async () => {
    const u = await makeUser(tx);
    const cars = await category(tx, 'cars');
    const car = await listing(u.id, 'فروش فوری کلاوزنر', { categoryId: cars.id, attributes: { brand: 'bmw', year: 2018 } });
    await indexed(car.id);
    const bmw = catalog.bySlug.get('cars')!.ownAttributes.find((a) => a.key === 'brand')!.options.find((o) => o.value === 'bmw')!.labelFa;
    expect(await ids({ keyword: `${bmw} کلاوزنر` })).toEqual([car.id]);
    expect(await ids({ keyword: `${catalog.bySlug.get('cars')!.nameFa} کلاوزنر` })).toEqual([car.id]);
    expect(await ids({ keyword: 'برلین کلاوزنر' })).toEqual([car.id]);
  });
});

describe('filters, sorting and paging with a keyword', () => {
  it('every filter type narrows the matches as on browse pages', async () => {
    const u = await makeUser(tx);
    const cars = await category(tx, 'cars');
    const rostock = await location(tx, 'rostock');
    const car = (title: string, attributes: Record<string, unknown>, over: Partial<typeof schema.listings.$inferInsert> = {}) =>
      listing(u.id, title, { categoryId: cars.id, locationId: rostock.id, point: rostock.center, attributes, ...over });
    const a = await car('ماشین گرونوالد یک', { brand: 'bmw', fuel: 'diesel', year: 2018, mileage_km: 90_000, service_history: true, inspection_until: '2027-05', car_extras: ['air_con', 'navigation'] }, { priceMinor: 1_400_000 });
    const b = await car('ماشین گرونوالد دو', { brand: 'audi', fuel: 'petrol', year: 2012, mileage_km: 180_000, car_extras: ['air_con'] }, { priceMinor: 600_000, shippingOffered: true });
    const c = await car('ماشین گرونوالد سه', { brand: 'bmw', fuel: 'petrol', year: 2021 }, { priceType: 'on_request', priceMinor: null, currency: null });
    const d = await car('ماشین گرونوالد چهار', { brand: 'vw' }, { priceType: 'free', priceMinor: null, currency: null });
    const berlin = await listing(u.id, 'ماشین گرونوالد برلین', { categoryId: cars.id, attributes: { brand: 'bmw' } });
    const phone = await listing(u.id, 'گوشی گرونوالد');
    await indexed(a.id, b.id, c.id, d.id, berlin.id, phone.id);

    const k = 'گرونوالد';
    const set = async (over: Partial<SearchFilters>) => new Set(await ids({ keyword: k, categoryIds: [cars.id], locationId: rostock.id, ...over }));
    expect(new Set(await ids({ keyword: k }))).toEqual(new Set([a.id, b.id, c.id, d.id, berlin.id, phone.id]));
    expect(new Set(await ids({ keyword: k, categoryIds: [cars.id] }))).toEqual(new Set([a.id, b.id, c.id, d.id, berlin.id]));
    expect(await set({})).toEqual(new Set([a.id, b.id, c.id, d.id]));
    expect(await set({ attributes: [{ key: 'brand', type: 'select', values: ['bmw'] }] })).toEqual(new Set([a.id, c.id]));
    expect(await set({ attributes: [{ key: 'brand', type: 'select', values: ['bmw', 'audi'] }] })).toEqual(new Set([a.id, b.id, c.id]));
    expect(await set({ attributes: [{ key: 'year', type: 'number', min: 2015, max: null, money: false }] })).toEqual(new Set([a.id, c.id]));
    expect(await set({ attributes: [{ key: 'mileage_km', type: 'number', min: null, max: 100_000, money: false }] })).toEqual(new Set([a.id]));
    expect(await set({ attributes: [{ key: 'service_history', type: 'boolean' }] })).toEqual(new Set([a.id]));
    expect(await set({ attributes: [{ key: 'inspection_until', type: 'date', from: '2027-01', to: null }] })).toEqual(new Set([a.id]));
    expect(await set({ attributes: [{ key: 'inspection_until', type: 'date', from: null, to: '2027-05' }] })).toEqual(new Set([a.id]));
    expect(await set({ attributes: [{ key: 'car_extras', type: 'multi_select', values: ['air_con', 'navigation'], match: 'all' }] })).toEqual(new Set([a.id]));
    expect(await set({ attributes: [{ key: 'car_extras', type: 'multi_select', values: ['air_con', 'navigation'], match: 'any' }] })).toEqual(new Set([a.id, b.id]));
    expect(await set({ price: { min: null, max: 1_000_000 } })).toEqual(new Set([b.id, d.id]));
    expect(await set({ price: { min: 1_000_000, max: null } })).toEqual(new Set([a.id]));
    expect(await set({ shipping: true })).toEqual(new Set([b.id]));
    // A radius around Rostock leaves Berlin out, and sorts by distance
    const around = { point: { lat: 54.09, lng: 12.13 }, radiusM: 50_000 };
    expect(new Set(await ids({ keyword: k, categoryIds: [cars.id], around }))).toEqual(new Set([a.id, b.id, c.id, d.id]));
    const near = await search({ keyword: k, categoryIds: [cars.id], around, sort: 'distance' });
    expect(near.items.every((l) => l.distanceKm !== null && l.distanceKm <= 50)).toBe(true);
    // Price order: free is 0, no price last in both directions
    expect(await ids({ keyword: k, categoryIds: [cars.id], locationId: rostock.id, sort: 'price_asc' })).toEqual([d.id, b.id, a.id, c.id]);
    expect(await ids({ keyword: k, categoryIds: [cars.id], locationId: rostock.id, sort: 'price_desc' })).toEqual([a.id, b.id, d.id, c.id]);
    // Another country never
    expect(await ids({ keyword: k, countryCode: 'AT' })).toEqual([]);
  });

  it('counts per category and per option, each without its own filter', async () => {
    const u = await makeUser(tx);
    const cars = await category(tx, 'cars');
    const x = await listing(u.id, 'ماشین نیدرهوف', { categoryId: cars.id, attributes: { brand: 'bmw' } });
    const y = await listing(u.id, 'ماشین نیدرهوف', { categoryId: cars.id, attributes: { brand: 'audi' } });
    const z = await listing(u.id, 'گوشی نیدرهوف');
    await indexed(x.id, y.id, z.id);
    const r = await searchListings(
      appDb,
      base({ keyword: 'نیدرهوف', categoryIds: [cars.id], attributes: [{ key: 'brand', type: 'select', values: ['bmw'] }] }),
      null,
      { meili, index, facetKeys: ['brand', 'fuel'] },
    );
    expect(r.items.map((l) => l.id)).toEqual([x.id]);
    expect(r.facets!['attrs.brand']).toEqual({ bmw: 1, audi: 1 });
    expect(r.facets!.category_id).toEqual({ [cars.id]: 2, [z.categoryId!]: 1 });
  });

  it('pages by an offset cursor tied to the sort, with cards from PostgreSQL', async () => {
    const u = await makeUser(tx);
    const many = [];
    for (let i = 0; i < PAGE_SIZE + 3; i++) many.push(await listing(u.id, `دوچرخه اشپاندو ${i}`, { rankedAt: new Date(Date.now() - i * 60_000) }));
    await indexed(...many.map((l) => l.id));
    const first = await search({ keyword: 'اشپاندو', sort: 'newest' });
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.total).toBe(PAGE_SIZE + 3);
    expect(first.items[0]).toMatchObject({ id: many[0]!.id, title: many[0]!.title, priceMinor: 25_000 });
    const second = await search({ keyword: 'اشپاندو', sort: 'newest' }, first.next);
    expect(second.items.map((l) => l.id)).toEqual(many.slice(PAGE_SIZE).map((l) => l.id));
    expect(second.next).toBeNull();
    // A cursor from another sort, or forged, starts again from the top
    expect(decodeOffsetCursor(first.next, 'price_asc')).toBe(0);
    expect(decodeOffsetCursor('bm90LWEtY3Vyc29y', 'newest')).toBe(0);
    expect(decodeOffsetCursor(encodeOffsetCursor(13, 'newest'), 'newest')).toBe(0);
    expect(decodeOffsetCursor(encodeOffsetCursor(COUNT_CAP + PAGE_SIZE, 'newest'), 'newest')).toBe(0);
  });

  it('a stale index entry is never shown, and events stay out of the listings', async () => {
    const u = await makeUser(tx);
    const sold = await listing(u.id, 'یخچال کرویتسبرگ');
    const ev = await listing(u.id, 'جشن کرویتسبرگ');
    await db.insert(schema.eventDetails).values({ listingId: ev.id, timeZone: 'Europe/Berlin' });
    await indexed(sold.id, ev.id);
    // Sold after indexing, and the sync job hasn't run yet
    await db.update(schema.listings).set({ status: 'sold' }).where(eq(schema.listings.id, sold.id));
    const r = await searchListings(appDb, base({ keyword: 'کرویتسبرگ' }), null, { meili, index, events: true });
    expect(r.items).toEqual([]);
    expect(r.eventIds).toEqual([ev.id]);
  });
});

describe('when Meilisearch fails', () => {
  it('the keyword goes to PostgreSQL: every word or a synonym, ZWNJ ignored, newest first', async () => {
    const u = await makeUser(tx);
    const a = await listing(u.id, `ماشین${ZWNJ}های شونبرگ`, { rankedAt: new Date(Date.now() - 60_000) });
    const b = await listing(u.id, 'خودرو شونبرگ', { rankedAt: new Date() });
    await listing(u.id, 'گوشی شونبرگ');
    const down = new Meili({ url: 'http://127.0.0.1:9', key: 'x'.repeat(16) });
    const r = await searchListings(appDb, base({ keyword: 'ماشینهای شونبرگ' }), null, { meili: down, index });
    expect(r.fallback).toBe(true);
    expect(r.items.map((l) => l.id)).toEqual([a.id]);
    const syn = await searchListings(appDb, base({ keyword: 'خودرو شونبرگ' }), null, { meili: down, index });
    expect(syn.items.map((l) => l.id)).toEqual([b.id, a.id]);
    // Unset is the same, without an error
    const unset = await searchListings(appDb, base({ keyword: 'ماشین شونبرگ' }), null, { meili: null });
    expect(unset.fallback).toBe(true);
    expect(unset.items.map((l) => l.id)).toEqual([b.id, a.id]);
    // LIKE wildcards in a keyword are plain characters
    expect((await searchListings(appDb, base({ keyword: '% _' }), null, { meili: null })).items).toEqual([]);
  });

  it('a filter value can never break out of its quotes', () => {
    const f = meiliFilter(base({ keyword: 'x', postalCode: '1" OR country = "AT', attributes: [{ key: 'brand', type: 'select', values: ['a"b'] }] }));
    expect(f).toContain('postal_code = "1\\" OR country = \\"AT"');
    expect(f).toContain('attrs.brand IN ["a\\"b"]');
  });
});

describe('the address', () => {
  const ctx = () => filterContext(catalog, catalog.bySlug.get('cars')!, 2);

  it('keeps the keyword as typed, sorts by relevance and writes it first', () => {
    const { state, refused } = parseBrowseParams({ q: '  پژو   ۲۰۶ ', brand: 'bmw' }, ctx());
    expect(refused).toEqual([]);
    expect(state).toMatchObject({ q: 'پژو ۲۰۶', sort: 'relevance' });
    expect(browseQuery(state, 2)).toBe(`?q=${encodeURIComponent('پژو ۲۰۶')}&brand=bmw`);
    expect(browseQuery({ ...state, sort: 'newest' }, 2)).toBe(`?q=${encodeURIComponent('پژو ۲۰۶')}&sort=newest&brand=bmw`);
    // Relevance needs a keyword
    expect(parseBrowseParams({ sort: 'relevance' }, ctx()).refused).toEqual(['sort']);
    // Removing the keyword goes back to the newest; "clear all" keeps it
    expect(without(state, 'q')).toMatchObject({ q: null, sort: 'newest' });
    expect(without(state, 'all')).toMatchObject({ q: 'پژو ۲۰۶', attributes: [] });
  });

  it('cuts long keywords and drops ones with nothing searchable', () => {
    expect(cleanKeyword('یک دو سه چهار پنج شش هفت هشت نه ده یازده')).toBe('یک دو سه چهار پنج شش هفت هشت نه ده');
    expect(cleanKeyword('ب'.repeat(300))!.length).toBe(KEYWORD_MAX_LENGTH);
    expect(cleanKeyword('ًٌ')).toBeNull();
    expect(parseBrowseParams({ q: 'ًٌ' }, ctx()).refused).toEqual(['q']);
  });

  it('keyword pages are never shared at the edge', () => {
    expect(browseCacheControl('/germany', new URLSearchParams('q=x'), () => undefined)).toBe('private, no-store');
    expect(browseCacheControl('/germany', new URLSearchParams(), () => undefined)).toBe('public, max-age=0, s-maxage=60');
  });
});

describe('matching one listing (saved-search alerts)', () => {
  it('asks for exactly that listing under each search', async () => {
    const u = await makeUser(tx);
    const cars = await category(tx, 'cars');
    const car = await listing(u.id, 'ماشین تمپلهوف', { categoryId: cars.id, attributes: { brand: 'bmw' } });
    const other = await listing(u.id, 'ماشین تمپلهوف');
    await indexed(car.id, other.id);
    const hit = await keywordMatches(meili, index, car.id, [
      { id: 's1', filters: base({ keyword: 'خودرو تمپلهوف' }) },
      { id: 's2', filters: base({ keyword: 'تمپلهوف', attributes: [{ key: 'brand', type: 'select', values: ['audi'] }] }) },
      { id: 's3', filters: base({ keyword: 'تمپلهوف', categoryIds: [cars.id] }) },
      { id: 's4', filters: base({ keyword: 'گوشی' }) },
    ]);
    expect(hit).toEqual(new Set(['s1', 's3']));
  });
});
