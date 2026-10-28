import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import type { Point } from '../../db/types';
import { webEnv } from '../../lib/env';
import { mapVersion } from './pmtiles';
import { AREA_CIRCLE_M, type MultiPolygon, type StreetMapView } from './view';

// What a page's street map shows (docs/setup.md, "The street map"). A listing never shows a point:
// its postal code's area is shaded, or, where we have no area, a circle around the stored point
// (itself never exact). An event's venue and a business's shop are public, so their own pin is
// shown where the organizer or business set one. Without a map file (development, tests) pages
// get null and keep the outline map.

export type { MultiPolygon, StreetMapView } from './view';

/** The street map's version, or null when this server has no map file */
export function streetMapVersion(): string | null {
  const file = webEnv().MAP_TILES_FILE;
  return file ? mapVersion(file) : null;
}

/**
 * The map for a place: the postal code's area where there is one, otherwise a circle; `pin` only for
 * public places. A listing placed by "my location" (precision `area`) keeps its ~500 m cell to
 * itself: the map is centred on the postal code (its area, or the postal place's centre), never on
 * the stored point. Null without a map file or a place.
 */
export async function streetMapView(
  db: Queryable,
  place: {
    countryCode: string | null;
    postalCode: string | null;
    placeName?: string | null;
    point: Point | null;
    pin?: Point | null;
    precision?: 'city' | 'postal_code' | 'area' | null;
  },
): Promise<StreetMapView | null> {
  const version = streetMapVersion();
  if (!version || !place.countryCode || (!place.point && !place.pin)) return null;
  const byPostal = !!place.postalCode && place.precision !== 'city';
  const [r] = byPostal
    ? await db.execute<{ geojson: string | null; lng: number | null; lat: number | null }>(sql`
        SELECT
          (SELECT ST_AsGeoJSON(boundary, 5) FROM postal_areas WHERE country_code = ${place.countryCode} AND postal_code = ${place.postalCode}) AS geojson,
          ST_X(p.center::geometry) AS lng, ST_Y(p.center::geometry) AS lat
        FROM (SELECT 1) one
        LEFT JOIN LATERAL (
          SELECT center FROM postal_places
          WHERE country_code = ${place.countryCode} AND postal_code = ${place.postalCode} AND is_active
          ORDER BY (place_name = ${place.placeName ?? ''}) DESC, place_name
          LIMIT 1) p ON true`)
    : [];
  const area = r?.geojson ? (JSON.parse(r.geojson) as MultiPolygon) : null;
  const postalCenter = r?.lng != null && r.lat != null ? ([r.lng, r.lat] as [number, number]) : null;
  const center = place.pin ? ([place.pin.lng, place.pin.lat] as [number, number]) : place.precision === 'area' ? postalCenter : place.point ? ([place.point.lng, place.point.lat] as [number, number]) : null;
  if (!center) return null;
  return {
    version,
    center,
    area,
    circle: area || place.pin || place.precision === 'city' ? null : AREA_CIRCLE_M,
    pin: place.pin ? [place.pin.lng, place.pin.lat] : null,
  };
}
