import { and, eq, inArray, not, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as seed from '../../seed';
import type { AttributeSeed, CategorySeed, LocationsSeed } from '../../seed/types';
import { normalizePersian } from '../lib/normalize-persian';
import {
  categories,
  categoryAttributeOptions,
  categoryAttributes,
  countries,
  currencies,
  locations,
  neighbourhoods,
  postalAreas,
  postalPlaces,
} from './schema';
import { foldLatin } from '../lib/fold-latin';
import { runSeedChecks } from './seed-checks';

// Loads seed/ into the database as classifieds_owner, in one transaction (see seed/README.md).

type Tx = Parameters<Parameters<ReturnType<typeof drizzle>['transaction']>[0]>[0];

export class SeedCheckError extends Error {
  constructor(public readonly failures: Awaited<ReturnType<typeof runSeedChecks>>) {
    super(
      'Seed checks failed:\n' +
        failures.map((f) => `- ${f.name}:\n    ${f.problems.join('\n    ')}`).join('\n'),
    );
  }
}

export type SeedSummary = {
  currencies: number;
  countries: number;
  regions: number;
  cities: number;
  postalPlaces: number;
  postalAreas: number;
  neighbourhoods: number;
  categories: number;
  leafCategories: number;
  attributes: number;
  options: number;
};

/** Seeds the database at `url` and returns what was written. Throws if a seed check fails. */
export async function runSeed(url: string): Promise<SeedSummary> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return await drizzle(client).transaction(async (tx) => {
      const summary: SeedSummary = {
        currencies: await seedCurrencies(tx),
        countries: await seedCountries(tx),
        regions: 0,
        cities: 0,
        postalPlaces: 0,
        postalAreas: 0,
        neighbourhoods: 0,
        categories: 0,
        leafCategories: 0,
        attributes: 0,
        options: 0,
      };
      for (const country of seed.locations) {
        const { regions, cities } = await seedLocations(tx, country);
        summary.regions += regions;
        summary.cities += cities;
      }
      for (const code of seed.POSTAL_COUNTRIES) summary.postalPlaces += await seedPostalPlaces(tx, code);
      for (const code of seed.POSTAL_AREA_COUNTRIES) summary.postalAreas += await seedPostalAreas(tx, code);
      summary.neighbourhoods = await seedNeighbourhoods(tx);
      Object.assign(summary, await seedCategories(tx, seed.categories));

      const failures = await runSeedChecks(tx);
      if (failures.length > 0) throw new SeedCheckError(failures);
      return summary;
    });
  } finally {
    await client.end();
  }
}

async function seedCurrencies(tx: Tx): Promise<number> {
  for (const c of seed.currencies) {
    await tx
      .insert(currencies)
      .values(c)
      .onConflictDoUpdate({
        target: currencies.code,
        set: { minorUnit: c.minorUnit, nameFa: c.nameFa, symbol: c.symbol },
      });
  }
  return seed.currencies.length;
}

async function seedCountries(tx: Tx): Promise<number> {
  for (const c of seed.countries) {
    const { code, ...rest } = c;
    await tx.insert(countries).values(c).onConflictDoUpdate({ target: countries.code, set: rest });
  }
  return seed.countries.length;
}

