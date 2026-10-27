import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { isViewing } from '../chat/presence';
import { DEFAULT_TIME_ZONE, noticeChannels, noticeSwitches, quietDelay, quietHoursOn, type NoticeKind } from '../users/notification-prefs';
import type { ReplyMarkup } from '../users/telegram-bot';
import { emailHtml, escapeHtml, type Mail } from './mailer';
import { isUnreachableMarked } from './telegram-reach';

// "New message from X about Y" (approved Oct 18, 2026; docs/setup.md, "Chat"). On `message.sent`
// the worker checks at once and again after NOTICE_DELAY_MS whether the receiver still needs a
// notice; someone who reads within that time gets none. Where it goes follows the receiver's
// switches (wave 1, src/modules/users/notification-prefs.ts): the first message about one of
// their listings is a `reply`, the rest `chat`; by default Telegram when the bot can reach them,
// else email. During their quiet hours it waits for the morning (and is dropped if read by then).
// At most one notice per conversation per receiver per channel per DEBOUNCE_SECONDS[channel].
// The notice carries no message text: scam text and personal data stay out of Telegram and email.

export const NOTICE_DELAY_MS = 20_000;
export const DEBOUNCE_SECONDS = { telegram: 5 * 60, email: 15 * 60 } as const;

export type Channel = 'telegram' | 'email';
export type NoticeJob = { conversationId: string; messageId: string; recipientId: string };

export type NoticeContent = {
  recipientId: string;
  email: string;
  telegramUserId: number | null;
  senderName: string;
  listingTitle: string;
  url: string;
  settingsUrl: string;
};

export type SkipReason =
  | 'gone'
  | 'recipient_inactive'
  | 'turned_off'
  | 'conversation_not_open'
  | 'already_read'
  | 'viewing'
  | 'debounced';

export type NoticeOptions = { now?: Date; /** Quiet hours for people without a saved place */ timeZone?: string };

type Facts = {
  status: string;
  created_at: Date | string;
  read_at: Date | string | null;
  user_status: string;
  email: string;
  telegram_user_id: string | number | null;
  prefs: unknown;
  sender_name: string;
  title: string;
  /** The first message of the conversation, to the seller: a `reply` to their listing */
  first: boolean;
  /** The time zone of the receiver's saved place */
  tz: string | null;
};

async function facts(db: Queryable, job: NoticeJob): Promise<Facts | undefined> {
  const [row] = await db.execute<Facts>(sql`
    SELECT c.status, m.created_at,
           CASE WHEN c.buyer_user_id = ${job.recipientId} THEN c.buyer_last_read_at ELSE c.seller_last_read_at END AS read_at,
           u.status AS user_status, u.email, u.telegram_user_id, u.notification_prefs AS prefs,
           s.display_name AS sender_name, l.title,
           (c.seller_user_id = ${job.recipientId} AND NOT EXISTS (
             SELECT 1 FROM messages p WHERE p.conversation_id = c.id AND p.kind = 'text' AND (p.created_at, p.id) < (m.created_at, m.id))) AS first,
           (SELECT h.timezone FROM locations h WHERE h.id = u.home_location_id) AS tz
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN users u ON u.id = ${job.recipientId}
    JOIN users s ON s.id = m.sender_user_id
    JOIN listings l ON l.id = c.listing_id
    WHERE m.id = ${job.messageId} AND c.id = ${job.conversationId} AND NOT m.withheld
      AND ${job.recipientId} IN (c.buyer_user_id, c.seller_user_id)
  `);
  return row;
}

const kindOf = (f: Facts): NoticeKind => (f.first ? 'reply' : 'chat');

function skipFor(f: Facts | undefined): SkipReason | null {
  if (!f) return 'gone';
  if (f.user_status !== 'active') return 'recipient_inactive';
  const on = noticeSwitches(f.prefs, kindOf(f), true);
  if (!on.telegram && !on.email) return 'turned_off';
  if (f.status !== 'open') return 'conversation_not_open';
  if (f.read_at && new Date(f.created_at) <= new Date(f.read_at)) return 'already_read';
  return null;
}

