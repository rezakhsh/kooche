import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { POSTAL_COUNTRIES, postalPlaces } from '../seed/postal';
import { PATTERNS } from '../src/db/schema/_columns';
import { foldLatin } from '../src/lib/fold-latin';
import { loadCatalog, type Catalog } from '../src/modules/listings/catalog';
import { resolvePlace, searchPlaces, type Place } from '../src/modules/listings/places';
import { normalizePostalCode, postalFilterCode, postalInputMode } from '../src/modules/listings/postal-code';
import { activeCountries } from '../src/modules/listings/queries';
import { browseQuery, filterContext, parseBrowseParams } from '../src/modules/search/filters';
import { searchFiltersOf } from '../src/modules/search/saved';
import { messages, PLACE_EXAMPLES } from '../src/messages/fa';
import { appDb } from './accounts';
import { db } from './db';
import { city } from './listings-fixtures';

// Postal codes step 3 (Nov 4, 2026): one reader for typed postal codes, per country, and its
// callers (the place field, the browse filter, saved searches). Stored forms: docs/progress.md,
// "Postal codes: step 1", decided from practice. Step 4: the country prefix ("D-10115"), long
// dashes, and the seeded codes of the 9 planned countries.

const read = (country: string, text: string) => normalizePostalCode(country, text);
const code = (country: string, text: string) => read(country, text).code;
const partial = (country: string, text: string) => normalizePostalCode(country, text, { partial: true }).code;
const STORED = new RegExp(PATTERNS.postalCode);

