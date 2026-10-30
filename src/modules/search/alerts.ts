import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Db, Queryable } from '../../db/drizzle';
import { hit, type Limit } from '../../lib/rate-limit';
import { ancestry, type Catalog } from '../listings/catalog';
import { activeCountries } from '../listings/queries';
import { isUnreachableMarked } from '../notifications/telegram-reach';
import { bundleOn, DEFAULT_TIME_ZONE, noticeChannels, quietDelay, quietHoursOn, savedSearchAlertsOn } from '../users/notification-prefs';
import { searchesShowing, type SearchFilters } from './browse';
import { keywordMatches } from './keyword';
import type { Meili } from './meili';
import { searchFiltersOf } from './saved';
import { countryZoneSql, localHourSql } from '../notifications/local-hour';

// New listings for saved searches (approved Oct 22, 2026; docs/setup.md, "Keyword search and
// saved searches"). When a listing is published and indexed, the worker finds the saved searches
// whose page would now show it and records each match once (saved_search_hits). A notice gathers
// a search's matches: "instant" searches at most one every DEBOUNCE_MS, the first one GATHER_MS
// after the match (time for the post-checks, and for more matches to join it); "daily" ones at
// 18:00 Berlin time. At most ALERTS_PER_USER per user and day; beyond that, matches wait for the
// next day. Telegram when the account is linked and reachable, else email, like chat notices.

export const GATHER_MS = 2 * 60_000;
export const DEBOUNCE_MS = 15 * 60_000;
export const ALERTS_PER_USER: Limit = { name: 'search-alert:user', max: 10, windowSeconds: 86_400 };
/** Matches older than this are deleted, sent or not */
export const HITS_KEPT_DAYS = 30;
/** An instant search whose matches waited this long (a lost job) goes out with the daily run */
const STUCK_MS = 60 * 60_000;

type ListingFacts = {
  id: string;
  status: string;
  user_id: string;
  country_code: string | null;
  category_id: string | null;
  location_id: string | null;
  lat: number | null;
  lng: number | null;
  published_at: Date | string | null;
  is_event: boolean;
};

type Candidate = {
  id: string;
  user_id: string;
  filters: unknown;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  notify_frequency: 'instant' | 'daily' | 'off';
  last_notified_at: Date | string | null;
  prefs: unknown;
};

export type NewHit = { savedSearchId: string; frequency: 'instant' | 'daily'; lastNotifiedAt: Date | null };

/**
 * Records the saved searches that the newly published listing matches. Only searches saved before
 * the listing went out, of other active users who have alerts on. Returns the new matches.
 */
export async function matchListing(db: Db, catalog: Catalog, listingId: string, opts: { meili: Meili | null; index: string }): Promise<NewHit[]> {
  const [l] = await db.execute<ListingFacts>(sql`
    SELECT l.id, l.status, l.user_id, l.country_code, l.category_id, l.location_id,
           ST_Y(l.point::geometry) AS lat, ST_X(l.point::geometry) AS lng, l.published_at,
           EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event
    FROM listings l WHERE l.id = ${listingId}::uuid`);
  if (!l || l.status !== 'active' || l.is_event || !l.category_id || !l.country_code || l.lat === null) return [];
  const categories = ancestry(catalog, l.category_id).map((c) => c.id);

  const candidates = await db.execute<Candidate>(sql`
    SELECT s.id, s.user_id, s.filters, ST_Y(s.point::geometry) AS lat, ST_X(s.point::geometry) AS lng, s.radius_m,
           s.notify_frequency, s.last_notified_at, u.notification_prefs AS prefs
    FROM saved_searches s
    JOIN users u ON u.id = s.user_id AND u.status = 'active'
    WHERE s.notify_frequency <> 'off' AND s.country_code = ${l.country_code}
      AND (s.category_id IS NULL OR s.category_id IN (${sql.join(categories.map((id) => sql`${id}::uuid`), sql`, `)}))
      AND (s.location_id IS NULL OR s.location_id = ${l.location_id}::uuid)
      AND (s.point IS NULL OR ST_DWithin(s.point, ST_SetSRID(ST_MakePoint(${Number(l.lng)}::float8, ${Number(l.lat)}::float8), 4326)::geography, s.radius_m))
      AND s.user_id <> ${l.user_id}::uuid
      AND s.created_at <= ${new Date(l.published_at!).toISOString()}::timestamptz`);

  const countries = await activeCountries(db);
  const checks: { id: string; filters: SearchFilters }[] = [];
  for (const c of candidates) {
    if (!savedSearchAlertsOn(c.prefs)) continue;
    const filters = searchFiltersOf(catalog, countries, { filters: c.filters, point: c.lat === null ? null : { lat: Number(c.lat), lng: Number(c.lng) }, radiusM: c.radius_m });
    if (filters) checks.push({ id: c.id, filters });
  }

  // "Would it be on that search's page": keywords through Meilisearch like the page, the rest
  // (and keywords without Meilisearch) through the browse query
  const withKeyword = opts.meili ? checks.filter((c) => c.filters.keyword) : [];
  const rest = checks.filter((c) => !withKeyword.includes(c));
  const matched = await searchesShowing(db, listingId, rest);
  if (withKeyword.length) {
    let viaMeili: Set<string>;
    try {
      viaMeili = await keywordMatches(opts.meili!, opts.index, listingId, withKeyword);
    } catch (e) {
      console.error('search: alert matching through Meilisearch failed, using PostgreSQL:', e instanceof Error ? e.message : e);
      viaMeili = await searchesShowing(db, listingId, withKeyword);
    }
    for (const id of viaMeili) matched.add(id);
  }
  if (matched.size === 0) return [];

  const inserted = await db.execute<{ saved_search_id: string }>(sql`
    INSERT INTO saved_search_hits (saved_search_id, listing_id)
    SELECT id, ${listingId}::uuid FROM unnest(ARRAY[${sql.join([...matched].map((id) => sql`${id}::uuid`), sql`, `)}]) AS id
    ON CONFLICT DO NOTHING
    RETURNING saved_search_id`);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return inserted.map((r) => {
    const c = byId.get(r.saved_search_id)!;
    // Bundling (wave 1 settings): every search of the person goes out with the daily run, together
    const daily = c.notify_frequency === 'daily' || bundleOn(c.prefs);
    return { savedSearchId: c.id, frequency: daily ? 'daily' : 'instant', lastNotifiedAt: c.last_notified_at ? new Date(c.last_notified_at) : null };
  });
}