async function seedLocations(tx: Tx, country: LocationsSeed) {
  const seededIds: string[] = [];
  const regionIds = new Map<string, string>();

  const columns = (l: LocationsSeed['regions'][number]) => ({
    nameFa: l.nameFa,
    nameFaNormalized: normalizePersian(l.nameFa),
    nameLocal: l.nameLocal,
    center: { lng: l.lng, lat: l.lat },
    timezone: l.timezone,
    population: l.population,
    geonamesId: l.geonamesId,
    isActive: true,
  });

  for (const r of country.regions) {
    const values = { kind: 'region' as const, countryCode: country.countryCode, slug: r.slug, ...columns(r) };
    const [row] = await tx
      .insert(locations)
      .values(values)
      .onConflictDoUpdate({
        target: [locations.countryCode, locations.slug],
        targetWhere: sql`kind = 'region'`,
        set: columns(r),
      })
      .returning({ id: locations.id });
    regionIds.set(r.slug, row!.id);
    seededIds.push(row!.id);
  }

  const cityIds = new Map<string, string>();
  const createdWith: Array<{ id: string; with: string }> = [];
  for (const c of country.cities) {
    const parentId = regionIds.get(c.region);
    if (!parentId) throw new Error(`City ${c.slug}: unknown region ${c.region}`);
    const values = {
      kind: 'city' as const,
      countryCode: country.countryCode,
      parentId,
      slug: c.slug,
      ...columns(c),
      // The first launch values only: afterwards launch is the owner's (admin), so `set` leaves it
      ...(c.launch
        ? {
            launchStatus: c.launch.status,
            businessGoal: c.launch.goal ?? null,
            launchRadiusKm: c.launch.radiusKm ?? null,
            openedAt: c.launch.status === 'open' ? new Date() : null,
          }
        : {}),
    };
    const [row] = await tx
      .insert(locations)
      .values(values)
      .onConflictDoUpdate({
        target: locations.slug,
        targetWhere: sql`kind = 'city'`,
        set: { ...columns(c), parentId },
      })
      // xmax = 0: the row was inserted now, not updated
      .returning({ id: locations.id, created: sql<boolean>`xmax = 0` });
    seededIds.push(row!.id);
    cityIds.set(c.slug, row!.id);
    if (row!.created && c.launch?.with) createdWith.push({ id: row!.id, with: c.launch.with });
  }
  for (const c of createdWith) {
    const withId = cityIds.get(c.with);
    if (!withId) throw new Error(`City launch: unknown city ${c.with} in ${country.countryCode}`);
    await tx.update(locations).set({ launchWithId: withId }).where(eq(locations.id, c.id));
  }

  // Removed from the seed: keep the row (listings may use it), but stop offering it
  await tx
    .update(locations)
    .set({ isActive: false })
    .where(and(eq(locations.countryCode, country.countryCode), not(inArray(locations.id, seededIds))));

  return { regions: country.regions.length, cities: country.cities.length };
}

const POSTAL_BATCH = 1000;

/**
 * Postal codes of one country (seed/postal/). Rows no longer in the file are set inactive, never
 * deleted. Each place then joins the nearest active city of its country: the city a listing with
 * that postal code belongs to.
 */
async function seedPostalPlaces(tx: Tx, countryCode: string): Promise<number> {
  const rows = seed.postalPlaces(countryCode);
  await tx.update(postalPlaces).set({ isActive: false }).where(eq(postalPlaces.countryCode, countryCode));
  for (let i = 0; i < rows.length; i += POSTAL_BATCH) {
    await tx
      .insert(postalPlaces)
      .values(
        rows.slice(i, i + POSTAL_BATCH).map((r) => ({
          countryCode,
          postalCode: r.postalCode,
          placeName: r.placeName,
          placeSearch: foldLatin(r.placeName),
          center: { lng: r.lng, lat: r.lat },
          isActive: true,
        })),
      )
      .onConflictDoUpdate({
        target: [postalPlaces.countryCode, postalPlaces.postalCode, postalPlaces.placeName],
        set: { placeSearch: sql`excluded.place_search`, center: sql`excluded.center`, isActive: true },
      });
  }
  await tx.execute(sql`
    UPDATE postal_places p SET location_id = (
      SELECT l.id FROM locations l
      WHERE l.kind = 'city' AND l.is_active AND l.country_code = p.country_code
      ORDER BY l.center <-> p.center
      LIMIT 1)
    WHERE p.country_code = ${countryCode}`);
  return rows.length;
}

const AREA_BATCH = 200;

/**
 * Postal code areas of one country (seed/postal-areas/). Reference data that nothing points to,
 * so the country's rows are replaced as a whole.
 */
async function seedPostalAreas(tx: Tx, countryCode: string): Promise<number> {
  const rows = seed.postalAreas(countryCode);
  await tx.delete(postalAreas).where(eq(postalAreas.countryCode, countryCode));
  for (let i = 0; i < rows.length; i += AREA_BATCH) {
    await tx.insert(postalAreas).values(rows.slice(i, i + AREA_BATCH).map((r) => ({ countryCode, postalCode: r.postalCode, boundary: multiPolygonEwkt(r.polygons) })));
  }
  // Simplifying can make a ring touch or cross itself; PostGIS mends it (polygons only)
  await tx.execute(sql`
    UPDATE postal_areas SET boundary = ST_Multi(ST_CollectionExtract(ST_MakeValid(boundary::geometry), 3))::geography
    WHERE country_code = ${countryCode} AND NOT ST_IsValid(boundary::geometry)`);
  return rows.length;
}

