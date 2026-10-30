import type { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { cachedCatalog } from '../listings/catalog';
import { emailHtml, escapeHtml, type Mail } from '../notifications/mailer';
import { isUnreachableMarked } from '../notifications/telegram-reach';
import type { ReplyMarkup } from '../users/telegram-bot';
import { eventsPath } from '../search/paths';
import { DEFAULT_TIME_ZONE, eventsCityOf, noticeChannels, quietDelay, quietHoursOn, type NoticeChannel, type NoticeKind } from '../users/notification-prefs';
import { eventPriceText, formatEventStart } from './format';
import { upcomingEvents, whenWindow } from './queries';
import { eventPath } from './slug';

// Event notices (wave 1, part 6), all through the shared send queues as ready-written messages
// (`plain_telegram`, `plain_email`, src/worker/chat.ts), by the person's switches
// (src/modules/users/notification-prefs.ts) and never in their quiet hours:
// - reminders: a saved event the day before (12 to 36 hours ahead, the first hourly run outside
//   quiet hours); favorites.reminded_for marks the date it went out for, so it goes once per date;
// - follows: a followed business's new event, at most FOLLOW_NEWS_PER_DAY a day per person;
// - weekly: «رویدادهای این هفته در شهر» on Monday mornings for those who asked («خبرم کن»).

export const FOLLOW_NEWS_PER_DAY = 2;
const WEEKLY_ITEMS = 6;
const BUTTON_TITLE = 60;

export type Recipient = { userId: string; email: string; telegramUserId: number | null; prefs: unknown; timeZone: string };
export type Outgoing = { telegram?: { telegramUserId: number; text: string; replyMarkup?: ReplyMarkup }; mail?: Mail };

type UserRow = { user_id: string; email: string; telegram_user_id: string | null; prefs: unknown; tz: string | null };

const recipient = (r: UserRow): Recipient => ({
  userId: r.user_id,
  email: r.email,
  telegramUserId: r.telegram_user_id === null ? null : Number(r.telegram_user_id),
  prefs: r.prefs,
  timeZone: r.tz ?? DEFAULT_TIME_ZONE,
});

/** Where a notice of this kind goes for this person now (empty: nowhere) */
export async function channelsFor(redis: Redis, r: Recipient, kind: NoticeKind): Promise<NoticeChannel[]> {
  const ready = r.telegramUserId !== null && !(await isUnreachableMarked(redis, r.telegramUserId).catch(() => false));
  return noticeChannels(r.prefs, kind, ready);
}

/** Whether it is the person's quiet time now */
export function isQuiet(r: Recipient, now: Date): boolean {
  return quietHoursOn(r.prefs) && quietDelay(now, r.timeZone) > 0;
}

const short = (s: string) => (s.length > BUTTON_TITLE ? `${s.slice(0, BUTTON_TITLE - 1)}…` : s);

type EventLine = { title: string; url: string; when: string; where: string | null };

/** One message in both forms; the email only by `channels` */
function compose(
  r: Recipient,
  channels: NoticeChannel[],
  c: { subject: string; intro: string; items: EventLine[]; button: { text: string; url: string }; footer: string; manageUrl: string },
): Outgoing {
  const out: Outgoing = {};
  const t = messages.events.notices;
  if (channels.includes('telegram') && r.telegramUserId !== null) {
    out.telegram = {
      telegramUserId: r.telegramUserId,
      text: [c.intro, ...c.items.map((i) => `• ${i.title}\n${i.when}${i.where ? `، ${i.where}` : ''}`)].join('\n\n'),
      replyMarkup: {
        inline_keyboard: [...c.items.map((i) => [{ text: short(i.title), url: i.url }]), ...(c.items.length > 1 ? [[{ text: c.button.text, url: c.button.url }]] : [])],
      },
    };
  }
  if (channels.includes('email')) {
    out.mail = {
      to: r.email,
      subject: c.subject,
      text: `${c.intro}\n\n${c.items.map((i) => `• ${i.title}\n  ${i.when}${i.where ? `، ${i.where}` : ''}\n  ${i.url}`).join('\n')}\n\n${c.button.text}: ${c.button.url}\n\n${c.footer}\n${t.manage}: ${c.manageUrl}`,
      html: emailHtml(
        `<p style="margin:0 0 12px;font-size:16px">${escapeHtml(c.intro)}</p>
<ul style="margin:0 0 16px;padding:0 20px 0 0">${c.items
          .map(
            (i) =>
              `<li style="margin:0 0 10px"><a href="${escapeHtml(i.url)}" style="color:#0b6e77;font-weight:bold">${escapeHtml(i.title)}</a><br><span style="font-size:13px;color:#525252">${escapeHtml(`${i.when}${i.where ? `، ${i.where}` : ''}`)}</span></li>`,
          )
          .join('')}</ul>
<p style="margin:0 0 16px"><a href="${escapeHtml(c.button.url)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(c.button.text)}</a></p>
<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(c.footer)} <a href="${escapeHtml(c.manageUrl)}" style="color:#0b6e77">${escapeHtml(t.manage)}</a></p>`,
      ),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------------------------

export type DueReminder = Recipient & { listingId: string; startsAt: Date; line: EventLine };

/** Saved events with a date 12 to 36 hours ahead that hasn't had its reminder */
export async function dueReminders(db: Queryable, appUrl: string, now = new Date()): Promise<DueReminder[]> {
  const rows = await db.execute<
    UserRow & { listing_id: string; title: string; public_token: string; starts_at: Date; time_zone: string; venue_name: string | null; city_fa: string | null; attendance: string }
  >(sql`
    SELECT DISTINCT ON (f.listing_id, f.user_id)
           f.listing_id, f.user_id, u.email, u.telegram_user_id, u.notification_prefs AS prefs,
           (SELECT h.timezone FROM locations h WHERE h.id = u.home_location_id) AS tz,
           l.title, l.public_token, d.starts_at, e.time_zone, e.venue_name, e.attendance, c.name_fa AS city_fa
    FROM event_dates d
    JOIN favorites f ON f.listing_id = d.listing_id
    JOIN listings l ON l.id = d.listing_id AND l.status = 'active'
    JOIN event_details e ON e.listing_id = l.id AND e.schedule_status <> 'cancelled'
    JOIN users u ON u.id = f.user_id AND u.status = 'active'
    LEFT JOIN locations c ON c.id = l.location_id
    WHERE d.starts_at > ${new Date(now.getTime() + 12 * 3_600_000).toISOString()}::timestamptz
      AND d.starts_at <= ${new Date(now.getTime() + 36 * 3_600_000).toISOString()}::timestamptz
      AND f.reminded_for IS DISTINCT FROM d.starts_at
    ORDER BY f.listing_id, f.user_id, d.starts_at
    LIMIT 5000`);
  const base = appUrl.replace(/\/$/, '');
  return rows.map((r) => ({
    ...recipient(r),
    listingId: r.listing_id,
    startsAt: new Date(r.starts_at),
    line: {
      title: r.title,
      url: `${base}${eventPath(r.title, r.public_token)}`,
      when: formatEventStart(new Date(r.starts_at), r.time_zone),
      where: r.attendance === 'online' ? messages.events.card.online : [r.venue_name, r.city_fa].filter(Boolean).join('، ') || null,
    },
  }));
}

/** Marks the reminder sent; false when another run did already (nothing to send then) */
export async function claimReminder(db: Queryable, listingId: string, userId: string, startsAt: Date): Promise<boolean> {
  const rows = await db.execute(sql`
    UPDATE favorites SET reminded_for = ${startsAt.toISOString()}::timestamptz
    WHERE listing_id = ${listingId} AND user_id = ${userId} AND reminded_for IS DISTINCT FROM ${startsAt.toISOString()}::timestamptz
    RETURNING 1`);
  return rows.length > 0;
}

export function reminderMessage(r: DueReminder, channels: NoticeChannel[], appUrl: string): Outgoing {
  const t = messages.events.notices;
  const base = appUrl.replace(/\/$/, '');
  return compose(r, channels, {
    subject: t.reminderSubject(r.line.title),
    intro: t.reminderIntro,
    items: [r.line],
    button: { text: t.open, url: r.line.url },
    footer: t.reminderFooter,
    manageUrl: `${base}/account/notifications`,
  });
}

// ---------------------------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------------------------

export type FollowNews = { listingId: string; organizationName: string; line: EventLine; followers: Recipient[] };

/**
 * A business's new event and who follows it (not its own members). Null when the listing is no
 * live event of a business.
 */
export async function followNews(db: Queryable, listingId: string, appUrl: string, now = new Date()): Promise<FollowNews | null> {
  const [ev] = await db.execute<{ id: string; title: string; public_token: string; organization_id: string; name: string; time_zone: string; venue_name: string | null; attendance: string; city_fa: string | null; starts_at: Date | null }>(sql`
    SELECT l.id, l.title, l.public_token, l.organization_id, o.name, e.time_zone, e.venue_name, e.attendance, c.name_fa AS city_fa,
           (SELECT min(d.starts_at) FROM event_dates d WHERE d.listing_id = l.id AND d.ends_at > ${now.toISOString()}::timestamptz) AS starts_at
    FROM listings l
    JOIN event_details e ON e.listing_id = l.id AND e.schedule_status = 'scheduled'
    JOIN organizations o ON o.id = l.organization_id AND o.status = 'active'
    LEFT JOIN locations c ON c.id = l.location_id
    WHERE l.id = ${listingId} AND l.status = 'active'`);
  if (!ev?.starts_at) return null;
  const rows = await db.execute<UserRow>(sql`
    SELECT u.id AS user_id, u.email, u.telegram_user_id, u.notification_prefs AS prefs,
           (SELECT h.timezone FROM locations h WHERE h.id = u.home_location_id) AS tz
    FROM organization_follows f
    JOIN users u ON u.id = f.user_id AND u.status = 'active'
    WHERE f.organization_id = ${ev.organization_id}
      AND NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = f.organization_id AND m.user_id = f.user_id)`);
  const base = appUrl.replace(/\/$/, '');
  return {
    listingId: ev.id,
    organizationName: ev.name,
    line: {
      title: ev.title,
      url: `${base}${eventPath(ev.title, ev.public_token)}`,
      when: formatEventStart(new Date(ev.starts_at), ev.time_zone),
      where: ev.attendance === 'online' ? messages.events.card.online : [ev.venue_name, ev.city_fa].filter(Boolean).join('، ') || null,
    },
    followers: rows.map(recipient),
  };
}

/** Counts one follow notice for the person today; false past the day's limit */
export async function takeFollowSlot(redis: Redis, userId: string, now: Date, timeZone: string): Promise<boolean> {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const key = `event-follow-news:${userId}:${day}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 2 * 86_400);
  return n <= FOLLOW_NEWS_PER_DAY;
}

export function followMessage(n: FollowNews, r: Recipient, channels: NoticeChannel[], appUrl: string): Outgoing {
  const t = messages.events.notices;
  return compose(r, channels, {
    subject: t.followSubject(n.organizationName),
    intro: t.followIntro(n.organizationName),
    items: [n.line],
    button: { text: t.open, url: n.line.url },
    footer: t.followFooter(n.organizationName),
    manageUrl: `${appUrl.replace(/\/$/, '')}/account/notifications`,
  });
}

// ---------------------------------------------------------------------------------------------
// This week in the city
// ---------------------------------------------------------------------------------------------

export type WeeklyRecipient = Recipient & { cityId: string };

/** People with the weekly message on, and their city (chosen, else their saved place's) */
export async function weeklyRecipients(db: Queryable): Promise<WeeklyRecipient[]> {
  const rows = await db.execute<UserRow & { home_city: string | null }>(sql`
    SELECT u.id AS user_id, u.email, u.telegram_user_id, u.notification_prefs AS prefs,
           h.timezone AS tz, h.id AS home_city
    FROM users u
    LEFT JOIN locations h ON h.id = u.home_location_id
    WHERE u.status = 'active'
      AND (u.notification_prefs #>> '{channels,events,telegram}' = 'true' OR u.notification_prefs #>> '{channels,events,email}' = 'true')`);
  return rows.flatMap((r) => {
    const cityId = eventsCityOf(r.prefs) ?? r.home_city;
    return cityId ? [{ ...recipient(r), cityId }] : [];
  });
}

/** The cities' time zones: the weekly message goes out at 9:00 on each city's clock (wave 2 part 7) */
export async function cityZones(db: Queryable, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.execute<{ id: string; timezone: string }>(sql`
    SELECT id, timezone FROM locations WHERE id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
  return new Map(rows.map((r) => [r.id, r.timezone]));
}

/** This week's message for one city, or null when nothing is on there */
export async function weeklyMessageFor(
  db: Queryable,
  cityId: string,
  appUrl: string,
  now = new Date(),
): Promise<{ build: (r: Recipient, channels: NoticeChannel[]) => Outgoing } | null> {
  const [city] = await db.execute<{ id: string; slug: string; name_fa: string; country_code: string; timezone: string; country_slug: string }>(sql`
    SELECT c.id, c.slug, c.name_fa, c.country_code, c.timezone, k.slug AS country_slug
    FROM locations c JOIN countries k ON k.code = c.country_code AND k.is_active
    WHERE c.id = ${cityId} AND c.kind = 'city'`);
  if (!city) return null;
  const window = whenWindow('week', now, city.timezone);
  const { items } = await upcomingEvents(db, { countryCode: city.country_code, locationId: city.id, ...window }, now, 50);
  const live = items.filter((e) => e.scheduleStatus !== 'cancelled');
  if (!live.length) return null;
  const catalog = await cachedCatalog(db);
  const base = appUrl.replace(/\/$/, '');
  const t = messages.events.notices;
  const lines: EventLine[] = live.slice(0, WEEKLY_ITEMS).map((e) => {
    const currency = e.currency ? catalog.currencies.get(e.currency) : undefined;
    const price = eventPriceText(e.priceType, e.priceMinor !== null && currency ? { minor: e.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null);
    return {
      title: e.title,
      url: `${base}${eventPath(e.title, e.publicToken)}`,
      when: formatEventStart(e.startsAt, e.timeZone),
      where: [e.attendance === 'online' ? messages.events.card.online : e.venueName, price].filter(Boolean).join('، ') || null,
    };
  });
  const listUrl = `${base}${eventsPath(city.country_slug, city.slug)}`;
  return {
    build: (r, channels) =>
      compose(r, channels, {
        subject: t.weeklySubject(city.name_fa, live.length),
        intro: t.weeklyIntro(city.name_fa, live.length),
        items: lines,
        button: { text: t.weeklyAll(live.length), url: listUrl },
        footer: t.weeklyFooter,
        manageUrl: `${base}/account/notifications`,
      }),
  };
}
