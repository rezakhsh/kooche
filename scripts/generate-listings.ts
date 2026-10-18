// Generates realistic test listings for measuring browse queries (EXPLAIN ANALYZE) in a scratch
// database, never staging or production: the database name must end in _bench.
//
//   BENCH_DATABASE_URL=postgres://classifieds_owner:…@host:5432/classifieds_bench \
//     npx tsx scripts/generate-listings.ts 5000
//
// The database needs the migrations and the seed first. Listings get valid attributes from the
// real category definitions (dependent selects included), a price in the country's currency, a
// city weighted by population, and the city centre, a postal-area centre or a ~500 m cell. About
// 85% are active; the rest paused, sold, expired or deleted, as the partial indexes expect.

import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomInt } from 'node:crypto';
import * as schema from '../src/db/schema';
import { snapToGrid } from '../src/lib/geo';
import { normalizePersian } from '../src/lib/normalize-persian';
import { effectiveAttributes, isEventCategory, loadCatalog, type AttributeDef } from '../src/modules/listings/catalog';
import { validateAttributes } from '../src/modules/listings/attributes';

const url = process.env.BENCH_DATABASE_URL;
const count = Number(process.argv[2] ?? 5000);
if (!url || !/_bench$/.test(new URL(url).pathname)) throw new Error('BENCH_DATABASE_URL must name a database ending in _bench');
if (!Number.isInteger(count) || count < 1 || count > 500_000) throw new Error('count: 1 to 500000');

const client = postgres(url, { max: 2, onnotice: () => {} });
const db = drizzle(client, { schema });

const pick = <T>(xs: readonly T[]): T => xs[randomInt(xs.length)]!;
const chance = (p: number) => Math.random() < p;
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
const token = () => Array.from({ length: 10 }, () => CROCKFORD[randomInt(32)]).join('');

/** Weighted choice: [item, weight][] */
function weighted<T>(items: [T, number][]): () => T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  return () => {
    let r = Math.random() * total;
    for (const [x, w] of items) if ((r -= w) <= 0) return x;
    return items.at(-1)![0];
  };
}

function numberValue(d: AttributeDef): number {
  const v = d.validation;
  const ranges: Record<string, [number, number]> = {
    year: [1995, 2025],
    year_built: [1900, 2024],
    mileage_km: [0, 300_000],
    rooms: [1, 6],
    area_m2: [15, 200],
    power_hp: [45, 400],
    floor: [0, 8],
    storage_gb: [16, 1024],
    ram_gb: [2, 64],
    screen_inch: [5, 75],
    age_months: [1, 120],
  };
  const [lo, hi] = ranges[d.key] ?? [v.min ?? 0, Math.min(v.max ?? 1000, (v.min ?? 0) + 1000)];
  if (v.money) return randomInt(5_000, 300_000);
  const n = lo + Math.random() * (hi - lo);
  return v.integer ? Math.round(n) : Math.round(n * 10) / 10;
}

function dateValue(d: AttributeDef): string {
  const t = new Date(Date.now() + randomInt(-180, 365) * 86_400_000);
  const iso = t.toISOString();
  return d.validation.month ? iso.slice(0, 7) : iso.slice(0, 10);
}

function attributesFor(defs: AttributeDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of defs.filter((x) => x.isActive)) {
    if (!d.isRequired && !chance(0.6)) continue;
    switch (d.type) {
      case 'select': {
        let opts = d.options;
        if (d.dependsOn) {
          const parent = out[d.dependsOn];
          if (typeof parent !== 'string') continue;
          opts = opts.filter((o) => !o.parentValue || o.parentValue === parent);
        }
        if (opts.length) out[d.key] = pick(opts).value;
        break;
      }
      case 'multi_select': {
        const n = Math.min(d.options.length, d.validation.max_items ?? 3, 1 + randomInt(3));
        out[d.key] = [...new Set(Array.from({ length: n }, () => pick(d.options).value))];
        break;
      }
      case 'number':
        out[d.key] = numberValue(d);
        break;
      case 'boolean':
        out[d.key] = chance(0.5);
        break;
      case 'date':
        out[d.key] = dateValue(d);
        break;
      case 'text':
        out[d.key] = 'نمونه';
        break;
    }
  }
  return out;
}

