import { and, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';
import { DEFAULT_TIME_ZONE } from './notification-prefs';

// A person's clock (owner, Nov 5, 2026): quiet hours, the morning-held notices, the daily
// saved-search run and the other notices timed to the receiver use, in this order,
//   1. the device's time zone (`users.time_zone`), which a signed-in page sends from the browser,
//   2. the time zone of the saved place (`users.home_location_id` → `locations.timezone`),
//   3. Berlin (`DEFAULT_TIME_ZONE`).
// The device's zone comes first because a saved city says nothing about which of a country's
// zones someone lives in (US, Canada, Australia), and a phone number doesn't either (people keep
// their numbers when they move). Unlike a location from the IP address it is right behind a VPN,
// which many Iranians use. Slack and Google Calendar do the same. There is no manual picker.

/** The form `users_time_zone_check` allows (as `event_details_time_zone_check`), and its length */
const ZONE_FORM = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/;
export const ZONE_MAX = 64;

export const deviceZoneSchema = z.string().max(ZONE_MAX);

/**
 * The device's zone as we keep it, or null for anything we don't: not a string, too long, not an
 * Area/Place name Intl knows, or a fixed offset (`Etc/…`, and `UTC`, which isn't Area/Place).
 * Fixed offsets are left out because privacy settings report them (Tor Browser and Firefox's
 * resistFingerprinting say UTC wherever the person is), as do servers and bots: the saved place
 * is the better guess then. The name comes back in Intl's own spelling (`asia/tehran` →
 * `Asia/Tehran`).
 */
export function deviceTimeZone(value: unknown): string | null {
  const parsed = deviceZoneSchema.safeParse(value);
  if (!parsed.success || !ZONE_FORM.test(parsed.data) || /^etc\//i.test(parsed.data)) return null;
  let zone: string;
  try {
    zone = new Intl.DateTimeFormat('en-US', { timeZone: parsed.data }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  return ZONE_FORM.test(zone) && zone.length <= ZONE_MAX && !/^etc\//i.test(zone) ? zone : null;
}

/** The person's clock from what is known: the device's zone, the saved place's, else Berlin */
export function personTimeZone(p: { device?: string | null; place?: string | null }, fallback: string = DEFAULT_TIME_ZONE): string {
  return p.device || p.place || fallback;
}

/**
 * The same in SQL, for a users row under `alias`: the device's zone, else the saved place's; null
 * when neither is known, so a query can add its own next step (the search's city) before Berlin.
 */
export function personZoneSql(alias = 'u'): SQL {
  const u = sql.raw(alias);
  return sql`coalesce(${u}.time_zone, (SELECT pz.timezone FROM locations pz WHERE pz.id = ${u}.home_location_id))`;
}

/**
 * Saves the device's zone on the account when it is valid and differs from what is stored: one
 * UPDATE that changes nothing otherwise. PostgreSQL must know the zone too (the hourly jobs use
 * `AT TIME ZONE`, and an unknown name would fail the whole query), so it is checked against
 * `pg_timezone_names` in the same statement. Returns whether it changed.
 */
export async function saveDeviceTimeZone(db: Queryable, userId: string, value: unknown): Promise<boolean> {
  const zone = deviceTimeZone(value);
  if (!zone) return false;
  const rows = await db
    .update(users)
    .set({ timeZone: zone })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.timeZone), ne(users.timeZone, zone)),
        sql`EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${zone})`,
      ),
    )
    .returning({ id: users.id });
  return rows.length > 0;
}

/**
 * A readable place for a zone, in Persian, from ICU's names: «لوس‌آنجلس» for America/Los_Angeles,
 * «آلمان» for Europe/Berlin (a country with one zone is named by the country). Null when ICU only
 * has an offset for it.
 */
export function zonePlaceName(zone: string): string | null {
  let name: string | undefined;
  try {
    name = new Intl.DateTimeFormat('fa', { timeZone: zone, timeZoneName: 'shortGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
  } catch {
    return null;
  }
  const place = name?.replace(/^وقت\s+/, '').trim();
  // An offset («GMT-3», «گرینویچ−۳») isn't a place
  return place && !/GMT|UTC|گرینویچ|[0-9۰-۹]/.test(place) ? place : null;
}

/**
 * The place the settings page names for a zone: our own Persian name of the city the zone is
 * named after when we list it (America/Los_Angeles → the city «los-angeles», Europe/Berlin →
 * «برلین»), else ICU's name, else the zone itself.
 */
export async function zoneLabel(db: Queryable, zone: string): Promise<{ text: string; latin: boolean }> {
  const slug = (zone.split('/').pop() ?? '').toLowerCase().replace(/_/g, '-');
  const [city] = await db.execute<{ name_fa: string }>(sql`
    SELECT name_fa FROM locations WHERE kind = 'city' AND timezone = ${zone} AND slug = ${slug} LIMIT 1`);
  if (city) return { text: city.name_fa, latin: false };
  const icu = zonePlaceName(zone);
  return icu ? { text: icu, latin: false } : { text: zone, latin: true };
}