/** "SRID=4326;MULTIPOLYGON(((lng lat, …)), …)" for a geography column */
export function multiPolygonEwkt(polygons: number[][][][]): string {
  const ring = (points: number[][]) => `(${points.map(([lng, lat]) => `${lng} ${lat}`).join(',')})`;
  return `SRID=4326;MULTIPOLYGON(${polygons.map((rings) => `(${rings.map(ring).join(',')})`).join(',')})`;
}

/**
 * City neighbourhoods (seed/neighbourhoods/), by the city's official key. Rows no longer in the
 * files are set inactive, never deleted. Every neighbourhood needs its Persian name.
 */
async function seedNeighbourhoods(tx: Tx): Promise<number> {
  let count = 0;
  for (const c of seed.NEIGHBOURHOOD_CITIES) {
    const [city] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.countryCode, c.countryCode), eq(locations.slug, c.city), eq(locations.kind, 'city')));
    if (!city) throw new SeedCheckError([{ name: 'neighbourhoods', problems: [`no city ${c.countryCode}/${c.city}`] }]);
    const rows = seed.neighbourhoods(c);
    const unnamed = rows.filter((r) => !r.nameFa).map((r) => r.nameLocal);
    if (unnamed.length > 0) throw new SeedCheckError([{ name: 'neighbourhoods', problems: [`${c.city} without a Persian name: ${unnamed.join(', ')}`] }]);
    await tx.update(neighbourhoods).set({ isActive: false }).where(eq(neighbourhoods.locationId, city.id));
    for (const r of rows) {
      await tx
        .insert(neighbourhoods)
        .values({ locationId: city.id, key: r.key, nameLocal: r.nameLocal, nameFa: r.nameFa, boundary: multiPolygonEwkt(r.polygons), isActive: true })
        .onConflictDoUpdate({
          target: [neighbourhoods.locationId, neighbourhoods.key],
          set: { nameLocal: sql`excluded.name_local`, nameFa: sql`excluded.name_fa`, boundary: sql`excluded.boundary`, isActive: true },
        });
    }
    count += rows.length;
  }
  return count;
}

type Inherited = Required<
  Pick<CategorySeed, 'priceMode' | 'listingDurationDays' | 'maxImages' | 'requiresReview' | 'businessOnly'>
>;

const ROOT_DEFAULTS: Inherited = {
  priceMode: 'required',
  listingDurationDays: 30,
  maxImages: 12,
  requiresReview: true,
  businessOnly: false,
};

