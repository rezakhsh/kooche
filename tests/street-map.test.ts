import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { streetMapView } from '../src/modules/maps/street-map';
import { AREA_CIRCLE_M } from '../src/modules/maps/view';
import { appDb } from './accounts';
import { db } from './db';
import { user } from './listings-fixtures';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

// The street map (docs/setup.md, "The street map"): the seeded postal code areas, and what a page's
// map may show. A listing never shows a point, not even its rounded one: its postal code's area,
// centred on the postal code. Venues and shops show the pin their owner set.

const env = vi.hoisted(() => ({ MAP_TILES_FILE: '/maps/20261028.pmtiles' as string | undefined }));
vi.mock('../src/lib/env', () => ({ webEnv: () => env }));

async function postalCenter(code: string) {
  const [r] = await db.execute<{ lng: number; lat: number }>(sql`
    SELECT ST_X(center::geometry) AS lng, ST_Y(center::geometry) AS lat FROM postal_places
    WHERE country_code = 'DE' AND postal_code = ${code} AND is_active ORDER BY place_name LIMIT 1`);
  return r!;
}

describe('postal code areas', () => {
  it('cover almost every German and Austrian postal code, with valid shapes', async () => {
    const [r] = await db.execute<{ de: number; at: number; invalid: number; orphan: number }>(sql`
      SELECT count(*) FILTER (WHERE country_code = 'DE')::int AS de,
        count(*) FILTER (WHERE country_code = 'AT')::int AS at,
        count(*) FILTER (WHERE NOT ST_IsValid(boundary::geometry))::int AS invalid,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM postal_places p WHERE p.country_code = a.country_code AND p.postal_code = a.postal_code))::int AS orphan
      FROM postal_areas a`);
    expect(r!.de).toBeGreaterThan(7_800);
    expect(r!.at).toBeGreaterThan(2_100);
    // The seed mends rings that simplifying made touch or cross themselves
    expect(r!.invalid).toBe(0);
    expect(r!.orphan).toBeLessThan(50);
  });

  it('hold the places they are named after', async () => {
    for (const [cc, code, lng, lat] of [
      ['DE', '13353', 13.3536, 52.5418], // Wedding, Leopoldplatz
      ['DE', '12045', 13.4344, 52.4848], // Neukölln, Sonnenallee
      ['DE', '80331', 11.5755, 48.1374], // München, Marienplatz
      ['AT', '1010', 16.3725, 48.2085], // Wien, Stephansplatz
    ] as const) {
      const [r] = await db.execute<{ ok: boolean }>(sql`
        SELECT ST_Covers(boundary, ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`})) AS ok
        FROM postal_areas WHERE country_code = ${cc} AND postal_code = ${code}`);
      expect(r?.ok, `${cc} ${code}`).toBe(true);
    }
  });

  it('are only read by the app', async () => {
    await expect(appDb.execute(sql`DELETE FROM postal_areas WHERE postal_code = '13353'`)).rejects.toThrow();
  });
});

describe('a page’s street map', () => {
  it('shows a listing’s postal code area, centred on the postal code, never on its rounded point', async () => {
    const center = await postalCenter('13353');
    // A "use my location" listing: its stored point is the seller's ~500 m cell
    const cell = { lng: 13.3601, lat: 52.5444 };
    const view = await streetMapView(appDb, { countryCode: 'DE', postalCode: '13353', placeName: 'Berlin', point: cell, precision: 'area' });
    expect(view).toMatchObject({ version: '20261028', center: [center.lng, center.lat], circle: null, pin: null });
    expect(view!.area?.type).toBe('MultiPolygon');
    expect(JSON.stringify(view)).not.toContain(String(cell.lng));
    expect(JSON.stringify(view)).not.toContain(String(cell.lat));
  });

  it('draws a circle where a postal code has no area, and only the city for a city', async () => {
    const center = await postalCenter('13353');
    // Pretend 13353 had no area: a postal code that is only a post-office box
    const view = await streetMapView(appDb, { countryCode: 'DE', postalCode: '99999', point: { lng: center.lng, lat: center.lat }, precision: 'postal_code' });
    expect(view).toMatchObject({ area: null, circle: AREA_CIRCLE_M, pin: null, center: [center.lng, center.lat] });
    const city = await streetMapView(appDb, { countryCode: 'DE', postalCode: null, point: { lng: 13.405, lat: 52.52 }, precision: 'city' });
    expect(city).toMatchObject({ area: null, circle: null, pin: null, center: [13.405, 52.52] });
  });

  it('puts a venue or shop on its own pin', async () => {
    const center = await postalCenter('12045');
    const pin = { lng: 13.43521, lat: 52.48601 };
    const view = await streetMapView(appDb, { countryCode: 'DE', postalCode: '12045', point: { lng: center.lng, lat: center.lat }, pin, precision: 'postal_code' });
    expect(view).toMatchObject({ center: [pin.lng, pin.lat], pin: [pin.lng, pin.lat], circle: null });
    expect(view!.area).not.toBeNull();
  });

  it('is left out without a map file or a place', async () => {
    expect(await streetMapView(appDb, { countryCode: 'DE', postalCode: '13353', point: null, precision: 'postal_code' })).toBeNull();
    env.MAP_TILES_FILE = undefined;
    try {
      expect(await streetMapView(appDb, { countryCode: 'DE', postalCode: '13353', point: { lng: 13.35, lat: 52.54 }, precision: 'postal_code' })).toBeNull();
    } finally {
      env.MAP_TILES_FILE = '/maps/20261028.pmtiles';
    }
  });
});

describe('the map around a place', () => {
  it('names a city’s districts where we have them (Berlin), nowhere else', async () => {
    const [berlin] = await db.execute<{ id: string }>(sql`SELECT DISTINCT location_id AS id FROM neighbourhoods WHERE is_active LIMIT 1`);
    const wedding = await postalCenter('13353');
    const view = await streetMapView(appDb, { countryCode: 'DE', postalCode: '13353', point: { lng: wedding.lng, lat: wedding.lat }, precision: 'postal_code' });
    expect(view?.neighbourhoods).toBe(berlin!.id);
    const munich = await streetMapView(appDb, { countryCode: 'DE', postalCode: '80331', point: { lng: 11.5755, lat: 48.1374 }, precision: 'postal_code' });
    expect(munich?.neighbourhoods).toBeNull();
  });

  it('shows the visitor their own saved place and how far it is, never anyone else', async () => {
    const [berlin] = await db.execute<{ id: string }>(sql`SELECT id FROM locations WHERE country_code = 'DE' AND name_local = 'Berlin' AND kind = 'city' LIMIT 1`);
    const visitor = await user();
    await db.update(schema.users).set({ homeLocationId: berlin!.id, homePostalCode: '13353', homePlaceName: 'Berlin' }).where(eq(schema.users.id, visitor.id));
    const stranger = await user();
    const friedrichshain = await postalCenter('10245');
    const place = { countryCode: 'DE', postalCode: '10245', placeName: 'Berlin', point: { lng: friedrichshain.lng, lat: friedrichshain.lat }, precision: 'postal_code' as const };

    const view = await streetMapView(appDb, place, visitor.id);
    const wedding = await postalCenter('13353');
    expect(view?.home).toMatchObject({ center: [wedding.lng, wedding.lat], name: 'Berlin' });
    expect(view!.home!.area?.type).toBe('MultiPolygon');
    // Wedding to Friedrichshain: about 8 km as the crow flies
    expect(view!.home!.km).toBeGreaterThan(6);
    expect(view!.home!.km).toBeLessThan(11);
    // No saved place, or no visitor: no home
    expect((await streetMapView(appDb, place, stranger.id))?.home).toBeNull();
    expect((await streetMapView(appDb, place))?.home).toBeNull();
  });
});

