import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { listings, outboxEvents, reports, users } from '../src/db/schema';
import { pathOfListingCode } from '../src/modules/listings/queries';
import { createReport, REPORT_LIMITS, reportTargetSummary } from '../src/modules/moderation/public-reports';
import { PUBLIC_REASONS, REASON_SECTIONS } from '../src/modules/moderation/reasons';
import { appDb, redis } from './accounts';
import { db, makeListing, makeOrganization, type Tx } from './db';
import { user } from './listings-fixtures';

// The report buttons (DSA art. 16, roadmap step 8): who may report what, anonymous notices need a
// name, an email and the good-faith statement, and nobody can flood the queue.

const tx = db as unknown as Tx;
let n = 0;
const ip = () => `198.51.100.${++n}`;
const anon = () => ({ userId: null, ip: ip() });
const notice = (extra: Record<string, unknown> = {}) => ({ name: 'Erika Muster', email: `notifier-${++n}@Example.test`, goodFaith: true, ...extra });

describe('reporting a listing', () => {
  it('signed in: one open report per person, with its outbox event', async () => {
    const seller = await user();
    const reporter = await user({ createdAt: new Date(Date.now() - 30 * 86_400_000) });
    const l = await makeListing(tx, seller.id);
    const r = await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'scam', details: '  پیش‌پرداخت خواست  ' });
    expect(r).toMatchObject({ ok: true, already: false });
    const [row] = await db.select().from(reports).where(eq(reports.listingId, l.id));
    expect(row).toMatchObject({ reporterUserId: reporter.id, reporterEmail: null, reasonCode: 'scam', details: 'پیش‌پرداخت خواست', status: 'open', isIllegalContentNotice: false });
    const [event] = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, row!.id));
    expect(event).toMatchObject({ eventType: 'report.created', payload: { target: 'listing', reason: 'scam', illegal: false } });

    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'harassment' })).toMatchObject({ ok: false, reason: 'invalid', fields: ['reason'] });
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'misleading' })).toEqual({ ok: true, reportId: null, already: true });
    expect(await db.select().from(reports).where(eq(reports.listingId, l.id))).toHaveLength(1);
  });

  it('nobody reports their own listing, profile or business, nor what visitors cannot see', async () => {
    const seller = await user();
    const l = await makeListing(tx, seller.id);
    expect(await createReport(appDb, redis, { userId: seller.id }, { kind: 'listing', ref: l.publicToken, reason: 'scam' })).toEqual({ ok: false, reason: 'own' });
    expect(await createReport(appDb, redis, { userId: seller.id }, { kind: 'user', ref: seller.publicToken, reason: 'spam' })).toEqual({ ok: false, reason: 'own' });
    const org = await makeOrganization(tx, seller.id);
    expect(await createReport(appDb, redis, { userId: seller.id }, { kind: 'business', ref: org.slug, reason: 'scam' })).toEqual({ ok: false, reason: 'own' });

    const other = await user();
    for (const status of ['draft', 'rejected', 'pending_review'] as const) {
      const hidden = await makeListing(tx, seller.id, { status, ...(status === 'draft' ? { publishedAt: null, rankedAt: null, expiresAt: null } : {}) });
      expect(await createReport(appDb, redis, { userId: other.id }, { kind: 'listing', ref: hidden.publicToken, reason: 'scam' })).toEqual({ ok: false, reason: 'not_found' });
    }
    const gone = await user();
    await db.update(users).set({ status: 'deactivated' }).where(eq(users.id, gone.id));
    expect(await createReport(appDb, redis, { userId: other.id }, { kind: 'user', ref: gone.publicToken, reason: 'spam' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await createReport(appDb, redis, { userId: other.id }, { kind: 'listing', ref: "x' OR 1=1", reason: 'scam' })).toEqual({ ok: false, reason: 'not_found' });
  });

  it('a user and a business can be reported, once each while open', async () => {
    const owner = await user();
    const org = await makeOrganization(tx, owner.id);
    const someone = await user();
    const reporter = await user();
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'business', ref: org.slug, reason: 'misleading' })).toMatchObject({ ok: true, already: false });
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'business', ref: org.slug, reason: 'scam' })).toMatchObject({ ok: true, already: true });
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'user', ref: someone.publicToken, reason: 'harassment' })).toMatchObject({ ok: true, already: false });
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'user', ref: someone.publicToken, reason: 'spam' })).toMatchObject({ ok: true, already: true });
    // A reason that doesn't fit the kind of thing
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'business', ref: org.slug, reason: 'wrong_category' })).toMatchObject({ ok: false, reason: 'invalid', fields: ['reason'] });
  });

  it('saying it is illegal needs the good-faith statement', async () => {
    const l = await makeListing(tx, (await user()).id);
    const reporter = await user();
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'illegal', illegal: true })).toMatchObject({ ok: false, reason: 'invalid', fields: ['goodFaith'] });
    expect(await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'illegal', illegal: true, goodFaith: true, legalReference: '§ 86a StGB' })).toMatchObject({ ok: true });
    const [row] = await db.select().from(reports).where(eq(reports.listingId, l.id));
    expect(row).toMatchObject({ isIllegalContentNotice: true, goodFaithConfirmed: true, legalReference: '§ 86a StGB' });
  });
});

