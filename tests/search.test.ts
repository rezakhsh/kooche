import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import type { Point } from '../src/db/types';
import { distanceMeters, snapToGrid } from '../src/lib/geo';
import { loadCatalog, type Catalog } from '../src/modules/listings/catalog';
import { browseListings, countListings, decodeCursor, encodeCursor, PAGE_SIZE, roundKm, type SearchFilters } from '../src/modules/search/browse';
import {
  browseParamsSchema,
  browseQuery,
  currentQuery,
  filterContext,
  parseBrowseParams,
  without,
  type FilterContext,
  type RawParams,
} from '../src/modules/search/filters';
import { resolveFilters } from '../src/modules/search/index';
import { createNearToken, NEAR_TOKEN_TTL_MS, readNearToken } from '../src/modules/search/near';
import { category, db, location, makeListing, makeUser, rollback, setRole, type Tx } from './db';
import { openEverywhereForTests } from './listings-fixtures';

// Browse filters, the browse query, keyset paging and "near me" (approved Oct 18, 2026).

let catalog: Catalog;
beforeAll(async () => {
  catalog = await loadCatalog(db);
});

const ctxFor = (slug: string | null, minorUnit = 2): FilterContext =>
  filterContext(catalog, slug ? catalog.bySlug.get(slug)! : null, minorUnit);

const parse = (raw: RawParams, slug: string | null = 'cars') => parseBrowseParams(raw, ctxFor(slug));


// Since wave 0 only the Berlin area is open and Austria is closed; this file is about other rules
let closeAgain: () => Promise<void>;
beforeAll(async () => {
  closeAgain = await openEverywhereForTests();
});
afterAll(async () => {
  await closeAgain();
});

