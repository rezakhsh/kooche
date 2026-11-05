import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { outboxEvents } from '../../db/schema';
import { formatDateTime } from '../../lib/format';
import { messages } from '../../messages/fa';
import { emailHtml, escapeHtml, type Mail, type Mailer } from '../notifications/mailer';
import { onceFor, sendOnce } from '../notifications/send-once';
import { isUnreachable, type TelegramClient } from '../notifications/telegram-api';
import { isUnreachableMarked, markUnreachable } from '../notifications/telegram-reach';
import { DEFAULT_TIME_ZONE } from './notification-prefs';
import { personZoneSql } from './time-zone';

// Notices about a person's own account (check B part 6, Nov 2, 2026: every action that changes
// something for someone tells them): their team (an invitation they sent was accepted or turned
// down, their role changed, they were removed, a former member's listings passed to them), their
// phone number confirmed («شما نبودید؟»), a timed restriction that ran out by itself. Written to
// the outbox in the action's transaction with the person told as the aggregate; the worker (queue
// `accounts`) sends an email and, except for the phone notice, Telegram when the bot can reach
// them. Each channel once per notice. The goodbye email after «حذف حساب» goes out from the erase
// job itself, just before the address is wiped (goodbyeMail).

export const ACCOUNT_NOTICE = 'account.notice';

const role = z.enum(['owner', 'manager', 'staff']);
const payloadSchema = z.discriminatedUnion('kind', [
  // To the owner who sent the invitation
  z.object({ kind: z.literal('invite_accepted'), invitationId: z.uuid() }),
  z.object({ kind: z.literal('invite_declined'), invitationId: z.uuid() }),
  // To the member an owner changed («مالک» has its own text)
  z.object({ kind: z.literal('role_changed'), organizationId: z.uuid(), role }),
  z.object({ kind: z.literal('removed'), organizationId: z.uuid() }),
  // To the owner who got a former member's listings and events (../organizations/members.ts, handOver)
  z.object({ kind: z.literal('listings_handed'), organizationId: z.uuid(), fromUserId: z.uuid(), count: z.int().positive() }),
  z.object({ kind: z.literal('phone_verified'), telegram: z.boolean() }),
  z.object({ kind: z.literal('sanction_ended'), sanctionId: z.uuid(), type: z.enum(['suspended', 'posting_restricted', 'messaging_restricted']) }),
]);
export type AccountNotice = z.infer<typeof payloadSchema>;

/** In the action's transaction; `userId`: the person told */
export async function queueAccountNotice(tx: Queryable, userId: string, notice: AccountNotice): Promise<void> {
  await tx.insert(outboxEvents).values({ eventType: ACCOUNT_NOTICE, aggregateType: 'user', aggregateId: userId, payload: notice });
}

export function parseAccountNotice(payload: Record<string, unknown>): AccountNotice | null {
  const r = payloadSchema.safeParse(payload);
  return r.success ? r.data : null;
}

type Deps = { mail: Mailer; telegram: TelegramClient | null; appUrl: string; once?: string };
type Content = { subject: string; lines: string[]; button: string; link: string; telegram: boolean };
type Person = { email: string; telegram_user_id: string | number | null; phone_e164: string | null; phone_verified_at: Date | null; tz: string };

/** "+49 ••• 12": enough to recognise one's own number, not enough to read it */
export function maskedPhone(e164: string): string {
  const cc = /^\+(1|7|\d{2})/.exec(e164)?.[0] ?? '+';
  return `${cc} ••• ${e164.slice(-2)}`;
}

