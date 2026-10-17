// Turns a GeoNames postal-code file (https://download.geonames.org/export/zip/<CC>.zip, CC BY 4.0)
// into seed/postal/<cc>.tsv: postal code, place name, latitude, longitude.
//
//   node scripts/import-postal-codes.mjs /path/to/DE.txt de
//
// Rows without an accuracy value are left out: in the German file they are the codes of large
// recipients (companies, authorities, PO boxes), not places where people live. A code with
// several places keeps each place once. Austrian city districts are rewritten (see below).

import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, cc] = process.argv;
if (!input || !/^[a-z]{2}$/.test(cc ?? '')) {
  console.error('usage: node scripts/import-postal-codes.mjs <GeoNames CC.txt> <cc>');
  process.exit(1);
}

const seen = new Set();
const rows = [];
for (const line of readFileSync(input, 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f.length < 12) continue;
  const [country, code, name] = f;
  const lat = Number(f[9]);
  const lng = Number(f[10]);
  const accuracy = f[11]?.trim();
  if (country !== cc.toUpperCase() || !accuracy) continue;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  // Austrian city districts come as "Graz,01.Bez.:Innere Stadt"; written as "Graz, Innere Stadt"
  const place = name
    .trim()
    .replace(/^(.+?),\s*\d+\.\s*Bez\.:\s*(.+)$/, '$1, $2')
    .replace(/\s+/g, ' ');
  if (!/^[0-9A-Z][0-9A-Z -]{1,9}$/.test(code) || place.length === 0 || place.length > 100) continue;
  const key = `${code}\t${place}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push([code, place, lat.toFixed(4), lng.toFixed(4)]);
}
rows.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));

const out = new URL(`../seed/postal/${cc}.tsv`, import.meta.url);
writeFileSync(out, rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log(`${rows.length} places, ${new Set(rows.map((r) => r[0])).size} postal codes → seed/postal/${cc}.tsv`);