describe('filters from the definitions', () => {
  it('reads the canonical address and writes it back unchanged', () => {
    const raw = { sort: 'price_asc', price: '..15000', brand: 'bmw,audi', year: '2015..', mileage_km: '..100000', gearbox: 'automatic' };
    const { state, refused } = parse(raw);
    expect(refused).toEqual([]);
    expect(state.sort).toBe('price_asc');
    expect(state.price).toEqual({ min: null, max: 1_500_000 }); // minor units
    // Choices in the order of the field's options, fields in the order of the category
    const brands = catalog.bySlug.get('cars')!.ownAttributes.find((a) => a.key === 'brand')!.options.map((o) => o.value);
    expect(state.attributes.map((f) => f.key)).toEqual(['brand', 'year', 'mileage_km', 'gearbox']);
    expect(state.attributes[0]).toMatchObject({ type: 'select', values: ['audi', 'bmw'].sort((a, b) => brands.indexOf(a) - brands.indexOf(b)) });
    const q = browseQuery(state, 2);
    expect(q).toMatch(/^\?sort=price_asc&price=\.\.15000&brand=[a-z,]+&year=2015\.\.&mileage_km=\.\.100000&gearbox=automatic$/);
    const again = parseBrowseParams(Object.fromEntries(new URLSearchParams(q)), ctxFor('cars'));
    expect(again).toEqual({ state, refused: [] });
    expect(browseQuery(again.state, 2)).toBe(q);
  });

  it('folds the plain form (ranges, repeated checkboxes, empty fields, Persian digits) into the canonical form', () => {
    const { state, refused } = parse({
      year_min: '۲۰۱۵',
      year_max: '',
      price_min: '1.200',
      price_max: '',
      fuel: ['petrol', 'diesel'],
      power_hp: '',
      service_history: '1',
    });
    expect(refused).toEqual([]);
    expect(browseQuery(state, 2)).toBe('?price=1200..&year=2015..&fuel=petrol,diesel&service_history=1');
  });

  it('refuses unknown, forged and out-of-place filters, and keeps the rest', () => {
    const cases: [RawParams, string][] = [
      [{ foo: '1' }, 'foo'],
      [JSON.parse('{"__proto__":"x"}') as RawParams, '__proto__'],
      [{ constructor: 'x' }, 'constructor'],
      [{ trim: 'M Sport' }, 'trim'], // free text is never a filter
      [{ rooms: '3..' }, 'rooms'], // a field of another category
      [{ fuel: 'rocket' }, 'fuel'], // not an option
      [{ fuel: "diesel' OR 1=1 --" }, 'fuel'],
      [{ year: '1800..' }, 'year'], // below the field's own minimum
      [{ year: '2020..2010' }, 'year'], // reversed
      [{ year: 'abc' }, 'year'],
      [{ year: '2015' }, 'year'], // not a range
      [{ year: '2015..2016..2017' }, 'year'],
      [{ service_history: 'true' }, 'service_history'],
      [{ fuel: Array.from({ length: 21 }, () => 'diesel') }, 'fuel'],
      [{ model: 'bmw-3-series' }, 'model'], // a model needs its make
      [{ sort: 'distance' }, 'sort'], // no place to measure from
      [{ sort: 'random' }, 'sort'],
      [{ r: '10' }, 'r'], // a radius without a place
      [{ r: '7', postal: '12045' }, 'r'], // not one of 5, 10, 25, 50
      [{ price: 'free' }, 'price'],
      [{ after: "'; DROP TABLE listings; --" }, 'after'],
    ];
    for (const [raw, key] of cases) {
      const { state, refused } = parse({ ...raw, gearbox: 'manual' });
      expect(refused, JSON.stringify(raw)).toContain(key);
      // The valid filter next to it survives
      expect(state.attributes.find((f) => f.key === 'gearbox'), JSON.stringify(raw)).toBeDefined();
      expect(browseQuery(state, 2)).not.toContain(key === '__proto__' ? '__proto__' : `${key}=`);
    }
  });

  it('keeps only the models of a chosen make', () => {
    const cars = catalog.bySlug.get('cars')!;
    const model = cars.ownAttributes.find((a) => a.key === 'model')!;
    const bmwModel = model.options.find((o) => o.parentValue === 'bmw')!.value;
    const audiModel = model.options.find((o) => o.parentValue === 'audi')!.value;
    const ok = parse({ brand: 'bmw', model: bmwModel });
    expect(ok.refused).toEqual([]);
    const mixed = parse({ brand: 'bmw', model: `${bmwModel},${audiModel}` });
    expect(mixed.refused).toEqual(['model']);
    expect(mixed.state.attributes.find((f) => f.key === 'model')).toMatchObject({ values: [bmwModel] });
    // Taking the make away takes its models with it
    const left = without(ok.state, { key: 'brand' }, ctxFor('cars').defs);
    expect(left.attributes).toEqual([]);
  });

  it('refuses retired and non-filterable fields, and a price where the category has none', () => {
    expect(parse({ rent_type: 'x' }, 'apartments-rent').refused).toEqual(['rent_type']); // retired
    expect(parse({ deposit: '..1000' }, 'apartments-rent').refused).toEqual(['deposit']); // not filterable
    expect(parse({ has_receipt: '1' }, 'mobile-phones').refused).toEqual(['has_receipt']);
    expect(parse({ price: '..1000' }, 'jobs').refused).toEqual(['price']);
    expect(parse({ sort: 'price_asc' }, 'it-jobs').refused).toEqual(['sort']);
    // Without a category only price, place and shipping
    expect(parse({ condition: 'new', ship: '1', price: '10..20' }, null)).toMatchObject({ refused: ['condition'], state: { ship: true, price: { min: 1000, max: 2000 } } });
  });

  it('a parent category offers only the fields every listing under it has', () => {
    expect(ctxFor('electronics').defs.map((d) => d.key)).toEqual(['condition']);
    expect(parse({ brand: 'apple' }, 'electronics').refused).toEqual(['brand']);
    expect(ctxFor('mobile-phones').defs.map((d) => d.key)).toContain('brand');
  });

  it('dates match the field: a day, or a month for month fields', () => {
    expect(parse({ available_from: '..2026-11-01' }, 'apartments-rent').refused).toEqual([]);
    expect(parse({ available_from: '..2026-02-30' }, 'apartments-rent').refused).toEqual(['available_from']);
    expect(parse({ available_from: '..2026-11' }, 'apartments-rent').refused).toEqual(['available_from']);
    expect(parse({ inspection_until: '2027-03..' }).refused).toEqual([]);
    expect(parse({ inspection_until: '2027-03-01..' }).refused).toEqual(['inspection_until']);
    // The form's date inputs, `available_from` is a field name that ends like a suffix
    const form = parse({ available_from_from: '2026-11-01', available_from_to: '' }, 'apartments-rent');
    expect(browseQuery(form.state, 2)).toBe('?available_from=2026-11-01..');
  });

  it('the strict schema refuses anything the page does not know', () => {
    const schema = browseParamsSchema(ctxFor('cars'));
    expect(schema.safeParse({ fuel: 'diesel' }).success).toBe(true);
    expect(schema.safeParse({ fuel: 'diesel', rooms: '3..' }).success).toBe(false);
  });

  it('a multi-select matches any value, a checklist all of them', () => {
    const any = parse({ trades: 'painting' }, 'home-repairs').state.attributes[0];
    const all = parse({ features: 'garden,parking' }, 'apartments-rent').state.attributes.find((f) => f.key === 'features');
    expect(any).toMatchObject({ type: 'multi_select', match: 'any' });
    expect(all).toMatchObject({ type: 'multi_select', match: 'all' });
  });

  it('the address as sent is compared in the same encoding', () => {
    expect(currentQuery({ brand: 'bmw,audi', year: '2015..' })).toBe('?brand=bmw,audi&year=2015..');
    expect(currentQuery({ fuel: ['a', 'b'] })).toBe('?fuel=a&fuel=b');
  });
});

