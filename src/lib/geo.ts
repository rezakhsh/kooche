// Location privacy (docs/schema.md, section 8, listings.point). A listing never stores the
// seller's exact position: either the city centre, or the centre of the ~500 m grid cell the
// position falls in. Pure functions, so the browser snaps before it sends a position and the
// server snaps again before it writes.

import type { Point } from '../db/types';

/** 0.0045° of latitude is ~500 m everywhere */
export const GRID_LAT_STEP = 0.0045;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * The centre of the grid cell containing the point. Rows are 0.0045° of latitude; within a row,
 * columns are 0.0045°/cos(latitude of the row centre), so cells stay ~500 m wide in the north
 * too. Snapping a snapped point returns the same point.
 */
export function snapToGrid({ lat, lng }: Point): Point {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 89 || Math.abs(lng) > 180) {
    throw new Error('Invalid coordinates');
  }
  const snappedLat = (Math.floor(lat / GRID_LAT_STEP) + 0.5) * GRID_LAT_STEP;
  const lngStep = GRID_LAT_STEP / Math.cos((snappedLat * Math.PI) / 180);
  const snappedLng = (Math.floor(lng / lngStep) + 0.5) * lngStep;
  return { lat: round6(snappedLat), lng: round6(snappedLng) };
}

/** Great-circle distance in metres (haversine), for "is this point near the chosen city?" */
export function distanceMeters(a: Point, b: Point): number {
  const r = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
