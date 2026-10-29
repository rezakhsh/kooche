import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { zoneSql } from '../listings/zones';

// The moderation queue (roadmap step 8; "The moderation routine" in docs/setup.md, "Admin page"):
// one row per thing, gathering its open reports (users, visitors, chat), an open flag from the
// automatic checks (near-duplicate photos), a resubmission after a take-down by a person, and open
// appeals. Notices that something is illegal come first, then the oldest (or the most reported).

export type QueueKind = 'listing' | 'user' | 'business' | 'message';
export type QueueSort = 'oldest' | 'most';

export type QueueItem = {
  kind: QueueKind;
  id: string;
  reports: number;
  reasons: string[];
  illegal: boolean;
  flagged: boolean;
  resubmitted: boolean;
  appeals: number;
  since: Date;
  title: string | null;
  status: string | null;
  countryCode: string | null;
  refNumber: number | null;
};

/** Open escalations: a flag from the checks that no person or AI has decided on since, on a listing that is up */
export const OPEN_ESCALATIONS = sql`
  SELECT d.listing_id AS id, min(d.created_at) AS since FROM moderation_decisions d
  JOIN listings l ON l.id = d.listing_id AND l.status IN ('active', 'paused', 'pending_review')
  WHERE d.decision = 'escalate'
    AND NOT EXISTS (SELECT 1 FROM moderation_decisions s WHERE s.listing_id = d.listing_id AND s.decided_by IN ('staff', 'ai') AND s.created_at > d.created_at)
  GROUP BY d.listing_id`;

/** Resubmissions waiting for a person: pending review after a take-down by staff */
export const HELD_RESUBMISSIONS = sql`
  SELECT l.id, l.status_changed_at AS since FROM listings l
  WHERE l.status = 'pending_review'
    AND (SELECT d.decided_by FROM listing_events e JOIN moderation_decisions d ON d.id = e.moderation_decision_id
         WHERE e.listing_id = l.id AND e.to_status = 'rejected' ORDER BY e.created_at DESC, e.id DESC LIMIT 1) = 'staff'`;

