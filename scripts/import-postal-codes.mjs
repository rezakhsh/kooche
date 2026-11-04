// Turns a GeoNames postal-code file (https://download.geonames.org/export/zip/<CC>.zip, CC BY 4.0)
// into seed/postal/<cc>.tsv: postal code, place name, latitude, longitude.
//
//   node scripts/import-postal-codes.mjs /path/to/DE.txt de
//
// Each country has its own rule (RULES below): which rows to leave out, how the code is stored
// (the form src/modules/listings/postal-code.ts reads, never a street-level code) and how the
// place name is written. A code with several places keeps each place once; rows that end up with
// the same code and name are merged into one, at the mean of their points (postal codes step 4,
// Nov 4, 2026). Germany and Austria are written exactly as before.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, cc] = process.argv;
if (!input || !/^[a-z]{2}$/.test(cc ?? '')) {
  console.error('usage: node scripts/import-postal-codes.mjs <GeoNames CC.txt> <cc>');
  process.exit(1);
}

/** The database check on postal_places.postal_code */
const STORED = /^[0-9A-Z][0-9A-Z -]{1,9}$/;

/** Spaces tidied; "Bors(Canton de Tude)" → "Bors (Canton de Tude)", "Ash,Canterbury" → "Ash, Canterbury" */
const tidy = (s) =>
  s
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .replace(/(\S)\(/g, '$1 (')
    .replace(/,(?=\S)/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

/** "Beverly Hills" in California → "Beverly Hills, CA": town names repeat across states (Craigslist, Gumtree AU) */
const withState = (name, r) => (r.admin1Code ? `${name}, ${r.admin1Code}` : name);

const US_STATES = new Set(
  'AK AL AR AZ CA CO CT DC DE FL GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC SD TN TX UT VA VT WA WI WV WY'.split(' '),
);

/** Austrian city districts come as "Graz,01.Bez.:Innere Stadt"; written as "Graz, Innere Stadt" */
const austrian = (s) =>
  s
    .trim()
    .replace(/^(.+?),\s*\d+\.\s*Bez\.:\s*(.+)$/, '$1, $2')
    .replace(/\s+/g, ' ');

/** Australia Post's mail and delivery centres ("Sydney Dc", "Kingsgrove Bc"): not places people live */
const AU_FACILITY = / (Dc|Bc|Mc|Msc|Po|Delivery Centre|Mail Centre|Business Centre)$/i;

/** Directions inside one Canadian city: "Calgary Northeast", "Lethbridge West and Central" → the city */
const CA_PART = / (North|South|East|West|Northeast|Northwest|Southeast|Southwest|Central|North Central|West and Central|East Central|South Central)$/;

/**
 * Per country: `keep(row)` leaves rows out, `code(row)` the stored code (null leaves the row out),
 * `name(row)` the place name, `merge` how rows with the same code and name are joined.
 * Row fields are GeoNames' columns (see the readme in the download).
 */
const RULES = {
  // Rows without an accuracy value are the codes of large recipients (companies, authorities, PO
  // boxes) in Germany, not places where people live
  de: { keep: (r) => !!r.accuracy, code: (r) => r.code, name: (r) => austrian(r.name), merge: 'first' },
  at: { keep: (r) => !!r.accuracy, code: (r) => r.code, name: (r) => austrian(r.name), merge: 'first' },
  // Outward codes only ("SW1A", "E8"): the plain GB file. Isle of Man, Guernsey and Jersey are not
  // the UK. Every Greater London code is "London" (Royal Mail's post town; the label shows the
  // district from London's neighbourhoods: «Hackney، E8 London»).
  gb: {
    keep: (r) => !/^(IM|GY|JE)\d/.test(r.code),
    code: (r) => (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(r.code) ? r.code : null),
    name: (r) => (r.admin2 === 'Greater London' ? 'London' : tidy(r.name.replace(/\s*\(PO Boxes\)/i, ''))),
  },
  // Plain 5-digit codes; CEDEX business codes ("75000 CEDEX 07") and Clipperton Island (98799) are
  // left out. Arrondissements are their city, as Leboncoin writes them ("Paris 11" → "Paris",
  // "75011 Paris"), at the arrondissement's point rather than the city centre GeoNames gives "Paris".
  fr: {
    keep: (r) => !r.code.startsWith('98'),
    code: (r) => (/^\d{5}$/.test(r.code) ? r.code : null),
    name: (r) => {
      const m = /^(Paris|Lyon|Marseille) \d{1,2}(e|er)?$/.exec(tidy(r.name));
      if (m) r.precise = true;
      return m ? m[1] : tidy(r.name);
    },
  },
  // GeoNames' places are neighbourhoods and villages (mahalle, köy); written after their district
  // (ilçe) as Austria writes its districts: "Kadiköy, Caferağa"
  tr: {
    keep: (r) => !/Eklenecek/i.test(r.name), // "Saraylar A Eklenecek" ("to be added"), a placeholder
    code: (r) => (/^\d{5}$/.test(r.code) ? r.code : null),
    name: (r) => {
      const place = tidy(r.name);
      const district = tidy(r.admin2);
      return !district || district === place ? place : `${district}, ${place}`;
    },
  },
  // Forward sortation areas ("M5V"; two rows have a whole code). Canada Post's names are tidied:
  // a rural area (second character 0) is its main town, "Eastern Alberta (St. Paul)" → "St. Paul";
  // a city's area is the city, "Calgary (Rundle / Whitehorn)" → "Calgary"; the province follows.
  // H0H is Santa Claus's.
  ca: {
    keep: (r) => !r.code.startsWith('H0H'),
    code: (r) => (/^[A-Z]\d[A-Z]( \d[A-Z]\d)?$/.test(r.code) ? r.code.slice(0, 3) : null),
    name: (r) => {
      let n = r.name.replace(/\s+(Stn |Business Reply|PO Box).*$/i, '').replace(/\s*\(Enclave of [^)]*\)/i, '');
      const m = /^(.*?)\s*\((.*)\)\s*$/.exec(n);
      if (m) n = r.code[1] === '0' ? m[2].split('/')[0] : m[1];
      n = tidy(n).replace(CA_PART, '').replace(/^(Downtown|Central|East|West|North) Toronto$/, 'Toronto');
      return withState(n, r);
    },
  },
  // 5-digit ZIPs in the 50 states and DC: military APO/FPO/DPO, the Marshall Islands and Wake
  // Island are left out
  us: {
    keep: (r) => US_STATES.has(r.admin1Code) && !/^(APO|FPO|DPO)\b/.test(r.name) && r.code !== '96898',
    code: (r) => (/^\d{5}$/.test(r.code) ? r.code : null),
    name: (r) => withState(tidy(r.name), r),
  },
  // 4 digits ("1012"); names as written ("Bergen (NH)")
  nl: { code: (r) => (/^\d{4}$/.test(r.code) ? r.code : null), name: (r) => tidy(r.name) },
  it: { code: (r) => (/^\d{5}$/.test(r.code) ? r.code : null), name: (r) => tidy(r.name) },
  // "123 45", as GeoNames writes it
  se: { code: (r) => (/^\d{3} \d{2}$/.test(r.code) ? r.code : null), name: (r) => tidy(r.name) },
  // 4 digits; mail centres left out where the code has a real place (else the centre's town)
  au: {
    code: (r) => (/^\d{4}$/.test(r.code) ? r.code : null),
    name: (r) => withState(tidy(r.name), r),
  },
};

const rule = RULES[cc];
if (!rule) {
  console.error(`no rule for "${cc}": add one to RULES first (countries: ${Object.keys(RULES).join(', ')})`);
  process.exit(1);
}

let read = 0;
let left = 0;
const groups = new Map(); // "code\tplace" → { code, place, points, precise points, only a mail centre }
for (const line of readFileSync(input, 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f.length < 12) continue;
  read++;
  const r = {
    country: f[0],
    code: f[1].trim(),
    name: f[2],
    admin1: f[3].trim(),
    admin1Code: f[4].trim(),
    admin2: f[5].trim(),
    lat: Number(f[9]),
    lng: Number(f[10]),
    accuracy: f[11]?.trim(),
  };
  if (r.country !== cc.toUpperCase() || !Number.isFinite(r.lat) || !Number.isFinite(r.lng) || (rule.keep && !rule.keep(r))) {
    left++;
    continue;
  }
  const code = rule.code(r);
  let facility = false;
  if (cc === 'au' && AU_FACILITY.test(r.name.trim())) {
    facility = true;
    r.name = r.name.trim().replace(AU_FACILITY, '');
  }
  const place = rule.name(r);
  if (!code || !STORED.test(code) || place.length === 0 || place.length > 100) {
    left++;
    continue;
  }
  const key = `${code}\t${place}`;
  const g = groups.get(key) ?? groups.set(key, { code, place, points: [], precise: [], facility }).get(key);
  if (g.points.length + g.precise.length === 0 || rule.merge !== 'first') (r.precise ? g.precise : g.points).push([r.lat, r.lng]);
  g.facility &&= facility;
}

const byCode = new Map();
for (const g of groups.values()) byCode.set(g.code, [...(byCode.get(g.code) ?? []), g]);
const rows = [];
for (const list of byCode.values()) {
  for (const g of list) {
    // A mail centre only where the code has no real place
    if (g.facility && list.some((o) => !o.facility)) continue;
    const points = g.precise.length ? g.precise : g.points;
    const mean = (i) => points.reduce((s, p) => s + p[i], 0) / points.length;
    rows.push([g.code, g.place, mean(0).toFixed(4), mean(1).toFixed(4)]);
  }
}
rows.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));

const out = new URL(`../seed/postal/${cc}.tsv`, import.meta.url);
writeFileSync(out, rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log(
  `${read} rows read, ${left} left out → ${rows.length} places, ${new Set(rows.map((r) => r[0])).size} postal codes → seed/postal/${cc}.tsv`,
);
