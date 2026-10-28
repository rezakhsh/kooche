import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { streetMapView } from '../src/modules/maps/street-map';
import { AREA_CIRCLE_M } from '../src/modules/maps/view';
import { appDb } from './accounts';
import { db } from './db';

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
