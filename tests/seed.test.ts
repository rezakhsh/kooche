import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { runSeed } from '../src/db/seed';
import { SEED_CHECKS, runSeedChecks } from '../src/db/seed-checks';
import { categories, categoryAttributes, countries, locations } from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { category, db, location, makeListing, makeUser, rollback, type Tx } from './db';

async function failingChecks(tx: Tx) {
  return (await runSeedChecks(tx)).map((f) => f.name);
}

const check = (fragment: string) => {
  const found = SEED_CHECKS.find((c) => c.name.includes(fragment));
  if (!found) throw new Error(`No seed check named like "${fragment}"`);
  return found.name;
};

describe('seed checks', () => {
  it('all pass on the seeded database', async () => {
    expect(await runSeedChecks(db)).toEqual([]);
  });

  it('catch an attribute key repeated along a path', async () => {
    await rollback(async (tx) => {
      // electronics already defines `condition` for all its descendants
      const phones = await category(tx, 'mobile-phones');
      await tx
        .insert(categoryAttributes)
        .values({ categoryId: phones.id, key: 'condition', type: 'boolean', labelFa: 'وضعیت' });
      expect(await failingChecks(tx)).toContain(check('unique along each category path'));
    });
  });

  it("catch a city whose parent isn't a region", async () => {
    await rollback(async (tx) => {
      const berlin = await location(tx, 'berlin');
      await tx.insert(locations).values({
        kind: 'city',
        countryCode: 'DE',
        parentId: berlin.id, // the city of Berlin, not the Land
        slug: 'test-city',
        nameFa: 'شهر آزمایشی',
        nameFaNormalized: 'شهر آزمایشی',
        nameLocal: 'Teststadt',
        center: { lng: 13.4, lat: 52.5 },
        timezone: 'Europe/Berlin',
      });
      expect(await failingChecks(tx)).toContain(check("city's parent is a region"));
    });
  });

  it('catch a listing in a category that is not a leaf', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const electronics = await category(tx, 'electronics');
      await makeListing(tx, user.id, { categoryId: electronics.id });
      expect(await failingChecks(tx)).toContain(check('listings are only in leaf categories'));
    });
  });

  it('catch a parent category that allows listings', async () => {
    await rollback(async (tx) => {
      await tx
        .update(categories)
        .set({ allowsListings: true })
        .where(eq(categories.slug, 'electronics'));
      expect(await failingChecks(tx)).toContain(check('only leaf categories allow listings'));
    });
  });
});

describe('seeded data', () => {
  it('has the approved category tree: 13 roots and 115 leaves', async () => {
    const [roots] = await db.select({ n: count() }).from(categories).where(isNull(categories.parentId));
    const [leaves] = await db
      .select({ n: count() })
      .from(categories)
      .where(eq(categories.allowsListings, true));
    expect(roots!.n).toBe(13);
    expect(leaves!.n).toBe(115);
  });

  it('opens Germany and Austria, with their regions and every city under one of them', async () => {
    const active = await db.select().from(countries).where(eq(countries.isActive, true)).orderBy(countries.sortOrder);
    expect(active.map((c) => c.code)).toEqual(['DE', 'AT']);
    const [regions] = await db
      .select({ n: count() })
      .from(locations)
      .where(and(eq(locations.countryCode, 'DE'), eq(locations.kind, 'region')));
    expect(regions!.n).toBe(16);
    const orphans = await db.execute(
      sql`SELECT slug FROM locations WHERE kind = 'city' AND parent_id IS NULL`,
    );
    expect(orphans).toHaveLength(0);
  });

  it('stores normalized names written by normalizePersian()', async () => {
    const rows = [
      ...(await db.select({ a: categories.nameFa, b: categories.nameFaNormalized }).from(categories)),
      ...(await db.select({ a: locations.nameFa, b: locations.nameFaNormalized }).from(locations)),
    ];
    expect(rows.filter((r) => normalizePersian(r.a) !== r.b)).toEqual([]);
  });

  it('can be loaded again without changes', async () => {
    const counts = sql`SELECT (SELECT count(*) FROM categories) AS c,
      (SELECT count(*) FROM category_attribute_options) AS o, (SELECT count(*) FROM locations) AS l`;
    const before = await db.execute(counts);
    const summary = await runSeed(process.env.TEST_DATABASE_URL!);
    expect(summary).toMatchObject({ countries: 37, currencies: 16, regions: 25, cities: 81, postalPlaces: 15_050 + 18_998 });
    expect(await db.execute(counts)).toEqual(before);
  });
});
