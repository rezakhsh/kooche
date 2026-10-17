import type { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { emailHtml, escapeHtml, type Mailer } from './mailer';

// "Your listing expires in 3 days, renew?" (decided Oct 17, 2026: 30 days, renewable with one
// tap). A daily worker job emails each seller once about their listings that expire between 2
// and 3 days from now. A daily run sees each listing in that window once; a Valkey key per
// listing and expiry stops a retried or doubled run from sending twice. Non-critical: a run that
// fails is not repeated for the same window, and renewing is still possible after expiry.

const GUARD_SECONDS = 6 * 86_400;

type Row = { id: string; title: string; expires_at: Date; user_id: string; email: string; display_name: string };

export async function sendExpiryReminders(
  db: Queryable,
  redis: Redis,
  mail: Mailer,
  appUrl: string,
  now: Date = new Date(),
): Promise<{ emails: number; listings: number }> {
  const from = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const to = new Date(now.getTime() + 3 * 86_400_000).toISOString();
  const rows = await db.execute<Row>(sql`
    SELECT l.id, l.title, l.expires_at, u.id AS user_id, u.email, u.display_name
    FROM listings l JOIN users u ON u.id = l.user_id
    WHERE l.status = 'active' AND l.expires_at > ${from}::timestamptz AND l.expires_at <= ${to}::timestamptz
      AND u.status = 'active'
    ORDER BY u.id, l.expires_at
  `);

  const byUser = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `expiry-reminder:${r.id}:${new Date(r.expires_at).getTime()}`;
    if ((await redis.set(key, '1', 'EX', GUARD_SECONDS, 'NX')) !== 'OK') continue;
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  }

  const t = messages.email.expiryReminder;
  const link = `${appUrl.replace(/\/$/, '')}/my/listings`;
  let emails = 0;
  let listings = 0;
  for (const list of byUser.values()) {
    const titles = list.map((r) => r.title);
    try {
      await mail({
        to: list[0]!.email,
        subject: t.subject(titles.length),
        text: t.text(titles, link),
        html: emailHtml(
          `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(t.intro(titles.length))}</p>
<ul style="margin:0 0 16px;padding-inline-start:20px;font-size:15px">${titles.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
<p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#047857;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.button)}</a></p>
<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(t.footer)}</p>`,
        ),
      });
      emails++;
      listings += list.length;
    } catch (e) {
      // Free the guards so a manual rerun can send this one
      await redis.del(...list.map((r) => `expiry-reminder:${r.id}:${new Date(r.expires_at).getTime()}`));
      console.error('expiry-reminder: send failed:', e instanceof Error ? e.message : e);
    }
  }
  return { emails, listings };
}