/** The text of one notice for this person, or null when what it is about is gone */
async function content(db: Queryable, appUrl: string, p: Person, n: AccountNotice): Promise<Content | null> {
  const t = messages.email.accountNotice;
  const roles = messages.business.roles;
  const org = async (id: string) =>
    (await db.execute<{ name: string; slug: string }>(sql`SELECT name, slug FROM organizations WHERE id = ${id} AND status <> 'deleted'`))[0] ?? null;
  switch (n.kind) {
    case 'invite_accepted':
    case 'invite_declined': {
      const [i] = await db.execute<{ email: string; role: 'manager' | 'staff'; name: string; slug: string; member: string | null }>(sql`
        SELECT i.email, i.role, o.name, o.slug, u.display_name AS member
        FROM organization_invitations i
        JOIN organizations o ON o.id = i.organization_id AND o.status <> 'deleted'
        LEFT JOIN users u ON u.id = i.accepted_by_user_id AND u.status = 'active'
        WHERE i.id = ${n.invitationId}`);
      if (!i) return null;
      const link = `${appUrl}/b/${i.slug}/team`;
      if (n.kind === 'invite_accepted') {
        const c = t.inviteAccepted;
        const who = i.member ?? i.email;
        return { subject: c.subject(who, i.name), lines: [c.intro(who, i.name, roles[i.role]), c.body], button: c.button, link, telegram: true };
      }
      const c = t.inviteDeclined;
      return { subject: c.subject(i.name), lines: [c.intro(i.email, i.name), c.body], button: c.button, link, telegram: true };
    }
    case 'role_changed': {
      const o = await org(n.organizationId);
      if (!o) return null;
      if (n.role === 'owner') {
        const c = t.madeOwner;
        return { subject: c.subject(o.name), lines: [c.intro(o.name), c.body], button: c.button, link: `${appUrl}/b/${o.slug}/manage`, telegram: true };
      }
      const c = t.roleChanged;
      return { subject: c.subject(o.name), lines: [c.intro(o.name, roles[n.role]), c.body[n.role]], button: c.button, link: `${appUrl}/b/${o.slug}/manage`, telegram: true };
    }
    case 'removed': {
      const o = await org(n.organizationId);
      if (!o) return null;
      const c = t.removed;
      return { subject: c.subject(o.name), lines: [c.intro(o.name), c.body], button: c.button, link: `${appUrl}/my/listings`, telegram: true };
    }
    case 'listings_handed': {
      const o = await org(n.organizationId);
      if (!o) return null;
      const [from] = await db.execute<{ name: string }>(sql`SELECT display_name AS name FROM users WHERE id = ${n.fromUserId} AND status = 'active'`);
      const c = t.listingsHanded;
      return {
        subject: c.subject(n.count, o.name),
        lines: [c.intro(from?.name ?? null, o.name, n.count), c.body],
        button: c.button,
        link: `${appUrl}/b/${o.slug}/manage`,
        telegram: true,
      };
    }
    case 'phone_verified': {
      // A number removed again since (staff, or a later change) needs no warning about it
      if (!p.phone_e164 || !p.phone_verified_at) return null;
      const c = t.phoneVerified;
      return {
        subject: c.subject,
        lines: [c.intro(maskedPhone(p.phone_e164), formatDateTime(new Date(p.phone_verified_at), p.tz), n.telegram), c.body],
        button: c.button,
        link: `${appUrl}/account/devices`,
        // Whoever did it may hold the Telegram account now: the email is the warning
        telegram: false,
      };
    }
    case 'sanction_ended': {
      const c = t.sanctionEnded;
      return { subject: c.subject, lines: [c.intro[n.type], c.body], button: c.button, link: `${appUrl}/my/listings`, telegram: true };
    }
  }
}

/** Worker: one account notice. Nothing for an account that is gone or a thing that no longer exists. */
export async function sendAccountNotice(db: Queryable, redis: Redis, deps: Deps, userId: string, notice: AccountNotice): Promise<{ email: boolean; telegram: boolean }> {
  const none = { email: false, telegram: false };
  const [p] = await db.execute<Person>(sql`
    SELECT u.email, u.telegram_user_id, u.phone_e164, u.phone_verified_at,
      coalesce(${personZoneSql()}, ${DEFAULT_TIME_ZONE}) AS tz
    FROM users u WHERE u.id = ${userId} AND u.status = 'active'`);
  if (!p) return none;
  const c = await content(db, deps.appUrl.replace(/\/$/, ''), p, notice);
  if (!c) return none;
  await onceFor(redis, deps.once, 'mail', () =>
    deps.mail({
      to: p.email,
      subject: c.subject,
      text: [...c.lines, c.link].join('\n\n'),
      html: emailHtml(
        `${c.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}<p><a href="${escapeHtml(c.link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(c.button)}</a></p>`,
      ),
    }),
  );
  let telegram = false;
  const tg = p.telegram_user_id === null ? null : Number(p.telegram_user_id);
  const bot = deps.telegram;
  if (c.telegram && bot && tg !== null && !(await isUnreachableMarked(redis, tg))) {
    // A failed Telegram copy is dropped (the email went), so it is marked like a sent one
    await onceFor(redis, deps.once, 'tg', async () => {
      try {
        await bot.sendMessage(tg, c.lines.join('\n\n'), { inline_keyboard: [[{ text: c.button, url: c.link }]] });
        telegram = true;
      } catch (e) {
        if (isUnreachable(e)) await markUnreachable(redis, tg);
        console.error('account notice: telegram failed:', e instanceof Error ? e.message : e);
      }
    });
  }
  return { email: true, telegram };
}

