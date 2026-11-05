import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { countries, locations, type COUNTRY_MODES } from '../../db/schema';
import { staffAudit, type StaffContext } from '../admin/audit';

// Country modes (wave 2 part 2, owner Oct 29, 2026; mockup final/admin-countries; docs/setup.md,
// "Country modes"). One mode per country instead of on and off:
// - hidden: no pages at all (404), not in the country lists;
// - waitlist: its key cities' waitlist pages and «خبرم کن»; nobody posts;
// - prestart: as waitlist for visitors; businesses can make their page and everyone can save drafts
//   (events too), to go live on the announced day (`opens_on`); nothing is published before;
// - guide: retired (Nov 5, 2026). Turkey had it, with a guide page and no marketplace; it is now a
//   normal country like Austria (src/modules/listings/country-rules.ts closes housing and cars
//   there). The value stays allowed in the database so production's Turkey keeps working until the
//   owner switches it to waitlist in admin; it shows like waitlist and admin no longer offers it.
// - open: everything, with the cities' own launch (./cities.ts).
// `countries.is_active` is true exactly in 'open' (a CHECK keeps them together), so every place
// that asks "is this country open" keeps working.

export type CountryMode = (typeof COUNTRY_MODES)[number];

/** Modes in which drafts may be saved and business pages made (publishing needs 'open') */
export const PREPARING: ReadonlySet<CountryMode> = new Set(['prestart', 'open']);
/** Modes admin offers (guide is retired: shown only while a country still has it) */
export const OFFERED_MODES: readonly CountryMode[] = ['hidden', 'waitlist', 'prestart', 'open'];
/** Modes whose waitlist pages are shown (hidden has none) */
export const LISTED: ReadonlySet<CountryMode> = new Set(['waitlist', 'prestart', 'guide']);

/** A country's mode, or null when it isn't seeded */
export async function countryMode(db: Queryable, code: string): Promise<CountryMode | null> {
  const [c] = await db.select({ mode: countries.mode }).from(countries).where(eq(countries.code, code.toUpperCase()));
  return c?.mode ?? null;
}

/** Whether drafts may be saved in this country (prestart or open) */
export const canPrepareIn = (mode: CountryMode | null | undefined): boolean => !!mode && PREPARING.has(mode);

export type AdminCountry = {
  code: string;
  slug: string | null;
  nameFa: string;
  mode: CountryMode;
  opensOn: string | null;
  /** When the owner last opened it; its starter page runs 8 weeks from then (./country-page.ts) */
  openedAt: Date | null;
  cities: number;
  openCities: number;
  waiting: number;
  businesses: number;
};

/** Every country for admin › countries and cities: its mode, cities open, people waiting, verified businesses */
export async function adminCountries(db: Queryable): Promise<AdminCountry[]> {
  const rows = await db.execute<{ code: string; slug: string | null; name_fa: string; mode: CountryMode; opens_on: string | null; opened_at: Date | null; cities: number; open_cities: number; waiting: number; businesses: number }>(sql`
    SELECT c.code, c.slug, c.name_fa, c.mode, c.opens_on::text AS opens_on, c.opened_at,
      (SELECT count(*)::int FROM locations l WHERE l.country_code = c.code AND l.kind = 'city' AND l.launch_status <> 'later') AS cities,
      (SELECT count(*)::int FROM locations l WHERE l.country_code = c.code AND l.kind = 'city' AND l.launch_status = 'open') AS open_cities,
      (SELECT count(*)::int FROM city_waitlist w JOIN locations l ON l.id = w.location_id WHERE l.country_code = c.code AND w.confirmed_at IS NOT NULL) AS waiting,
      (SELECT count(*)::int FROM organizations o WHERE o.country_code = c.code AND o.status = 'active' AND o.verification_status = 'verified'
        AND NOT EXISTS (SELECT 1 FROM users tu WHERE tu.id = o.created_by_user_id AND tu.test_account IS NOT NULL)) AS businesses
    FROM countries c
    ORDER BY CASE c.mode WHEN 'open' THEN 0 WHEN 'prestart' THEN 1 WHEN 'waitlist' THEN 2 WHEN 'guide' THEN 3 ELSE 4 END, c.sort_order, c.name_fa`);
  return rows.map((r) => ({ code: r.code, slug: r.slug, nameFa: r.name_fa, mode: r.mode, opensOn: r.opens_on, openedAt: r.opened_at ? new Date(r.opened_at) : null, cities: r.cities, openCities: r.open_cities, waiting: r.waiting, businesses: r.businesses }));
}

export type ModeChange = { mode: CountryMode; opensOn?: string | null };

/**
 * Admin: a country's new mode (and the announced day for prestart), in audit_log. Returns the
 * country's slug for the cache purge, or null when nothing changed or the input is wrong.
 */
export async function setCountryMode(tx: Queryable, ctx: StaffContext, code: string, change: ModeChange): Promise<{ slug: string | null; citySlugs: string[] } | null> {
  if (!OFFERED_MODES.includes(change.mode)) return null;
  const opensOn = change.mode === 'prestart' && change.opensOn && z.iso.date().safeParse(change.opensOn).success ? change.opensOn : null;
  const [before] = await tx.select({ mode: countries.mode, opensOn: countries.opensOn }).from(countries).where(eq(countries.code, code)).for('update');
  if (!before || (before.mode === change.mode && before.opensOn === opensOn)) return null;
  const [after] = await tx
    .update(countries)
    // Opening starts the starter weeks (./country-page.ts)
    .set({ mode: change.mode, isActive: change.mode === 'open', opensOn, ...(change.mode === 'open' && before.mode !== 'open' ? { openedAt: sql`now()` } : {}) })
    .where(and(eq(countries.code, code)))
    .returning({ slug: countries.slug });
  // audit_log.target_id is a uuid: the country goes into the data
  await staffAudit(tx, ctx, 'country.mode', null, { country: code, from: before.mode, to: change.mode, opensOn });
  // The key cities' pages change with it (waitlist ↔ listings)
  const cities = await tx.select({ slug: locations.slug }).from(locations).where(and(eq(locations.countryCode, code), eq(locations.kind, 'city'), ne(locations.launchStatus, 'later')));
  return { slug: after!.slug, citySlugs: cities.map((c) => c.slug) };
}
