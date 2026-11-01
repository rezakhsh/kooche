import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Db, Queryable } from '../../db/drizzle';
import { legalNotices, outboxEvents, type LegalDocument } from '../../db/schema';
import { messages } from '../../messages/fa';
import { legalNoticeMailDe } from '../../messages/legal-de';
import { staffAudit, type StaffContext } from '../admin/audit';
import { emailHtml, escapeHtml, type Mail, type Mailer } from '../notifications/mailer';
import { sendOnce } from '../notifications/send-once';
import { LEGAL_VERSIONS, berlinToday, dayDe, dayFa, earliestTermsDay, nextVersion, type LegalVersion } from './versions';

// «خبر تغییر شرایط به همه» (Check B, Nov 1, 2026; owner's choice: built before launch). Terms 12
// promises an email at least four weeks before the terms of use change; privacy 12 one about
// important changes of the privacy policy. The new text is already in the code with its day
// (./versions.ts); the owner writes a short summary in Persian and German, sees the email and the
// number of accounts, can send a sample to themself, and confirms with «مطمئنم». The confirmation
// writes one row per active account (the proof that each was told, with the time it went out) and
// `legal.notice` in the outbox. The worker (queue `accounts`) sends in small batches, each account
// once, and marks the notice finished. It is a contract notice, not advertising: it goes to every
// active account whatever its notification switches say.

export const LEGAL_NOTICE = 'legal.notice';
/** The banner's «بستن» (src/components/legal-change-banner.tsx): the id of the notice closed */
export const LEGAL_SEEN_COOKIE = 'legal_seen';
/** Accounts per worker job, and the pause between two emails (SES allows 14 a second) */
export const CHUNK = 100;
export const SEND_GAP_MS = 150;
/** A recipient whose email failed this often is given up */
export const MAX_ATTEMPTS = 3;
export const SUMMARY_MAX = 2000;
/** A notice with no send for this long has stopped: the hourly job takes it up again */
export const STALLED_MS = 30 * 60_000;

type Versions = typeof LEGAL_VERSIONS;
export type NoticeError = 'no_version' | 'dates_differ' | 'too_soon' | 'already_sent' | 'invalid' | 'not_found';
type Docs = 'terms' | 'privacy' | 'both';

const docsKey = (docs: readonly LegalDocument[]): Docs => (docs.length === 2 ? 'both' : docs[0]!);
const ORDER: readonly LegalDocument[] = ['terms', 'privacy'];

/** The documents with a new version waiting, and its day */
export function upcomingVersions(now: Date = new Date(), versions: Versions = LEGAL_VERSIONS): Array<{ doc: LegalDocument; version: LegalVersion }> {
  return ORDER.flatMap((doc) => {
    const version = nextVersion(doc, now, versions);
    return version ? [{ doc, version }] : [];
  });
}

/** Whether these documents can be announced now: a new version each, one day, four weeks for the terms */
export function checkDocuments(docs: readonly LegalDocument[], now: Date = new Date(), versions: Versions = LEGAL_VERSIONS): { ok: true; day: string } | { ok: false; reason: NoticeError } {
  const unique = ORDER.filter((d) => docs.includes(d));
  if (unique.length === 0 || unique.length !== docs.length) return { ok: false, reason: 'invalid' };
  const days = unique.map((d) => nextVersion(d, now, versions)?.from);
  if (days.some((d) => !d)) return { ok: false, reason: 'no_version' };
  if (new Set(days).size > 1) return { ok: false, reason: 'dates_differ' };
  const day = days[0]!;
  if (unique.includes('terms') && day < earliestTermsDay(now)) return { ok: false, reason: 'too_soon' };
  return { ok: true, day };
}

function cleanSummary(s: string): string | null {
  const t = s.replace(/\r\n?/g, '\n').trim();
  return t.length >= 1 && t.length <= SUMMARY_MAX ? t : null;
}