describe('anonymous notices', () => {
  it('need a name, an email and the good-faith statement', async () => {
    const l = await makeListing(tx, (await user()).id);
    const base = { kind: 'listing', ref: l.publicToken, reason: 'scam' };
    expect(await createReport(appDb, redis, anon(), base)).toEqual({ ok: false, reason: 'invalid', fields: ['name', 'email', 'goodFaith'] });
    expect(await createReport(appDb, redis, anon(), { ...base, name: 'Erika', goodFaith: true })).toEqual({ ok: false, reason: 'invalid', fields: ['email'] });
    expect(await createReport(appDb, redis, anon(), { ...base, name: 'Erika', email: 'not-an-email', goodFaith: true })).toMatchObject({ ok: false, reason: 'invalid', fields: ['email'] });
    const ok = await createReport(appDb, redis, anon(), { ...base, ...notice() });
    expect(ok).toMatchObject({ ok: true, already: false });
    const [row] = await db.select().from(reports).where(eq(reports.listingId, l.id));
    expect(row!.reporterUserId).toBeNull();
    expect(row!.reporterEmail).toMatch(/^notifier-\d+@example\.test$/);
    expect(row!.reporterName).toBe('Erika Muster');
  });

  it('one open notice per email per thing', async () => {
    const l = await makeListing(tx, (await user()).id);
    const who = notice();
    const base = { kind: 'listing', ref: l.publicToken, reason: 'scam', ...who };
    expect(await createReport(appDb, redis, anon(), base)).toMatchObject({ ok: true, already: false });
    expect(await createReport(appDb, redis, anon(), { ...base, email: who.email.toUpperCase() })).toEqual({ ok: true, reportId: null, already: true });
    expect(await createReport(appDb, redis, anon(), { ...base, ...notice() })).toMatchObject({ ok: true, already: false });
  });

  it('five an hour per IP, ten a day per email', async () => {
    const seller = await user();
    const address = ip();
    for (let i = 0; i < REPORT_LIMITS.perIpHour.max; i++) {
      const l = await makeListing(tx, seller.id);
      expect(await createReport(appDb, redis, { userId: null, ip: address }, { kind: 'listing', ref: l.publicToken, reason: 'spam', ...notice() })).toMatchObject({ ok: true });
    }
    const l = await makeListing(tx, seller.id);
    expect(await createReport(appDb, redis, { userId: null, ip: address }, { kind: 'listing', ref: l.publicToken, reason: 'spam', ...notice() })).toMatchObject({ ok: false, reason: 'rate_limited' });

    const who = notice();
    for (let i = 0; i < REPORT_LIMITS.perEmailDay.max; i++) {
      const x = await makeListing(tx, seller.id);
      expect(await createReport(appDb, redis, anon(), { kind: 'listing', ref: x.publicToken, reason: 'spam', ...who })).toMatchObject({ ok: true });
    }
    const y = await makeListing(tx, seller.id);
    expect(await createReport(appDb, redis, anon(), { kind: 'listing', ref: y.publicToken, reason: 'spam', ...who })).toMatchObject({ ok: false, reason: 'rate_limited' });
  });
});

