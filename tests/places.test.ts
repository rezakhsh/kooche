import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { projectOnOutline } from '../src/components/outline-map';
import * as schema from '../src/db/schema';
import { foldLatin } from '../src/lib/fold-latin';
import { distanceMeters, snapToGrid } from '../src/lib/geo';
import { listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { placeParts } from '../src/modules/listings/place-text';
import {
  clearSavedPlace,
  nearestPostalPlace,
  placeValue,
  resolvePlace,
  searchPlaces,
  setSavedPlace,
  type Place,
} from '../src/modules/listings/places';
import { activeCountries, countryListings, savedPlace } from '../src/modules/listings/queries';
import { parseSmsNumber } from '../src/modules/users/phone-number';
import { appDb, workerDb } from './accounts';
import { db } from './db';
import { categoryBySlug, city, listing, user } from './listings-fixtures';
import { createDraft } from '../src/modules/listings/listings';

// Where a listing is (decided Oct 17, 2026): a country, then a postal code or town from our own
// data (GeoNames), or the browser's position snapped to ~500 m. No street, no exact point, and
// the currency is always the country's.

async function input(over: Partial<ListingInput> = {}): Promise<ListingInput> {
  return listingInputSchema.parse({
    title: 'دوچرخه شهری ۲۸ اینچ',
    description: 'سالم، با چراغ و قفل. فقط تحویل حضوری.',
    attributes: { condition: 'used' },
    priceType: 'fixed',
    amount: '120',
    countryCode: 'DE',
    place: '12045',
    ...over,
  });
}

async function draft(userId: string, slug = 'bicycles') {
  const r = await createDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!r.ok) throw new Error(r.reason);
  return r.listingId;
}

async function publish(userId: string, over: Partial<ListingInput> = {}) {
  const id = await draft(userId);
  const r = await saveListing(appDb, { userId, listingId: id, input: await input(over), intent: 'publish' });
  return { id, r };
}

async function postal(countryCode: string, code: string, name: string) {
  const [p] = await db
    .select()
    .from(schema.postalPlaces)
    .where(and(eq(schema.postalPlaces.countryCode, countryCode), eq(schema.postalPlaces.postalCode, code), eq(schema.postalPlaces.placeName, name)));
  if (!p) throw new Error(`no postal place ${code} ${name}`);
  return p;
}

const mustPlace = (p: Place | string | null): Place => {
  if (!p || typeof p === 'string') throw new Error(`expected a place, got ${p}`);
  return p;
};

describe('countries and seeded places', () => {
  it('Germany and Austria are open with their slugs; Turkey is listed but closed, with the lira', async () => {
    expect((await activeCountries(appDb)).map((c) => [c.code, c.slug, c.currency.code])).toEqual([
      ['DE', 'germany', 'EUR'],
      ['AT', 'austria', 'EUR'],
    ]);
    const [tr] = await db.select().from(schema.countries).where(eq(schema.countries.code, 'TR'));
    expect(tr).toMatchObject({ isActive: false, slug: 'turkey', defaultCurrency: 'TRY' });
    const [lira] = await db.select().from(schema.currencies).where(eq(schema.currencies.code, 'TRY'));
    expect(lira).toMatchObject({ minorUnit: 2, symbol: '₺' });
  });

  it('Austria has its 9 states and its cities, Vienna and every state capital among them', async () => {
    const at = await db.select().from(schema.locations).where(eq(schema.locations.countryCode, 'AT'));
    expect(at.filter((l) => l.kind === 'region')).toHaveLength(9);
    const cities = at.filter((l) => l.kind === 'city').map((l) => l.slug);
    expect(cities).toHaveLength(29);
    for (const capital of ['wien', 'sankt-poelten', 'linz', 'salzburg', 'innsbruck', 'bregenz', 'klagenfurt', 'graz', 'eisenstadt']) {
      expect(cities).toContain(capital);
    }
  });

  it('postal codes are loaded for both countries and each leads to a city of its own country', async () => {
    const [counts] = await db.execute<{ de: number; at: number; orphans: number; foreign: number }>(sql`
      SELECT count(*) FILTER (WHERE p.country_code = 'DE')::int AS de,
             count(*) FILTER (WHERE p.country_code = 'AT')::int AS at,
             count(*) FILTER (WHERE p.location_id IS NULL)::int AS orphans,
             count(*) FILTER (WHERE l.country_code <> p.country_code)::int AS foreign
      FROM postal_places p LEFT JOIN locations l ON l.id = p.location_id
      WHERE p.is_active`);
    expect(counts).toEqual({ de: 15_050, at: 18_998, orphans: 0, foreign: 0 });
    expect((await postal('AT', '1100', 'Wien, Favoriten')).locationId).toBe((await city('wien')).id);
    expect((await postal('DE', '12045', 'Berlin')).locationId).toBe((await city('berlin')).id);
  });

  it('SMS to Turkish numbers stays off while Turkey is closed', () => {
    expect(parseSmsNumber('+90 532 123 45 67')).toEqual({ ok: false, reason: 'country_not_supported' });
    expect(parseSmsNumber('+43 664 1234567')).toMatchObject({ ok: true, country: 'AT' });
  });
});

