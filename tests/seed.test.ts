import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as seed from '../seed';
import { repeatedCitySlugs, runSeed } from '../src/db/seed';
import { SEED_CHECKS, runSeedChecks } from '../src/db/seed-checks';
import { categories, categoryAttributes, countries, locations } from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { adminCountries } from '../src/modules/launch/countries';
import { soonCountries } from '../src/modules/launch/country-page';
import { keyCitiesOf, waitingCountries } from '../src/modules/launch/waitlist';
import { activeCountries } from '../src/modules/listings/queries';
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

  it('catch money on a non-number, month on a non-date, and optional_in outside the subtree', async () => {
    for (const [type, validation] of [
      ['text', { money: true }],
      ['number', { month: true }],
      ['number', { optional_in: ['cars'] }],
    ] as const) {
      await rollback(async (tx) => {
        const flats = await category(tx, 'real-estate');
        await tx.insert(categoryAttributes).values({ categoryId: flats.id, key: 'probe', type, labelFa: 'آزمایش', validation });
        expect(await failingChecks(tx)).toContain(check('validation settings fit'));
      });
    }
  });

  it('catch a category hint (help_in) outside the subtree or not text', async () => {
    for (const validation of [{ help_in: { cars: 'نه اینجا' } }, { help_in: { 'shared-rooms': 5 } }]) {
      await rollback(async (tx) => {
        const homes = await category(tx, 'real-estate');
        await tx.insert(categoryAttributes).values({ categoryId: homes.id, key: 'probe', type: 'number', labelFa: 'آزمایش', validation: validation as never });
        expect(await failingChecks(tx)).toContain(check('category hints belong'));
      });
    }
    await rollback(async (tx) => {
      const homes = await category(tx, 'real-estate');
      await tx.insert(categoryAttributes).values({ categoryId: homes.id, key: 'probe', type: 'number', labelFa: 'آزمایش', validation: { help_in: { 'shared-rooms': 'متراژ اتاق' } } as never });
      expect(await failingChecks(tx)).not.toContain(check('category hints belong'));
    });
  });

  it('catch a country rule naming an unknown country or an option the field lacks', async () => {
    for (const validation of [{ countries: ['XX'] }, { hidden_in: ['ZZ'] }, { by_country: { QQ: { label: 'x' } } }, { by_country: { DE: { options: ['nope'] } } }, { by_country: { '*': { option_labels: { nope: 'x' } } } }]) {
      await rollback(async (tx) => {
        const homes = await category(tx, 'real-estate');
        await tx.insert(categoryAttributes).values({ categoryId: homes.id, key: 'probe', type: 'boolean', labelFa: 'آزمایش', validation: validation as never });
        expect(await failingChecks(tx)).toContain(check('country rules name real countries'));
      });
    }
    await rollback(async (tx) => {
      const homes = await category(tx, 'real-estate');
      await tx.insert(categoryAttributes).values({ categoryId: homes.id, key: 'probe', type: 'boolean', labelFa: 'آزمایش', validation: { countries: ['DE', 'AT'], by_country: { DE: { label: 'x' }, '*': { help: 'y' } } } as never });
      expect(await failingChecks(tx)).not.toContain(check('country rules name real countries'));
    });
  });

  it('keep browse addresses apart: an active category named events is caught, a retired one is not', async () => {
    await rollback(async (tx) => {
      const community = await category(tx, 'community');
      const [retired] = await tx
        .insert(categories)
        .values({ parentId: community.id, path: 'community.events', slug: 'events', nameFa: 'رویداد', nameFaNormalized: 'رویداد', isActive: false })
        .returning();
      expect(await failingChecks(tx)).not.toContain(check('stay apart in browse addresses'));
      await tx.update(categories).set({ isActive: true }).where(eq(categories.id, retired!.id));
      expect(await failingChecks(tx)).toContain(check('stay apart in browse addresses'));
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
  // Oct 18, 2026: + the events section (1 root, 13 event types), community › events retired;
  // wave 1 (Oct 27): the event types became the design's eight and «سایر»
  it('has the approved category tree: 14 roots and 128 leaves (5 licensed services added in wave 2 part 4)', async () => {
    const [roots] = await db.select({ n: count() }).from(categories).where(isNull(categories.parentId));
    const [leaves] = await db
      .select({ n: count() })
      .from(categories)
      .where(eq(categories.allowsListings, true));
    expect(roots!.n).toBe(14);
    expect(leaves!.n).toBe(128);
  });

  it('opens Germany (Austria closed since wave 0), with its regions and every city under one of them', async () => {
    const active = await db.select().from(countries).where(eq(countries.isActive, true)).orderBy(countries.sortOrder);
    expect(active.map((c) => c.code)).toEqual(['DE']);
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
    // Nov 4, 2026: the 9 planned countries' cities of 100,000+ people (postal codes, step 2): 145 regions, 387 cities;
    // their postal codes (step 4)
    const postal = Object.values(POSTAL_PLACES).reduce((a, b) => a + b, 0);
    expect(summary).toMatchObject({ countries: 37, currencies: 16, regions: 25 + 145, cities: 81 + 387, postalPlaces: postal, neighbourhoods: 1866 });
    expect(await db.execute(counts)).toEqual(before);
  }, 240_000);

  it('postal codes per country (GeoNames; step 4 for the 9 planned countries), each leading to a city', async () => {
    const rows = await db.execute<{ cc: string; n: number; codes: number; cityless: number }>(sql`
      SELECT country_code AS cc, count(*)::int AS n, count(DISTINCT postal_code)::int AS codes,
        count(*) FILTER (WHERE location_id IS NULL)::int AS cityless
      FROM postal_places WHERE is_active GROUP BY 1 ORDER BY 1`);
    expect(Object.fromEntries(rows.map((r) => [r.cc, r.n]))).toEqual(POSTAL_PLACES);
    expect(Object.fromEntries(rows.map((r) => [r.cc, r.codes]))).toEqual(POSTAL_CODES);
    expect(rows.filter((r) => r.cityless > 0)).toEqual([]);
  });

  it('leaves the owner’s city launch alone when loaded again', async () => {
    const hamburg = and(eq(locations.kind, 'city'), eq(locations.slug, 'hamburg'));
    const [before] = await db.select().from(locations).where(hamburg);
    await db.update(locations).set({ launchStatus: 'open', businessGoal: 12 }).where(hamburg);
    try {
      await runSeed(process.env.TEST_DATABASE_URL!);
      const [after] = await db.select().from(locations).where(hamburg);
      expect(after).toMatchObject({ launchStatus: 'open', businessGoal: 12 });
    } finally {
      await db.update(locations).set({ launchStatus: before!.launchStatus, businessGoal: before!.businessGoal }).where(hamburg);
    }
  }, 240_000);
});

// Postal places (code and place) and distinct codes per country, as seed/postal/<cc>.tsv has them
const POSTAL_PLACES: Record<string, number> = {
  AT: 18_998, AU: 18_340, CA: 1_655, DE: 15_050, FR: 37_198, GB: 26_763, IT: 18_415, NL: 4_321, SE: 18_887, TR: 36_306, US: 40_976,
};
const POSTAL_CODES: Record<string, number> = {
  AT: 2_501, AU: 3_170, CA: 1_651, DE: 8_172, FR: 6_064, GB: 2_979, IT: 4_736, NL: 4_086, SE: 18_887, TR: 2_953, US: 40_976,
};

// The planned countries' first cities (round 12) and their launch values: the only ones that are not `later`
const FIRST_CITIES: Record<string, { slug: string; goal: number }> = {
  CA: { slug: 'toronto', goal: 30 },
  US: { slug: 'los-angeles', goal: 30 },
  AU: { slug: 'sydney', goal: 20 },
  GB: { slug: 'london', goal: 30 },
  NL: { slug: 'amsterdam', goal: 15 },
  IT: { slug: 'milano', goal: 15 },
  SE: { slug: 'stockholm', goal: 20 },
  FR: { slug: 'paris', goal: 20 },
  TR: { slug: 'istanbul', goal: 30 },
};

describe('the planned countries’ cities (postal codes, step 2)', () => {
  it('has their cities of 100,000+ people, at most 50 per country (US 100), with unique slugs', () => {
    const per = Object.fromEntries(seed.locations.map((l) => [l.countryCode, l.cities.length]));
    expect(per).toMatchObject({ GB: 50, FR: 38, TR: 50, CA: 50, US: 100, NL: 25, IT: 43, SE: 10, AU: 21 });
    expect(repeatedCitySlugs(seed.locations)).toEqual([]);
    expect(repeatedCitySlugs([...seed.locations, { countryCode: 'XX', regions: [], cities: [seed.locations[0]!.cities[0]!] }])).toEqual(['berlin']);
    // A smaller city of the same name carries its state
    const slugs = seed.locations.flatMap((l) => l.cities.map((c) => `${l.countryCode}:${c.slug}`));
    expect(slugs).toEqual(expect.arrayContaining(['GB:london', 'CA:london-on', 'US:richmond', 'CA:richmond-bc']));
  });

  it('keeps each first city’s launch values and makes every other city `later`', async () => {
    for (const [code, first] of Object.entries(FIRST_CITIES)) {
      const country = seed.locations.find((l) => l.countryCode === code)!;
      expect(country.cities.filter((c) => c.launch).map((c) => [c.slug, c.launch])).toEqual([[first.slug, { status: 'waitlist', goal: first.goal }]]);
      const rows = await db
        .select({ slug: locations.slug, status: locations.launchStatus, goal: locations.businessGoal })
        .from(locations)
        .where(and(eq(locations.countryCode, code), eq(locations.kind, 'city'), sql`${locations.launchStatus} <> 'later'`));
      expect(rows).toEqual([{ slug: first.slug, status: 'waitlist', goal: first.goal }]);
    }
  });

  it('change nothing in the country lists, the country pages or the city chooser', async () => {
    const codes = Object.keys(FIRST_CITIES);
    // Only Germany is open
    expect((await activeCountries(db)).map((c) => c.code)).toEqual(['DE']);
    // The chooser's «به‌زودی» list and the country pages name the first city, never a bigger later one
    // (New York over Los Angeles, Rotterdam over Amsterdam, Roma over Milano)
    const soon = (await soonCountries(db)).filter((c) => codes.includes(c.code));
    expect(Object.fromEntries(soon.map((c) => [c.code, c.city?.slug]))).toEqual(Object.fromEntries(codes.map((c) => [c, FIRST_CITIES[c]!.slug])));
    // Turkey waits for İstanbul like the others since Nov 5, 2026 (its guide mode is retired)
    const waiting = (await waitingCountries(db)).filter((c) => codes.includes(c.code));
    expect(Object.fromEntries(waiting.map((c) => [c.code, c.city.slug]))).toEqual(Object.fromEntries(codes.map((c) => [c, FIRST_CITIES[c]!.slug])));
    // A country page and the chooser list a country's key cities: still only the first one
    for (const code of codes) expect((await keyCitiesOf(db, code)).map((k) => k.slug)).toEqual([FIRST_CITIES[code]!.slug]);
    // Admin › countries and cities counts one planned city per country
    const admin = (await adminCountries(db)).filter((c) => codes.includes(c.code));
    expect(admin.map((c) => [c.code, c.cities, c.openCities]).sort()).toEqual(codes.map((c) => [c, 1, 0]).sort());
  });
});
