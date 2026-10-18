import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { isViewing } from '../chat/presence';
import { chatNoticesOn } from '../users/notification-prefs';
import type { ReplyMarkup } from '../users/telegram-bot';
import { emailHtml, escapeHtml, type Mail } from './mailer';
import { isUnreachableMarked } from './telegram-reach';

// "New message from X about Y" (approved Oct 18, 2026; docs/setup.md, "Chat"). On `message.sent`
// the worker checks at once and again after NOTICE_DELAY_MS whether the receiver still needs a
// notice; someone who reads within that time gets none. Telegram first when the account is
// linked to the bot and the bot can reach it, else email. At most one notice per conversation
// per receiver per DEBOUNCE_SECONDS[channel]. The notice carries no message text: scam text and
// personal data stay out of Telegram and email.

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
};

async function facts(db: Queryable, job: NoticeJob): Promise<Facts | undefined> {
  const [row] = await db.execute<Facts>(sql`
    SELECT c.status, m.created_at,
           CASE WHEN c.buyer_user_id = ${job.recipientId} THEN c.buyer_last_read_at ELSE c.seller_last_read_at END AS read_at,
           u.status AS user_status, u.email, u.telegram_user_id, u.notification_prefs AS prefs,
           s.display_name AS sender_name, l.title
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

function skipFor(f: Facts | undefined): SkipReason | null {
  if (!f) return 'gone';
  if (f.user_status !== 'active') return 'recipient_inactive';
  if (!chatNoticesOn(f.prefs)) return 'turned_off';
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
 * The check after the delay. When a notice is due it takes the debounce slot for its channel and
 * returns the channel; the send queues do the rest.
 */
export async function decideNotice(
  db: Queryable,
  redis: Redis,
  job: NoticeJob,
): Promise<{ channel: Channel } | { skip: SkipReason }> {
  const f = await facts(db, job);
  const skip = skipFor(f);
  if (skip) return { skip };
  if (await isViewing(redis, job.recipientId, job.conversationId)) return { skip: 'viewing' };

  const tg = f!.telegram_user_id === null ? null : Number(f!.telegram_user_id);
  const channel: Channel = tg !== null && !(await isUnreachableMarked(redis, tg)) ? 'telegram' : 'email';
  const slot = await redis.set(`notice:${job.conversationId}:${job.recipientId}`, channel, 'EX', DEBOUNCE_SECONDS[channel], 'NX');
  if (slot !== 'OK') return { skip: 'debounced' };
  return { channel };
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
