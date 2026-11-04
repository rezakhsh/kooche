// What a street map shows, shared by the server (src/modules/maps/street-map.ts) and the browser
// (src/components/street-map.tsx). No server code here: the forms' map imports it.

export type MultiPolygon = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
  /** The country whose official file the area comes from, when that file asks for credit (AREA_CREDITS) */
  credit?: string;
};

/**
 * Postal code areas from official files (scripts/import-official-postal-areas.py, seed/README.md):
 * shown in the map's corner next to «© OpenStreetMap» while their area is on the map. CC BY 4.0
 * (CBS, ABS) and the Open Government Licence – Canada ask for it; the Census Bureau's is public domain.
 */
export const AREA_CREDITS: Record<string, { name: string; href: string }> = {
  US: { name: 'US Census Bureau', href: 'https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html' },
  CA: { name: 'Statistics Canada', href: 'https://open.canada.ca/en/open-government-licence-canada' },
  NL: { name: '© CBS', href: 'https://creativecommons.org/licenses/by/4.0/' },
  AU: { name: '© ABS', href: 'https://creativecommons.org/licenses/by/4.0/' },
};

/** A postal code area read from the database, with its credit when its country's file asks for one */
export function postalArea(geojson: string | null, countryCode: string | null): MultiPolygon | null {
  if (!geojson) return null;
  const area = JSON.parse(geojson) as MultiPolygon;
  return countryCode && AREA_CREDITS[countryCode] ? { ...area, credit: countryCode } : area;
}

export type StreetMapView = {
  /** The map file's version for the tile addresses (/map/tiles/{version}/…) */
  version: string;
  center: [number, number];
  /** The shaded area */
  area: MultiPolygon | null;
  /** Metres of the soft circle around the centre, when there is no area */
  circle: number | null;
  /** An exact public spot (venue, shop) */
  pin: [number, number] | null;
  /** The city whose district names and borders the map draws (/map/neighbourhoods/{id}), if we have them */
  neighbourhoods?: string | null;
  /** The visitor's own saved place ("my location"), only on their own page */
  home?: StreetMapHome | null;
};

export type StreetMapHome = {
  center: [number, number];
  area: MultiPolygon | null;
  /** Their town, for the arrow when it is far: "Berlin" */
  name: string;
  /** Straight-line kilometres from their place to the centre of this map */
  km: number;
};

/** Up to this far, home and place share one map; further, an arrow at the edge points home */
export const HOME_NEAR_KM = 25;

/** Radius of the circle shown when a postal code has no area, or a listing was placed by "my location" */
export const AREA_CIRCLE_M = 1_200;
