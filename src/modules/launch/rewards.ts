import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { reportError } from '../../lib/monitoring/server';
import { messages } from '../../messages/fa';
import { formatDate } from '../../lib/format';
import { DEFAULT_ZONE, localHourSql } from '../notifications/local-hour';
import { emailHtml, escapeHtml, type Mailer } from '../notifications/mailer';
import { rewardPlaces } from './waitlist';

// The waitlist reward (wave 2 part 9, owner Oct 30, 2026; promised on the waitlist pages since
// round 12): «۲۰۰ نفر اول هامبورگ: یک نردبان رایگان، از روز سوم تا شصتم بعد از باز شدن شهر، روی
// یکی از آگهی‌هایتان». When the owner opens a city, the first confirmed signups of it and the
// cities launching with it (rewardPlaces() of the city, one per email, in confirmation order) get
// a reward (waitlist_rewards, migration 0036). One per person, for a listing in that city
// (owner, Nov 6, 2026: before, three cities' waitlists gave three bumps usable anywhere). It belongs to the account with that email, made
// before or after. From day 3, the person gets one email (9:00 on the city's clock) and a box on
// «آگهی‌های من»; «استفاده از نردبان رایگان» on a listing's «ارتقا» page marks the reward used, and
// the bump job (src/modules/payments/bumps.ts) moves the listing up within a minute, like a paid
// bump. It isn't an entitlement: those come only from payments.

const DAY_MS = 86_400_000;
export const REWARD_FROM_DAYS = 3;
export const REWARD_UNTIL_DAYS = 60;

/**
 * Records the rewards of cities the owner has just opened (each the anchor of its launch group),
 * in the opening's transaction. A city opened again gives nobody a second one.
 */
export async function grantWaitlistRewards(tx: Queryable, anchorIds: string[], now: Date = new Date()): Promise<number> {
  let granted = 0;
  for (const anchor of anchorIds) {
    const [city] = await tx.execute<{ population: number | null; timezone: string | null }>(sql`SELECT population, timezone FROM locations WHERE id = ${anchor}::uuid`);
    if (!city) continue;
    // Usable to the end of the 60th day on the city's clock, the day the emails name (Check B, Oct 31, 2026)
    const zone = city.timezone || DEFAULT_ZONE;
    const rows = await tx.execute(sql`
      INSERT INTO waitlist_rewards (waitlist_id, location_id, available_from, ends_at)
      SELECT x.id, ${anchor}::uuid, ${new Date(now.getTime() + REWARD_FROM_DAYS * DAY_MS).toISOString()}::timestamptz,
             (date_trunc('day', ${new Date(now.getTime() + REWARD_UNTIL_DAYS * DAY_MS).toISOString()}::timestamptz AT TIME ZONE ${zone}) + interval '1 day') AT TIME ZONE ${zone}
      FROM (
        SELECT DISTINCT ON (w.email) w.id, w.confirmed_at FROM city_waitlist w
        WHERE w.confirmed_at IS NOT NULL
          AND w.location_id IN (SELECT g.id FROM locations g WHERE g.id = ${anchor}::uuid OR g.launch_with_id = ${anchor}::uuid)
          -- One reward per person, ever (owner, Nov 6, 2026): an email rewarded by another city's
          -- opening (or earlier in this one, «همهٔ کشور») leaves the place to the next sign-up
          AND NOT EXISTS (SELECT 1 FROM waitlist_rewards r2 JOIN city_waitlist w2 ON w2.id = r2.waitlist_id WHERE w2.email = w.email)
        ORDER BY w.email, w.confirmed_at
      ) x
      ORDER BY x.confirmed_at, x.id
      LIMIT ${rewardPlaces(city.population)}
      ON CONFLICT (waitlist_id) DO NOTHING
      RETURNING 1`);
    granted += rows.length;
  }
  return granted;
}

export type RewardOffer = { id: string; cityFa: string; endsAt: Date };

/**
 * The account's rewards usable now: its verified email signed up and was among the first. None
 * once the account has used one (one per person, owner Nov 6, 2026; covers rewards granted before
 * that rule, and an email changed to another rewarded one). With `listingId`, only the rewards of
 * that listing's city: a reward bumps a listing in the city that opened, or a city launching with
 * it (Potsdam with Berlin).
 */
