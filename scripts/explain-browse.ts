// Runs EXPLAIN (ANALYZE, BUFFERS) on the queries the browse pages make, in a scratch database
// filled by scripts/generate-listings.ts (name ending in _bench). The SQL is exactly what
// src/modules/search/browse.ts builds: Drizzle's logger captures it, then it runs again under
// EXPLAIN as classifieds_app.
//
//   BENCH_DATABASE_URL=postgres://classifieds_owner:…@host:5432/classifieds_bench npx tsx scripts/explain-browse.ts

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { snapToGrid } from '../src/lib/geo';
import { loadCatalog } from '../src/modules/listings/catalog';
import { browseListings, categoryCounts, cityCounts, countListings, type SearchFilters } from '../src/modules/search/browse';

const url = process.env.BENCH_DATABASE_URL;
if (!url || !/_bench$/.test(new URL(url).pathname)) throw new Error('BENCH_DATABASE_URL must name a database ending in _bench');

const client = postgres(url, { max: 1, onnotice: () => {} });
let captured: { query: string; params: unknown[] }[] = [];
const db = drizzle(client, { schema, logger: { logQuery: (query, params) => void captured.push({ query, params }) } });

async function explain(label: string, run: () => Promise<unknown>) {
  captured = [];
  await run();
  const main = captured[0]!;
  const rows = await client.begin(async (tx) => {
    await tx.unsafe('SET LOCAL ROLE classifieds_app');
    return tx.unsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${main.query}`, main.params as never[]);
  });
  const plan = (rows[0] as { 'QUERY PLAN': { Plan: Record<string, unknown>; 'Execution Time': number }[] })['QUERY PLAN'][0]!;
  const nodes: string[] = [];
  const walk = (n: Record<string, unknown>) => {
    const name = `${n['Node Type']}${n['Index Name'] ? ` ${n['Index Name']}` : ''}${n['Relation Name'] && !n['Index Name'] ? ` ${n['Relation Name']}` : ''}`;
    if (!/^(Result|Limit|Subquery Scan|Aggregate|Sort|Hash|Materialize|Memoize|Incremental Sort|Gather.*)$/.test(name)) nodes.push(name);
    for (const c of (n.Plans as Record<string, unknown>[] | undefined) ?? []) walk(c);
  };
  walk(plan.Plan);
  const buffers = (plan.Plan['Shared Hit Blocks'] as number) + (plan.Plan['Shared Read Blocks'] as number);
  console.log(`${plan['Execution Time'].toFixed(2).padStart(8)} ms  ${String(buffers).padStart(6)} buf  ${label}\n${' '.repeat(26)}${[...new Set(nodes)].join(' · ')}`);
}

async function main() {
  const catalog = await loadCatalog(db);
  const subtree = (slug: string): string[] => {
    const walk = (id: string): string[] => [id, ...catalog.byId.get(id)!.childIds.flatMap(walk)];
    return walk(catalog.bySlug.get(slug)!.id);
  };
  const city = async (slug: string) => (await db.select().from(schema.locations).where(and(eq(schema.locations.slug, slug), eq(schema.locations.kind, 'city'))))[0]!;
  const berlin = await city('berlin');
  const base: SearchFilters = { countryCode: 'DE', categoryIds: null, locationId: null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest' };
  const page3 = async (f: SearchFilters) => {
    const p1 = await browseListings(db, f, null);
    const p2 = await browseListings(db, f, p1.next);
    return p2.next;
  };
  const [{ n }] = await client`SELECT count(*)::int AS n FROM listings WHERE status = 'active'`;
  console.log(`Active listings: ${n}\n`);

  const cars = subtree('cars');
  const carFilters: SearchFilters['attributes'] = [
    { key: 'brand', type: 'select', values: ['bmw', 'audi', 'volkswagen'] },
    { key: 'fuel', type: 'select', values: ['diesel'] },
    { key: 'year', type: 'number', min: 2012, max: null, money: false },
    { key: 'mileage_km', type: 'number', min: null, max: 150_000, money: false },
  ];
  const near = (km: number) => ({ point: snapToGrid({ lat: berlin.center.lat + 0.01, lng: berlin.center.lng - 0.02 }), radiusM: km * 1000 });

  const cases: [string, SearchFilters, string | null][] = [
    ['country, newest', base, null],
    ['country, newest, page 3', base, await page3(base)],
    ['country + category (cars)', { ...base, categoryIds: cars }, null],
    ['country + parent category (vehicles)', { ...base, categoryIds: subtree('vehicles') }, null],
    ['city (berlin)', { ...base, locationId: berlin.id }, null],
    ['city + category (berlin, apartments-rent)', { ...base, locationId: berlin.id, categoryIds: subtree('apartments-rent') }, null],
    ['city + cars + make, fuel, year, mileage', { ...base, locationId: berlin.id, categoryIds: cars, attributes: carFilters }, null],
    ['country + cars + make, fuel, year, mileage', { ...base, categoryIds: cars, attributes: carFilters }, null],
    ['country + apartments + balcony, lift (GIN)', { ...base, categoryIds: subtree('apartments-rent'), attributes: [{ key: 'balcony', type: 'boolean' }, { key: 'elevator', type: 'boolean' }] }, null],
    ['country, all categories, condition=new (GIN)', { ...base, attributes: [{ key: 'condition', type: 'select', values: ['new'] }] }, null],
    ['country + category, price 100–500, price asc', { ...base, categoryIds: subtree('mobile-phones'), price: { min: 10_000, max: 50_000 }, sort: 'price_asc' }, null],
    ['country, all categories, price asc', { ...base, sort: 'price_asc' }, null],
    ['country, all categories, price desc, page 3', { ...base, sort: 'price_desc' }, await page3({ ...base, sort: 'price_desc' })],
    ['postal code only (12045)', { ...base, postalCode: '12045' }, null],
    ['near 10 km, distance', { ...base, around: near(10), sort: 'distance' }, null],
    ['near 50 km, distance', { ...base, around: near(50), sort: 'distance' }, null],
    ['near 50 km, distance, page 3', { ...base, around: near(50), sort: 'distance' }, await page3({ ...base, around: near(50), sort: 'distance' })],
    ['near 25 km + cars, newest', { ...base, around: near(25), categoryIds: cars }, null],
    ['shipping, country, newest', { ...base, shipping: true }, null],
  ];
  for (const [label, f, cursor] of cases) await explain(label, () => browseListings(db, f, cursor));
  console.log('');
  await explain('count: country', () => countListings(db, base));
  await explain('count: city + cars + filters', () => countListings(db, { ...base, locationId: berlin.id, categoryIds: cars, attributes: carFilters }));
  await explain('count: near 50 km', () => countListings(db, { ...base, around: near(50) }));
  await explain('category counts: country', () => categoryCounts(db, 'DE'));
  await explain('category counts: city', () => categoryCounts(db, 'DE', berlin.id));
  await explain('city counts: country', () => cityCounts(db, 'DE'));
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
