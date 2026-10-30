import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { hideTestRaw } from '../users/test-accounts';
import { EVENT_OUTBOX } from './events';
import { whenWindow } from './queries';
import { countryZoneSql, isLocalHour, localDate, MONDAY } from '../notifications/local-hour';
import { addDays, dayNumber, localParts } from './time';

// The weekly digest: every Monday morning one outbox event per open country with events in the
// coming week (Monday to Sunday), for the planned channel posting (n8n to Telegram). The payload
// carries ids and small facts only; whoever posts reads the events through the internal API.
// Run by the worker (job `event-digest`, src/worker/events.ts) every hour: with `localHour` only
// the countries where it is Monday at that hour now (wave 2 part 7, each country's own clock,
// src/modules/notifications/local-hour.ts). A country gets one digest per week, however often it runs.

const MAX_IN_DIGEST = 50;

export async function writeWeeklyDigests(db: Queryable, now = new Date(), opts: { localHour?: number } = {}): Promise<number> {
  const zones = await db.execute<{ code: string; zone: string }>(sql`
    SELECT c.code, ${countryZoneSql(sql`c.code`)} AS zone FROM countries c WHERE c.is_active ORDER BY c.code`);
  let written = 0;
  for (const { code, zone } of zones) {
    if (opts.localHour !== undefined && !isLocalHour(now, zone, opts.localHour, MONDAY)) continue;
    const { from, to } = whenWindow('week', now, zone);
    // The week, by its Monday on the country's clock: one digest per week (`from` is the run's own time)
    const week = mondayOf(now, zone);
    const [r] = await db.execute<{ ids: string[]; n: number }>(sql`
      WITH due AS (
        SELECT DISTINCT ON (d.listing_id) d.listing_id, d.starts_at
        FROM event_dates d
        JOIN listings l ON l.id = d.listing_id AND l.status = 'active' ${hideTestRaw(false, sql`l.user_id`)}
        JOIN event_details e ON e.listing_id = d.listing_id AND e.schedule_status <> 'cancelled'
        WHERE d.country_code = ${code} AND d.ends_at > ${from.toISOString()}::timestamptz AND d.starts_at < ${to!.toISOString()}::timestamptz
        ORDER BY d.listing_id, d.starts_at
      )
      SELECT (array_agg(listing_id::text ORDER BY starts_at, listing_id))[1:${MAX_IN_DIGEST}] AS ids, count(*)::int AS n FROM due`);
    if (!r || r.n === 0) continue;
    const inserted = await db.execute(sql`
      INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
      SELECT ${EVENT_OUTBOX.weeklyDigest}, 'event_digest', uuidv7(), ${JSON.stringify({ country: code, week, from: from.toISOString(), to: to!.toISOString(), total: r.n, listingIds: r.ids })}::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM outbox_events o WHERE o.event_type = ${EVENT_OUTBOX.weeklyDigest}
                          AND o.payload ->> 'country' = ${code} AND o.payload ->> 'week' = ${week})
      RETURNING 1`);
    written += inserted.length;
  }
  return written;
}

/** The Monday of the week `now` is in, on that clock, `YYYY-MM-DD` */
function mondayOf(now: Date, zone: string): string {
  const p = localParts(now, zone);
  const back = (dayNumber(p) + 3) % 7;
  const m = addDays(p, -back);
  return localDate(new Date(Date.UTC(m.y, m.m - 1, m.d, 12)), 'UTC');
}
