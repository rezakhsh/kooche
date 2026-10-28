// Postal code areas for the street map (docs/setup.md, "The street map"): a listing shows its
// postal code's area shaded, never a pin. Reads OpenStreetMap's postal code boundaries
// (`boundary=postal_code` relations, © OpenStreetMap contributors, ODbL) through the Overpass API,
// one 1.5° box of the country at a time (plain boxes work on every Overpass server; some have no
// area index). A relation is kept only when its code is one of the country's postal codes
// (seed/postal/<cc>.tsv) and one of that code's places lies within ~25 km of its outline, so a
// neighbour's code can't slip in. It then joins each relation's ways into rings, simplifies them with Douglas-Peucker
// at 0.0002° (about 15–20 m; the area is shown, not a street), and writes seed/postal-areas/<cc>.json:
//
//   { "13353": [["<outer ring>", "<hole>", …], …], … }
//
// one entry per postal code (relations with the same code are merged), each polygon a list of rings
// in Google's polyline encoding at 5 decimals, longitude first. The seed decodes them.
//
//   [OVERPASS_URL=…] [OVERPASS_FALLBACK_URLS=…,…] [OVERPASS_CACHE=<dir>] node scripts/import-postal-areas.mjs DE      (or AT)
//
// Oct 28, 2026 (boxes from overpass.openstreetmap.fr, data of Aug 10; broken relations by id from
// overpass-api.de and the mail.ru mirror): DE 8,037 of 8,172 postal codes, AT 2,231 (Austria's other
// codes are post-office boxes and large customers without an area).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { simplifyClosedRing } from './simplify-geometry.mjs';

// Any Overpass server with the full planet. On Oct 28, 2026 the main one answered 502 and the
// mail.ru mirror 504, so the import ran on https://overpass.openstreetmap.fr/api/interpreter
// (data of Aug 10, 2026)
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const AGENT = 'peydoo-postal-import/1.0 (+https://peydoo.com)';
const TOLERANCE = 0.0002;
/** The country's box [west, south, east, north] */
const REGIONS = {
  DE: { bbox: [5.8, 47.2, 15.1, 55.1] },
  AT: { bbox: [9.5, 46.3, 17.2, 49.1] },
};
const STEP = 1.5;

const cc = process.argv[2];
const region = REGIONS[cc];
if (!region) {
  console.error(`usage: node scripts/import-postal-areas.mjs <${Object.keys(REGIONS).join('|')}>`);
  process.exit(1);
}

/** One state's relations; kept in OVERPASS_CACHE (a directory) when set, so a run that stops can go on */
async function overpass(part, query, url = OVERPASS) {
  const cached = process.env.OVERPASS_CACHE && `${process.env.OVERPASS_CACHE}/${part}.json`;
  if (cached && existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: query }) }).catch((e) => ({ ok: false, status: e.message }));
    if (r.ok) {
      const text = await r.text();
      if (cached) writeFileSync(cached, text);
      return JSON.parse(text);
    }
    if (attempt >= 15) throw new Error(`Overpass ${r.status}`);
    console.error(`${part}: Overpass ${r.status}, waiting`);
    await new Promise((s) => setTimeout(s, 20_000 * Math.min(attempt, 6)));
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

function encode(ring) {
  let out = '';
  let px = 0;
  let py = 0;
  const num = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const [x, y] of ring) {
    const [ix, iy] = [Math.round(x * 1e5), Math.round(y * 1e5)];
    num(ix - px);
    num(iy - py);
    [px, py] = [ix, iy];
  }
  return out;
}

/** Our postal codes and the centres of their places */
const centres = new Map();
for (const line of readFileSync(`seed/postal/${cc.toLowerCase()}.tsv`, 'utf8').split('\n').filter(Boolean)) {
  const [code, , lat, lng] = line.split('\t');
  centres.set(code, [...(centres.get(code) ?? []), [Number(lng), Number(lat)]]);
}

const seen = new Set();
/** Relations a server sent incomplete (points or whole ways missing), or whose rings didn't close */
const broken = new Set();
const areas = new Map();
let points = 0;
let foreign = 0;

