import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { localDate } from '../src/modules/notifications/local-hour';
import { GET as fontGlyphs } from '../src/app/map/fonts/[stack]/[range]/route';
import { ipBlock } from '../src/lib/client-ip';
import { admin } from '../src/messages/fa';
import { isParticipant } from '../src/modules/chat/queries';
import { appealDecision } from '../src/modules/moderation/appeals';
import {
  archiveRefCode,
  countVisit,
  createRefCode,
  DAILY_KEYS,
  deviceOf,
  flushVisitStats,
  labelFor,
  pageGroup,
  refCodeCache,
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

// Check B, package 3 (visitor numbers, approved Nov 1, 2026)
describe('the counter can’t be filled or broken from outside', () => {
  it('at most 300 sources and 1,000 page groups a day; the rest count as «other»', async () => {
    for (let i = 0; i < DAILY_KEYS.source + 20; i++) await countVisit(redis, visit({ referrer: `https://s${i}.example/`, ip: `2001:db8::${i.toString(16)}` }));
    for (let i = 0; i < DAILY_KEYS.page + 20; i++) await countVisit(redis, visit({ path: `/x/${i}`, landing: false }));
    expect(await redis.hlen(`vs:${DAY}:v:source`)).toBe(DAILY_KEYS.source + 1);
    expect(await redis.hget(`vs:${DAY}:v:source`, 'other')).toBe('20');
    expect((await redis.keys(`vs:${DAY}:u:source:*`)).length).toBe(DAILY_KEYS.source + 1);
    expect(await redis.hlen(`vs:${DAY}:v:page`)).toBe(DAILY_KEYS.page + 1);
    // A source the day already has still counts as itself
    await countVisit(redis, visit({ referrer: 'https://s3.example/' }));
    expect(await redis.hget(`vs:${DAY}:v:source`, 's3.example')).toBe('2');
  });

  it('a big day is written in chunks, and one bad list doesn’t stop the others', async () => {
    const m = redis.multi();
    for (let i = 0; i < 13_200; i++) m.hincrby(`vs:${DAY}:v:page`, `/p/${i}`, 1);
    m.hincrby(`vs:${DAY}:v:total`, 'all', 5);
    await m.exec();
    expect(await flushVisitStats(redis, workerDb, NOW)).toBe(13_201);
    // A count that isn't a number fails its own list only
    await redis.hset(`vs:${DAY}:v:country`, 'DE', 'x');
    await redis.hincrby(`vs:${DAY}:v:total`, 'all', 1);
    await expect(flushVisitStats(redis, workerDb, NOW)).rejects.toThrow();
    const [total] = await db.select().from(schema.visitStats).where(sql`day = ${DAY}::date AND dimension = 'total'`);
    expect(total!.views).toBe(6);
  });

  it('«constructor» is just a name: no crash on «آمار بازدید»', () => {
    expect(sourceOf('http://constructor/', 'peydoo.com', null)).toBe('constructor');
    expect(labelFor(admin.stats.sources, 'constructor')).toBe('constructor');
    expect(labelFor(admin.stats.sources, 'google')).toBe('گوگل');
    expect(pageGroup('/constructor')).toBe('/constructor');
    expect(pageGroup('/toString/x')).toBe('/toString/x');
  });

  it('a business invitation’s link is never stored', async () => {
    expect(pageGroup('/business/invite/AbCdEfGhIjKlMnOpQrStUv')).toBe('invite');
    // Counted before the change: left out when written
    await redis.hincrby(`vs:${DAY}:v:page`, '/business/invite/AbCdEfGhIjKlMnOpQrStUv', 1);
    await countVisit(redis, visit({ path: '/business/invite/ZyXwVuTsRqPoNmLkJiHgFe', landing: false }));
    await flushVisitStats(redis, workerDb, NOW);
    const pages = await db.select({ key: schema.visitStats.key }).from(schema.visitStats).where(sql`day = ${DAY}::date AND dimension = 'page'`);
    expect(pages.map((p) => p.key)).toEqual(['invite']);
  });

  it('a failed ref-code lookup is asked again, not kept for 5 minutes', async () => {
    let calls = 0;
    const codes = refCodeCache(async () => {
      calls++;
      if (calls === 1) throw new Error('database restarting');
      return new Set(['volek']);
    });
    expect(await codes()).toEqual(new Set());
    expect(await codes()).toEqual(new Set(['volek']));
    expect(await codes()).toEqual(new Set(['volek']));
    expect(calls).toBe(2);
  });

  it('an IPv6 connection’s whole /64 shares one hourly limit', () => {
    expect(ipBlock('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(ipBlock('2001:0DB8:0001:0002::9')).toBe('2001:db8:1:2::/64');
    expect(ipBlock('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipBlock('203.0.113.5')).toBe('203.0.113.5');
  });
});

describe('hand-edited addresses give «not found», not an error page', () => {
  it('ids that aren’t ids, a lone «%», a font called «constructor»', async () => {
    const me = await user();
    expect(await isParticipant(appDb, me.id, '-'.repeat(36))).toBe(false);
    expect(await isParticipant(appDb, me.id, 'a'.repeat(36))).toBe(false);
    expect(await appealDecision(appDb, redis, me.id, '-'.repeat(36), 'لطفاً دوباره نگاه کنید.')).toEqual({ ok: false, reason: 'not_found' });
    const font = (stack: string) => fontGlyphs(new Request('https://peydoo.test/'), { params: Promise.resolve({ stack, range: '0-255.pbf' }) });
    expect((await font('%')).status).toBe(404);
    expect((await font('constructor')).status).toBe(404);
    expect((await font('Noto%20Sans%20Regular')).status).toBe(200);
  });
});

describe('migration 0042', () => {
  it('merges invitation links stored before into one «invite» row per day', async () => {
    await rollback(async (tx) => {
      await tx.execute(sql`INSERT INTO visit_stats (day, dimension, key, views) VALUES
        ('2031-02-01', 'page', '/business/invite/AbCdEfGhIjKlMnOpQrStUv', 2), ('2031-02-01', 'page', '/business/invite/ZyXwVuTsRqPoNmLkJiHgFe', 3),
        ('2031-02-02', 'page', '/business/invite/AbCdEfGhIjKlMnOpQrStUv', 1), ('2031-02-02', 'page', 'invite', 4), ('2031-02-02', 'page', 'listing', 9)`);
      const file = readFileSync(new URL('../src/db/migrations/0042_invite_pages.sql', import.meta.url), 'utf8');
      for (const statement of file.split('--> statement-breakpoint')) await tx.execute(sql.raw(statement));
      const rows = await tx.execute<{ day: string; key: string; views: number }>(sql`SELECT day::text, key, views FROM visit_stats WHERE day IN ('2031-02-01', '2031-02-02') ORDER BY day, key`);
      expect(rows.map((r) => [r.day, r.key, r.views])).toEqual([
        ['2031-02-01', 'invite', 5],
        ['2031-02-02', 'invite', 5],
        ['2031-02-02', 'listing', 9],
      ]);
    });
  });
});
