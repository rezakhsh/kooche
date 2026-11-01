import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { outboxEvents } from '../../db/schema';
import { messages } from '../../messages/fa';
import { emailHtml, escapeHtml, type Mailer } from '../notifications/mailer';
import { isUnreachable, type TelegramClient } from '../notifications/telegram-api';
import { isUnreachableMarked, markUnreachable } from '../notifications/telegram-reach';
import { onceFor } from '../notifications/send-once';

// Notices to a business's owner when staff change something about the business (owner's rule,
// Oct 26, 2026: users are always told, both ways). Verified, badge removed, rejected, founding.
// Suspensions already go through the moderation notices. Written to the outbox in the staff
// action's transaction; the worker (queue `payments`) sends an email and, when the owner has
// linked the bot and it can reach them, a Telegram message. Telegram never stops the email.

export const BUSINESS_NOTICE = 'organization.notice';
export const BUSINESS_NOTICE_KINDS = ['verified', 'unverified', 'rejected', 'founding'] as const;
export type BusinessNoticeKind = (typeof BUSINESS_NOTICE_KINDS)[number];

/** In the staff action's transaction */
export async function queueBusinessNotice(tx: Queryable, organizationId: string, kind: BusinessNoticeKind): Promise<void> {
  await tx.insert(outboxEvents).values({ eventType: BUSINESS_NOTICE, aggregateType: 'organization', aggregateId: organizationId, payload: { kind } });
}

/** Worker: sends one notice. Returns what went out (nothing for a deleted business or owner). */
export async function sendBusinessNotice(
  db: Queryable,
  redis: Redis,
  /** `once`: the outbox event's id, so a retried job sends each channel once (../payments/notices.ts) */
  opts: { mail: Mailer; telegram: TelegramClient | null; appUrl: string; once?: string },
  organizationId: string,
  kind: BusinessNoticeKind,
): Promise<{ email: boolean; telegram: boolean }> {
  const [r] = await db.execute<{ name: string; slug: string; email: string; telegram_user_id: string | number | null }>(sql`
    SELECT o.name, o.slug, u.email, u.telegram_user_id
    FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id AND m.role = 'owner'
    JOIN users u ON u.id = m.user_id AND u.status = 'active'
    WHERE o.id = ${organizationId} AND o.status <> 'deleted'
    LIMIT 1`);
  if (!r) return { email: false, telegram: false };
  const t = messages.email.businessNotice[kind];
  const link = `${opts.appUrl}/b/${r.slug}/${kind === 'rejected' || kind === 'unverified' ? 'edit' : 'manage'}`;
  await onceFor(redis, opts.once, 'mail', () =>
    opts.mail({
      to: r.email,
      subject: t.subject(r.name),
      text: `${t.intro(r.name)}\n\n${t.body}\n\n${link}`,
      html: emailHtml(
        `<p>${escapeHtml(t.intro(r.name))}</p><p>${escapeHtml(t.body)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.button)}</a></p>`,
      ),
    }),
  );
  let telegram = false;
  const tg = r.telegram_user_id === null ? null : Number(r.telegram_user_id);
  const bot = opts.telegram;
  if (bot && tg !== null && !(await isUnreachableMarked(redis, tg))) {
    await onceFor(redis, opts.once, 'tg', async () => {
      try {
        await bot.sendMessage(tg, `${t.intro(r.name)}\n\n${t.body}`, { inline_keyboard: [[{ text: t.button, url: link }]] });
        telegram = true;
      } catch (e) {
        if (isUnreachable(e)) await markUnreachable(redis, tg);
        console.error('business notice: telegram failed:', e instanceof Error ? e.message : e);
      }
    });
  }
  return { email: true, telegram };
}

/** The kind of a stored outbox payload, or null for anything unexpected */
export function noticeKind(payload: Record<string, unknown>): BusinessNoticeKind | null {
  const k = payload.kind;
  return typeof k === 'string' && (BUSINESS_NOTICE_KINDS as readonly string[]).includes(k) ? (k as BusinessNoticeKind) : null;
}