/** How long to wait before an instant notice for a search that was last notified then */
export function noticeDelay(lastNotifiedAt: Date | null, now: Date): number {
  const debounced = lastNotifiedAt ? lastNotifiedAt.getTime() + DEBOUNCE_MS - now.getTime() : 0;
  return Math.max(GATHER_MS, debounced);
}

/** `more`: the person's other searches in the same message (bundling) */
export type AlertJob = { savedSearchId: string; userId: string; listingIds: string[]; more?: AlertJob[] };
export type Channel = 'telegram' | 'email';
export type ClaimResult =
  /** `bundle`: the person wants one daily message for all their searches */
  | { send: Channel[]; job: AlertJob; bundle: boolean }
  | { later: number }
  | { skip: 'gone' | 'user_inactive' | 'turned_off' | 'nothing' | 'capped' };

/**
 * Takes a search's pending matches for one notice, in one transaction with the search's row
 * locked (two jobs never send the same matches): marks them sent, sets last_notified_at and
 * returns the channel. Matches whose listing went away are dropped. `daily` ignores the debounce.
 */
export async function claimAlert(
  db: Db,
  redis: Redis,
  savedSearchId: string,
  now: Date,
  mode: 'instant' | 'daily' = 'instant',
  timeZone = DEFAULT_TIME_ZONE,
): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [s] = await tx.execute<{ user_id: string; notify_frequency: string; last_notified_at: Date | string | null; status: string; prefs: unknown; telegram_user_id: string | number | null; tz: string | null }>(sql`
      SELECT s.user_id, s.notify_frequency, s.last_notified_at, u.status, u.notification_prefs AS prefs, u.telegram_user_id,
             (SELECT h.timezone FROM locations h WHERE h.id = u.home_location_id) AS tz
      FROM saved_searches s JOIN users u ON u.id = s.user_id
      WHERE s.id = ${savedSearchId}::uuid
      FOR UPDATE OF s`);
    if (!s) return { skip: 'gone' };
    const drop = () => tx.execute(sql`UPDATE saved_search_hits SET notified_at = ${now.toISOString()}::timestamptz WHERE saved_search_id = ${savedSearchId}::uuid AND notified_at IS NULL`);
    if (s.status !== 'active') return { skip: 'user_inactive' };
    if (s.notify_frequency === 'off' || !savedSearchAlertsOn(s.prefs)) {
      await drop();
      return { skip: 'turned_off' };
    }
    // Quiet hours: the matches wait for the morning
    if (quietHoursOn(s.prefs)) {
      const wait = quietDelay(now, s.tz ?? timeZone);
      if (wait > 0) return { later: wait };
    }
    const last = s.last_notified_at ? new Date(s.last_notified_at) : null;
    if (mode === 'instant' && last && now.getTime() - last.getTime() < DEBOUNCE_MS) return { later: last.getTime() + DEBOUNCE_MS - now.getTime() };

    const pending = await tx.execute<{ listing_id: string }>(sql`
      SELECT h.listing_id FROM saved_search_hits h JOIN listings l ON l.id = h.listing_id
      WHERE h.saved_search_id = ${savedSearchId}::uuid AND h.notified_at IS NULL AND l.status = 'active'
      ORDER BY l.ranked_at DESC, l.id DESC`);
    if (pending.length === 0) {
      await drop();
      return { skip: 'nothing' };
    }
    // The daily cap is counted per notice; over it, the matches stay pending for tomorrow. A
    // bundling person's daily run is one message, whatever number of searches it carries (code
    // check, Oct 30, 2026: searches 11 and up never got through)
    const bundled = mode === 'daily' && bundleOn(s.prefs);
    if (!bundled && !(await hit(redis, [[ALERTS_PER_USER, s.user_id]])).ok) return { skip: 'capped' };

    const tg = s.telegram_user_id === null ? null : Number(s.telegram_user_id);
    const channels = noticeChannels(s.prefs, 'searches', tg !== null && !(await isUnreachableMarked(redis, tg)));
    await drop();
    if (channels.length === 0) return { skip: 'turned_off' };
    await tx.execute(sql`UPDATE saved_searches SET last_notified_at = ${now.toISOString()}::timestamptz WHERE id = ${savedSearchId}::uuid`);
    return { send: channels, job: { savedSearchId, userId: s.user_id, listingIds: pending.map((p) => p.listing_id) }, bundle: bundleOn(s.prefs) };
  });
}

