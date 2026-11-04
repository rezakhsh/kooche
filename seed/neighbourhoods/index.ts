import { readFileSync } from 'node:fs';
import type { NeighbourhoodSeed } from '../types';

// City neighbourhoods (wave 1, Oct 27, 2026): a listing card says «Wedding، ۲ ساعت پیش» instead of
// «برلین». Names as written locally, never Persian (owner, Nov 3, 2026), the same as on the map.
// Berlin's boundaries are the city's official ones (scripts/import-neighbourhoods.mjs); other
// cities' come from OpenStreetMap (scripts/import-osm-neighbourhoods.mjs). Both write
// <country>-<city>.json; never edit those by hand. A city without a file shows its own name.

type CityNeighbourhoods = { countryCode: string; city: string; file: string; source: string };

const BERLIN: CityNeighbourhoods = {
  countryCode: 'DE',
  city: 'berlin',
  file: 'de-berlin.json',
  // Geoportal Berlin, ALKIS Ortsteile, Datenlizenz Deutschland Zero 2.0 (downloaded Oct 27, 2026)
  source: 'https://gdi.berlin.de/services/wfs/alkis_ortsteile',
};

// The other cities of about 200,000 people or more where OpenStreetMap maps their districts
// completely (Nov 3, 2026). Left out: Chemnitz, Freiburg and Oberhausen (mapped in part only),
// Amsterdam, Los Angeles, Milano and Sydney (no district level people use: their postal places
// name the area).
const FROM_OSM: Record<string, string> = {
  AT: 'graz linz wien',
  CA: 'toronto',
  DE: 'aachen augsburg bielefeld bochum bonn braunschweig bremen dortmund dresden duesseldorf duisburg erfurt essen frankfurt gelsenkirchen hagen halle-saale hamburg hannover karlsruhe kassel kiel koeln krefeld leipzig luebeck magdeburg mainz mannheim moenchengladbach muenchen muenster nuernberg rostock stuttgart wiesbaden wuppertal',
  FR: 'paris',
  GB: 'london',
  SE: 'stockholm',
  TR: 'istanbul',
};

export const NEIGHBOURHOOD_CITIES: CityNeighbourhoods[] = [
  BERLIN,
  ...Object.entries(FROM_OSM).flatMap(([countryCode, cities]) =>
    cities.split(' ').map((city) => ({
      countryCode,
      city,
      file: `${countryCode.toLowerCase()}-${city}.json`,
      source: 'OpenStreetMap, boundary=administrative (© OpenStreetMap contributors, ODbL)',
    })),
  ),
];

/** One city's neighbourhoods */
export function neighbourhoods(c: CityNeighbourhoods): NeighbourhoodSeed[] {
  const rows = JSON.parse(readFileSync(new URL(`./${c.file}`, import.meta.url), 'utf8')) as { key: string; name: string; polygons: number[][][][] }[];
  return rows.map((r) => ({ key: r.key, nameLocal: r.name, polygons: r.polygons }));
}
