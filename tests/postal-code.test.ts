import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { PATTERNS } from '../src/db/schema/_columns';
import { foldLatin } from '../src/lib/fold-latin';
import { loadCatalog, type Catalog } from '../src/modules/listings/catalog';
import { resolvePlace, searchPlaces, type Place } from '../src/modules/listings/places';
import { normalizePostalCode, postalFilterCode, postalInputMode } from '../src/modules/listings/postal-code';
import { activeCountries } from '../src/modules/listings/queries';
import { browseQuery, filterContext, parseBrowseParams } from '../src/modules/search/filters';
import { searchFiltersOf } from '../src/modules/search/saved';
import { appDb } from './accounts';
import { db, rollback, type Tx } from './db';
import { city } from './listings-fixtures';

// Postal codes step 3 (Nov 4, 2026): one reader for typed postal codes, per country, and its
// callers (the place field, the browse filter, saved searches). Stored forms: docs/progress.md,
// "Postal codes: step 1", decided from practice.

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

  async function addPostal(tx: Tx, countryCode: string, slug: string, postalCode: string, placeName: string) {
    const c = await city(slug);
    await tx.insert(schema.postalPlaces).values({ countryCode, postalCode, placeName, placeSearch: foldLatin(placeName), center: c.center, locationId: c.id });
  }

  const mustPlace = (p: Place | 'not_found' | 'ambiguous') => {
    if (typeof p === 'string') throw new Error(p);
    return p;
  };

  it('the place field finds typed codes of the planned countries (rows only for this test)', async () => {
    await rollback(async (tx) => {
      await addPostal(tx, 'GB', 'london', 'SW1A', 'London');
      await addPostal(tx, 'GB', 'london', 'E8', 'London');
      await addPostal(tx, 'CA', 'toronto', 'M5V', 'Toronto');
      await addPostal(tx, 'NL', 'amsterdam', '1012', 'Amsterdam');
      await addPostal(tx, 'SE', 'stockholm', '111 22', 'Stockholm');
      await addPostal(tx, 'US', 'los-angeles', '90012', 'Los Angeles, CA');
      await addPostal(tx, 'AU', 'sydney', '2000', 'Sydney, NSW');

      expect(mustPlace(await resolvePlace(tx, 'GB', 'SW1A 1AA'))).toMatchObject({ kind: 'postal', postalCode: 'SW1A' });
      expect(mustPlace(await resolvePlace(tx, 'GB', 'London e8 3qd'))).toMatchObject({ postalCode: 'E8' });
      expect(mustPlace(await resolvePlace(tx, 'CA', 'm5v3l9'))).toMatchObject({ postalCode: 'M5V' });
      expect(mustPlace(await resolvePlace(tx, 'NL', '1012 AB Amsterdam'))).toMatchObject({ postalCode: '1012' });
      expect(mustPlace(await resolvePlace(tx, 'SE', '11122'))).toMatchObject({ postalCode: '111 22' });
      expect(mustPlace(await resolvePlace(tx, 'US', '90012-3456'))).toMatchObject({ postalCode: '90012' });
      expect(mustPlace(await resolvePlace(tx, 'AU', 'Sydney NSW ۲۰۰۰'))).toMatchObject({ postalCode: '2000' });
      expect(await resolvePlace(tx, 'GB', 'SW1B 1AA')).toBe('not_found');

      // Suggestions while typing: the start of a code. A label may start with the city's area
      // («Westminster، ⁦SW1A London⁩»): compared here without it
      const labels = async (country: string, text: string) =>
        (await searchPlaces(tx, country, text)).map((s) => s.label.replace(/^[^،]*،\s*/, '').replace(/[\u2066-\u2069]/g, ''));
      expect(await labels('GB', 'sw1')).toEqual(['SW1A London']);
      expect(await labels('CA', 'M5')).toEqual(['M5V Toronto']);
      expect(await labels('SE', '1112')).toEqual(['111 22 Stockholm']);
      expect(await labels('NL', '1012 a')).toEqual(['1012 Amsterdam']);
      // A suggestion's label read back is its code, with or without the area
      const [sw1a] = await searchPlaces(tx, 'GB', 'SW1A');
      expect(sw1a!.label).toMatch(/^[^،]+، \u2066SW1A London\u2069$/);
      expect(mustPlace(await resolvePlace(tx, 'GB', sw1a!.label))).toMatchObject({ postalCode: 'SW1A' });
      expect(mustPlace(await resolvePlace(tx, 'GB', 'SW1A London'))).toMatchObject({ postalCode: 'SW1A' });
    });
  });
});