export async function usableRewards(db: Queryable, userId: string, now: Date = new Date(), listingId?: string): Promise<RewardOffer[]> {
  const rows = await db.execute<{ id: string; city_fa: string; ends_at: Date }>(sql`
    SELECT r.id, c.name_fa AS city_fa, r.ends_at
    FROM waitlist_rewards r
    JOIN city_waitlist w ON w.id = r.waitlist_id
    JOIN users u ON u.id = ${userId}::uuid AND u.email_verified AND u.status = 'active' AND lower(u.email) = w.email
    JOIN locations c ON c.id = r.location_id
    WHERE r.used_at IS NULL AND r.available_from <= ${now.toISOString()}::timestamptz AND r.ends_at > ${now.toISOString()}::timestamptz
      AND NOT EXISTS (SELECT 1 FROM waitlist_rewards used WHERE used.user_id = ${userId}::uuid AND used.used_at IS NOT NULL)
      ${listingId ? sql`AND r.location_id = (SELECT coalesce(g.launch_with_id, g.id) FROM listings l JOIN locations g ON g.id = l.location_id WHERE l.id = ${listingId}::uuid)` : sql``}
    ORDER BY r.ends_at, r.id`);
  return rows.map((r) => ({ id: r.id, cityFa: r.city_fa, endsAt: new Date(r.ends_at) }));
}

export type RewardUse = { ok: true } | { ok: false; reason: 'none' | 'not_allowed' | 'other_city' };

/**
 * Uses the reward that ends first on one of the person's own live listings in the reward's city
 * (not an event: those have their own «رویداد ویژه»). The bump job applies it.
 */
export async function useReward(db: Queryable, opts: { userId: string; listingId: string; now?: Date }): Promise<RewardUse> {
  const now = opts.now ?? new Date();
  const [listing] = await db.execute<{ id: string }>(sql`
    SELECT l.id FROM listings l
    WHERE l.id = ${opts.listingId}::uuid AND l.user_id = ${opts.userId}::uuid AND l.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`);
  if (!listing) return { ok: false, reason: 'not_allowed' };
  const [reward] = await usableRewards(db, opts.userId, now, listing.id);
  if (!reward) return { ok: false, reason: (await usableRewards(db, opts.userId, now)).length ? 'other_city' : 'none' };
  const used = await db.execute(sql`
    UPDATE waitlist_rewards SET used_at = ${now.toISOString()}::timestamptz, user_id = ${opts.userId}::uuid, listing_id = ${listing.id}::uuid
    WHERE id = ${reward.id}::uuid AND used_at IS NULL
    RETURNING 1`);
  return used.length ? { ok: true } : { ok: false, reason: 'none' };
}

/**
 * Worker, hourly: "your free bump is ready" to each rewarded signup, once, at 9:00 on the city's
 * clock from day 3. The email goes to the address they signed up with.
 */
export async function sendRewardNotices(db: Queryable, mail: Mailer, appUrl: string, now: Date = new Date()): Promise<number> {
  const rows = await db.execute<{ id: string; email: string; city_fa: string; ends_at: Date; timezone: string }>(sql`
    SELECT r.id, w.email, c.name_fa AS city_fa, r.ends_at, coalesce(c.timezone, ${DEFAULT_ZONE}) AS timezone
    FROM waitlist_rewards r
    JOIN city_waitlist w ON w.id = r.waitlist_id
    JOIN locations c ON c.id = r.location_id
    WHERE r.notified_at IS NULL AND r.used_at IS NULL
      AND r.available_from <= ${now.toISOString()}::timestamptz AND r.ends_at > ${now.toISOString()}::timestamptz
      AND ${localHourSql(sql`coalesce(c.timezone, ${DEFAULT_ZONE})`, now, 9)}
    ORDER BY r.available_from, r.id
    LIMIT 500`);
  const t = messages.email.waitlistReward;
  const link = `${appUrl.replace(/\/$/, '')}/my/listings`;
  let sent = 0;
  for (const r of rows) {
    // Marked first, so a retried run never sends twice
    const claimed = await db.execute(sql`UPDATE waitlist_rewards SET notified_at = ${now.toISOString()}::timestamptz WHERE id = ${r.id}::uuid AND notified_at IS NULL RETURNING 1`);
    if (!claimed.length) continue;
    // The last day it can be used (it ends at midnight after it)
    const until = formatDate(new Date(new Date(r.ends_at).getTime() - 1), r.timezone);
    try {
      await mail({
        to: r.email,
        subject: t.subject,
        text: t.text(r.city_fa, until, link),
        html: emailHtml(
          `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(t.intro(r.city_fa))}</p>
<p style="margin:0 0 16px">${escapeHtml(t.body(r.city_fa, until))}</p>
<p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.button)}</a></p>
<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(t.footer(r.city_fa))}</p>`,
        ),
      });
      sent++;
    } catch (e) {
      // Free it again for the next hour's run (the city's 9:00 comes again tomorrow)
      await db.execute(sql`UPDATE waitlist_rewards SET notified_at = NULL WHERE id = ${r.id}::uuid`);
      console.error('waitlist-reward: send failed:', e instanceof Error ? e.message : e);
      reportError(e, { tags: { job: 'reward-notices' } });
    }
  }
  return sent;
}