/**
 * Searches whose matches go out with the daily run: daily ones, all of a bundling person's, and
 * instant ones left waiting; per person, the one that waited longest first
 */
export async function dueForDaily(db: Queryable, now: Date, opts: { localHour?: number } = {}): Promise<string[]> {
  // With `localHour` (the worker, hourly): only where it is that hour on the person's clock, their
  // saved city's, else the search's city's, else its country's (wave 2 part 7)
  const zone = sql`coalesce(h.timezone, sl.timezone, ${countryZoneSql(sql`s.country_code`)})`;
  const rows = await db.execute<{ id: string }>(sql`
    SELECT s.id FROM saved_searches s JOIN users u ON u.id = s.user_id
    LEFT JOIN locations h ON h.id = u.home_location_id
    LEFT JOIN locations sl ON sl.id = s.location_id
    WHERE s.notify_frequency <> 'off'
      ${opts.localHour !== undefined ? sql`AND ${localHourSql(zone, now, opts.localHour)}` : sql``}
      AND EXISTS (
        SELECT 1 FROM saved_search_hits h WHERE h.saved_search_id = s.id AND h.notified_at IS NULL
          AND (s.notify_frequency = 'daily' OR u.notification_prefs @> '{"bundle": true}'::jsonb
            OR h.created_at < ${new Date(now.getTime() - STUCK_MS).toISOString()}::timestamptz))
    ORDER BY s.user_id, s.last_notified_at NULLS FIRST, s.id`);
  return rows.map((r) => r.id);
}

/**
 * A claimed notice that couldn't be queued: its matches wait again, so the next run sends them
 * (code check, Oct 30, 2026: they were marked sent before the message was on its way)
 */
export async function unclaimAlert(db: Queryable, job: AlertJob, claimedAt: Date): Promise<void> {
  for (const j of [job, ...(job.more ?? [])]) {
    if (!j.listingIds.length) continue;
    await db.execute(sql`
      UPDATE saved_search_hits SET notified_at = NULL
      WHERE saved_search_id = ${j.savedSearchId}::uuid AND notified_at = ${claimedAt.toISOString()}::timestamptz
        AND listing_id IN (${sql.join(j.listingIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
  }
}

/** Deletes matches older than HITS_KEPT_DAYS, in batches; returns how many */
export async function purgeHits(db: Queryable, now: Date, batch = 5_000): Promise<number> {
  let total = 0;
  for (;;) {
    const rows = await db.execute<{ n: number }>(sql`
      WITH gone AS (
        DELETE FROM saved_search_hits WHERE ctid IN (
          SELECT ctid FROM saved_search_hits WHERE created_at < ${new Date(now.getTime() - HITS_KEPT_DAYS * 86_400_000).toISOString()}::timestamptz LIMIT ${batch})
        RETURNING 1)
      SELECT count(*)::int AS n FROM gone`);
    const n = Number(rows[0]?.n ?? 0);
    total += n;
    if (n < batch) return total;
  }
}
