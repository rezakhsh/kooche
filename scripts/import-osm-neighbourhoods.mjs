// A city's districts from OpenStreetMap (boundary=administrative, © OpenStreetMap contributors,
// ODbL) for seed/neighbourhoods/<cc>-<city>.json, the same format as scripts/import-neighbourhoods.mjs
// (Berlin's official file). Names as OpenStreetMap writes them locally (owner, Nov 3, 2026: no
// Persian names; Greek or Cyrillic names use their English or Latin form where OpenStreetMap has one).
// Only cities of about 200,000 people or more get districts; smaller ones show their own name, as on
// Kleinanzeigen (owner, Nov 3, 2026).
//
//   [OVERPASS_URL=…] node scripts/import-osm-neighbourhoods.mjs <lat> <lng> "<city name>" <output.json> [--level=N] [--relation=ID] [--include=ID,…]
//   node scripts/import-osm-neighbourhoods.mjs --rename <file.json>…   (tidies the names of existing files)
//
// 1. The city: the administrative boundary (admin_level 4–8) named "<city name>" (also name:en or
//    name:de) around the city's point, or --relation. 2. Its districts: for each admin_level below
//    the city's, the boundaries in the city's box whose centre lies inside the city; the deepest
//    level with 4–200 districts that together cover at least 70% of the city (its sea and lakes
//    may lie outside every district) wins: Berlin's 97 Ortsteile, Hamburg's 104 Stadtteile. A
//    deeper level mapped in one corner only (München's 7 pieces below its 25 Stadtbezirke) doesn't.
//    --level picks the level people use where the deepest is a land register (Vienna's Bezirke, not
//    its Katastralgemeinden); --include adds districts the centre test misses (Paris 12e, whose
//    Bois de Vincennes puts its centre outside Paris; the City of London, one level up). Only plain
//    box queries: every Overpass server answers them, also without an area index. 3. Each district's
//    ways joined into rings and simplified with Douglas-Peucker at 0.0001° (about 7–11 m), rounded to
//    5 decimals. A city with no such level gets no file (its cards show the city).

import { readFileSync, writeFileSync } from 'node:fs';
import { simplifyClosedRing } from './simplify-geometry.mjs';

const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const AGENT = 'peydoo-neighbourhood-import/1.0 (+https://peydoo.com)';
const MIN = 4;
const MAX = 200;
const COVER = 0.7;

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

/** The name as local listings show it: «Hackney», not «London Borough of Hackney» (Gumtree), «Paris 11e» (Leboncoin), «Södermalm» (Blocket) */
function tidy(name) {
  return name
    .replace(/^(Katastralgemeinde|Gemarkung|Stadtbezirk|Stadtteil|Ortsteil) /, '')
    .replace(/^(London Borough|Royal Borough) of /, '')
    .replace(/^City of (?!London$)/, '')
    .replace(/^Paris (\d+)(er|e) Arrondissement$/, 'Paris $1$2')
    .replace(/(?<=[^aeiouyåäö])s stadsdelsområde$/, '')
    .replace(/ stadsdelsområde$/, '')
    .replace(/ \((Ortsteil|Stadtteil)\)$/, '');
}

if (args[0] === '--rename') {
  for (const file of args.slice(1)) {
    const rows = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, `[\n${rows.map((r) => JSON.stringify({ ...r, name: tidy(r.name) })).join(',\n')}\n]\n`);
  }
  process.exit(0);
}
const [lat, lng, cityName, output] = args.filter((a) => !a.startsWith('--'));
if (!lat || !lng || !cityName || !output) {
  console.error('usage: node scripts/import-osm-neighbourhoods.mjs <lat> <lng> "<city name>" <output.json> [--level=N] [--relation=ID] [--include=ID,…]');
  process.exit(1);
}

async function overpass(query) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: `[out:json][timeout:300];${query}` }),
    }).catch((e) => ({ ok: false, status: e.message }));
    if (r.ok) return (await r.json()).elements;
    if (attempt >= 8) throw new Error(`Overpass ${r.status}`);
    console.error(`Overpass ${r.status}, waiting`);
    await new Promise((s) => setTimeout(s, 15_000 * attempt));
  }
}

const key = ([x, y]) => `${x},${y}`;

/** Joins ways (lists of [lon, lat]) end to end into closed rings; leftovers that never close are dropped */
function rings(ways) {
  const open = ways.filter((w) => w.length >= 2).map((w) => [...w]);
  const out = [];
  while (open.length > 0) {
    let ring = open.pop();
    for (let grown = true; grown && key(ring[0]) !== key(ring.at(-1)); ) {
      grown = false;
      for (let i = 0; i < open.length; i++) {
        const w = open[i];
        const end = key(ring.at(-1));
        if (key(w[0]) === end) ring = [...ring, ...w.slice(1)];
        else if (key(w.at(-1)) === end) ring = [...ring, ...w.slice(0, -1).reverse()];
        else if (key(w.at(-1)) === key(ring[0])) ring = [...w.slice(0, -1), ...ring];
        else if (key(w[0]) === key(ring[0])) ring = [...w.slice(1).reverse(), ...ring];
        else continue;
        open.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1))) out.push(ring);
  }
  return out;
}

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Plain area in square degrees: enough to compare districts with their own city */
const ringArea = (r) => Math.abs(r.reduce((a, [x, y], i) => a + (i ? r[i - 1][0] * y - x * r[i - 1][1] : 0), 0)) / 2;
const area = (polygons) => polygons.reduce((a, [outer, ...holes]) => a + ringArea(outer) - holes.reduce((h, r) => h + ringArea(r), 0), 0);