/** Saves the owner's draft (replacing their earlier draft); it goes out only through confirmNotice */
export async function saveDraft(
  db: Db,
  staff: StaffContext,
  input: { documents: readonly LegalDocument[]; summaryFa: string; summaryDe: string },
  now: Date = new Date(),
  versions: Versions = LEGAL_VERSIONS,
): Promise<{ ok: true; id: string } | { ok: false; reason: NoticeError }> {
  const summaryFa = cleanSummary(input.summaryFa);
  const summaryDe = cleanSummary(input.summaryDe);
  if (!summaryFa || !summaryDe) return { ok: false, reason: 'invalid' };
  const checked = checkDocuments(input.documents, now, versions);
  if (!checked.ok) return checked;
  const documents = ORDER.filter((d) => input.documents.includes(d));
  return db.transaction(async (tx) => {
    await tx.delete(legalNotices).where(and(isNull(legalNotices.confirmedAt), eq(legalNotices.createdByUserId, staff.userId)));
    const [row] = await tx
      .insert(legalNotices)
      .values({ documents, effectiveOn: checked.day, summaryFa, summaryDe, createdByUserId: staff.userId })
      .returning({ id: legalNotices.id });
    return { ok: true as const, id: row!.id };
  });
}

export type NoticeRow = typeof legalNotices.$inferSelect;

export async function draftById(db: Queryable, id: string): Promise<NoticeRow | null> {
  const [row] = await db.select().from(legalNotices).where(and(eq(legalNotices.id, id), isNull(legalNotices.confirmedAt)));
  return row ?? null;
}

export async function discardDraft(db: Queryable, id: string): Promise<void> {
  await db.delete(legalNotices).where(and(eq(legalNotices.id, id), isNull(legalNotices.confirmedAt)));
}

/** Every active account; closed and deleted ones have no contract left */
export async function recipientCount(db: Queryable): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM users WHERE status = 'active'`);
  return r?.n ?? 0;
}

/**
 * «فرستادن به همه»: checks the draft again (the version may have changed since), refuses a second
 * notice for the same text and day, and writes the recipients, the outbox event and the audit row
 * in one transaction.
 */
export async function confirmNotice(
  db: Db,
  staff: StaffContext,
  id: string,
  now: Date = new Date(),
  versions: Versions = LEGAL_VERSIONS,
): Promise<{ ok: true; recipients: number } | { ok: false; reason: NoticeError }> {
  return db.transaction(async (tx) => {
    // One confirmation at a time, so two clicks can't both pass the "already sent" check
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('legal_notices'))`);
    const [draft] = await tx.select().from(legalNotices).where(and(eq(legalNotices.id, id), isNull(legalNotices.confirmedAt))).for('update');
    if (!draft) return { ok: false as const, reason: 'not_found' as const };
    const checked = checkDocuments(draft.documents, now, versions);
    if (!checked.ok) return checked;
    if (checked.day !== draft.effectiveOn) return { ok: false as const, reason: 'no_version' as const };
    const [dup] = await tx.execute(sql`
      SELECT 1 FROM legal_notices
      WHERE confirmed_at IS NOT NULL AND effective_on = ${draft.effectiveOn}::date AND documents && ARRAY[${sql.join(
        draft.documents.map((d) => sql`${d}`),
        sql`, `,
      )}]::text[]`);
    if (dup) return { ok: false as const, reason: 'already_sent' as const };
    const inserted = await tx.execute(sql`
      INSERT INTO legal_notice_recipients (notice_id, user_id)
      SELECT ${id}::uuid, u.id FROM users u WHERE u.status = 'active'`);
    const recipients = inserted.count ?? 0;
    await tx.update(legalNotices).set({ confirmedAt: now, confirmedByUserId: staff.userId, recipients }).where(eq(legalNotices.id, id));
    await tx.insert(outboxEvents).values({ eventType: LEGAL_NOTICE, aggregateType: 'legal_notice', aggregateId: id });
    await staffAudit(tx, staff, 'legal.notice_sent', { type: 'legal_notice', id }, { documents: draft.documents, effectiveOn: draft.effectiveOn, recipients });
    return { ok: true as const, recipients };
  });
}

export type NoticeProgress = NoticeRow & { sent: number; failed: number };