describe('finding a place', () => {
  it('folds Latin names so umlauts and spellings match', () => {
    expect(foldLatin('München')).toBe('muenchen');
    expect(foldLatin('MUENCHEN')).toBe('muenchen');
    expect(foldLatin('Graz, Innere Stadt')).toBe('graz innere stadt');
    expect(foldLatin('Straße')).toBe('strasse');
  });

  it('suggests postal codes by prefix, towns by name and cities by their Persian name', async () => {
    expect((await searchPlaces(appDb, 'DE', '1204')).map((s) => s.label)).toContain('12045 Berlin');
    expect((await searchPlaces(appDb, 'DE', 'muench')).map((s) => s.label)).toContain('80331 München');
    expect((await searchPlaces(appDb, 'DE', 'münch'))[0]?.label).toMatch(/München/);
    expect((await searchPlaces(appDb, 'AT', 'وی')).map((s) => s.label)).toContain('وین (Wien)');
    // A German postal code is not an Austrian one
    expect(await searchPlaces(appDb, 'AT', '12045')).toEqual([]);
  });

  it('resolves typed text without a picked suggestion', async () => {
    // 8010 has a dozen places; the one nearest Graz's centre wins
    expect(mustPlace(await resolvePlace(appDb, 'AT', '8010'))).toMatchObject({ kind: 'postal', placeName: 'Graz, Innere Stadt' });
    expect(mustPlace(await resolvePlace(appDb, 'DE', '12045 Berlin'))).toMatchObject({ kind: 'postal', postalCode: '12045', placeName: 'Berlin' });
    expect(mustPlace(await resolvePlace(appDb, 'DE', '۱۲۰۴۵'))).toMatchObject({ postalCode: '12045' });
    expect(mustPlace(await resolvePlace(appDb, 'AT', 'وین'))).toMatchObject({ kind: 'city', nameLocal: 'Wien' });
    expect(mustPlace(await resolvePlace(appDb, 'DE', 'gießen'))).toMatchObject({ kind: 'postal', placeName: 'Gießen' });
    expect(await resolvePlace(appDb, 'DE', 'Schönberg')).toBe('ambiguous');
    expect(await resolvePlace(appDb, 'DE', 'Atlantis')).toBe('not_found');
    expect(await resolvePlace(appDb, 'DE', '99999')).toBe('not_found');
  });

  it('finds the nearest postal code to a position, only within the country', async () => {
    const kreuzberg = snapToGrid({ lat: 52.4895, lng: 13.4227 });
    expect(mustPlace(await nearestPostalPlace(appDb, 'DE', kreuzberg))).toMatchObject({ kind: 'postal', placeName: 'Berlin' });
    expect(await nearestPostalPlace(appDb, 'AT', kreuzberg)).toBeNull();
    const paris = snapToGrid({ lat: 48.8566, lng: 2.3522 });
    expect(await nearestPostalPlace(appDb, 'DE', paris)).toBeNull();
  });
});

