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