describe('signed-in limits', () => {
  it('accounts under 7 days report at most five a day; others twenty (shared with chat)', async () => {
    const seller = await user();
    const fresh = await user({ createdAt: new Date() });
    for (let i = 0; i < REPORT_LIMITS.perNewUserDay.max; i++) {
      const l = await makeListing(tx, seller.id);
      expect(await createReport(appDb, redis, { userId: fresh.id }, { kind: 'listing', ref: l.publicToken, reason: 'spam' })).toMatchObject({ ok: true });
    }
    const l = await makeListing(tx, seller.id);
    expect(await createReport(appDb, redis, { userId: fresh.id }, { kind: 'listing', ref: l.publicToken, reason: 'spam' })).toMatchObject({ ok: false, reason: 'rate_limited' });

    const old = await user({ createdAt: new Date(Date.now() - 60 * 86_400_000) });
    for (let i = 0; i < REPORT_LIMITS.perUserDay.max; i++) {
      const x = await makeListing(tx, seller.id);
      expect(await createReport(appDb, redis, { userId: old.id }, { kind: 'listing', ref: x.publicToken, reason: 'spam' })).toMatchObject({ ok: true });
    }
    const y = await makeListing(tx, seller.id);
    expect(await createReport(appDb, redis, { userId: old.id }, { kind: 'listing', ref: y.publicToken, reason: 'spam' })).toMatchObject({ ok: false, reason: 'rate_limited' });
  });
});

describe('the report page', () => {
  it('names what is reported and links back to it', async () => {
    const seller = await user({ name: 'مینا' });
    const l = await makeListing(tx, seller.id, { title: 'دوچرخه' });
    expect(await reportTargetSummary(appDb, 'listing', l.publicToken)).toEqual({ label: 'دوچرخه', isEvent: false, back: `/v/${encodeURIComponent('دوچرخه')}/${l.publicToken}` });
    expect(await reportTargetSummary(appDb, 'user', seller.publicToken)).toMatchObject({ label: 'مینا', back: `/u/${seller.publicToken}` });
    expect(await reportTargetSummary(appDb, 'listing', 'zzzzzzzzzz')).toBeNull();
  });

  it('every reason a visitor can pick names sections that exist', () => {
    for (const reasons of Object.values(PUBLIC_REASONS)) for (const r of reasons) expect(REASON_SECTIONS[r].length).toBeGreaterThan(0);
  });
});

describe('listing codes', () => {
  it('are 9 digits, unique, and drawn for every new listing', async () => {
    const seller = await user();
    const made = await Promise.all(Array.from({ length: 20 }, () => makeListing(tx, seller.id)));
    const codes = made.map((l) => l.refNumber);
    for (const c of codes) expect(String(c)).toMatch(/^[1-9][0-9]{8}$/);
    expect(new Set(codes).size).toBe(codes.length);
    // Not counting up: consecutive listings are far apart
    const sorted = [...made].sort((a, b) => (a.id < b.id ? -1 : 1)).map((l) => l.refNumber);
    expect(sorted.some((c, i) => i > 0 && Math.abs(c - sorted[i - 1]!) > 1000)).toBe(true);
  });

  it('the shuffle is a bijection on a sample (no two sequence values give one code)', async () => {
    const rows = await db.execute(sql`SELECT count(DISTINCT listing_ref_number(n)) AS d, min(listing_ref_number(n)) AS lo, max(listing_ref_number(n)) AS hi FROM generate_series(0::bigint, 199999) n`);
    const r = rows[0] as { d: string; lo: string; hi: string };
    expect(Number(r.d)).toBe(200_000);
    expect(Number(r.lo)).toBeGreaterThanOrEqual(100_000_000);
    expect(Number(r.hi)).toBeLessThanOrEqual(999_999_999);
  });

  it('typed into a search box, opens the live listing (Persian digits too)', async () => {
    const seller = await user();
    const l = await makeListing(tx, seller.id, { title: 'میز' });
    const persian = String(l.refNumber).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
    expect(await pathOfListingCode(appDb, persian)).toBe(`/v/${encodeURIComponent('میز')}/${l.publicToken}`);
    expect(await pathOfListingCode(appDb, ` ${l.refNumber} `)).not.toBeNull();
    await db.update(listings).set({ status: 'paused' }).where(and(eq(listings.id, l.id)));
    expect(await pathOfListingCode(appDb, String(l.refNumber))).toBeNull();
    expect(await pathOfListingCode(appDb, 'پژو ۲۰۶')).toBeNull();
    expect(await pathOfListingCode(appDb, '12345678')).toBeNull();
  });
});
