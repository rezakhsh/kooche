import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { locations, postalPlaces } from '../../db/schema';
import type { Point } from '../../db/types';

// Places for browsing: the seeded cities of a country (city pages, /germany/berlin) and postal
// codes for the "postal code and radius" filter. Reference data, kept 10 minutes per process.

export type City = { id: string; slug: string; nameFa: string; nameLocal: string; countryCode: string; center: Point; population: number | null };

const TTL_MS = 10 * 60_000;
const globalForCities = globalThis as typeof globalThis & { browseCities?: { value: Promise<City[]>; at: number } };

/** Active cities of every country, largest first */
export function allCities(db: Queryable): Promise<City[]> {
  const cached = globalForCities.browseCities;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = db
    .select({
      id: locations.id,
      slug: locations.slug,
      nameFa: locations.nameFa,
      nameLocal: locations.nameLocal,
      countryCode: locations.countryCode,
      center: locations.center,
      population: locations.population,
    })
    .from(locations)
    .where(and(eq(locations.kind, 'city'), eq(locations.isActive, true)))
    .orderBy(sql`${locations.population} DESC NULLS LAST`, asc(locations.slug));
  globalForCities.browseCities = { value, at: Date.now() };
  value.catch(() => {
    if (globalForCities.browseCities?.value === value) globalForCities.browseCities = undefined;
  });
  return value;
}

export async function citiesOf(db: Queryable, countryCode: string): Promise<City[]> {
  return (await allCities(db)).filter((c) => c.countryCode === countryCode);
}

export async function cityOf(db: Queryable, countryCode: string, slug: string): Promise<City | null> {
  return (await allCities(db)).find((c) => c.countryCode === countryCode && c.slug === slug) ?? null;
}

/**
 * The centre of a postal code in a country, for a radius around it. A code shared by several
 * places (villages) gets the average of their centres: close enough for a 5 km radius, and the
 * visitor doesn't have to choose.
 */
export async function postalCenter(db: Queryable, countryCode: string, postalCode: string): Promise<Point | null> {
  const [row] = await db
    .select({
      lng: sql<number>`avg(ST_X(${postalPlaces.center}::geometry))`,
      lat: sql<number>`avg(ST_Y(${postalPlaces.center}::geometry))`,
      n: sql<number>`count(*)::int`,
    })
    .from(postalPlaces)
    .where(and(eq(postalPlaces.countryCode, countryCode), eq(postalPlaces.postalCode, postalCode), eq(postalPlaces.isActive, true)));
  if (!row || !row.n) return null;
  return { lng: Number(row.lng), lat: Number(row.lat) };
}

/** The place name shown with a postal code ("12045 Berlin"): its first place */
export async function postalLabel(db: Queryable, countryCode: string, postalCode: string): Promise<string | null> {
  const [row] = await db
    .select({ name: postalPlaces.placeName })
    .from(postalPlaces)
    .where(and(eq(postalPlaces.countryCode, countryCode), eq(postalPlaces.postalCode, postalCode), eq(postalPlaces.isActive, true)))
    .orderBy(desc(sql`${postalPlaces.locationId} IS NOT NULL`), asc(postalPlaces.placeName))
    .limit(1);
  return row?.name ?? null;
}

/** The nearest active city of a country within `maxM` metres of a point, or null (the point is elsewhere) */
export async function nearestCity(db: Queryable, countryCode: string, p: Point, maxM: number): Promise<{ id: string; slug: string } | null> {
  const g = sql`ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography`;
  const [row] = await db
    .select({ id: locations.id, slug: locations.slug })
    .from(locations)
    .where(and(eq(locations.kind, 'city'), eq(locations.isActive, true), eq(locations.countryCode, countryCode), sql`ST_DWithin(${locations.center}, ${g}, ${maxM})`))
    .orderBy(sql`${locations.center} <-> ${g}`)
    .limit(1);
  return row ?? null;
}