async function main() {
  const catalog = await loadCatalog(db);
  const leaves = [...catalog.byId.values()].filter((c) => c.allowsListings && c.isActive && !isEventCategory(catalog, c.id));
  // Popular categories more often, like a real classifieds site
  const heavy: Record<string, number> = { 'apartments-rent': 12, 'shared-rooms': 8, cars: 10, 'mobile-phones': 8, 'living-room': 5, 'women-clothing': 4, laptops: 4, tutoring: 3, 'home-repairs': 3, 'mini-jobs': 3 };
  const nextLeaf = weighted(leaves.map((c) => [c, heavy[c.slug] ?? 1] as [typeof c, number]));
  const cities = await db.select().from(schema.locations).where(and(eq(schema.locations.kind, 'city'), eq(schema.locations.isActive, true)));
  const nextCity = weighted(cities.map((c) => [c, Math.max(50_000, c.population ?? 0) ** 0.8] as [typeof c, number]));
  const currencyOf = new Map([...catalog.countryCurrency]);
  const nextStatus = weighted<'active' | 'paused' | 'sold' | 'expired' | 'deleted'>([
    ['active', 85],
    ['paused', 3],
    ['sold', 5],
    ['expired', 5],
    ['deleted', 2],
  ]);

  const users = await db
    .insert(schema.users)
    .values(
      Array.from({ length: Math.max(10, Math.ceil(count / 15)) }, () => {
        const t = token();
        return { publicToken: t, email: `bench-${t}@example.test`, displayName: 'فروشنده', displayNameNormalized: 'فروشنده', phoneVerifiedAt: new Date(), phoneE164: `+4915${randomInt(10_000_000, 99_999_999)}`, phoneVerificationMethod: 'telegram' as const };
      }),
    )
    .returning({ id: schema.users.id });

  const now = Date.now();
  let made = 0;
  while (made < count) {
    const batch: (typeof schema.listings.$inferInsert)[] = [];
    for (let i = 0; i < Math.min(1000, count - made); i++) {
      const leaf = nextLeaf();
      const city = nextCity();
      const defs = effectiveAttributes(catalog, leaf.id);
      const v = validateAttributes(defs, attributesFor(defs), 'publish');
      const attributes = v.ok ? v.value : {};
      const precision = pick(['city', 'postal_code', 'area', 'area'] as const);
      const point =
        precision === 'city'
          ? city.center
          : snapToGrid({ lat: city.center.lat + (Math.random() - 0.5) * 0.15, lng: city.center.lng + (Math.random() - 0.5) * 0.25 });
      const status = nextStatus();
      const published = new Date(now - randomInt(0, 40 * 86_400) * 1000);
      const currency = currencyOf.get(city.countryCode)!;
      const priceType = leaf.priceMode === 'none' ? 'on_request' : pick(['fixed', 'fixed', 'fixed', 'negotiable', 'free', 'on_request'] as const);
      const priced = priceType === 'fixed' || priceType === 'negotiable';
      const title = `${leaf.nameFa} نمونه ${randomInt(1000)}`;
      batch.push({
        publicToken: token(),
        userId: pick(users).id,
        categoryId: leaf.id,
        title,
        titleNormalized: normalizePersian(title),
        attributes,
        priceType,
        priceMinor: priced ? randomInt(1, 5000) * 1000 : null,
        currency: priced ? currency : null,
        countryCode: city.countryCode,
        locationId: city.id,
        point,
        locationPrecision: precision,
        postalCode: precision === 'postal_code' ? String(10_000 + randomInt(89_999)) : null,
        shippingOffered: chance(0.2),
        status,
        statusChangedAt: published,
        publishedAt: published,
        rankedAt: published,
        expiresAt: new Date(published.getTime() + 30 * 86_400_000),
        deletedAt: status === 'deleted' ? new Date() : null,
      });
    }
    await db.insert(schema.listings).values(batch);
    made += batch.length;
    process.stdout.write(`\r${made} / ${count}`);
  }
  await db.execute(sql`ANALYZE listings`);
  console.log(`\nDone: ${count} listings, ${users.length} sellers.`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