/** The first check, right after the message: whether a delayed notice is worth scheduling */
export async function planNotice(db: Queryable, redis: Redis, job: NoticeJob): Promise<SkipReason | 'later'> {
  const skip = skipFor(await facts(db, job));
  if (skip) return skip;
  if (await isViewing(redis, job.recipientId, job.conversationId)) return 'viewing';
  return 'later';
}

export function noticeUrls(appUrl: string, conversationId: string) {
  const base = appUrl.replace(/\/$/, '');
  return { url: `${base}/chat/${conversationId}`, settingsUrl: `${base}/account/notifications` };
}

/**
 * The check after the delay. When a notice is due it takes the debounce slot of each channel it
 * goes to and returns them; the send queues do the rest. During quiet hours it answers how long
 * to wait instead.
 */
export async function decideNotice(
  db: Queryable,
  redis: Redis,
  job: NoticeJob,
  opts: NoticeOptions = {},
): Promise<{ channels: Channel[] } | { skip: SkipReason } | { later: number }> {
  const f = await facts(db, job);
  const skip = skipFor(f);
  if (skip) return { skip };
  if (await isViewing(redis, job.recipientId, job.conversationId)) return { skip: 'viewing' };
  if (quietHoursOn(f!.prefs)) {
    const wait = quietDelay(opts.now ?? new Date(), f!.tz ?? opts.timeZone ?? DEFAULT_TIME_ZONE);
    if (wait > 0) return { later: wait };
  }

  const tg = f!.telegram_user_id === null ? null : Number(f!.telegram_user_id);
  const telegramReady = tg !== null && !(await isUnreachableMarked(redis, tg));
  const wanted = noticeChannels(f!.prefs, kindOf(f!), telegramReady);
  if (wanted.length === 0) return { skip: 'turned_off' };
  const channels: Channel[] = [];
  for (const channel of wanted) {
    const slot = await redis.set(`notice:${job.conversationId}:${job.recipientId}:${channel}`, '1', 'EX', DEBOUNCE_SECONDS[channel], 'NX');
    if (slot === 'OK') channels.push(channel);
  }
  return channels.length ? { channels } : { skip: 'debounced' };
}

/** What a notice says, read when it is sent (the name or title may have changed) */
export async function noticeContent(db: Queryable, job: NoticeJob, appUrl: string): Promise<NoticeContent | null> {
  const f = await facts(db, job);
  if (!f || f.user_status !== 'active') return null;
  return {
    recipientId: job.recipientId,
    email: f.email,
    telegramUserId: f.telegram_user_id === null ? null : Number(f.telegram_user_id),
    senderName: f.sender_name,
    listingTitle: f.title,
    ...noticeUrls(appUrl, job.conversationId),
  };
}

export function telegramNotice(c: NoticeContent): { text: string; replyMarkup: ReplyMarkup } {
  const t = messages.chatNotice;
  return {
    text: t.telegram(c.senderName, c.listingTitle),
    replyMarkup: { inline_keyboard: [[{ text: t.open, url: c.url }], [{ text: t.settings, url: c.settingsUrl }]] },
  };
}

export function emailNotice(c: NoticeContent): Mail {
  const t = messages.chatNotice;
  return {
    to: c.email,
    subject: t.subject(c.senderName, c.listingTitle),
    text: t.text(c.senderName, c.listingTitle, c.url, c.settingsUrl),
    html: emailHtml(
      `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(t.intro(c.senderName, c.listingTitle))}</p>
<p style="margin:0 0 16px"><a href="${escapeHtml(c.url)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.open)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#525252">${escapeHtml(t.safety)}</p>
<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(t.footer)} <a href="${escapeHtml(c.settingsUrl)}" style="color:#0b6e77">${escapeHtml(t.settings)}</a></p>`,
    ),
  };
}