describe('a listing’s place', () => {
  it('a postal code gives the place, its city and the postal-code centre, never a street', async () => {
    const u = await user();
    const { id, r } = await publish(u.id, { place: '12045', district: 'نزدیک هرمان‌پلاتس' });
    expect(r).toMatchObject({ ok: true, status: 'active' });
    const l = await listing(id);
    const p = await postal('DE', '12045', 'Berlin');
    expect(l).toMatchObject({
      countryCode: 'DE',
      locationId: (await city('berlin')).id,
      postalCode: '12045',
      placeName: 'Berlin',
      district: 'نزدیک هرمان‌پلاتس',
      locationPrecision: 'postal_code',
    });
    expect(l.point).toEqual(p.center);
  });

  it('a picked suggestion is used as it is, but only in its own country', async () => {
    const u = await user();
    const favoriten = await postal('AT', '1100', 'Wien, Favoriten');
    const value = placeValue({ kind: 'postal', ...favoriten, locationId: favoriten.locationId! });
    const { id, r } = await publish(u.id, { countryCode: 'AT', place: '1100 Wien, Favoriten', placeValue: value });
    expect(r).toMatchObject({ ok: true });
    expect(await listing(id)).toMatchObject({ countryCode: 'AT', locationId: (await city('wien')).id, postalCode: '1100' });

    // The same Austrian place sent with Germany is not found in Germany
    const wrong = await publish(u.id, { countryCode: 'DE', place: '', placeValue: value });
    expect(wrong.r).toMatchObject({ ok: false, errors: { place: 'required' } });
  });

  it('the browser position is snapped to ~500 m; the exact point is never stored', async () => {
    const u = await user();
    const exact = { lat: 52.486_317, lng: 13.424_871 };
    const { id, r } = await publish(u.id, { place: '12045', area: exact });
    expect(r).toMatchObject({ ok: true });
    const l = await listing(id);
    expect(l.locationPrecision).toBe('area');
    expect(l.point).toEqual(snapToGrid(exact));
    expect(l.point).not.toEqual(exact);
    expect(distanceMeters(l.point!, exact)).toBeLessThan(400);
    // Nothing in the row holds the exact coordinates
    expect(JSON.stringify(l)).not.toContain('52.486317');
    expect(JSON.stringify(l)).not.toContain('13.424871');
  });

  it('a position alone finds its postal code; one far from the place or outside the country is refused', async () => {
    const u = await user();
    const alone = await publish(u.id, { place: '', area: { lat: 48.1372, lng: 11.5755 } });
    expect(alone.r).toMatchObject({ ok: true });
    expect(await listing(alone.id)).toMatchObject({ locationId: (await city('muenchen')).id, locationPrecision: 'area' });

    const far = await publish(u.id, { place: '12045', area: { lat: 48.1372, lng: 11.5755 } });
    expect(far.r).toMatchObject({ ok: false, errors: { area: 'too_far' } });
    const abroad = await publish(u.id, { place: '', area: { lat: 48.8566, lng: 2.3522 } });
    expect(abroad.r).toMatchObject({ ok: false, errors: { area: 'too_far' } });
  });

  it('wrong or ambiguous text is explained, and a closed country is refused', async () => {
    const u = await user();
    expect((await publish(u.id, { place: 'Atlantis' })).r).toMatchObject({ ok: false, errors: { place: 'not_found' } });
    expect((await publish(u.id, { place: 'Schönberg' })).r).toMatchObject({ ok: false, errors: { place: 'ambiguous' } });
    expect((await publish(u.id, { countryCode: 'TR', place: '34000' })).r).toMatchObject({ ok: false, errors: { countryCode: 'invalid' } });
  });

  it('reads as postal code and place, with "near <city>" when the town is not the city', () => {
    const near = (c: string) => `نزدیک ${c}`;
    expect(placeParts({ postalCode: '12045', placeName: 'Berlin', district: null, cityFa: 'برلین', cityLocal: 'Berlin' }, near)).toEqual({
      local: '12045 Berlin',
      city: 'برلین',
      district: null,
    });
    expect(placeParts({ postalCode: '8010', placeName: 'Graz, Innere Stadt', district: null, cityFa: 'گراتس', cityLocal: 'Graz' }, near).city).toBe('گراتس');
    expect(placeParts({ postalCode: '35390', placeName: 'Gießen', district: null, cityFa: 'فرانکفورت', cityLocal: 'Frankfurt am Main' }, near).city).toBe(
      'نزدیک فرانکفورت',
    );
    expect(placeParts({ postalCode: null, placeName: null, district: 'میته', cityFa: 'برلین', cityLocal: 'Berlin' }, near)).toEqual({
      local: null,
      city: 'برلین',
      district: 'میته',
    });
  });

  it('the dot on the outline map falls inside the country drawing', () => {
    for (const [cc, point] of [
      ['DE', { lat: 52.52, lng: 13.405 }],
      ['DE', { lat: 47.56, lng: 10.0 }],
      ['AT', { lat: 48.2085, lng: 16.3721 }],
      ['AT', { lat: 47.26, lng: 9.6 }],
    ] as const) {
      const at = projectOnOutline(cc, point)!;
      expect(at.x).toBeGreaterThan(0);
      expect(at.x).toBeLessThan(400);
      expect(at.y).toBeGreaterThan(0);
      expect(at.y).toBeLessThan(cc === 'DE' ? 543 : 206);
    }
  });
});