/** A relation's polygons (outer ring first, then its holes), or null when its rings don't close */
function polygonsOf(rel) {
  if (rel.members.some((m) => m.type === 'way' && (!m.geometry?.length || m.geometry.some((g) => !g)))) return null;
  const ways = (outer) => rel.members.filter((m) => m.type === 'way' && (outer ? m.role === 'outer' || m.role === '' : m.role === 'inner')).map((m) => m.geometry.map((g) => [g.lon, g.lat]));
  const outers = rings(ways(true));
  const holes = rings(ways(false));
  return outers.length ? outers.map((o) => [o, ...holes.filter((h) => inside(h[0], o))]) : null;
}

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’-]+$/u;
/** The local name; Greek, Cyrillic and other scripts take their English or Latin form where there is one */
function nameOf(tags) {
  const name = (tags.name ?? '').trim();
  if (!name || LATIN.test(name)) return tidy(name);
  return tidy((tags['name:en'] ?? tags['name:latin'] ?? tags.int_name ?? name).trim());
}

// 1. The city
const city = flag('relation')
  ? (await overpass(`rel(${flag('relation')});out geom;`))[0]
  : await (async () => {
      const named = (await overpass(`rel[boundary=administrative][admin_level~"^[4-8]$"](${Number(lat) - 0.03},${Number(lng) - 0.03},${Number(lat) + 0.03},${Number(lng) + 0.03});out tags;`)).filter((r) =>
        [r.tags.name, r.tags['name:en'], r.tags['name:de']].includes(cityName),
      );
      if (named.length === 0) throw new Error(`no administrative boundary named ${cityName} near ${lat},${lng}; pass --relation=ID`);
      // The widest one with that name (Berlin the state, not a district called Berlin)
      named.sort((a, b) => Number(a.tags.admin_level) - Number(b.tags.admin_level));
      return (await overpass(`rel(${named[0].id});out geom;`))[0];
    })();
const cityPolygons = polygonsOf(city);
if (!cityPolygons) throw new Error(`the city's boundary (relation ${city.id}) doesn't close`);
const insideCity = (p) => cityPolygons.some(([outer, ...holes]) => inside(p, outer) && !holes.some((h) => inside(p, h)));
const all = cityPolygons.flatMap((p) => p[0]);
const box = [Math.min(...all.map((c) => c[1])), Math.min(...all.map((c) => c[0])), Math.max(...all.map((c) => c[1])), Math.max(...all.map((c) => c[0]))].join(',');
const cityLevel = Number(city.tags.admin_level);
console.log(`${city.tags.name} (relation ${city.id}, admin_level ${cityLevel})`);

// 2. The district level
// One query for every level below the city's (one per level is many times slower on a busy server)
const levels = flag('level') ? [Number(flag('level'))] : Array.from({ length: 11 - cityLevel }, (_, i) => cityLevel + 1 + i);
const found = (await overpass(`rel[boundary=administrative][admin_level~"^(${levels.join('|')})$"](${box});out tags center;`)).filter(
  (r) => r.center && insideCity([r.center.lon, r.center.lat]) && r.tags.name,
);
const candidates = new Map(levels.map((l) => [l, found.filter((r) => Number(r.tags.admin_level) === l)]));
for (const [l, rels] of candidates) console.log(`  admin_level ${l}: ${rels.length}`);
const cityArea = area(cityPolygons);

// 3. Their shapes, deepest level first, until one covers the city
async function shapes(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 40) {
    for (const rel of await overpass(`rel(id:${ids.slice(i, i + 40).join(',')});out geom;`)) {
      const polygons = polygonsOf(rel);
      if (!polygons) {
        console.error(`  ${rel.tags.name} (relation ${rel.id}): rings don't close, left out`);
        continue;
      }
      const simplified = polygons
        .map((p) => p.map((r) => simplifyClosedRing(r, 0.0001)))
        .filter((p) => p[0])
        .map((p) => p.filter(Boolean));
      if (simplified.length) rows.push({ key: `osm-${rel.id}`, name: nameOf(rel.tags), polygons: simplified });
    }
  }
  return rows;
}

let level;
let rows;
for (const l of [...candidates.keys()].reverse()) {
  const n = candidates.get(l).length;
  if (!flag('level') && (n < MIN || n > MAX)) continue;
  const got = await shapes(candidates.get(l).map((r) => r.id));
  const cover = got.reduce((a, r) => a + area(r.polygons), 0) / cityArea;
  console.log(`  admin_level ${l}: covers ${Math.round(cover * 100)}% of the city`);
  if (flag('level') || cover >= COVER) {
    [level, rows] = [l, got];
    break;
  }
}
if (!level) {
  console.log(`no district level with ${MIN}–${MAX} districts covering the city: no file`);
  process.exit(0);
}
if (flag('include')) rows.push(...(await shapes(flag('include').split(','))));
rows.sort((a, b) => (a.key < b.key ? -1 : 1));
writeFileSync(output, `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);
console.log(`admin_level ${level}: ${rows.length} districts, ${rows.reduce((n, r) => n + r.polygons.flat(2).length, 0)} points`);
