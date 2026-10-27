import { and, eq, isNull, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import type { Queryable } from '../../db/drizzle';
import { cityWaitlist, locations, type WAITLIST_ROLES } from '../../db/schema';
import { linkToken, sha256 } from '../../lib/tokens';
import { staffAudit, type StaffContext } from '../admin/audit';

// City waitlists (round 12, docs/wave0-plan.md, item 1). A city that isn't open shows its goal of
// verified businesses, the people waiting (for information only) and a "notify me" form. Only the
// business count decides; the owner opens a city with one click in admin, and the whole country
// when its key cities are open. People confirm their email (double opt-in); the owner writes the
// opening email himself, with each person's leave link from the export (a random token per row).

export type WaitlistRole = (typeof WAITLIST_ROLES)[number];

/** Unconfirmed signups are deleted after this (round 7) */
export const UNCONFIRMED_DAYS = 30;

/** Free bump for the first confirmed signups of a city, by its size (owner, Oct 26, 2026) */
export function rewardPlaces(population: number | null): number {
  const p = population ?? 0;
  return p >= 1_000_000 ? 200 : p >= 300_000 ? 100 : 50;
}

export type KeyCity = { id: string; slug: string; nameFa: string; status: 'open' | 'waitlist' | 'later'; goal: number | null; businesses: number };

export type CityLaunch = {
  /** The city of the page */
  status: 'open' | 'waitlist' | 'later';
  /** The city it launches with (Bonn → Cologne), else itself */
  anchor: { id: string; slug: string; nameFa: string };
  /** Names of the cities that count together (Cologne and Bonn) */
  groupNames: string[];
  goal: number | null;
  businesses: number;
  waiting: number;
  reward: { places: number; left: number };
  /** The country's key cities (open or waitlist, not launching with another) */
  keyCities: KeyCity[];
};

const counts = (group: ReturnType<typeof sql>) => sql`
  (SELECT count(*)::int FROM organizations o
    WHERE o.location_id IN (${group}) AND o.status = 'active' AND o.verification_status = 'verified') AS businesses,
  (SELECT count(*)::int FROM city_waitlist w WHERE w.location_id IN (${group}) AND w.confirmed_at IS NOT NULL) AS waiting`;

/** Everything a city's waitlist page shows; null for an unknown city */
export async function cityLaunch(db: Queryable, cityId: string): Promise<CityLaunch | null> {
  const [city] = await db.execute<{
    status: CityLaunch['status'];
    country_code: string;
    anchor_id: string;
    anchor_slug: string;
    anchor_name: string;
    anchor_population: number | null;
    goal: number | null;
    group_names: string[];
    businesses: number;
    waiting: number;
  }>(sql`
    SELECT c.launch_status AS status, c.country_code, a.id AS anchor_id, a.slug AS anchor_slug, a.name_fa AS anchor_name,
      a.population AS anchor_population, a.business_goal AS goal,
      (SELECT array_agg(g.name_fa ORDER BY g.launch_with_id NULLS FIRST, g.population DESC NULLS LAST)
        FROM locations g WHERE g.id = a.id OR g.launch_with_id = a.id) AS group_names,
      ${counts(sql`SELECT g.id FROM locations g WHERE g.id = a.id OR g.launch_with_id = a.id`)}
    FROM locations c
    JOIN locations a ON a.id = coalesce(c.launch_with_id, c.id)
    WHERE c.id = ${cityId} AND c.kind = 'city'`);
  if (!city) return null;

  const keyCities = await keyCitiesOf(db, city.country_code);
  const places = rewardPlaces(city.anchor_population);
  return {
    status: city.status,
    anchor: { id: city.anchor_id, slug: city.anchor_slug, nameFa: city.anchor_name },
    groupNames: city.group_names,
    goal: city.goal,
    businesses: city.businesses,
    waiting: city.waiting,
    reward: { places, left: Math.max(0, places - city.waiting) },
    keyCities,
  };
}

/** A country's key cities (open or waitlist, not launching with another), open first, then by size */
export async function keyCitiesOf(db: Queryable, countryCode: string): Promise<KeyCity[]> {
  const rows = await db.execute<{ id: string; slug: string; name_fa: string; status: KeyCity['status']; goal: number | null; businesses: number }>(sql`
    SELECT l.id, l.slug, l.name_fa, l.launch_status AS status, l.business_goal AS goal,
      (SELECT count(*)::int FROM organizations o
        WHERE o.location_id IN (SELECT g.id FROM locations g WHERE g.id = l.id OR g.launch_with_id = l.id)
          AND o.status = 'active' AND o.verification_status = 'verified') AS businesses
    FROM locations l
    WHERE l.country_code = ${countryCode} AND l.kind = 'city' AND l.launch_with_id IS NULL
      AND l.launch_status IN ('open', 'waitlist')
    ORDER BY (l.launch_status = 'open') DESC, l.population DESC NULLS LAST`);
  return rows.map((k) => ({ id: k.id, slug: k.slug, nameFa: k.name_fa, status: k.status, goal: k.goal, businesses: k.businesses }));
}

export type JoinResult =
  /** `token`: for the confirmation email; null when this email is already confirmed for the city */
  | { ok: true; token: string | null }
  | { ok: false; reason: 'not_waiting' };

/** Adds (or renews) an unconfirmed signup. The email address is checked by the caller (Zod). */
export async function joinWaitlist(db: Queryable, opts: { cityId: string; email: string; role: WaitlistRole }): Promise<JoinResult> {
  const [city] = await db
    .select({ status: locations.launchStatus })
    .from(locations)
    .where(and(eq(locations.id, opts.cityId), eq(locations.kind, 'city')));
  if (!city || city.status === 'open') return { ok: false, reason: 'not_waiting' };

  const token = linkToken();
  const [row] = await db
    .insert(cityWaitlist)
    .values({ locationId: opts.cityId, email: opts.email.trim().toLowerCase(), role: opts.role, confirmTokenHash: sha256(token), leaveToken: linkToken() })
    .onConflictDoUpdate({
      target: [cityWaitlist.locationId, cityWaitlist.email],
      // A new email with a new link only while unconfirmed; a confirmed signup is left alone
      set: { role: opts.role, confirmTokenHash: sha256(token), createdAt: sql`now()` },
      setWhere: isNull(cityWaitlist.confirmedAt),
    })
    .returning({ id: cityWaitlist.id });
  return { ok: true, token: row ? token : null };
}

/** The link in the confirmation email: confirmed once, later clicks change nothing */
export async function confirmWaitlist(db: Queryable, token: string): Promise<{ ok: true; citySlug: string } | { ok: false }> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false };
  const [row] = await db
    .update(cityWaitlist)
    .set({ confirmedAt: sql`coalesce(${cityWaitlist.confirmedAt}, now())` })
    .where(and(eq(cityWaitlist.confirmTokenHash, sha256(token)), sql`${cityWaitlist.createdAt} > now() - make_interval(days => ${UNCONFIRMED_DAYS})`))
    .returning({ cityId: cityWaitlist.locationId });
  if (!row) return { ok: false };
  const [city] = await db.select({ slug: locations.slug }).from(locations).where(eq(locations.id, row.cityId));
  return { ok: true, citySlug: city!.slug };
}

