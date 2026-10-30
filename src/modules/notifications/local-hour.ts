import { sql, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { dayNumber, localParts } from '../events/time';

// Timed messages on each place's own clock (wave 2 part 7, owner Oct 30, 2026): the weekly
// events digest (Monday 8:00), the weekly city email (Monday 9:00), the expiry reminder (9:00) and
// the daily saved-search notices (18:00). Their worker jobs run every hour on the hour, UTC, and
// send only where it is that hour now. Every time zone's hours start at :00, :30 or :45 UTC, so
// each local hour meets exactly one run. A place without a clock of its own is on Berlin time.

export const EVERY_HOUR = { pattern: '0 * * * *', tz: 'UTC' } as const;
export const DEFAULT_ZONE = 'Europe/Berlin';
export const MONDAY = 0;

/** Whether it is `hour` o'clock in the time zone now (and, with `weekday`, that day; 0 is Monday) */
export function isLocalHour(now: Date, timeZone: string, hour: number, weekday?: number): boolean {
  const p = localParts(now, timeZone);
  return p.h === hour && (weekday === undefined || (dayNumber(p) + 3) % 7 === weekday);
}

/** The same in SQL, for a time zone expression (a column, or a coalesce of them) */
export function localHourSql(timeZone: SQL, now: Date, hour: number): SQL {
  return sql`extract(hour from (${now.toISOString()}::timestamptz AT TIME ZONE ${timeZone})) = ${hour}`;
}

/**
 * A country's clock, for what belongs to the whole country (its digest, a search over all of it):
 * its first opened city's, else its biggest city's (the US's first city sets America's), else Berlin.
 */
export function countryZoneSql(code: SQL): SQL {
  return sql`coalesce((SELECT z.timezone FROM locations z WHERE z.country_code = ${code} AND z.kind = 'city' AND z.is_active
    ORDER BY z.opened_at NULLS LAST, z.population DESC NULLS LAST, z.id LIMIT 1), ${DEFAULT_ZONE})`;
}

/**
 * The hour a scheduled job is for: its tick, not when it runs, so a run that starts late (worker
 * or Valkey away over the hour) still serves the places whose hour it was (code check, Oct 30,
 * 2026). A job that isn't from a scheduler is for now.
 */
export function scheduledTime(job: { timestamp: number; opts: { delay?: number }; repeatJobKey?: string }, now: Date = new Date()): Date {
  if (!job.repeatJobKey) return now;
  const tick = job.timestamp + (job.opts.delay ?? 0);
  // A tick from long ago (a job stuck for hours) is no longer worth serving as if it were now
  return now.getTime() - tick < 3 * 3_600_000 ? new Date(tick) : now;
}

/** The local date in the time zone, `YYYY-MM-DD` (a week's Monday names that week) */
export function localDate(now: Date, timeZone: string): string {
  const p = localParts(now, timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Whether any city's clock (or Berlin's) is at that hour (and weekday) now: most runs need nothing */
export async function anyCityAtHour(db: Queryable, now: Date, hour: number, weekday?: number): Promise<boolean> {
  const zones = await db.execute<{ tz: string }>(sql`SELECT DISTINCT timezone AS tz FROM locations WHERE kind = 'city' AND timezone IS NOT NULL`);
  return [DEFAULT_ZONE, ...zones.map((z) => z.tz)].some((tz) => isLocalHour(now, tz, hour, weekday));
}
