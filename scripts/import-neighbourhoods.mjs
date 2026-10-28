// Turns a city's official neighbourhood boundaries (GeoJSON in WGS 84) into
// seed/neighbourhoods/<file>.json: one row per neighbourhood with its official key, local name and
// a simplified MultiPolygon. The Persian names are in seed/neighbourhoods/index.ts.
//
//   node scripts/import-neighbourhoods.mjs <input.geojson> <output.json> <key property> <name property>
//
// Berlin (wave 1, Oct 27, 2026): the 97 Ortsteile from the Geoportal Berlin, Datenlizenz
// Deutschland Zero 2.0 (no conditions):
//   https://gdi.berlin.de/services/wfs/alkis_ortsteile?service=WFS&version=2.0.0&request=GetFeature&typeNames=alkis_ortsteile:ortsteile&outputFormat=application/json&srsName=EPSG:4326
//   node scripts/import-neighbourhoods.mjs ortsteile.json seed/neighbourhoods/de-berlin.json sch nam
//
// Simplified with Douglas-Peucker at 0.0001° (about 7–11 m) and rounded to 5 decimals: a listing's
// point is a postal code's centre or a rounded area, so finer borders would add nothing.

import { readFileSync, writeFileSync } from 'node:fs';
import { simplifyClosedRing } from './simplify-geometry.mjs';

const [, , input, output, keyProp, nameProp] = process.argv;
if (!input || !output || !keyProp || !nameProp) {
  console.error('usage: node scripts/import-neighbourhoods.mjs <input.geojson> <output.json> <key property> <name property>');
  process.exit(1);
}

const simplifyRing = (ring) => simplifyClosedRing(ring, 0.0001);

const collection = JSON.parse(readFileSync(input, 'utf8'));
const rows = [];
for (const f of collection.features) {
  const key = String(f.properties[keyProp] ?? '').trim();
  const name = String(f.properties[nameProp] ?? '').trim();
  if (!key || !name) throw new Error(`feature without ${keyProp} or ${nameProp}`);
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const simplified = polygons
    .map((rings) => rings.map(simplifyRing))
    // A polygon whose outer ring collapsed is a sliver; holes that collapse are dropped
    .filter((rings) => rings[0])
    .map((rings) => rings.filter(Boolean));
  if (simplified.length === 0) throw new Error(`${name}: nothing left after simplifying`);
  rows.push({ key, name, polygons: simplified });
}
rows.sort((a, b) => (a.key < b.key ? -1 : 1));
writeFileSync(output, `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);
console.log(`${rows.length} neighbourhoods, ${rows.reduce((n, r) => n + r.polygons.flat(2).length, 0)} points`);
