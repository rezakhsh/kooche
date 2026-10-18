import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { EVENT_OUTBOX } from './events';
import { whenWindow } from './queries';

// The weekly digest: every Monday morning one outbox event per open country with events in the
// coming week (Monday to Sunday), for the planned channel posting (n8n to Telegram). The payload
// carries ids and small facts only; whoever posts reads the events through the internal API.
// Run by the worker (job `event-digest`, src/worker/events.ts).

const MAX_IN_DIGEST = 50;

export async function writeWeeklyDigests(db: Queryable, timeZone: string, now = new Date()): Promise<number> {
  const { from, to } = whenWindow('week', now, timeZone);
  const rows = await db.execute<{ country_code: string; ids: string[]; n: number }>(sql`
    WITH due AS (
      SELECT DISTINCT ON (d.listing_id) d.listing_id, d.country_code, d.starts_at
      FROM event_dates d
      JOIN listings l ON l.id = d.listing_id AND l.status = 'active'
      JOIN event_details e ON e.listing_id = d.listing_id AND e.schedule_status <> 'cancelled'
      JOIN countries c ON c.code = d.country_code AND c.is_active
      WHERE d.ends_at > ${from.toISOString()}::timestamptz AND d.starts_at < ${to!.toISOString()}::timestamptz
      ORDER BY d.listing_id, d.starts_at
    )
    SELECT country_code,
           (array_agg(listing_id::text ORDER BY starts_at, listing_id))[1:${MAX_IN_DIGEST}] AS ids,
           count(*)::int AS n
    FROM due GROUP BY country_code ORDER BY country_code
  `);
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
      VALUES (${EVENT_OUTBOX.weeklyDigest}, 'event_digest', uuidv7(), ${JSON.stringify({
        country: r.country_code,
        from: from.toISOString(),
        to: to!.toISOString(),
        total: r.n,
        listingIds: r.ids,
      })}::jsonb)`);
  }
  return rows.length;
}