/** Confirmed notices, newest first, with how many went out */
export async function noticeHistory(db: Queryable, limit = 20): Promise<NoticeProgress[]> {
  const rows = await db.execute<{ id: string; sent: number; failed: number }>(sql`
    SELECT n.id, count(r.sent_at)::int AS sent, count(r.failed_at)::int AS failed
    FROM legal_notices n LEFT JOIN legal_notice_recipients r ON r.notice_id = n.id
    WHERE n.confirmed_at IS NOT NULL
    GROUP BY n.id ORDER BY n.confirmed_at DESC LIMIT ${limit}`);
  if (rows.length === 0) return [];
  const notices = await db.select().from(legalNotices).where(inArray(legalNotices.id, rows.map((r) => r.id)));
  const byId = new Map(notices.map((n) => [n.id, n]));
  return rows.map((r) => ({ ...byId.get(r.id)!, sent: r.sent, failed: r.failed }));
}

/** The confirmed notice whose day hasn't come yet (the banner for signed-in people) */
export async function waitingNotice(db: Queryable, now: Date = new Date()): Promise<{ id: string; documents: LegalDocument[]; effectiveOn: string } | null> {
  const [row] = await db
    .select({ id: legalNotices.id, documents: legalNotices.documents, effectiveOn: legalNotices.effectiveOn })
    .from(legalNotices)
    .where(sql`${legalNotices.confirmedAt} IS NOT NULL AND ${legalNotices.effectiveOn} > ${berlinToday(now)}::date`)
    .orderBy(legalNotices.effectiveOn)
    .limit(1);
  return row ?? null;
}

/** The new version's page of a document, Persian or German */
export const nextPath = (doc: LegalDocument, lang: 'fa' | 'de' = 'fa') => `/${doc}${lang === 'de' ? '/de' : ''}/next`;