describe('normalizePostalCode', () => {
  it('Germany: 5 digits', () => {
    expect(code('DE', '12045')).toBe('12045');
    expect(code('DE', '  12045  ')).toBe('12045');
    expect(code('DE', '۱۲۰۴۵')).toBe('12045');
    expect(read('DE', '12045   Berlin')).toEqual({ code: '12045', rest: 'berlin' });
    expect(read('DE', '12045, Berlin')).toEqual({ code: '12045', rest: 'berlin' });
    expect(read('DE', 'Berlin 12045')).toEqual({ code: '12045', rest: 'berlin' });
    expect(code('DE', '1204')).toBeNull();
    expect(code('DE', '123456')).toBeNull();
    expect(read('DE', 'Gießen')).toEqual({ code: null, rest: 'gießen' });
    expect(partial('DE', '1204')).toBe('1204');
    expect(partial('DE', '120 Ber')).toBe('120');
  });

  it('Austria: 4 digits', () => {
    expect(code('AT', '1100')).toBe('1100');
    expect(read('AT', '٨٠١٠ Graz')).toEqual({ code: '8010', rest: 'graz' });
    expect(code('AT', '11000')).toBeNull();
    expect(code('AT', '110')).toBeNull();
  });

  it('United Kingdom: the outward code of every shape, the inward part dropped', () => {
    // A9, A99, A9A, AA9, AA99, AA9A
    expect(code('GB', 'M1 1AE')).toBe('M1');
    expect(code('GB', 'B33 8TH')).toBe('B33');
    expect(code('GB', 'W1A 0AX')).toBe('W1A');
    expect(code('GB', 'CR2 6XH')).toBe('CR2');
    expect(code('GB', 'DN55 1PT')).toBe('DN55');
    expect(code('GB', 'EC1A 1BB')).toBe('EC1A');
    expect(code('GB', 'SW1A 1AA')).toBe('SW1A');
    expect(code('GB', 'sw1a1aa')).toBe('SW1A');
    expect(code('GB', 'SW1A')).toBe('SW1A');
    expect(code('GB', '  sw1a   1aa ')).toBe('SW1A');
    expect(code('GB', 'SW۱A ۱AA')).toBe('SW1A');
    // Without the space the inward part is always the last three
    expect(code('GB', 'E11AA')).toBe('E1');
    expect(code('GB', 'E111AA')).toBe('E11');
    expect(read('GB', 'E8 London')).toEqual({ code: 'E8', rest: 'london' });
    expect(read('GB', 'SW1A 1AA London')).toEqual({ code: 'SW1A', rest: 'london' });
    expect(read('GB', 'London SW1A 1AA')).toEqual({ code: 'SW1A', rest: 'london' });
    expect(read('GB', 'Hackney، ⁦E8 London⁩')).toEqual({ code: 'E8', rest: 'london' });
    // A word without a digit is a town
    expect(read('GB', 'Bath')).toEqual({ code: null, rest: 'bath' });
    expect(code('GB', 'SW')).toBeNull();
    expect(code('GB', '1AA')).toBeNull();
    expect(code('GB', 'SWA1 1AA')).toBeNull();
    expect(code('GB', 'SW1AB')).toBeNull();
    expect(partial('GB', 'SW1')).toBe('SW1');
    expect(partial('GB', 'SW1A 1')).toBe('SW1A');
    expect(partial('GB', 'S')).toBeNull();
  });

  it('Canada: the forward sortation area', () => {
    expect(code('CA', 'M5V 3L9')).toBe('M5V');
    expect(code('CA', 'm5v3l9')).toBe('M5V');
    expect(code('CA', 'M5V')).toBe('M5V');
    expect(code('CA', ' m5v   3l9 ')).toBe('M5V');
    expect(code('CA', 'M۵V ۳L۹')).toBe('M5V');
    expect(read('CA', 'M5V 3L9 Toronto')).toEqual({ code: 'M5V', rest: 'toronto' });
    expect(read('CA', 'Toronto, ON M5V 3L9')).toEqual({ code: 'M5V', rest: 'toronto, on' });
    expect(code('CA', '5MV')).toBeNull();
    expect(code('CA', 'MM5')).toBeNull();
    expect(code('CA', 'M5')).toBeNull();
    expect(partial('CA', 'M5')).toBe('M5');
    expect(partial('CA', 'M5V 3')).toBe('M5V');
    expect(partial('CA', 'M')).toBeNull();
  });

  it('Netherlands: 4 digits, the letters dropped', () => {
    expect(code('NL', '1012 AB')).toBe('1012');
    expect(code('NL', '1012ab')).toBe('1012');
    expect(code('NL', '1012')).toBe('1012');
    expect(code('NL', '۱۰۱۲ AB')).toBe('1012');
    expect(read('NL', '1012 AB Amsterdam')).toEqual({ code: '1012', rest: 'amsterdam' });
    expect(read('NL', '1012 Amsterdam')).toEqual({ code: '1012', rest: 'amsterdam' });
    // «De Bilt» is a place, not the letters
    expect(read('NL', '3731 De Bilt')).toEqual({ code: '3731', rest: 'de bilt' });
    expect(code('NL', '3731 DE')).toBe('3731');
    expect(code('NL', '101')).toBeNull();
    expect(code('NL', '10123')).toBeNull();
    expect(partial('NL', '101')).toBe('101');
    expect(partial('NL', '1012 a')).toBe('1012');
  });

  it('United States: the 5-digit ZIP, ZIP+4 cut', () => {
    expect(code('US', '90210')).toBe('90210');
    expect(code('US', '90210-1234')).toBe('90210');
    expect(code('US', '90210 1234')).toBe('90210');
    expect(code('US', '902101234')).toBe('90210');
    expect(code('US', '۹۰۲۱۰')).toBe('90210');
    expect(read('US', 'Beverly Hills, CA 90210')).toEqual({ code: '90210', rest: 'beverly hills, ca' });
    expect(read('US', '90210 Beverly Hills')).toEqual({ code: '90210', rest: 'beverly hills' });
    expect(code('US', '9021')).toBeNull();
    expect(code('US', '902101')).toBeNull();
    expect(partial('US', '9021')).toBe('9021');
    expect(partial('US', '90210-12')).toBe('90210');
  });

  it('France, Italy, Turkey: 5 digits, leading zeros kept', () => {
    expect(read('FR', '75011 Paris')).toEqual({ code: '75011', rest: 'paris' });
    expect(code('FR', '٧٥٠١١')).toBe('75011');
    expect(code('FR', '7501')).toBeNull();
    expect(read('IT', '00184 Roma')).toEqual({ code: '00184', rest: 'roma' });
    expect(code('IT', '0018')).toBeNull();
    const tr = read('TR', '34000 İstanbul');
    expect(tr.code).toBe('34000');
    expect(foldLatin(tr.rest)).toBe('istanbul');
    expect(code('TR', '340000')).toBeNull();
  });

  it('Sweden: "123 45", with or without the space', () => {
    expect(code('SE', '12345')).toBe('123 45');
    expect(code('SE', '123 45')).toBe('123 45');
    expect(code('SE', '123   45')).toBe('123 45');
    expect(code('SE', '۱۲۳ ۴۵')).toBe('123 45');
    expect(read('SE', '12345 Stockholm')).toEqual({ code: '123 45', rest: 'stockholm' });
    expect(read('SE', 'Stockholm 123 45')).toEqual({ code: '123 45', rest: 'stockholm' });
    expect(code('SE', '1234')).toBeNull();
    expect(code('SE', '123456')).toBeNull();
    expect(partial('SE', '1234')).toBe('123 4');
    expect(partial('SE', '12')).toBe('12');
  });

  it('Australia: 4 digits, also written last', () => {
    expect(code('AU', '2000')).toBe('2000');
    expect(code('AU', '۲۰۰۰')).toBe('2000');
    expect(read('AU', 'Sydney NSW 2000')).toEqual({ code: '2000', rest: 'sydney nsw' });
    expect(code('AU', '200')).toBeNull();
  });

  it('a country without postal data keeps the old reading', () => {
    expect(read('CH', '8001 Zürich')).toEqual({ code: '8001', rest: 'zürich' });
    expect(code('ch', '8001')).toBe('8001');
  });

  it('a country prefix before the code and long dashes (postal codes step 4)', () => {
    expect(code('DE', 'D-10115')).toBe('10115');
    expect(code('DE', 'DE-10115')).toBe('10115');
    expect(read('DE', 'D-10115 Berlin')).toEqual({ code: '10115', rest: 'berlin' });
    expect(read('DE', 'Berlin, D-10115')).toEqual({ code: '10115', rest: 'berlin' });
    expect(read('DE', 'Neukölln، D-12045 Berlin')).toEqual({ code: '12045', rest: 'berlin' });
    expect(code('AT', 'A-1010')).toBe('1010');
    expect(code('FR', 'F-75001')).toBe('75001');
    expect(code('FR', 'fr-75001')).toBe('75001');
    expect(code('IT', 'I-00184')).toBe('00184');
    expect(code('SE', 'SE-123 45')).toBe('123 45');
    expect(code('SE', 'S-12345')).toBe('123 45');
    expect(code('NL', 'NL-1012')).toBe('1012');
    expect(code('NL', 'nl-1012 ab')).toBe('1012');
    expect(code('GB', 'GB-SW1A 1AA')).toBe('SW1A');
    expect(code('US', 'US-90210')).toBe('90210');
    expect(partial('DE', 'D-101')).toBe('101');
    // Only this country's prefix, and only before a code
    expect(code('DE', 'F-75001')).toBeNull();
    expect(read('DE', 'D-Mark')).toEqual({ code: null, rest: 'd-mark' });
    // Long dashes in a ZIP+4
    expect(code('US', '90210–1234')).toBe('90210');
    expect(code('US', '90210—1234')).toBe('90210');
    expect(read('US', 'Beverly Hills, CA 90210–1234')).toEqual({ code: '90210', rest: 'beverly hills, ca' });
  });

  it('every seeded postal code reads as itself (seed/postal/*.tsv)', () => {
    for (const country of POSTAL_COUNTRIES) {
      const codes = [...new Set(postalPlaces(country).map((p) => p.postalCode))];
      expect(codes.length, country).toBeGreaterThan(1000);
      expect(codes.filter((c) => code(country, c) !== c || !STORED.test(c)), country).toEqual([]);
    }
  });

  it('every stored form fits the database check', () => {
    const samples: [string, string][] = [
      ['DE', '12045'], ['AT', '1100'], ['GB', 'EC1A 1BB'], ['GB', 'E8'], ['CA', 'm5v 3l9'], ['NL', '1012 AB'],
      ['US', '90210-1234'], ['FR', '75011'], ['IT', '00184'], ['TR', '34000'], ['SE', '12345'], ['AU', '2000'],
    ];
    for (const [c, t] of samples) expect(code(c, t)).toMatch(STORED);
  });
});