/** Leaving deletes the row (the token from the leave link) */
export async function leaveWaitlist(db: Queryable, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return false;
  const rows = await db.delete(cityWaitlist).where(eq(cityWaitlist.leaveToken, token)).returning({ id: cityWaitlist.id });
  return rows.length > 0;
}

/** Worker, daily (retention queue, as classifieds_worker): unconfirmed signups older than 30 days */
export async function deleteUnconfirmedWaitlist(sql: postgres.Sql): Promise<number> {
  const rows = await sql`
    DELETE FROM city_waitlist
    WHERE confirmed_at IS NULL AND created_at < now() - make_interval(days => ${UNCONFIRMED_DAYS})`;
  return rows.count;
}

// ---------------------------------------------------------------------------------------------
// Admin: Countries and cities
// ---------------------------------------------------------------------------------------------

export type AdminCity = {
  id: string;
  slug: string;
  nameFa: string;
  status: 'open' | 'waitlist' | 'later';
  goal: number | null;
  radiusKm: number | null;
  withName: string | null;
  openedAt: Date | null;
  businesses: number;
  waiting: number;
};

/** The country's cities that are open, waiting, or have businesses or people waiting */
export async function adminCities(db: Queryable, countryCode: string): Promise<AdminCity[]> {
  const rows = await db.execute<{
    id: string;
    slug: string;
    name_fa: string;
    status: AdminCity['status'];
    goal: number | null;
    radius: number | null;
    with_name: string | null;
    opened_at: Date | null;
    businesses: number;
    waiting: number;
  }>(sql`
    SELECT * FROM (
      SELECT l.id, l.slug, l.name_fa, l.launch_status AS status, l.business_goal AS goal, l.launch_radius_km AS radius,
        w.name_fa AS with_name, l.opened_at, l.population,
        ${counts(sql`SELECT g.id FROM locations g WHERE g.id = l.id OR g.launch_with_id = l.id`)}
      FROM locations l LEFT JOIN locations w ON w.id = l.launch_with_id
      WHERE l.country_code = ${countryCode} AND l.kind = 'city'
    ) c
    WHERE c.status <> 'later' OR c.businesses > 0 OR c.waiting > 0
    ORDER BY (c.status = 'open') DESC, (c.status = 'waitlist') DESC, c.population DESC NULLS LAST`);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nameFa: r.name_fa,
    status: r.status,
    goal: r.goal,
    radiusKm: r.radius,
    withName: r.with_name,
    openedAt: r.opened_at ? new Date(r.opened_at) : null,
    businesses: r.businesses,
    waiting: r.waiting,
  }));
}

