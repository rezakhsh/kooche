import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { localDate } from '../src/modules/notifications/local-hour';
import {
  archiveRefCode,
  countVisit,
  createRefCode,
  deviceOf,
  flushVisitStats,
  pageGroup,
  recordSignupSource,
  sourceOf,
  STATS_TIME_ZONE,
  visitReport,
  type Visit,
} from '../src/modules/stats/visits';
import { appDb, redis, workerDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, rollback, setRole } from './db';
import { user } from './listings-fixtures';

// Visitor numbers without cookies (owner, Oct 30, 2026): daily counts from Valkey into
// visit_stats, the owner's ref links, and where new accounts came from.

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0';
// A fixed day far from other tests' "now"
const NOW = new Date('2031-05-12T10:00:00Z');
const DAY = localDate(NOW, STATS_TIME_ZONE);

const visit = (over: Partial<Visit>): Visit => ({ path: '/', landing: true, referrer: null, ref: null, ip: '203.0.113.5', userAgent: PHONE, country: 'DE', ownHost: 'peydoo.com', now: NOW, ...over });

beforeEach(async () => {
  await redis.flushdb();
  await db.execute(sql`DELETE FROM visit_stats WHERE day = ${DAY}::date`);
});

describe('what a visit is', () => {
  it('a source: a ref code, a known site, another domain, or direct', () => {
    expect(sourceOf('https://www.google.de/', 'peydoo.com', null)).toBe('google');
    expect(sourceOf('https://l.instagram.com/?u=x', 'peydoo.com', null)).toBe('instagram');
    expect(sourceOf('https://t.me/berlini', 'peydoo.com', null)).toBe('telegram');
    expect(sourceOf('https://kojast.de/a', 'peydoo.com', null)).toBe('kojast.de');
    expect(sourceOf('https://peydoo.com/germany', 'peydoo.com', null)).toBe('direct');
    expect(sourceOf(null, 'peydoo.com', null)).toBe('direct');
    expect(sourceOf('https://www.google.de/', 'peydoo.com', 'volek')).toBe('ref:volek');
  });

  it('a page group and a device', () => {
    expect(pageGroup('/germany/berlin/housing/rooms?x=1')).toBe('/germany/berlin/housing');
    expect(pageGroup('/v/room-in-berlin/abcdefghjk')).toBe('listing');
    expect(pageGroup('/b/bazarche-hafez/team')).toBe('/b/bazarche-hafez');
    expect(pageGroup('/')).toBe('/');
    expect([deviceOf(PHONE), deviceOf(DESKTOP), deviceOf('Mozilla/5.0 (iPad; CPU OS 18_0)')]).toEqual(['phone', 'computer', 'tablet']);
  });
});

describe('counting', () => {
  it('views and once-a-day visitors per dimension, without bots; written to visit_stats', async () => {
    expect(await countVisit(redis, visit({ referrer: 'https://www.google.com/' }))).toBe(true);
    expect(await countVisit(redis, visit({ path: '/germany/berlin', landing: false }))).toBe(true);
    expect(await countVisit(redis, visit({ ip: '203.0.113.6', userAgent: DESKTOP, country: 'AT' }))).toBe(true);
    expect(await countVisit(redis, visit({ userAgent: 'Googlebot/2.1' }))).toBe(false);
    await flushVisitStats(redis, workerDb, NOW);
    const rows = await db.select().from(schema.visitStats).where(sql`day = ${DAY}::date`);
    const get = (dimension: string, key: string) => rows.find((r) => r.dimension === dimension && r.key === key);
    expect(get('total', 'all')).toMatchObject({ views: 3, visitors: 2 });
    expect(get('source', 'google')).toMatchObject({ views: 1, visitors: 1 });
    expect(get('source', 'direct')).toMatchObject({ views: 1, visitors: 1 });
    expect(get('country', 'AT')).toMatchObject({ views: 1, visitors: 1 });
    expect(get('page', '/germany/berlin')).toMatchObject({ views: 1 });
    expect(get('device', 'phone')).toMatchObject({ views: 2, visitors: 1 });
    // Flushing again writes the same totals, not twice as much
    await flushVisitStats(redis, workerDb, NOW);
    expect((await db.select().from(schema.visitStats).where(sql`day = ${DAY}::date AND dimension = 'total'`))[0]).toMatchObject({ views: 3 });
    // No IP or browser string anywhere
    expect(JSON.stringify(rows)).not.toContain('203.0.113');
    expect(JSON.stringify(await redis.keys('vs:*'))).not.toContain('203.0.113');
  });
});

describe('the owner’s links and new accounts', () => {
  it('a ref link: made once, counted, and a sign-up from it is credited to it', async () => {
    const admin = await user();
    const code = `volek-${randomUUID().slice(0, 6)}`;
    const staff = { userId: admin.id, sessionId: null };
    expect(await createRefCode(appDb, staff, { code: code.toUpperCase(), label: 'Volek Events' })).toEqual({ ok: true });
    expect(await createRefCode(appDb, staff, { code, label: 'again' })).toEqual({ ok: false, reason: 'taken' });
    expect(await createRefCode(appDb, staff, { code: 'x', label: 'short' })).toEqual({ ok: false, reason: 'invalid' });

    const now = new Date();
    await countVisit(redis, visit({ ref: code, ip: '198.51.100.7', now }));
    const fresh = await user();
    await recordSignupSource(appDb, redis, { userId: fresh.id, ip: '198.51.100.7', userAgent: PHONE, now });
    expect((await db.select({ s: schema.users.signupSource }).from(schema.users).where(eq(schema.users.id, fresh.id)))[0]!.s).toBe(`ref:${code}`);
    // Someone else, not counted today: direct; and an old account isn't touched
    const other = await user();
    await recordSignupSource(appDb, redis, { userId: other.id, ip: '198.51.100.99', userAgent: DESKTOP, now });
    expect((await db.select({ s: schema.users.signupSource }).from(schema.users).where(eq(schema.users.id, other.id)))[0]!.s).toBe('direct');
    const old = await user({ createdAt: new Date(Date.now() - 86_400_000) });
    await recordSignupSource(appDb, redis, { userId: old.id, ip: '198.51.100.7', userAgent: PHONE, now });
    expect((await db.select({ s: schema.users.signupSource }).from(schema.users).where(eq(schema.users.id, old.id)))[0]!.s).toBeNull();

    await flushVisitStats(redis, workerDb, now);
    const report = await visitReport(appDb, 7, now);
    expect(report.refs.find((r) => r.code === code)).toMatchObject({ label: 'Volek Events', visitors: 1, signups: 1, archived: false });
    expect(report.funnel.find((f) => f.source === `ref:${code}`)).toMatchObject({ signups: 1 });
    const [row] = await db.select().from(schema.refCodes).where(eq(schema.refCodes.code, code));
    expect(await archiveRefCode(appDb, staff, row!.id)).toBe(true);
    expect((await visitReport(appDb, 7, now)).refs.find((r) => r.code === code)?.archived).toBe(true);
  });

  it('the app reads the numbers but only the worker writes them', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      await expectError(tx.execute(sql`INSERT INTO visit_stats (day, dimension, key, views) VALUES ('2031-01-01', 'total', 'all', 1)`), INSUFFICIENT_PRIVILEGE);
    });
  });
});