const P = (text: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7">${escapeHtml(text)}</p>`;
const BUTTON = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 0 8px 8px;background:#0b6e77;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a>`;

/** The email: Persian first, then the binding German version left to right */
export function noticeMail(n: Pick<NoticeRow, 'documents' | 'effectiveOn' | 'summaryFa' | 'summaryDe'>, appUrl: string, to: string): Mail {
  const t = messages.email.legalNotice;
  const de = legalNoticeMailDe;
  const docs = docsKey(n.documents);
  const faDay = dayFa(n.effectiveOn);
  const deDay = dayDe(n.effectiveOn);
  const links = n.documents.map((d) => ({ doc: d, fa: `${appUrl}${nextPath(d)}`, de: `${appUrl}${nextPath(d, 'de')}` }));
  const deleteUrl = `${appUrl}/account/delete`;
  const terms = n.documents.includes('terms');
  const faLines = n.summaryFa.split('\n').filter((l) => l.trim());
  const deLines = n.summaryDe.split('\n').filter((l) => l.trim());
  const german = [
    de.intro(docs, deDay),
    de.what,
    ...deLines,
    ...links.map((l) => (l.doc === 'terms' ? de.terms(l.de) : de.privacy(l.de))),
    ...(terms ? [de.disagree(deleteUrl)] : []),
    de.why,
  ];
  const text = [
    t.intro(docs, faDay),
    '',
    t.what,
    ...faLines,
    '',
    ...links.map((l) => `${l.doc === 'terms' ? t.terms : t.privacy}: ${l.fa}`),
    ...(terms ? ['', `${t.disagree} ${deleteUrl}`] : []),
    '',
    t.why,
    '',
    t.germanBelow,
    ...german,
  ].join('\n');
  const html = emailHtml(
    P(t.intro(docs, faDay)) +
      `<p style="margin:0 0 6px;font-size:15px;font-weight:bold">${escapeHtml(t.what)}</p>` +
      faLines.map(P).join('') +
      `<p style="margin:4px 0 12px">${links.map((l) => BUTTON(l.fa, l.doc === 'terms' ? t.terms : t.privacy)).join('')}</p>` +
      (terms ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.7">${escapeHtml(t.disagree)} <a href="${escapeHtml(deleteUrl)}" style="color:#0b6e77">${escapeHtml(t.deleteLink)}</a></p>` : '') +
      `<p style="margin:0 0 12px;font-size:13px;color:#737373">${escapeHtml(t.why)}</p>` +
      `<div dir="ltr" lang="de" style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e5e5;text-align:left;font-size:13px;color:#525252">${german.map((p) => `<p style="margin:0 0 8px">${escapeHtml(p)}</p>`).join('')}</div>`,
  );
  return { to, subject: `${t.subject(docs, faDay)} · ${de.subject(docs, deDay)}`, text, html };
}

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The worker's half, as classifieds_worker: sends the next batch of a confirmed notice. Each
 * account once (Valkey key per notice and account, and `sent_at`). A failed send counts against
 * that account (given up after MAX_ATTEMPTS) and fails the job, so BullMQ retries it later instead
 * of running the whole list into an SMTP outage. `more`: another batch is due.
 */
export async function sendNoticeBatch(
  db: Queryable,
  redis: Redis,
  mail: Mailer,
  noticeId: string,
  appUrl: string,
  opts: { limit?: number; gapMs?: number; sleep?: Sleep; now?: () => Date } = {},
): Promise<{ sent: number; skipped: number; more: boolean }> {
  const limit = opts.limit ?? CHUNK;
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? (() => new Date());
  const [notice] = await db.select().from(legalNotices).where(eq(legalNotices.id, noticeId));
  if (!notice?.confirmedAt || notice.finishedAt) return { sent: 0, skipped: 0, more: false };
  const due = await db.execute<{ user_id: string; email: string; status: string }>(sql`
    SELECT r.user_id, u.email, u.status FROM legal_notice_recipients r JOIN users u ON u.id = r.user_id
    WHERE r.notice_id = ${noticeId} AND r.sent_at IS NULL AND r.failed_at IS NULL
    ORDER BY r.attempts, r.user_id LIMIT ${limit}`);
  let sent = 0;
  let skipped = 0;
  for (const r of due) {
    if (r.status !== 'active') {
      // Closed after the confirmation: nobody to tell any more
      await db.execute(sql`UPDATE legal_notice_recipients SET failed_at = ${now().toISOString()}::timestamptz WHERE notice_id = ${noticeId} AND user_id = ${r.user_id}`);
      skipped++;
      continue;
    }
    try {
      await sendOnce(redis, `legal_${noticeId}_${r.user_id}`, () => mail(noticeMail(notice, appUrl, r.email)));
    } catch (e) {
      await db.execute(sql`
        UPDATE legal_notice_recipients
        SET attempts = attempts + 1, failed_at = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN ${now().toISOString()}::timestamptz END
        WHERE notice_id = ${noticeId} AND user_id = ${r.user_id}`);
      throw e;
    }
    await db.execute(sql`UPDATE legal_notice_recipients SET sent_at = ${now().toISOString()}::timestamptz WHERE notice_id = ${noticeId} AND user_id = ${r.user_id}`);
    sent++;
    if (opts.gapMs ?? SEND_GAP_MS) await sleep(opts.gapMs ?? SEND_GAP_MS);
  }
  if (due.length === limit) return { sent, skipped, more: true };
  const [left] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM legal_notice_recipients WHERE notice_id = ${noticeId} AND sent_at IS NULL AND failed_at IS NULL`);
  if (left?.n) return { sent, skipped, more: true };
  await db.execute(sql`UPDATE legal_notices SET finished_at = ${now().toISOString()}::timestamptz WHERE id = ${noticeId} AND finished_at IS NULL`);
  return { sent, skipped, more: false };
}

/** Confirmed notices not finished whose sending stopped half an hour ago or more (the worker's hourly look) */
export async function unfinishedNotices(db: Queryable, now: Date = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT n.id FROM legal_notices n
    WHERE n.confirmed_at IS NOT NULL AND n.finished_at IS NULL
      AND coalesce((SELECT max(greatest(r.sent_at, r.failed_at)) FROM legal_notice_recipients r WHERE r.notice_id = n.id), n.confirmed_at)
        < ${new Date(now.getTime() - STALLED_MS).toISOString()}::timestamptz
    ORDER BY n.confirmed_at`);
  return rows.map((r) => r.id);
}