/** One relation: its area by its code, or why not */
function take(rel) {
  if (rel.type !== 'relation' || seen.has(rel.id)) return 'skip';
  const code = (rel.tags?.postal_code ?? '').trim();
  if (!centres.has(code)) return 'skip';
  // Some servers leave out points far outside the box, or a whole way
  if (rel.members.some((m) => m.type === 'way' && (!m.geometry?.length || m.geometry.some((g) => !g)))) {
    broken.add(rel.id);
    return 'broken';
  }
  const ways = (role) => rel.members.filter((m) => m.type === 'way' && (m.role === role || (role === 'outer' && m.role === ''))).map((m) => m.geometry.map((g) => [g.lon, g.lat]));
  const outers = rings(ways('outer'));
  const holes = rings(ways('inner'));
  const polygons = outers.map((o) => [o, ...holes.filter((h) => inside(h[0], o))]);
  const simplified = polygons
    .map((p) => p.map((r) => simplifyClosedRing(r, TOLERANCE)))
    .filter((p) => p[0])
    .map((p) => p.filter(Boolean));
  if (simplified.length === 0) {
    broken.add(rel.id);
    return 'broken';
  }
  seen.add(rel.id);
  broken.delete(rel.id);
  // A neighbour's code that happens to be ours too (a French 5-digit code) lies far from our
  // places of that code. GeoNames often puts all of a city's codes on its centre (Leipzig), so
  // within ~25 km of the outline's box
  const ring = polygons.flatMap((p) => p[0]);
  const M = 0.3;
  const [x0, y0, x1, y1] = [Math.min(...ring.map((c) => c[0])) - M, Math.min(...ring.map((c) => c[1])) - M, Math.max(...ring.map((c) => c[0])) + M, Math.max(...ring.map((c) => c[1])) + M];
  if (!centres.get(code).some(([cx, cy]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1)) {
    foreign++;
    return 'foreign';
  }
  areas.set(code, [...(areas.get(code) ?? []), ...simplified]);
  return 'ok';
}

const [west, south, east, north] = region.bbox;
for (let x = west; x < east; x += STEP) {
  for (let y = south; y < north; y += STEP) {
    const part = `${cc}_${x.toFixed(1)}_${y.toFixed(1)}`;
    const box = [y, x, Math.min(y + STEP, north), Math.min(x + STEP, east)].map((n) => n.toFixed(2)).join(',');
    const data = await overpass(part, `[out:json][timeout:900];rel[boundary=postal_code](${box});out geom;`);
    console.log(`${part}: ${data.elements.filter((r) => take(r) === 'ok').length} relations`);
    // Overpass asks for a pause between big queries
    await new Promise((s) => setTimeout(s, 2_000));
  }
}

// The broken ones once more, by id, from other servers (small questions get through when big ones don't)
for (const url of (process.env.OVERPASS_FALLBACK_URLS ?? '').split(',').filter(Boolean)) {
  const ids = [...broken];
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25);
    const data = await overpass(`${cc}_retry_${new URL(url).host}_${batch[0]}`, `[out:json][timeout:300];rel(id:${batch.join(',')});out geom;`, url).catch((e) => {
      console.error(`${url}: ${e.message}`);
      return { elements: [] };
    });
    for (const r of data.elements) take(r);
  }
  console.log(`after ${new URL(url).host}: ${broken.size} broken`);
}
// Our codes still without an area (relations the first server didn't have), by code
for (const url of (process.env.OVERPASS_FALLBACK_URLS ?? '').split(',').filter(Boolean)) {
  const missing = [...centres.keys()].filter((c) => !areas.has(c));
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    const data = await overpass(`${cc}_codes_${new URL(url).host}_${batch[0]}`, `[out:json][timeout:300];rel[boundary=postal_code][postal_code~"^(${batch.join('|')})$"];out geom;`, url).catch((e) => {
      console.error(`${url}: ${e.message}`);
      return { elements: [] };
    });
    for (const r of data.elements) take(r);
  }
  console.log(`after ${new URL(url).host}: ${[...centres.keys()].filter((c) => !areas.has(c)).length} of our codes without an area`);
}
console.log(`${foreign} relations left out: their code's places lie outside them`);
if (broken.size) console.log(`${broken.size} relations incomplete on every server: ${[...broken].join(', ')}`);

const codes = [...areas.keys()].sort();
const out = {};
for (const c of codes) {
  out[c] = areas.get(c).map((p) => p.map(encode));
  points += areas.get(c).flat(2).length;
}
const file = `seed/postal-areas/${cc.toLowerCase()}.json`;
writeFileSync(file, `{\n${codes.map((c) => `${JSON.stringify(c)}:${JSON.stringify(out[c])}`).join(',\n')}\n}\n`);
console.log(`${codes.length} postal codes, ${points} points → ${file}`);
