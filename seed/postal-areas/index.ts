import { existsSync, readFileSync } from 'node:fs';

// Postal code areas for the street map (migration 0027): OpenStreetMap's postal code boundaries
// (© OpenStreetMap contributors, ODbL), written by scripts/import-postal-areas.mjs into <cc>.json
// (never edit those by hand). Each postal code is a list of polygons, each a list of rings (outer
// first, then holes) in Google's polyline encoding at 5 decimals, longitude first.

/** Countries whose postal code areas are seeded; a postal code without an area gets a circle on the map */
export const POSTAL_AREA_COUNTRIES = ['DE', 'AT', 'US', 'CA', 'NL', 'AU'] as const;

/** One ring from the polyline encoding, as [lng, lat] pairs */
export function decodeRing(encoded: string): number[][] {
  const out: number[][] = [];
  let i = 0;
  let x = 0;
  let y = 0;
  const num = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    x += num();
    y += num();
    out.push([x / 1e5, y / 1e5]);
  }
  return out;
}

/**
 * A country's areas one at a time, decoded only when taken (the US file has about 34,000 areas
 * and 3.7 million points: decoded at once they would take several hundred MB in the seed)
 */
export function* postalAreas(countryCode: string): Generator<{ postalCode: string; polygons: number[][][][] }> {
  const file = new URL(`./${countryCode.toLowerCase()}.json`, import.meta.url);
  if (!existsSync(file)) return;
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[][]>;
  for (const [postalCode, polygons] of Object.entries(data)) yield { postalCode, polygons: polygons.map((rings) => rings.map(decodeRing)) };
}
