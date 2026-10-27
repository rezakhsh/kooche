import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { cardOf } from '../src/modules/listings/card';
import { homeArea } from '../src/modules/listings/neighbourhood';
import { publicListing } from '../src/modules/listings/queries';
import { cardsByIds } from '../src/modules/search/browse';
import { loadCatalog } from '../src/modules/listings/catalog';
import { appDb } from './accounts';
import { db, makeListing, makeUser } from './db';
import { city } from './listings-fixtures';

// City neighbourhoods (wave 1, owner Oct 27, 2026): a Berlin card says «ودینگ», not «برلین»

const at = (lng: number, lat: number) => ({ lng, lat });

describe('Berlin’s neighbourhoods', () => {
  it('are all 97 official Ortsteile, each with a Persian name and a valid shape', async () => {
    const berlin = await city('berlin');
    const [row] = await db.execute<{ n: number; named: number; valid: number }>(sql`
      SELECT count(*)::int AS n,
        count(*) FILTER (WHERE name_fa <> '')::int AS named,
        count(*) FILTER (WHERE ST_IsValid(boundary::geometry))::int AS valid
      FROM neighbourhoods WHERE location_id = ${berlin.id} AND is_active`);
    expect(row).toEqual({ n: 97, named: 97, valid: 97 });
  });

  it('cover the places people know by name', async () => {
    const name = async (lng: number, lat: number) => {
      const [r] = await db.execute<{ name_fa: string }>(sql`
        SELECT name_fa FROM neighbourhoods WHERE ST_Covers(boundary, ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`}))`);
      return r?.name_fa ?? null;
    };
    expect(await name(13.3594, 52.5465)).toBe('ودینگ'); // Leopoldplatz
    expect(await name(13.342, 52.526)).toBe('موآبیت'); // Moabit, Turmstraße
    expect(await name(13.417, 52.5025)).toBe('کرویتسبرگ'); // Oranienplatz
    expect(await name(13.4245, 52.4815)).toBe('نویکلن'); // Hermannplatz area
    expect(await name(13.3, 52.5)).not.toBeNull();
    expect(await name(13.06, 52.39)).toBeNull(); // Potsdam is not Berlin
  });
});

describe('a listing’s neighbourhood', () => {
  it('shows on its card and page when it was placed by postal code or area, never for a city centre', async () => {
    const seller = await makeUser(db as never);
    const wedding = await makeListing(db as never, seller.id, { point: at(13.3594, 52.5465), locationPrecision: 'postal_code', postalCode: '13353', placeName: 'Berlin' });
    const byCity = await makeListing(db as never, seller.id, { point: at(13.3594, 52.5465), locationPrecision: 'city' });
    const catalog = await loadCatalog(appDb);
    const cards = await cardsByIds(appDb, [wedding.id, byCity.id], null);
    expect(cards.map((c) => c.neighbourhood)).toEqual(['ودینگ', null]);
    expect(cardOf(catalog, cards[0]!, 'Europe/Berlin').place).toEqual({ text: 'ودینگ', latin: false });
    expect(cardOf(catalog, cards[1]!, 'Europe/Berlin').place).toEqual({ text: 'برلین', latin: false });
    expect((await publicListing(appDb, wedding.publicToken))?.neighbourhood).toBe('ودینگ');
    // An inactive neighbourhood is no longer shown
    await db.update(schema.neighbourhoods).set({ isActive: false }).where(eq(schema.neighbourhoods.nameLocal, 'Wedding'));
    try {
      expect((await cardsByIds(appDb, [wedding.id], null))[0]?.neighbourhood).toBeNull();
    } finally {
      await db.update(schema.neighbourhoods).set({ isActive: true }).where(eq(schema.neighbourhoods.nameLocal, 'Wedding'));
    }
  });
});

describe('the account’s home area', () => {
  it('names the neighbourhood of a saved postal code and the city, or the city alone', async () => {
    const berlin = await city('berlin');
    const nobody = await makeUser(db as never);
    expect(await homeArea(appDb, nobody.id)).toBeNull();
    const byCity = await makeUser(db as never, { homeLocationId: berlin.id });
    expect(await homeArea(appDb, byCity.id)).toEqual({ city: 'برلین', citySlug: 'berlin', countryCode: 'DE', neighbourhood: null });
    const [pc] = await db.execute<{ postal_code: string; place_name: string }>(sql`
      SELECT postal_code, place_name FROM postal_places
      WHERE country_code = 'DE' AND is_active AND location_id = ${berlin.id} AND postal_code = '13353' LIMIT 1`);
    const byPostal = await makeUser(db as never, { homeLocationId: berlin.id, homePostalCode: pc!.postal_code, homePlaceName: pc!.place_name });
    expect(await homeArea(appDb, byPostal.id)).toEqual({ city: 'برلین', citySlug: 'berlin', countryCode: 'DE', neighbourhood: 'ودینگ' });
  });
});
