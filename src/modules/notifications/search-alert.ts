import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { cachedCatalog } from '../listings/catalog';
import { listingPath } from '../listings/slug';
import type { AlertJob } from '../search/alerts';
import { savedSearchHrefs } from '../search/saved';
import type { ReplyMarkup } from '../users/telegram-bot';
import { emailHtml, escapeHtml, type Mail } from './mailer';

// What a saved-search notice says (src/modules/search/alerts.ts decides when one goes out). Read
// when it is sent: listings that went away since are left out, and a notice with none left is
// not sent. Up to ITEMS listings by title, then a link to the whole search.

export const ITEMS = 5;
/** Telegram buttons hold at most this many characters of a title */
const BUTTON_TITLE = 40;

export type AlertContent = {
  email: string;
  telegramUserId: number | null;
  name: string;
  total: number;
  items: { title: string; url: string }[];
  url: string;
  manageUrl: string;
  unsubscribeUrl: string;
  /** RFC 8058: where mail apps post their own unsubscribe button */
  oneClickUrl: string;
};

export async function alertContent(db: Queryable, job: AlertJob, appUrl: string): Promise<AlertContent | null> {
  const base = appUrl.replace(/\/$/, '');
  const [s] = await db.execute<{ id: string; name: string | null; filters: unknown; unsubscribe_token: string; email: string; telegram_user_id: string | number | null; status: string }>(sql`
    SELECT s.id, s.name, s.filters, s.unsubscribe_token, u.email, u.telegram_user_id, u.status
    FROM saved_searches s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${job.savedSearchId}::uuid AND s.user_id = ${job.userId}::uuid`);
  if (!s || s.status !== 'active' || job.listingIds.length === 0) return null;
  const rows = await db.execute<{ id: string; title: string; public_token: string }>(sql`
    SELECT id, title, public_token FROM listings
    WHERE id IN (${sql.join(job.listingIds.map((id) => sql`${id}::uuid`), sql`, `)}) AND status = 'active'`);
  if (rows.length === 0) return null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const live = job.listingIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  const href = (await savedSearchHrefs(db, await cachedCatalog(db), [s])).get(s.id) ?? '/';
  return {
    email: s.email,
    telegramUserId: s.telegram_user_id === null ? null : Number(s.telegram_user_id),
    name: s.name ?? messages.savedSearches.all,
    total: live.length,
    items: live.slice(0, ITEMS).map((l) => ({ title: l.title, url: `${base}${listingPath(l.title, l.public_token)}` })),
    url: `${base}${href}`,
    manageUrl: `${base}/my/searches`,
    unsubscribeUrl: `${base}/alerts/off?t=${s.unsubscribe_token}`,
    oneClickUrl: `${base}/alerts/off/one-click?t=${s.unsubscribe_token}`,
  };
}

const short = (s: string) => (s.length > BUTTON_TITLE ? `${s.slice(0, BUTTON_TITLE - 1)}…` : s);

export function telegramAlert(c: AlertContent): { text: string; replyMarkup: ReplyMarkup } {
  const t = messages.searchAlert;
  const more = c.total > c.items.length ? `\n${t.more(c.total - c.items.length)}` : '';
  return {
    text: `${t.telegram(c.total, c.name)}${more}`,
    replyMarkup: {
      inline_keyboard: [
        ...c.items.map((i) => [{ text: short(i.title), url: i.url }]),
        [{ text: t.open, url: c.url }],
        [{ text: t.manage, url: c.manageUrl }],
      ],
    },
  };
}

export function emailAlert(c: AlertContent): Mail {
  const t = messages.searchAlert;
  const intro = t.intro(c.total, c.name);
  const lines = c.items.map((i) => `• ${i.title}\n  ${i.url}`);
  if (c.total > c.items.length) lines.push(t.more(c.total - c.items.length));
  return {
    to: c.email,
    subject: t.subject(c.total, c.name),
    text: t.text(intro, lines, c.url, c.manageUrl, c.unsubscribeUrl),
    // RFC 8058: mail apps offer their own "unsubscribe" button, which posts to this address
    headers: { 'List-Unsubscribe': `<${c.oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    html: emailHtml(
      `<p style="margin:0 0 12px;font-size:16px">${escapeHtml(intro)}</p>
<ul style="margin:0 0 16px;padding:0 20px 0 0">${c.items.map((i) => `<li style="margin:0 0 6px"><a href="${escapeHtml(i.url)}" style="color:#0b6e77">${escapeHtml(i.title)}</a></li>`).join('')}</ul>
${c.total > c.items.length ? `<p style="margin:0 0 16px;font-size:14px;color:#525252">${escapeHtml(t.more(c.total - c.items.length))}</p>` : ''}
<p style="margin:0 0 16px"><a href="${escapeHtml(c.url)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.open)}</a></p>
<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(t.footer)} <a href="${escapeHtml(c.manageUrl)}" style="color:#0b6e77">${escapeHtml(t.manage)}</a> · <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:#0b6e77">${escapeHtml(t.unsubscribe)}</a></p>`,
    ),
  };
}
