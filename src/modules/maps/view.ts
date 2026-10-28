// What a street map shows, shared by the server (src/modules/maps/street-map.ts) and the browser
// (src/components/street-map.tsx). No server code here: the forms' map imports it.

export type MultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] };

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
};

/** Radius of the circle shown when a postal code has no area, or a listing was placed by "my location" */
export const AREA_CIRCLE_M = 1_200;