describe('postalFilterCode and the keyboard', () => {
  it('the browse filter keeps the stored code; text that only looks like one stays so the page can say "not found"', () => {
    expect(postalFilterCode('GB', 'sw1a 1aa')).toBe('SW1A');
    expect(postalFilterCode('DE', '12045 Berlin')).toBe('12045');
    expect(postalFilterCode('DE', '1234')).toBe('1234');
    expect(postalFilterCode('DE', 'x')).toBeNull();
    expect(postalFilterCode('DE', '<script>')).toBeNull();
  });

  it('a number pad only where codes have no letters', () => {
    for (const c of ['DE', 'AT', 'FR', 'IT', 'TR', 'US', 'SE', 'AU']) expect(postalInputMode(c)).toBe('numeric');
    for (const c of ['GB', 'CA', 'NL']) expect(postalInputMode(c)).toBe('text');
  });
});

describe('the callers', () => {
  let catalog: Catalog;
  beforeAll(async () => {
    catalog = await loadCatalog(db);
  });

  it('browse filter and saved searches read the code the country’s way', async () => {
    const ctx = (country: string) => filterContext(catalog, catalog.bySlug.get('cars')!, 2, country);
    expect(parseBrowseParams({ postal: 'sw1a 1aa', r: '5' }, ctx('GB')).state.postal).toEqual({ code: 'SW1A', radiusKm: 5 });
    expect(parseBrowseParams({ postal: 'M5V 3L9' }, ctx('CA')).state.postal?.code).toBe('M5V');
    expect(parseBrowseParams({ postal: '۱۲۰۴۵ Berlin' }, ctx('DE')).state.postal?.code).toBe('12045');
    const se = parseBrowseParams({ postal: '12345' }, ctx('SE')).state;
    expect(se.postal?.code).toBe('123 45');
    // The canonical address reads back to the same code
    const query = browseQuery(se, 2);
    expect(parseBrowseParams(Object.fromEntries(new URLSearchParams(query)), ctx('SE')).state.postal?.code).toBe('123 45');
    // Text that is no code at all is refused
    expect(parseBrowseParams({ postal: '<b>' }, ctx('GB')).refused).toContain('postal');

    // A saved search reads its stored address with its own country
    const [de] = await activeCountries(appDb);
    const gb = { ...de!, code: 'GB' };
    const f = searchFiltersOf(catalog, [gb], {
      filters: { v: 1, country: 'GB', categoryId: catalog.bySlug.get('cars')!.id, locationId: null, query: '?postal=sw1a+1aa' },
      point: null,
      radiusM: null,
    });
    expect(f).toMatchObject({ countryCode: 'GB', postalCode: 'SW1A' });
  });

  const mustPlace = (p: Place | 'not_found' | 'ambiguous') => {
    if (typeof p === 'string') throw new Error(p);
    return p;
  };

  it('the place field finds typed codes of the planned countries (the seeded GeoNames codes, step 4)', async () => {
    expect(mustPlace(await resolvePlace(db, 'GB', 'SW1A 1AA'))).toMatchObject({ kind: 'postal', postalCode: 'SW1A', placeName: 'London' });
    expect(mustPlace(await resolvePlace(db, 'GB', 'London e8 3qd'))).toMatchObject({ postalCode: 'E8', placeName: 'London' });
    expect(mustPlace(await resolvePlace(db, 'CA', 'm5v3l9'))).toMatchObject({ postalCode: 'M5V', placeName: 'Toronto, ON' });
    expect(mustPlace(await resolvePlace(db, 'NL', '1012 AB Amsterdam'))).toMatchObject({ postalCode: '1012', placeName: 'Amsterdam' });
    expect(mustPlace(await resolvePlace(db, 'SE', '11122'))).toMatchObject({ postalCode: '111 22', placeName: 'Stockholm' });
    expect(mustPlace(await resolvePlace(db, 'US', '90210-3456'))).toMatchObject({ postalCode: '90210', placeName: 'Beverly Hills, CA' });
    expect(mustPlace(await resolvePlace(db, 'US', 'Beverly Hills, CA 90210–3456'))).toMatchObject({ postalCode: '90210' });
    expect(mustPlace(await resolvePlace(db, 'AU', 'Sydney NSW ۲۰۰۰'))).toMatchObject({ postalCode: '2000', placeName: 'Sydney, NSW' });
    expect(mustPlace(await resolvePlace(db, 'FR', 'F-75011 Paris'))).toMatchObject({ postalCode: '75011', placeName: 'Paris' });
    expect(mustPlace(await resolvePlace(db, 'IT', '00184 Roma'))).toMatchObject({ postalCode: '00184', placeName: 'Roma' });
    expect(mustPlace(await resolvePlace(db, 'TR', '34710 Kadıköy'))).toMatchObject({ postalCode: '34710', placeName: 'Kadiköy, Caferağa' });
    expect(await resolvePlace(db, 'GB', 'SW1B 1AA')).toBe('not_found');

    // Every code leads to a city of its country (the nearest one, as in Germany)
    for (const [country, slug] of [['GB', 'london'], ['CA', 'toronto'], ['US', 'los-angeles'], ['AU', 'sydney'], ['TR', 'istanbul']] as const) {
      const [p] = await db.execute(sql`SELECT count(*)::int AS n FROM postal_places WHERE country_code = ${country} AND location_id = ${(await city(slug)).id}`);
      expect(p!.n, country).toBeGreaterThan(10);
    }

    // A town typed alone: the name before the comma ("Malibu, CA"); one in two states needs the code
    expect(mustPlace(await resolvePlace(db, 'US', 'Malibu'))).toMatchObject({ kind: 'postal', placeName: 'Malibu, CA' });
    expect(mustPlace(await resolvePlace(db, 'US', 'Beverly Hills, CA'))).toMatchObject({ placeName: 'Beverly Hills, CA' });
    expect(await resolvePlace(db, 'US', 'Beverly Hills')).toBe('ambiguous'); // California and Florida
    expect(await resolvePlace(db, 'US', 'Springfield')).toBe('ambiguous');
    // Turkish dotless ı typed, GeoNames without it
    expect(mustPlace(await resolvePlace(db, 'TR', 'Kadıköy'))).toMatchObject({ kind: 'postal', locationId: (await city('istanbul')).id });
    expect((mustPlace(await resolvePlace(db, 'TR', 'Kadıköy')) as { placeName: string }).placeName).toMatch(/^Kadiköy, /);
    // A word that only starts a town name is no town ("Beverly" is one: Massachusetts, New Jersey…)
    expect(await resolvePlace(db, 'US', 'Malib')).toBe('not_found');

    // Suggestions while typing: the start of a code. A label may start with the city's area
    // («Westminster، ⁦SW1A London⁩»): compared here without it
    const labels = async (country: string, text: string) =>
      (await searchPlaces(db, country, text)).map((s) => s.label.replace(/^[^،]*،\s*/, '').replace(/[\u2066-\u2069]/g, ''));
    expect(await labels('GB', 'sw1a')).toEqual(['SW1A London']);
    expect(await labels('CA', 'M5V')).toEqual(['M5V Toronto, ON']);
    expect(await labels('SE', '11122')).toEqual(['111 22 Stockholm']);
    expect(await labels('SE', '1112')).toContain('111 22 Stockholm');
    expect(await labels('NL', '1012 a')).toEqual(['1012 Amsterdam']);
    expect((await labels('TR', 'Kadıköy')).length).toBeGreaterThan(1);
    // A suggestion's label read back is its code, with or without the area
    const [sw1a] = await searchPlaces(db, 'GB', 'SW1A');
    expect(sw1a!.label).toMatch(/^[^،]+، \u2066SW1A London\u2069$/);
    expect(mustPlace(await resolvePlace(db, 'GB', sw1a!.label))).toMatchObject({ postalCode: 'SW1A' });
    expect(mustPlace(await resolvePlace(db, 'GB', 'SW1A London'))).toMatchObject({ postalCode: 'SW1A' });
  });

  // Step 6 (Nov 4, 2026): staging showed Germany's «12045» under a British place field
  it("the place field's hint gives each country's own code and town, and both are found", async () => {
    for (const cc of POSTAL_COUNTRIES) {
      const example = PLACE_EXAMPLES[cc];
      expect(example, cc).toBeDefined();
      const [typed, town] = example!;
      expect(messages.form.placeHint(cc)).toContain(`«${typed}»`);
      // Germany and Austria share one hint since wave 1 (a German code, an Austrian town): unchanged
      if (cc === 'AT') continue;
      expect(code(cc, typed), `${cc} ${typed}`).not.toBeNull();
      expect(mustPlace(await resolvePlace(db, cc, typed)), `${cc} ${typed}`).toMatchObject({ kind: 'postal' });
      if (cc !== 'DE') expect(mustPlace(await resolvePlace(db, cc, town)), `${cc} ${town}`).toBeTruthy();
    }
    expect(messages.form.placeHint('GB')).not.toContain('12045');
    expect(messages.form.placeHint('DE')).toBe('مثلاً «12045» یا «Graz». خیابان و پلاک را ننویسید.');
    expect(messages.form.placeHint('IE')).not.toMatch(/[0-9]/); // no postal data: towns only
  });
});
