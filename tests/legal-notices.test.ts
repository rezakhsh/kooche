import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import {
  checkDocuments,
  confirmNotice,
  LEGAL_NOTICE,
  MAX_ATTEMPTS,
  noticeHistory,
  noticeMail,
  saveDraft,
  sendNoticeBatch,
  STALLED_MS,
  unfinishedNotices,
  waitingNotice,
} from '../src/modules/legal/notices';
import { currentVersion, dayStart, earliestTermsDay, LEGAL_VERSIONS, nextVersion } from '../src/modules/legal/versions';
import type { Mail } from '../src/modules/notifications/mailer';
import { pages } from '../src/messages/fa';
import { legalDe } from '../src/messages/legal-de';
import { appDb, redis, workerDb } from './accounts';
import { db, publicToken } from './db';

// «خبر تغییر شرایط به همه» (Check B, Nov 1, 2026): versions switch on their day (Berlin), four
// weeks for the terms, one notice per text and day, every active account once, proof per account,
// retries that don't run the list into an outage, erase_user takes the rows.

const APP = 'https://app.example.test';
const NOW = new Date('2026-11-01T10:00:00Z');
const DAY = 86_400_000;

/** A day far enough ahead and unique to the test (the notices share one database) */
function futureDay(minDays = 40): string {
  const d = new Date(NOW.getTime() + (minDays + Math.floor(Math.random() * 20_000)) * DAY);
  return d.toISOString().slice(0, 10);
}

/** The real versions plus a new one per document */
function versions(next: { terms?: string; privacy?: string }): typeof LEGAL_VERSIONS {
  return {
    terms: [...LEGAL_VERSIONS.terms, ...(next.terms ? [{ from: next.terms, fa: { ...pages.terms, updated: 'تازه' }, de: { ...legalDe.terms, updated: 'neu' } }] : [])],
    privacy: [...LEGAL_VERSIONS.privacy, ...(next.privacy ? [{ from: next.privacy, fa: pages.privacy, de: legalDe.privacy }] : [])],
  };
}

async function person(status: 'active' | 'deactivated' | 'deleted' = 'active') {
  const [u] = await db
    .insert(schema.users)
    .values({
      publicToken: publicToken(),
      email: `${randomUUID()}@example.test`,
      emailVerified: true,
      displayName: 'کاربر',
      displayNameNormalized: 'کاربر',
      status,
      ...(status === 'deleted' ? { deletedAt: new Date() } : {}),
    })
    .returning();
  return u!;
}

async function adminCtx(): Promise<StaffContext> {
  const [a] = await db
    .insert(schema.users)
    .values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, emailVerified: true, displayName: 'مدیر', displayNameNormalized: 'مدیر', staffRole: 'admin' })
    .returning();
  const [s] = await db.insert(schema.sessions).values({ userId: a!.id, token: randomUUID().replace(/-/g, ''), expiresAt: new Date(Date.now() + DAY) }).returning();
  return { userId: a!.id, sessionId: s!.id, role: 'admin', ip: null, userAgent: null };
}

const SUMMARY = { summaryFa: 'بند ۵ روشن‌تر شد.\nبند ۷ تازه است.', summaryDe: 'Ziffer 5 ist klarer.\nZiffer 7 ist neu.' };

/** A confirmed notice for a new terms version; its id and the accounts it went to */
async function confirmed(docs: Array<'terms' | 'privacy'> = ['terms']) {
  const day = futureDay();
  const v = versions(Object.fromEntries(docs.map((d) => [d, day])));
  const staff = await adminCtx();
  const draft = await saveDraft(appDb, staff, { documents: docs, ...SUMMARY }, NOW, v);
  if (!draft.ok) throw new Error(draft.reason);
  const r = await confirmNotice(appDb, staff, draft.id, NOW, v);
  if (!r.ok) throw new Error(r.reason);
  return { id: draft.id, day, staff, v, recipients: r.recipients };
}

const recipient = async (noticeId: string, userId: string) =>
  (await db.select().from(schema.legalNoticeRecipients).where(and(eq(schema.legalNoticeRecipients.noticeId, noticeId), eq(schema.legalNoticeRecipients.userId, userId))))[0];

/** Sends batches until the notice is done; the mails per address */
async function sendAll(noticeId: string, mail: (m: Mail) => Promise<void>) {
  for (let i = 0; i < 1000; i++) {
    const r = await sendNoticeBatch(workerDb, redis, mail, noticeId, APP, { limit: 50, gapMs: 0 });
    if (!r.more) return;
  }
  throw new Error('never finished');
}

