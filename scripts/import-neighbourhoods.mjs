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

const [, , input, output, keyProp, nameProp] = process.argv;
if (!input || !output || !keyProp || !nameProp) {
  console.error('usage: node scripts/import-neighbourhoods.mjs <input.geojson> <output.json> <key property> <name property>');
  process.exit(1);
}

const TOLERANCE = 0.0001;
const round = (n) => Math.round(n * 1e5) / 1e5;

/** Distance from p to the segment a–b, in degrees (good enough at this scale) */
function segmentDistance(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(points) {
  if (points.length < 3) return points;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = segmentDistance(points[i], points[0], points[points.length - 1]);
    if (d > max) [max, index] = [d, i];
  }
  if (max <= TOLERANCE) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))];
}

/** A closed ring, simplified; split at its farthest point so both halves keep their shape */
function simplifyRing(ring) {
  const open = ring.slice(0, -1);
  let far = 0;
  let max = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > max) [max, far] = [d, i];
  }
  const first = simplify(open.slice(0, far + 1));
  const second = simplify([...open.slice(far), open[0]]);
  const out = [...first.slice(0, -1), ...second.slice(0, -1)].map(([x, y]) => [round(x), round(y)]);
  const unique = out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
  return unique.length >= 3 ? [...unique, unique[0]] : null;
}

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
