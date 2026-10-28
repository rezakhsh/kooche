import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { testOwned } from '../users/test-accounts';

// The overview (roadmap step 8): how many people and listings arrived, what was talked about and
// paid, by country and day, and the launch metrics per city from docs/strategy.md ("Gates" and
// "Weekly metrics per city"): live listings (housing, services and jobs for the gate), weekly
// posters, and the share of new listings that got a chat within 7 days. Plain SQL over the
// indexed timestamps; cached by the page for 5 minutes.

export const METRICS = ['users', 'listings', 'events', 'chats', 'reports', 'revenue'] as const;
export type Metric = (typeof METRICS)[number];

/** Categories under these roots count for the city gate (docs/strategy.md) */
export const GATE_ROOTS = ['real-estate', 'services', 'jobs'] as const;

const NOT_EVENT = sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`;
const IS_EVENT = sql`EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`;
/** Test accounts and what they post never count (src/modules/users/test-accounts.ts) */
const REAL = sql`NOT ${testOwned(sql`l.user_id`)}`;

/** Each metric's rows as (day, country, value) since `from` */
function metricRows(metric: Metric, from: string) {
  switch (metric) {
    case 'users':
      // Accounts have no country; counted under '—'
      return sql`SELECT created_at AS at, NULL::text AS country, 1::bigint AS v FROM users WHERE created_at >= ${from}::timestamptz AND status <> 'deleted' AND test_account IS NULL`;
    case 'listings':
      return sql`SELECT l.published_at AS at, l.country_code AS country, 1::bigint AS v FROM listings l WHERE l.published_at >= ${from}::timestamptz AND ${NOT_EVENT} AND ${REAL}`;
    case 'events':
      return sql`SELECT l.published_at AS at, l.country_code AS country, 1::bigint AS v FROM listings l WHERE l.published_at >= ${from}::timestamptz AND ${IS_EVENT} AND ${REAL}`;
    case 'chats':
      return sql`SELECT c.created_at AS at, l.country_code AS country, 1::bigint AS v FROM conversations c JOIN listings l ON l.id = c.listing_id WHERE c.created_at >= ${from}::timestamptz AND ${REAL}`;
    case 'reports':
      return sql`SELECT r.created_at AS at, coalesce(l.country_code, o.country_code) AS country, 1::bigint AS v FROM reports r
        LEFT JOIN listings l ON l.id = r.listing_id LEFT JOIN organizations o ON o.id = r.organization_id WHERE r.created_at >= ${from}::timestamptz`;
    case 'revenue':
      // Charges minus refunds, in minor units (EUR only today; another currency would need its own line)
      return sql`SELECT p.occurred_at AS at, NULL::text AS country, CASE WHEN p.kind = 'refund' THEN -p.amount_minor ELSE p.amount_minor END AS v
        FROM payments p WHERE p.status = 'succeeded' AND p.occurred_at >= ${from}::timestamptz`;
  }
}

/** `period` is the chosen number of days, `previous` the same number of days before it (wave 1: the change) */
export type Totals = Record<Metric, { today: number; week: number; month: number; period: number; previous: number; byCountry: Record<string, number> }>;
export type Series = Record<Metric, Array<{ day: string; value: number }>>;

/** Totals for today, 7 and 30 days (by country for 30 days), `days` and the `days` before, and a daily series for `days` days */
export async function overview(db: Queryable, opts: { days: number; timeZone: string; now?: Date }): Promise<{ totals: Totals; series: Series }> {
  const now = opts.now ?? new Date();
  const span = Math.max(opts.days * 2, 30);
  const from = new Date(now.getTime() - span * 86_400_000).toISOString();
  const totals = {} as Totals;
  const series = {} as Series;
  for (const m of METRICS) {
    const rows = await db.execute<{ day: string; country: string | null; v: string }>(sql`
      SELECT to_char((at AT TIME ZONE ${opts.timeZone})::date, 'YYYY-MM-DD') AS day, country, sum(v)::bigint AS v
      FROM (${metricRows(m, from)}) x GROUP BY 1, 2`);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: opts.timeZone }).format(now);
    const dayAgo = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: opts.timeZone }).format(new Date(now.getTime() - n * 86_400_000));
    const weekFrom = dayAgo(6);
    const monthFrom = dayAgo(29);
    const periodFrom = dayAgo(opts.days - 1);
    const previousFrom = dayAgo(opts.days * 2 - 1);
    const t = { today: 0, week: 0, month: 0, period: 0, previous: 0, byCountry: {} as Record<string, number> };
    const perDay = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r.v);
      perDay.set(r.day, (perDay.get(r.day) ?? 0) + v);
      if (r.day === today) t.today += v;
      if (r.day >= weekFrom) t.week += v;
      if (r.day >= periodFrom) t.period += v;
      else if (r.day >= previousFrom) t.previous += v;
      if (r.day >= monthFrom) {
        t.month += v;
        const c = r.country ?? '—';
        t.byCountry[c] = (t.byCountry[c] ?? 0) + v;
      }
    }
    totals[m] = t;
    series[m] = Array.from({ length: opts.days }, (_, i) => {
      const day = dayAgo(opts.days - 1 - i);
      return { day, value: perDay.get(day) ?? 0 };
    });
  }
  return { totals, series };
}

export type CityMetrics = {
  country: string;
  city: string;
  cityFa: string;
  active: number;
  /** Live listings in housing, services and jobs (the next-city gate: 100) */
  gateActive: number;
  /** Accounts that published something in the last 7 days (gate: 30) */
  weeklyPosters: number;
  /** Listings published 7 to 35 days ago, and how many got a chat within 7 days (gate: 50%) */
  cohort: number;
  withChat: number;
};

/** The strategy's launch metrics per city, biggest first */
export async function cityMetrics(db: Queryable): Promise<CityMetrics[]> {
  const rows = await db.execute<{ country: string; city: string; city_fa: string; active: number; gate_active: number; weekly_posters: number; cohort: number; with_chat: number }>(sql`
    WITH gate AS (
      SELECT c.id FROM categories c JOIN categories root ON root.path @> c.path AND nlevel(root.path) = 1
      WHERE root.slug IN (${sql.join(GATE_ROOTS.map((r) => sql`${r}`), sql`, `)})
    )
    SELECT co.slug AS country, loc.slug AS city, loc.name_fa AS city_fa,
      count(*) FILTER (WHERE l.status = 'active')::int AS active,
      count(*) FILTER (WHERE l.status = 'active' AND l.category_id IN (SELECT id FROM gate))::int AS gate_active,
      count(DISTINCT l.user_id) FILTER (WHERE l.published_at > now() - interval '7 days')::int AS weekly_posters,
      count(*) FILTER (WHERE l.published_at BETWEEN now() - interval '35 days' AND now() - interval '7 days')::int AS cohort,
      count(*) FILTER (WHERE l.published_at BETWEEN now() - interval '35 days' AND now() - interval '7 days'
        AND EXISTS (SELECT 1 FROM conversations cv WHERE cv.listing_id = l.id AND cv.created_at < l.published_at + interval '7 days'))::int AS with_chat
    FROM listings l
    JOIN locations loc ON loc.id = l.location_id
    JOIN countries co ON co.code = l.country_code
    WHERE l.published_at IS NOT NULL AND l.status <> 'deleted' AND ${NOT_EVENT} AND ${REAL}
    GROUP BY co.slug, loc.slug, loc.name_fa
    HAVING count(*) FILTER (WHERE l.status = 'active') > 0 OR count(*) FILTER (WHERE l.published_at > now() - interval '35 days') > 0
    ORDER BY active DESC, loc.slug
    LIMIT 30
  `);
  return rows.map((r) => ({ country: r.country, city: r.city, cityFa: r.city_fa, active: r.active, gateActive: r.gate_active, weeklyPosters: r.weekly_posters, cohort: r.cohort, withChat: r.with_chat }));
}