export async function moderationQueue(db: Queryable, opts: { sort?: QueueSort; kind?: QueueKind | null; country?: string | null; limit?: number } = {}): Promise<QueueItem[]> {
  const order = opts.sort === 'most' ? sql`illegal DESC, reports DESC, since ASC` : sql`illegal DESC, since ASC`;
  const rows = await db.execute<{
    kind: QueueKind; id: string; reports: number; reasons: string[] | null; illegal: boolean; flagged: boolean; resubmitted: boolean; appeals: number; since: string | Date;
    title: string | null; status: string | null; country_code: string | null; ref_number: string | null;
  }>(sql`
    WITH parts AS (
      SELECT CASE WHEN listing_id IS NOT NULL THEN 'listing' WHEN reported_user_id IS NOT NULL THEN 'user'
                  WHEN organization_id IS NOT NULL THEN 'business' ELSE 'message' END AS kind,
             coalesce(listing_id, reported_user_id, organization_id, message_id) AS id,
             1 AS reports, reason_code AS reason, is_illegal_content_notice AS illegal,
             false AS flagged, false AS resubmitted, 0 AS appeals, created_at AS since
      FROM reports WHERE status IN ('open', 'in_review')
      UNION ALL
      SELECT 'listing', e.id, 0, NULL, false, true, false, 0, e.since FROM (${OPEN_ESCALATIONS}) e
      UNION ALL
      SELECT 'listing', h.id, 0, NULL, false, false, true, 0, h.since FROM (${HELD_RESUBMISSIONS}) h
      UNION ALL
      SELECT CASE WHEN d.listing_id IS NOT NULL THEN 'listing' WHEN d.user_id IS NOT NULL THEN 'user'
                  WHEN d.organization_id IS NOT NULL THEN 'business' ELSE 'message' END,
             coalesce(d.listing_id, d.user_id, d.organization_id, d.message_id), 0, NULL, false, false, false, 1, a.created_at
      FROM moderation_appeals a JOIN moderation_decisions d ON d.id = a.decision_id
      WHERE a.status = 'open' AND d.listing_image_id IS NULL
    ), items AS (
      SELECT kind, id, sum(reports)::int AS reports, array_agg(DISTINCT reason) FILTER (WHERE reason IS NOT NULL) AS reasons,
             bool_or(illegal) AS illegal, bool_or(flagged) AS flagged, bool_or(resubmitted) AS resubmitted, sum(appeals)::int AS appeals, min(since) AS since
      FROM parts GROUP BY kind, id
    )
    SELECT i.*, coalesce(l.title, u.display_name, o.name, left(m.body, 80)) AS title,
           coalesce(l.status, u.status, o.status) AS status, coalesce(l.country_code, o.country_code) AS country_code, l.ref_number
    FROM items i
    LEFT JOIN listings l ON i.kind = 'listing' AND l.id = i.id
    LEFT JOIN users u ON i.kind = 'user' AND u.id = i.id
    LEFT JOIN organizations o ON i.kind = 'business' AND o.id = i.id
    LEFT JOIN messages m ON i.kind = 'message' AND m.id = i.id
    WHERE ${opts.kind ? sql`i.kind = ${opts.kind}` : sql`true`}
      AND ${opts.country ? sql`coalesce(l.country_code, o.country_code) = ${opts.country}` : sql`true`}
    ORDER BY ${order}
    LIMIT ${opts.limit ?? 200}
  `);
  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    reports: r.reports,
    reasons: r.reasons ?? [],
    illegal: r.illegal,
    flagged: r.flagged,
    resubmitted: r.resubmitted,
    appeals: r.appeals,
    since: new Date(r.since),
    title: r.title,
    status: r.status,
    countryCode: r.country_code,
    refNumber: r.ref_number === null ? null : Number(r.ref_number),
  }));
}

/** How many things wait and since when (the overview and the nav badge) */
export async function queueAge(db: Queryable): Promise<{ count: number; oldest: Date | null }> {
  const items = await moderationQueue(db, { limit: 1_000 });
  return { count: items.length, oldest: items.reduce<Date | null>((o, i) => (!o || i.since < o ? i.since : o), null) };
}

/**
 * New listings from accounts under 7 days, or posted with a number from another zone than the
 * listing's (wave 2 part 5, ../listings/zones.ts), out in the last 48 hours, not yet looked at by staff
 */
export async function freshListings(db: Queryable, limit = 60) {
  const otherZone = sql`(l.number_country IS NOT NULL AND ${zoneSql(sql`l.number_country`)} <> ${zoneSql(sql`l.country_code`)})`;
  return db.execute<{ id: string; title: string; token: string; ref_number: string; price_minor: number | null; currency: string | null; published_at: string | Date; seller: string; seller_since: string | Date; cover: string | null; is_event: boolean; other_zone: string | null }>(sql`
    SELECT l.id, l.title, l.public_token AS token, l.ref_number, l.price_minor, l.currency, l.published_at, u.display_name AS seller, u.created_at AS seller_since,
      (SELECT i.storage_key FROM listing_images i WHERE i.listing_id = l.id AND i.status = 'ready' ORDER BY i.position LIMIT 1) AS cover,
      EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event,
      CASE WHEN ${otherZone} THEN l.number_country END AS other_zone
    FROM listings l JOIN users u ON u.id = l.user_id
    WHERE l.status = 'active' AND l.published_at > now() - interval '48 hours' AND (u.created_at > now() - interval '7 days' OR ${otherZone})
      AND NOT EXISTS (SELECT 1 FROM moderation_decisions d WHERE d.listing_id = l.id AND d.decided_by = 'staff' AND d.listing_revision = l.revision)
    ORDER BY l.published_at DESC
    LIMIT ${limit}
  `);
}