/**
 * Timed restrictions that ran out by themselves in the last two days and weren't told yet: one
 * notice each, unless another restriction of the same kind still holds or the suspension's
 * listings came back (that decision told them already, ../moderation/decide.ts). Worker, every
 * 15 minutes after restoreAfterSuspensions; the outbox row is the mark (kept 7 days).
 */
export async function queueEndedSanctionNotices(db: Queryable, now: Date = new Date()): Promise<number> {
  const at = now.toISOString();
  const rows = await db.execute<{ id: string; user_id: string; type: 'suspended' | 'posting_restricted' | 'messaging_restricted' }>(sql`
    SELECT s.id, s.user_id, s.type FROM user_sanctions s
    JOIN users u ON u.id = s.user_id AND u.status = 'active'
    WHERE s.type IN ('suspended', 'posting_restricted', 'messaging_restricted')
      AND s.revoked_at IS NULL AND s.ends_at <= ${at}::timestamptz AND s.ends_at > ${at}::timestamptz - interval '2 days'
      AND NOT EXISTS (
        SELECT 1 FROM user_sanctions o WHERE o.user_id = s.user_id AND o.type = s.type AND o.id <> s.id AND o.revoked_at IS NULL
          AND o.starts_at <= ${at}::timestamptz AND (o.ends_at IS NULL OR o.ends_at > ${at}::timestamptz))
      AND NOT EXISTS (SELECT 1 FROM moderation_decisions d WHERE d.user_id = s.user_id AND d.ai_output->>'sanctionId' = s.id::text)
      AND NOT EXISTS (SELECT 1 FROM outbox_events e WHERE e.event_type = ${ACCOUNT_NOTICE} AND e.aggregate_id = s.user_id AND e.payload->>'sanctionId' = s.id::text)
    LIMIT 500`);
  for (const r of rows) await queueAccountNotice(db, r.user_id, { kind: 'sanction_ended', sanctionId: r.id, type: r.type });
  return rows.length;
}

/** «حساب شما حذف شد», to the address the account still has; null when there is nothing to send */
export async function goodbyeMail(db: Queryable, userId: string, appUrl: string): Promise<Mail | null> {
  const [u] = await db.execute<{ email: string }>(sql`SELECT email FROM users WHERE id = ${userId} AND status = 'deactivated'`);
  if (!u) return null;
  const t = messages.email.accountNotice.goodbye;
  const link = appUrl.replace(/\/$/, '');
  return {
    to: u.email,
    subject: t.subject,
    text: [t.intro, t.kept, t.notYou, link].join('\n\n'),
    html: emailHtml(`<p>${escapeHtml(t.intro)}</p><p>${escapeHtml(t.kept)}</p><p>${escapeHtml(t.notYou)}</p>`),
  };
}

/**
 * The erase job's goodbye, once per request (`key`: the outbox event). A failure is only logged:
 * the deletion never waits for an email.
 */
export async function sendGoodbye(db: Queryable, redis: Redis, mail: Mailer, appUrl: string, userId: string, key: string): Promise<boolean> {
  try {
    const m = await goodbyeMail(db, userId, appUrl);
    return m ? await sendOnce(redis, `goodbye_${key}`, () => mail(m)) : false;
  } catch (e) {
    console.error('accounts: goodbye email failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