export type LaunchChange =
  | { kind: 'open' }
  | { kind: 'waitlist'; goal: number }
  | { kind: 'later' }
  | { kind: 'goal'; goal: number };

/**
 * The owner's change to a city. Opening also opens the cities launching with it (Bonn with
 * Cologne). Returns the slugs whose pages should be purged from Cloudflare, or null if unknown.
 */
export async function changeCityLaunch(tx: Queryable, ctx: StaffContext, cityId: string, change: LaunchChange): Promise<{ country: string; slugs: string[] } | null> {
  const [city] = await tx
    .select({ id: locations.id, slug: locations.slug, countryCode: locations.countryCode, status: locations.launchStatus, goal: locations.businessGoal, withId: locations.launchWithId })
    .from(locations)
    .where(and(eq(locations.id, cityId), eq(locations.kind, 'city')));
  if (!city) return null;
  if ((change.kind === 'waitlist' || change.kind === 'goal') && !(Number.isInteger(change.goal) && change.goal >= 1 && change.goal <= 1000)) return null;

  const group = sql`${locations.id} = ${cityId} OR ${locations.launchWithId} = ${cityId}`;
  let slugs: string[] = [city.slug];
  if (change.kind === 'open') {
    const rows = await tx
      .update(locations)
      .set({ launchStatus: 'open', openedAt: sql`coalesce(${locations.openedAt}, now())` })
      .where(group)
      .returning({ slug: locations.slug });
    slugs = rows.map((r) => r.slug);
  } else if (change.kind === 'waitlist') {
    await tx.update(locations).set({ launchStatus: 'waitlist', businessGoal: change.goal, openedAt: null }).where(eq(locations.id, cityId));
  } else if (change.kind === 'later') {
    await tx.update(locations).set({ launchStatus: 'later', openedAt: null }).where(eq(locations.id, cityId));
  } else {
    await tx.update(locations).set({ businessGoal: change.goal }).where(eq(locations.id, cityId));
  }
  await staffAudit(tx, ctx, 'city.launch', { type: 'location', id: cityId }, {
    change: change.kind,
    ...('goal' in change ? { goal: change.goal } : {}),
    before: { status: city.status, goal: city.goal },
  });
  const [country] = await tx.execute<{ slug: string }>(sql`SELECT slug FROM countries WHERE code = ${city.countryCode}`);
  return { country: country?.slug ?? '', slugs };
}

/** Opens every city of the country, without a radius (round 12: after its key cities) */
export async function openCountry(tx: Queryable, ctx: StaffContext, countryCode: string): Promise<number> {
  const rows = await tx
    .update(locations)
    .set({ launchStatus: 'open', launchRadiusKm: null, openedAt: sql`coalesce(${locations.openedAt}, now())` })
    .where(and(eq(locations.countryCode, countryCode), eq(locations.kind, 'city')))
    .returning({ id: locations.id });
  // audit_log.target_id is a uuid: the country goes into the data
  await staffAudit(tx, ctx, 'country.open', null, { country: countryCode, cities: rows.length });
  return rows.length;
}

export type WaitlistExportRow = { email: string; role: WaitlistRole; confirmedAt: Date; leaveUrl: string };

/** Confirmed signups of a city and the cities launching with it, for the owner's opening email */
export async function exportWaitlist(db: Queryable, cityId: string, opts: { appUrl: string }): Promise<WaitlistExportRow[]> {
  const rows = await db.execute<{ leave_token: string; email: string; role: WaitlistRole; confirmed_at: Date }>(sql`
    SELECT w.leave_token, w.email, w.role, w.confirmed_at FROM city_waitlist w
    WHERE w.confirmed_at IS NOT NULL
      AND w.location_id IN (SELECT g.id FROM locations g WHERE g.id = ${cityId} OR g.launch_with_id = ${cityId})
    ORDER BY w.confirmed_at`);
  return rows.map((r) => ({
    email: r.email,
    role: r.role,
    confirmedAt: new Date(r.confirmed_at),
    leaveUrl: `${opts.appUrl}/waitlist/leave?t=${r.leave_token}`,
  }));
}