async function seedCategories(tx: Tx, tree: CategorySeed[]) {
  const categoryIds: string[] = [];
  const attributeIds: string[] = [];
  const optionIds: string[] = [];
  let leaves = 0;

  /** Attributes visible at a category: its own plus its ancestors', by key */
  type Visible = Map<string, { id: string; options: Map<string, string> }>;

  async function visit(
    node: CategorySeed,
    parent: { id: string; path: string; inherited: Inherited; visible: Visible } | null,
    sortOrder: number,
  ) {
    const path = parent ? `${parent.path}.${node.slug}` : node.slug;
    const base = parent?.inherited ?? ROOT_DEFAULTS;
    const inherited: Inherited = {
      priceMode: node.priceMode ?? base.priceMode,
      listingDurationDays: node.listingDurationDays ?? base.listingDurationDays,
      maxImages: node.maxImages ?? base.maxImages,
      requiresReview: node.requiresReview ?? base.requiresReview,
      businessOnly: node.businessOnly ?? base.businessOnly,
    };
    const isLeaf = !node.children?.length;
    if (isLeaf) leaves++;

    const values = {
      parentId: parent?.id ?? null,
      path,
      nameFa: node.nameFa,
      nameFaNormalized: normalizePersian(node.nameFa),
      descriptionFa: node.descriptionFa ?? null,
      icon: node.icon ?? null,
      allowsListings: isLeaf,
      ...inherited,
      sortOrder,
      isActive: true,
    };
    const [row] = await tx
      .insert(categories)
      .values({ slug: node.slug, ...values })
      .onConflictDoUpdate({ target: categories.slug, set: values })
      .returning({ id: categories.id });
    const categoryId = row!.id;
    categoryIds.push(categoryId);

    const visible: Visible = new Map(parent?.visible ?? []);
    // Redefining an ancestor's key is reported by the seed checks
    for (const [i, attr] of (node.attributes ?? []).entries()) {
      const seeded = await seedAttribute(categoryId, attr, i * 10, visible, node.slug);
      visible.set(attr.key, seeded);
    }

    for (const [i, child] of (node.children ?? []).entries()) {
      await visit(child, { id: categoryId, path, inherited, visible }, i * 10);
    }
  }

  async function seedAttribute(
    categoryId: string,
    attr: AttributeSeed,
    sortOrder: number,
    visible: Visible,
    categorySlug: string,
  ) {
    let dependsOn: { id: string; options: Map<string, string> } | undefined;
    if (attr.dependsOn) {
      dependsOn = visible.get(attr.dependsOn);
      if (!dependsOn) {
        throw new Error(
          `${categorySlug}.${attr.key} depends on ${attr.dependsOn}, which must be defined earlier on the same path`,
        );
      }
    }
    const values = {
      type: attr.type,
      labelFa: attr.labelFa,
      unitFa: attr.unitFa ?? null,
      helpFa: attr.helpFa ?? null,
      validation: attr.validation ?? {},
      dependsOnAttributeId: dependsOn?.id ?? null,
      isRequired: attr.isRequired ?? false,
      isFilterable: attr.isFilterable ?? false,
      isSearchable: attr.isSearchable ?? false,
      showOnCard: attr.showOnCard ?? false,
      sortOrder,
      isActive: true,
    };
    const [row] = await tx
      .insert(categoryAttributes)
      .values({ categoryId, key: attr.key, ...values })
      .onConflictDoUpdate({
        target: [categoryAttributes.categoryId, categoryAttributes.key],
        set: values,
      })
      .returning({ id: categoryAttributes.id });
    const attributeId = row!.id;
    attributeIds.push(attributeId);

    const options = new Map<string, string>();
    for (const [i, opt] of (attr.options ?? []).entries()) {
      let parentOptionId: string | null = null;
      if (opt.parent) {
        parentOptionId = dependsOn?.options.get(opt.parent) ?? null;
        if (!parentOptionId) {
          throw new Error(
            `${categorySlug}.${attr.key}=${opt.value}: parent ${opt.parent} is not an option of ${attr.dependsOn}`,
          );
        }
      }
      const optionValues = { labelFa: opt.labelFa, parentOptionId, sortOrder: i * 10, isActive: true };
      const [optRow] = await tx
        .insert(categoryAttributeOptions)
        .values({ attributeId, value: opt.value, ...optionValues })
        .onConflictDoUpdate({
          target: [categoryAttributeOptions.attributeId, categoryAttributeOptions.value],
          set: optionValues,
        })
        .returning({ id: categoryAttributeOptions.id });
      options.set(opt.value, optRow!.id);
      optionIds.push(optRow!.id);
    }
    return { id: attributeId, options };
  }

  for (const [i, root] of tree.entries()) await visit(root, null, i * 10);

  // Removed from the seed: retired, never deleted (old listings still display)
  await tx.update(categories).set({ isActive: false }).where(not(inArray(categories.id, categoryIds)));
  await tx
    .update(categoryAttributes)
    .set({ isActive: false })
    .where(not(inArray(categoryAttributes.id, attributeIds)));
  await tx
    .update(categoryAttributeOptions)
    .set({ isActive: false })
    .where(not(inArray(categoryAttributeOptions.id, optionIds)));

  return {
    categories: categoryIds.length,
    leafCategories: leaves,
    attributes: attributeIds.length,
    options: optionIds.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set');
  const summary = await runSeed(url);
  console.log('Seed loaded:', summary);
}
