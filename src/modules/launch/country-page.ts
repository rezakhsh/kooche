import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { countries, currencies, listings } from '../../db/schema';
import type { Country } from '../listings/queries';
import { PREPARING, type CountryMode } from './countries';

// A country's own first pages (wave 2 part 8, mockups final/home-waitlist, waitlist-announced,
// countries and us-starter; docs/setup.md, "Country pages"):
// - a planned country that isn't open (prestart, guide, or waitlist with a key city on its
//   waitlist) has a «پیدو به‌زودی در اتریش» page at /austria, also shown on the first page to
//   visitors from there; with an announced day (prestart) it shows the day and what happens when;
// - a waitlist country with no city planned has no page (404), as before: nothing is promised;
// - for 8 weeks after the owner opens a country, its first page is the starter page: events,
//   verified businesses and jobs first, because those exist before the listings do.

export const STARTER_WEEKS = 8;

export type CountryInfo = Country & { mode: CountryMode; opensOn: string | null; openedAt: Date | null };

const countryColumns = {
  code: countries.code,
  slug: countries.slug,
  nameFa: countries.nameFa,
  nameLocal: countries.nameLocal,
  currency: { code: currencies.code, symbol: currencies.symbol, minorUnit: currencies.minorUnit, nameFa: currencies.nameFa },
  mode: countries.mode,
  opensOn: countries.opensOn,
  openedAt: countries.openedAt,
};

/** A country that has pages (not hidden), by its slug, with its mode */
export async function countryBySlug(db: Queryable, slug: string): Promise<CountryInfo | null> {
  const [row] = await db
    .select(countryColumns)
    .from(countries)
    .innerJoin(currencies, eq(currencies.code, countries.defaultCurrency))
    .where(and(eq(countries.slug, slug), sql`${countries.mode} <> 'hidden'`));
  return row ? { ...row, slug: row.slug! } : null;
}

/** The same by its code (the visitor's country) */
export async function countryByCode(db: Queryable, code: string): Promise<CountryInfo | null> {
  const [row] = await db
    .select(countryColumns)
    .from(countries)
    .innerJoin(currencies, eq(currencies.code, countries.defaultCurrency))
    .where(and(eq(countries.code, code), sql`${countries.mode} <> 'hidden'`, sql`${countries.slug} IS NOT NULL`));
  return row ? { ...row, slug: row.slug! } : null;
}

/** The end of an open country's starter weeks, or null when it has none (Germany) */
export function starterUntil(openedAt: Date | null): Date | null {
  return openedAt ? new Date(openedAt.getTime() + STARTER_WEEKS * 7 * 86_400_000) : null;
}

/** Whether an open country's first page is the starter page now */
export function isStarter(c: { mode: CountryMode; openedAt: Date | null }, now = new Date()): boolean {
  const until = starterUntil(c.openedAt);
  return c.mode === 'open' && !!until && now < until;
}

/** Whether a closed country is planned, so it has a «به‌زودی» page */
export async function isPlanned(db: Queryable, c: { code: string; mode: CountryMode }): Promise<boolean> {
  if (c.mode === 'open' || c.mode === 'hidden') return false;
  if (c.mode !== 'waitlist') return true;
  const [row] = await db.execute<{ yes: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM locations l WHERE l.country_code = ${c.code} AND l.kind = 'city' AND l.is_active
      AND l.launch_with_id IS NULL AND l.launch_status = 'waitlist') AS yes`);
  return !!row?.yes;
}

export type SoonCountry = {
  code: string;
  slug: string;
  nameFa: string;
  mode: CountryMode;
  opensOn: string | null;
  /** Its first waitlist city (the largest goal, then the largest city), if any */
  city: { slug: string; nameFa: string } | null;
  goal: number | null;
  businesses: number;
};

/** Planned countries that aren't open, for the country chooser: announced days first, then the largest goals */
export async function soonCountries(db: Queryable): Promise<SoonCountry[]> {
  const rows = await db.execute<{ code: string; slug: string; name_fa: string; mode: CountryMode; opens_on: string | null; city_slug: string | null; city_fa: string | null; goal: number | null; businesses: number | null }>(sql`
    SELECT c.code, c.slug, c.name_fa, c.mode, c.opens_on::text AS opens_on, f.slug AS city_slug, f.name_fa AS city_fa, f.business_goal AS goal,
      (SELECT count(*)::int FROM organizations o
        WHERE o.location_id IN (SELECT g.id FROM locations g WHERE g.id = f.id OR g.launch_with_id = f.id)
          AND o.status = 'active' AND o.verification_status = 'verified') AS businesses
    FROM countries c
    LEFT JOIN LATERAL (
      SELECT l.id, l.slug, l.name_fa, l.business_goal FROM locations l
      WHERE l.country_code = c.code AND l.kind = 'city' AND l.is_active AND l.launch_with_id IS NULL AND l.launch_status = 'waitlist'
      ORDER BY l.business_goal DESC NULLS LAST, l.population DESC NULLS LAST LIMIT 1
    ) f ON true
    WHERE c.mode IN ('waitlist', 'prestart', 'guide') AND c.slug IS NOT NULL AND (c.mode <> 'waitlist' OR f.id IS NOT NULL)
    ORDER BY c.opens_on NULLS LAST, f.business_goal DESC NULLS LAST, c.sort_order, c.code`);
  return rows.map((r) => ({
    code: r.code,
    slug: r.slug,
    nameFa: r.name_fa,
    mode: r.mode,
    opensOn: r.opens_on,
    city: r.city_slug && r.city_fa ? { slug: r.city_slug, nameFa: r.city_fa } : null,
    goal: r.goal,
    businesses: r.businesses ?? 0,
  }));
}

/** Countries a new listing or business may be made in: open ones and those preparing to open (prestart) */
export async function preparingCountries(db: Queryable): Promise<Array<Country & { mode: CountryMode }>> {
  const rows = await db
    .select(countryColumns)
    .from(countries)
    .innerJoin(currencies, eq(currencies.code, countries.defaultCurrency))
    .where(and(inArray(countries.mode, [...PREPARING]), sql`${countries.slug} IS NOT NULL`))
    .orderBy(asc(countries.sortOrder), asc(countries.code));
  return rows.map(({ opensOn: _o, openedAt: _a, ...c }) => ({ ...c, slug: c.slug! }));
}

export type OpeningDraft = { id: string; title: string; status: 'draft' | 'pending_review' };

/** Someone's listings waiting for a country's opening day (drafts, or in review), newest first */
export async function openingDrafts(db: Queryable, userId: string, countryCode: string): Promise<OpeningDraft[]> {
  const rows = await db
    .select({ id: listings.id, title: listings.title, status: listings.status })
    .from(listings)
    .where(and(eq(listings.userId, userId), eq(listings.countryCode, countryCode), inArray(listings.status, ['draft', 'pending_review'])))
    .orderBy(desc(listings.updatedAt))
    .limit(5);
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status as OpeningDraft['status'] }));
}