describe('legal versions', () => {
  it('switch at 00:00 Berlin on their day', () => {
    const v = versions({ terms: '2026-12-01' });
    expect(dayStart('2026-12-01').toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(currentVersion('terms', new Date('2026-11-30T22:59:59Z'), v).from).toBe('2026-10-31');
    expect(nextVersion('terms', new Date('2026-11-30T22:59:59Z'), v)?.from).toBe('2026-12-01');
    expect(currentVersion('terms', new Date('2026-11-30T23:00:00Z'), v).from).toBe('2026-12-01');
    expect(nextVersion('terms', new Date('2026-11-30T23:00:00Z'), v)).toBeNull();
    // Today's versions: one each, nothing waiting
    expect(nextVersion('terms', NOW)).toBeNull();
    expect(nextVersion('privacy', NOW)).toBeNull();
  });

  it('need four weeks for the terms, not for the privacy policy', () => {
    expect(earliestTermsDay(NOW)).toBe('2026-11-29');
    expect(checkDocuments(['terms'], NOW, versions({ terms: '2026-11-28' }))).toEqual({ ok: false, reason: 'too_soon' });
    expect(checkDocuments(['terms'], NOW, versions({ terms: '2026-11-29' }))).toEqual({ ok: true, day: '2026-11-29' });
    expect(checkDocuments(['privacy'], NOW, versions({ privacy: '2026-11-10' }))).toEqual({ ok: true, day: '2026-11-10' });
    expect(checkDocuments(['terms'], NOW, versions({ privacy: '2026-12-10' }))).toEqual({ ok: false, reason: 'no_version' });
    expect(checkDocuments(['terms', 'privacy'], NOW, versions({ terms: '2026-12-10', privacy: '2026-12-11' }))).toEqual({ ok: false, reason: 'dates_differ' });
    expect(checkDocuments(['terms', 'terms'], NOW, versions({ terms: '2026-12-10' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(checkDocuments([], NOW, versions({ terms: '2026-12-10' }))).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('legal notice drafts and confirmation', () => {
  it('keep one draft per staff member and refuse empty or long summaries', async () => {
    const day = futureDay();
    const v = versions({ terms: day });
    const staff = await adminCtx();
    expect(await saveDraft(appDb, staff, { documents: ['terms'], summaryFa: ' ', summaryDe: 'x' }, NOW, v)).toEqual({ ok: false, reason: 'invalid' });
    expect(await saveDraft(appDb, staff, { documents: ['terms'], summaryFa: 'x'.repeat(2001), summaryDe: 'x' }, NOW, v)).toEqual({ ok: false, reason: 'invalid' });
    const a = await saveDraft(appDb, staff, { documents: ['terms'], ...SUMMARY }, NOW, v);
    const b = await saveDraft(appDb, staff, { documents: ['terms'], summaryFa: 'دوم', summaryDe: 'zweite' }, NOW, v);
    expect(a.ok && b.ok).toBe(true);
    const drafts = await db.select().from(schema.legalNotices).where(eq(schema.legalNotices.createdByUserId, staff.userId));
    expect(drafts.map((d) => d.summaryFa)).toEqual(['دوم']);
    expect(drafts[0]).toMatchObject({ effectiveOn: day, documents: ['terms'], confirmedAt: null, recipients: null });
  });

  it('go to every active account once, with the outbox event and the audit row', async () => {
    const active = await person();
    const closing = await person('deactivated');
    const gone = await person('deleted');
    const n = await confirmed();
    const [c] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM legal_notice_recipients WHERE notice_id = ${n.id}`);
    expect(c!.n).toBe(n.recipients);
    expect(await recipient(n.id, active.id)).toMatchObject({ sentAt: null, failedAt: null, attempts: 0 });
    expect(await recipient(n.id, closing.id)).toBeUndefined();
    expect(await recipient(n.id, gone.id)).toBeUndefined();
    const [row] = await db.select().from(schema.legalNotices).where(eq(schema.legalNotices.id, n.id));
    expect(row).toMatchObject({ recipients: n.recipients, confirmedByUserId: n.staff.userId });
    expect(row!.confirmedAt).toEqual(NOW);
    const events = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, LEGAL_NOTICE), eq(schema.outboxEvents.aggregateId, n.id)));
    expect(events).toHaveLength(1);
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'legal.notice_sent'), eq(schema.auditLog.targetId, n.id)));
    expect(audit[0]).toMatchObject({ actorUserId: n.staff.userId, data: { documents: ['terms'], effectiveOn: n.day, recipients: n.recipients } });
  });

  it('refuse a second notice for the same text and day, and a draft whose version changed', async () => {
    const n = await confirmed(['terms']);
    const again = await saveDraft(appDb, n.staff, { documents: ['terms'], ...SUMMARY }, NOW, n.v);
    if (!again.ok) throw new Error(again.reason);
    expect(await confirmNotice(appDb, n.staff, again.id, NOW, n.v)).toEqual({ ok: false, reason: 'already_sent' });
    // Already confirmed: not a draft any more
    expect(await confirmNotice(appDb, n.staff, n.id, NOW, n.v)).toEqual({ ok: false, reason: 'not_found' });

    const day = futureDay();
    const staff = await adminCtx();
    const draft = await saveDraft(appDb, staff, { documents: ['privacy'], ...SUMMARY }, NOW, versions({ privacy: day }));
    if (!draft.ok) throw new Error(draft.reason);
    const moved = futureDay();
    expect(await confirmNotice(appDb, staff, draft.id, NOW, versions({ privacy: moved }))).toEqual({ ok: false, reason: moved === day ? 'already_sent' : 'no_version' });
    // Four weeks are checked again at the confirmation
    const late = new Date(dayStart(day).getTime() - 10 * DAY);
    const terms = await saveDraft(appDb, staff, { documents: ['terms'], ...SUMMARY }, NOW, versions({ terms: day }));
    if (!terms.ok) throw new Error(terms.reason);
    expect(await confirmNotice(appDb, staff, terms.id, late, versions({ terms: day }))).toEqual({ ok: false, reason: 'too_soon' });
  });

  it('show on the banner until the day', async () => {
    const n = await confirmed(['privacy']);
    const before = new Date(dayStart(n.day).getTime() - 1000);
    const waiting = await waitingNotice(appDb, before);
    // Another test's notice may start earlier; ours is waiting at least until its own day
    expect(waiting).not.toBeNull();
    expect(waiting!.effectiveOn <= n.day).toBe(true);
    const all = await db.execute(sql`SELECT id FROM legal_notices WHERE confirmed_at IS NOT NULL AND effective_on > ${n.day}::date`);
    if (all.length === 0) expect(await waitingNotice(appDb, dayStart(n.day))).toBeNull();
  });
});

describe('sending a legal notice', () => {
  it('emails each account once and marks the notice finished', async () => {
    const a = await person();
    const b = await person();
    const n = await confirmed(['terms', 'privacy']);
    const mails: Mail[] = [];
    await sendAll(n.id, async (m) => void mails.push(m));
    expect(mails.filter((m) => m.to === a.email)).toHaveLength(1);
    expect(mails.filter((m) => m.to === b.email)).toHaveLength(1);
    expect(mails).toHaveLength(n.recipients);
    expect((await recipient(n.id, a.id))!.sentAt).not.toBeNull();
    const [row] = await db.select().from(schema.legalNotices).where(eq(schema.legalNotices.id, n.id));
    expect(row!.finishedAt).not.toBeNull();
    // Nothing more, also after a stray job
    const more: Mail[] = [];
    expect(await sendNoticeBatch(workerDb, redis, async (m) => void more.push(m), n.id, APP, { gapMs: 0 })).toEqual({ sent: 0, skipped: 0, more: false });
    expect(more).toEqual([]);
    const history = await noticeHistory(appDb, 100);
    expect(history.find((h) => h.id === n.id)).toMatchObject({ sent: n.recipients, failed: 0 });
  });

  it('skips an account closed after the confirmation', async () => {
    const leaving = await person();
    const n = await confirmed(['privacy']);
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, leaving.id));
    const mails: Mail[] = [];
    await sendAll(n.id, async (m) => void mails.push(m));
    expect(mails.some((m) => m.to === leaving.email)).toBe(false);
    expect(await recipient(n.id, leaving.id)).toMatchObject({ sentAt: null, attempts: 0 });
    expect((await recipient(n.id, leaving.id))!.failedAt).not.toBeNull();
  });

  it('stops the batch on a failed send and gives an address up after three tries', async () => {
    const bad = await person();
    const n = await confirmed(['privacy']);
    const send = async (m: Mail) => {
      if (m.to === bad.email) throw new Error('smtp down');
    };
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      // The other accounts go out in between; the failing one stops each run that reaches it
      for (;;) {
        try {
          const r = await sendNoticeBatch(workerDb, redis, send, n.id, APP, { limit: 50, gapMs: 0 });
          if (!r.more) break;
        } catch (e) {
          expect((e as Error).message).toBe('smtp down');
          break;
        }
      }
      expect((await recipient(n.id, bad.id))!.attempts).toBe(i);
    }
    expect((await recipient(n.id, bad.id))!.failedAt).not.toBeNull();
    await sendAll(n.id, send);
    const history = await noticeHistory(appDb, 100);
    expect(history.find((h) => h.id === n.id)).toMatchObject({ failed: 1, sent: n.recipients - 1 });
    expect(history.find((h) => h.id === n.id)!.finishedAt).not.toBeNull();
  });

  it('is taken up again only once it stopped', async () => {
    const n = await confirmed(['privacy']);
    expect(await unfinishedNotices(workerDb, NOW)).not.toContain(n.id);
    expect(await unfinishedNotices(workerDb, new Date(NOW.getTime() + STALLED_MS + 1000))).toContain(n.id);
    await sendAll(n.id, async () => {});
    expect(await unfinishedNotices(workerDb, new Date(NOW.getTime() + STALLED_MS + 1000))).not.toContain(n.id);
  });

  it('erase_user deletes the account’s rows', async () => {
    const p = await person();
    const n = await confirmed(['privacy']);
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, p.id));
    await workerDb.execute(sql`SELECT erase_user(${p.id})`);
    expect(await recipient(n.id, p.id)).toBeUndefined();
  });
});

describe('the legal notice email', () => {
  const base = { effectiveOn: '2026-12-01', summaryFa: 'بند ۵ روشن‌تر شد.\nبند ۷ تازه است.', summaryDe: 'Ziffer 5 ist klarer.' };

  it('names the day, the changes and both versions, in Persian and German', () => {
    const m = noticeMail({ ...base, documents: ['terms'] }, APP, 'a@example.test');
    expect(m.to).toBe('a@example.test');
    expect(m.subject).toBe('شرایط استفادهٔ پیدو از ۱ دسامبر ۲۰۲۶ تغییر می‌کند · Änderung unserer Nutzungsbedingungen zum 1. Dezember 2026');
    expect(m.text).toContain('بند ۷ تازه است.');
    expect(m.text).toContain(`${APP}/terms/next`);
    expect(m.text).toContain(`Neue Nutzungsbedingungen: ${APP}/terms/de/next`);
    expect(m.text).toContain(`${APP}/account/delete`);
    expect(m.text).toContain('Ziffer 5 ist klarer.');
    expect(m.html).toContain('dir="ltr" lang="de"');
    expect(m.html).toContain(`href="${APP}/terms/next"`);
  });

  it('for the privacy policy alone has no deletion line', () => {
    const m = noticeMail({ ...base, documents: ['privacy'] }, APP, 'a@example.test');
    expect(m.subject).toContain('Datenschutzerklärung zum 1. Dezember 2026');
    expect(m.text).toContain(`${APP}/privacy/next`);
    expect(m.text).not.toContain('/account/delete');
  });

  it('escapes the summaries in the HTML', () => {
    const m = noticeMail({ ...base, documents: ['terms', 'privacy'], summaryFa: '<b>x</b>' }, APP, 'a@example.test');
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&#60;b&#62;x&#60;/b&#62;');
    expect(m.subject).toContain('شرایط استفاده و حریم خصوصی');
  });
});

describe('legal notice grants', () => {
  it('let the worker mark sends but not write notices, and the app not mark sends', async () => {
    const n = await confirmed(['privacy']);
    await expect(workerDb.insert(schema.legalNotices).values({ documents: ['terms'], effectiveOn: futureDay(), summaryFa: 'x', summaryDe: 'x' })).rejects.toThrow();
    await expect(appDb.execute(sql`UPDATE legal_notice_recipients SET sent_at = now() WHERE notice_id = ${n.id}`)).rejects.toThrow();
    await expect(appDb.execute(sql`UPDATE legal_notices SET finished_at = now() WHERE id = ${n.id}`)).rejects.toThrow();
    await expect(workerDb.execute(sql`UPDATE legal_notices SET summary_fa = 'x' WHERE id = ${n.id}`)).rejects.toThrow();
  });
});