// ---------------------------------------------------------------------------

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
  sort: 'newest',
  ...over,
});

async function all(tx: Tx, f: SearchFilters): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const page = await browseListings(tx, f, cursor);
    ids.push(...page.items.map((x) => x.id));
    if (!page.next) break;
    cursor = page.next;
  }
  return ids;
}

describe('browse query', () => {
  it('each filter type returns exactly the matching listings', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const cars = await category(tx, 'cars');
      const rostock = await location(tx, 'rostock');
      const car = (attributes: Record<string, unknown>, over: Partial<typeof schema.listings.$inferInsert> = {}) =>
        makeListing(tx, u.id, { categoryId: cars.id, locationId: rostock.id, point: rostock.center, attributes, ...over });
      const a = await car({ brand: 'bmw', fuel: 'diesel', year: 2018, mileage_km: 90_000, service_history: true, inspection_until: '2027-05', car_extras: ['air_con', 'navigation'] }, { priceMinor: 1_400_000 });
      const b = await car({ brand: 'audi', fuel: 'petrol', year: 2012, mileage_km: 180_000, car_extras: ['air_con'] }, { priceMinor: 600_000, shippingOffered: true });
      const c = await car({ brand: 'bmw', fuel: 'petrol', year: 2021, mileage_km: 20_000 }, { priceType: 'on_request', priceMinor: null, currency: null });
      const d = await car({ brand: 'vw', year: '2019' }, { priceType: 'free', priceMinor: null, currency: null }); // a stray string year
      const paused = await car({ brand: 'bmw' }, { status: 'paused' });
      const vienna = await location(tx, 'wien');
      const austrian = await car({ brand: 'bmw' }, { countryCode: 'AT', locationId: vienna.id, point: vienna.center });
      const event = await car({ brand: 'bmw' });
      await tx.insert(schema.eventDetails).values({ listingId: event.id, timeZone: 'Europe/Berlin' });
      await setRole(tx, 'classifieds_app');

      const inCity = (over: Partial<SearchFilters>) => all(tx, base({ categoryIds: [cars.id], locationId: rostock.id, ...over }));
      // Only this test's own listings: other files commit cars in Rostock too, in any order
      const mine = new Set([a, b, c, d, paused, austrian, event].map((l) => l.id));
      const set = async (over: Partial<SearchFilters>) => new Set((await inCity(over)).filter((id) => mine.has(id)));

      expect(await set({})).toEqual(new Set([a.id, b.id, c.id, d.id]));
      expect(await set({ attributes: [{ key: 'brand', type: 'select', values: ['bmw'] }] })).toEqual(new Set([a.id, c.id]));
      expect(await set({ attributes: [{ key: 'brand', type: 'select', values: ['bmw', 'audi'] }] })).toEqual(new Set([a.id, b.id, c.id]));
      expect(await set({ attributes: [{ key: 'brand', type: 'select', values: ['bmw'] }, { key: 'fuel', type: 'select', values: ['petrol'] }] })).toEqual(new Set([c.id]));
      expect(await set({ attributes: [{ key: 'year', type: 'number', min: 2015, max: null, money: false }] })).toEqual(new Set([a.id, c.id]));
      expect(await set({ attributes: [{ key: 'mileage_km', type: 'number', min: null, max: 100_000, money: false }] })).toEqual(new Set([a.id, c.id]));
      expect(await set({ attributes: [{ key: 'service_history', type: 'boolean' }] })).toEqual(new Set([a.id]));
      expect(await set({ attributes: [{ key: 'inspection_until', type: 'date', from: '2027-01', to: null }] })).toEqual(new Set([a.id]));
      expect(await set({ attributes: [{ key: 'car_extras', type: 'multi_select', values: ['air_con', 'navigation'], match: 'all' }] })).toEqual(new Set([a.id]));
      expect(await set({ attributes: [{ key: 'car_extras', type: 'multi_select', values: ['air_con', 'navigation'], match: 'any' }] })).toEqual(new Set([a.id, b.id]));
      // Free counts as 0; on request has no price and leaves the price filter
      expect(await set({ price: { min: null, max: 1_000_000 } })).toEqual(new Set([b.id, d.id]));
      expect(await set({ price: { min: 1_000_000, max: null } })).toEqual(new Set([a.id]));
      expect(await set({ shipping: true })).toEqual(new Set([b.id]));
      // Plus whatever live cars other files left in Rostock (they commit theirs)
      const [others] = await tx.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM listings l
        WHERE l.category_id = ${cars.id} AND l.location_id = ${rostock.id} AND l.status = 'active'
          AND l.user_id <> ${u.id} AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`);
      expect(await countListings(tx, base({ categoryIds: [cars.id], locationId: rostock.id }))).toBe(4 + others!.n);
      // Never: paused, another country, events
      const everywhere = await all(tx, base({ categoryIds: [cars.id] }));
      expect(everywhere).not.toContain(paused.id);
      expect(everywhere).not.toContain(austrian.id);
      expect(everywhere).not.toContain(event.id);
      expect(await all(tx, base({ countryCode: 'AT', categoryIds: [cars.id] }))).toContain(austrian.id);
    });
  });

  it('seller: only private people’s or only businesses’ listings, and back in the address (wave 2 part 4)', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const boats = await category(tx, 'boats');
      const [org] = await tx
        .insert(schema.organizations)
        .values({ slug: `boats-${u.id.slice(-8)}`, name: 'قایق‌فروشی', nameNormalized: 'قایق فروشی', countryCode: 'DE', createdByUserId: u.id })
        .returning();
      const own = await makeListing(tx, u.id, { categoryId: boats.id, postalCode: '12099', placeName: 'Berlin' });
      const shop = await makeListing(tx, u.id, { categoryId: boats.id, postalCode: '12099', placeName: 'Berlin', organizationId: org!.id });
      await setRole(tx, 'classifieds_app');
      const f = (seller: SearchFilters['seller']) => all(tx, base({ categoryIds: [boats.id], postalCode: '12099', seller }));
      expect(new Set(await f(null))).toEqual(new Set([own.id, shop.id]));
      expect(await f('private')).toEqual([own.id]);
      expect(await f('business')).toEqual([shop.id]);
    });
    expect(parse({ seller: 'business' }, null)).toMatchObject({ refused: [], state: { seller: 'business' } });
    expect(parse({ seller: 'shop' }, null)).toMatchObject({ refused: ['seller'], state: { seller: null } });
  });

  it('postal code: this code only', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const boats = await category(tx, 'boats');
      const x = await makeListing(tx, u.id, { categoryId: boats.id, postalCode: '12045', placeName: 'Berlin' });
      await makeListing(tx, u.id, { categoryId: boats.id, postalCode: '10115', placeName: 'Berlin' });
      await setRole(tx, 'classifieds_app');
      expect(await all(tx, base({ categoryIds: [boats.id], postalCode: '12045' }))).toEqual([x.id]);
    });
  });
});

describe('keyset paging', () => {
  it('no duplicates and no gaps in any order, with ties in time and price, while listings are added', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const boats = await category(tx, 'boats');
      const kiel = await location(tx, 'kiel');
      const sameTime = new Date('2026-10-01T12:00:00.123456Z');
      const created: string[] = [];
      for (let i = 0; i < 70; i++) {
        const priced = i % 5 !== 0;
        const at = i < 40 ? sameTime : new Date(sameTime.getTime() - i * 1000);
        const point = snapToGrid({ lat: kiel.center.lat + (i % 7) * 0.01, lng: kiel.center.lng });
        const l = await makeListing(tx, u.id, {
          categoryId: boats.id,
          locationId: kiel.id,
          point,
          locationPrecision: 'area',
          rankedAt: at,
          publishedAt: at,
          ...(priced ? { priceMinor: (i % 4) * 10_000 } : { priceType: i % 10 === 0 ? 'free' : 'exchange', priceMinor: null, currency: null }),
        });
        created.push(l.id);
      }
      // Ranked at the same microsecond: the cursor must keep the microseconds
      await tx.execute(sql`UPDATE listings SET ranked_at = ${sameTime.toISOString()}::timestamptz + interval '0.000456 seconds' WHERE id = ANY(${sql.raw(`ARRAY[${created.slice(0, 40).map((id) => `'${id}'::uuid`).join(',')}]`)})`);
      await setRole(tx, 'classifieds_app');

      const around = { point: kiel.center, radiusM: 50_000 };
      for (const sort of ['newest', 'price_asc', 'price_desc', 'distance'] as const) {
        const f = base({ categoryIds: [boats.id], sort, around: sort === 'distance' ? around : null });
        const ids = await all(tx, f);
        expect(new Set(ids).size, sort).toBe(ids.length);
        expect(new Set(ids), sort).toEqual(new Set(created));
      }

      // A listing published between page 1 and page 2 doesn't show twice or push one out
      const f = base({ categoryIds: [boats.id] });
      const first = await browseListings(tx, f, null);
      expect(first.items).toHaveLength(PAGE_SIZE);
      await tx.execute(sql`RESET ROLE`);
      const late = await makeListing(tx, u.id, { categoryId: boats.id, locationId: kiel.id });
      await setRole(tx, 'classifieds_app');
      const rest: string[] = [];
      let cursor = first.next;
      while (cursor) {
        const p = await browseListings(tx, f, cursor);
        rest.push(...p.items.map((x) => x.id));
        cursor = p.next;
      }
      const seen = [...first.items.map((x) => x.id), ...rest];
      expect(seen).not.toContain(late.id);
      expect(new Set(seen)).toEqual(new Set(created));
    });
  });

  it('prices: lowest first with free as 0, listings without a price last in both orders', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const boats = await category(tx, 'boats');
      const kiel = await location(tx, 'kiel');
      const mk = (over: Partial<typeof schema.listings.$inferInsert>) => makeListing(tx, u.id, { categoryId: boats.id, locationId: kiel.id, ...over });
      const cheap = await mk({ priceMinor: 100 });
      const dear = await mk({ priceMinor: 900_000 });
      const free = await mk({ priceType: 'free', priceMinor: null, currency: null });
      const swap = await mk({ priceType: 'exchange', priceMinor: null, currency: null });
      await setRole(tx, 'classifieds_app');
      expect(await all(tx, base({ categoryIds: [boats.id], sort: 'price_asc' }))).toEqual([free.id, cheap.id, dear.id, swap.id]);
      expect(await all(tx, base({ categoryIds: [boats.id], sort: 'price_desc' }))).toEqual([dear.id, cheap.id, free.id, swap.id]);
    });
  });

  it('a cursor of another sort, or a forged one, is ignored', () => {
    const c = encodeCursor('2026-10-01T12:00:00.123456Z', '01900000-0000-7000-8000-000000000000');
    expect(decodeCursor(c, 'newest')).toMatchObject({ key: '2026-10-01T12:00:00.123456Z' });
    expect(decodeCursor(c, 'price_asc')).toBeNull();
    expect(decodeCursor(encodeCursor(5, 'not-a-uuid'), 'price_asc')).toBeNull();
    expect(decodeCursor('bm90IGpzb24', 'newest')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

const SECRET = 'x'.repeat(40);

describe('near me', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the token holds only the ~500 m cell, encrypted, for 2 hours', () => {
    const exact = { lat: 52.520008, lng: 13.404954 };
    const token = createNearToken(SECRET, exact, 1_000_000);
    // Only base64url: no dot, so no readable coordinate (a plain "52" turns up by chance in about 1
    // token in 75, which made this test fail now and then)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url').toString('latin1')).not.toMatch(/52\.5|13\.4/);
    const read = readNearToken(SECRET, token, 1_000_000 + 60_000);
    expect(read).toEqual({ ok: true, point: snapToGrid(exact) });
    expect(read.ok && read.point).not.toEqual(exact);
    expect(readNearToken(SECRET, token, 1_000_000 + NEAR_TOKEN_TTL_MS)).toEqual({ ok: false, reason: 'expired' });
    expect(readNearToken('y'.repeat(40), token, 1_000_000)).toEqual({ ok: false, reason: 'invalid' });
    // Any changed character fails the authentication tag
    for (const i of [0, 5, 20, token.length - 2]) {
      const changed = token.slice(0, i) + (token[i] === 'A' ? 'B' : 'A') + token.slice(i + 1);
      expect(readNearToken(SECRET, changed, 1_000_000).ok, `position ${i}`).toBe(false);
    }
    expect(readNearToken(SECRET, 'short', 1_000_000)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('radius results come from the stored rounded point, sorted by distance, with whole kilometres and no coordinates', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const boats = await category(tx, 'boats');
      const berlin = await location(tx, 'berlin');
      const hamburg = await location(tx, 'hamburg');
      const near = snapToGrid({ lat: berlin.center.lat + 0.02, lng: berlin.center.lng }); // ~2.2 km north
      const atCentre = await makeListing(tx, u.id, { categoryId: boats.id, point: berlin.center });
      const north = await makeListing(tx, u.id, { categoryId: boats.id, point: near, locationPrecision: 'area' });
      await makeListing(tx, u.id, { categoryId: boats.id, locationId: hamburg.id, point: hamburg.center });
      await setRole(tx, 'classifieds_app');

      const visitor = { lat: berlin.center.lat - 0.0011, lng: berlin.center.lng + 0.0012 };
      const token = createNearToken(SECRET, visitor);
      const log = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'debug')];
      const { filters, place, notice } = await resolveFilters(tx, {
        countryCode: 'DE',
        categoryIds: [boats.id],
        locationId: null,
        state: { ...parseBrowseParams({ near: token, r: '10', sort: 'distance' }, ctxFor('boats')).state },
        secret: SECRET,
      });
      expect(notice).toBeNull();
      expect(place).toEqual({ kind: 'near', radiusKm: 10 });
      expect(filters.around).toEqual({ point: snapToGrid(visitor), radiusM: 10_000 });
      const page = await browseListings(tx, filters, null);
      expect(page.items.map((x) => x.id)).toEqual([atCentre.id, north.id]);
      expect(page.items.map((x) => x.distanceKm)).toEqual([berlin.center, near].map((p) => roundKm(distanceMeters(snapToGrid(visitor), p))));
      expect(page.items[1]!.distanceKm).toBeGreaterThan(1);
      for (const x of page.items) expect(Number.isInteger(x.distanceKm)).toBe(true);
      // Nothing in the result says where a listing or the visitor is
      const json = JSON.stringify(page);
      for (const p of [berlin.center, near, visitor, snapToGrid(visitor)] as Point[]) {
        expect(json).not.toContain(String(p.lat).slice(0, 6));
        expect(json).not.toContain(String(p.lng).slice(0, 6));
      }
      expect(Object.keys(page.items[0]!)).not.toContain('point');
      // And nothing was logged
      for (const spy of log) expect(spy).not.toHaveBeenCalled();
    });
  });

  it('a token for a place outside the country, an expired or a changed one is dropped with a notice', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      const resolve = (token: string) =>
        resolveFilters(tx, {
          countryCode: 'DE',
          categoryIds: null,
          locationId: null,
          state: parseBrowseParams({ near: token, r: '10', sort: 'distance' }, ctxFor(null)).state,
          secret: SECRET,
        });
      const paris = await resolve(createNearToken(SECRET, { lat: 48.8566, lng: 2.3522 }));
      expect(paris.notice).toBe('near_outside');
      expect(paris.filters.around).toBeNull();
      expect(paris.state).toMatchObject({ near: null, sort: 'newest' });
      const old = await resolve(createNearToken(SECRET, { lat: 52.52, lng: 13.4 }, Date.now() - NEAR_TOKEN_TTL_MS - 1));
      expect(old.notice).toBe('near_expired');
      const other = await resolve(createNearToken('z'.repeat(40), { lat: 52.52, lng: 13.4 }));
      expect(other.notice).toBe('near_invalid');
    });
  });

  it('postal code and radius: the centre of the postal area, the city dropped', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      const berlin = await location(tx, 'berlin');
      const r = await resolveFilters(tx, {
        countryCode: 'DE',
        categoryIds: null,
        locationId: berlin.id,
        state: parseBrowseParams({ postal: '12045', r: '5' }, ctxFor(null)).state,
        secret: SECRET,
      });
      expect(r.notice).toBeNull();
      expect(r.place).toMatchObject({ kind: 'postal', code: '12045', label: 'Berlin', radiusKm: 5 });
      expect(r.filters).toMatchObject({ locationId: null, postalCode: null, around: { radiusM: 5000 } });
      const exact = await resolveFilters(tx, {
        countryCode: 'DE',
        categoryIds: null,
        locationId: null,
        state: parseBrowseParams({ postal: '12045' }, ctxFor(null)).state,
        secret: SECRET,
      });
      expect(exact.filters).toMatchObject({ postalCode: '12045', around: null });
      const unknown = await resolveFilters(tx, {
        countryCode: 'DE',
        categoryIds: null,
        locationId: null,
        state: parseBrowseParams({ postal: '00000' }, ctxFor(null)).state,
        secret: SECRET,
      });
      expect(unknown.notice).toBe('postal_unknown');
    });
  });

  it('distances round to whole kilometres, never under 1', () => {
    expect([roundKm(0), roundKm(499), roundKm(1499), roundKm(1500), roundKm(24_600)]).toEqual([1, 1, 1, 2, 25]);
  });
});