describe('currency follows the country', () => {
  it('the seller cannot choose it; Austria and Germany are euro', async () => {
    const u = await user();
    // An old form field or a forged one is ignored
    const forged = { ...(await input({ countryCode: 'AT', place: '8010' })), currency: 'GBP' } as ListingInput;
    const id = await draft(u.id);
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: forged, intent: 'publish' })).toMatchObject({ ok: true });
    expect(await listing(id)).toMatchObject({ countryCode: 'AT', currency: 'EUR', priceMinor: 12_000 });
  });

  it('an amount needs a country to know its currency', async () => {
    const u = await user();
    const id = await draft(u.id);
    const r = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ countryCode: '', place: '' }), intent: 'save' });
    expect(r).toMatchObject({ ok: false, errors: { countryCode: 'required' } });
  });

  it('every priced listing in the database has its country’s default currency', async () => {
    const rows = await db.execute(sql`
      SELECT l.id FROM listings l JOIN countries c ON c.code = l.country_code
      WHERE l.currency IS NOT NULL AND l.currency <> c.default_currency`);
    expect(rows).toHaveLength(0);
  });
});

describe('the saved place', () => {
  it('"remember" saves postal code, place, city and district on the account, never a position', async () => {
    const u = await user();
    const { r } = await publish(u.id, { place: '12045', district: 'نویکلن', area: { lat: 52.4863, lng: 13.4249 }, rememberPlace: true });
    expect(r).toMatchObject({ ok: true });
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(row).toMatchObject({ homeLocationId: (await city('berlin')).id, homePostalCode: '12045', homePlaceName: 'Berlin', homeDistrict: 'نویکلن' });
    expect(JSON.stringify(row)).not.toContain('52.48');
    const saved = await savedPlace(appDb, u.id);
    expect(saved).toMatchObject({ district: 'نویکلن', place: { kind: 'postal', postalCode: '12045' } });
  });

  it('without "remember" the account keeps its place; the account page sets and clears it', async () => {
    const u = await user();
    expect(await setSavedPlace(appDb, u.id, { countryCode: 'AT', placeValue: '', place: '8010', district: '' })).toEqual({ ok: true });
    await publish(u.id, { place: '12045', rememberPlace: false });
    expect(await savedPlace(appDb, u.id)).toMatchObject({ place: { postalCode: '8010', countryCode: 'AT' } });
    expect(await setSavedPlace(appDb, u.id, { countryCode: 'AT', placeValue: '', place: 'Atlantis', district: '' })).toEqual({
      ok: false,
      errors: { place: 'not_found' },
    });
    await clearSavedPlace(appDb, u.id);
    expect(await savedPlace(appDb, u.id)).toBeNull();
  });

  it('erasing an account clears the saved place', async () => {
    const u = await user();
    await setSavedPlace(appDb, u.id, { countryCode: 'DE', placeValue: '', place: '12045', district: 'نویکلن' });
    await workerDb.execute(sql`SELECT erase_user(${u.id})`);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(row).toMatchObject({ homeLocationId: null, homePostalCode: null, homePlaceName: null, homeDistrict: null, status: 'deleted' });
  });
});

describe('country page', () => {
  it('shows only active listings of that country, newest first, page by page', async () => {
    const u = await user();
    const vienna = await publish(u.id, { countryCode: 'AT', place: '1100' });
    const berlin = await publish(u.id, { place: '12045' });
    const at = await countryListings(appDb, 'AT', null);
    expect(at.items.map((i) => i.id)).toContain(vienna.id);
    expect(at.items.map((i) => i.id)).not.toContain(berlin.id);
    const de = await countryListings(appDb, 'DE', null);
    expect(de.items.every((i, n) => n === 0 || i.rankedAt! <= de.items[n - 1]!.rankedAt!)).toBe(true);
    // The cursor continues strictly after the given listing
    const first = de.items[0]!;
    const next = await countryListings(appDb, 'DE', { rankedAt: first.rankedAt!, id: first.id });
    expect(next.items.map((i) => i.id)).not.toContain(first.id);
  });
});
