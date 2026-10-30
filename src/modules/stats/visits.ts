import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Db, Queryable } from '../../db/drizzle';
import { auditLog, refCodes } from '../../db/schema';
import { localDate } from '../notifications/local-hour';

// Visitor numbers without cookies (owner, Oct 30, 2026: "Own counter + ref links", instead of
// Google Analytics; docs/setup.md, "Visitor numbers"). Every page sends one small request
// (src/components/visit-beacon.tsx → /api/v); nothing is stored on the device. A visitor is
// counted once a day through a hash of their IP and browser with a secret that changes every day
// and is thrown away after two (Valkey only): the hash can't be turned back into either, and the
// same person is someone else tomorrow. Valkey keeps the day's counters; the worker writes the
// totals to `visit_stats` every 10 minutes. Days are Berlin days.

export const STATS_TIME_ZONE = 'Europe/Berlin';
const KEEP_SECONDS = 3 * 86_400;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|httpclient|monitor|uptime/i;

export type VisitDimension = 'total' | 'source' | 'country' | 'page' | 'device';
/** Dimensions with a daily visitor count; pages count views only */
const UNIQUE: VisitDimension[] = ['total', 'source', 'country', 'device'];

/** Search engines and social sites by their address; anything else is its own domain */
const KNOWN_SOURCES: Array<[RegExp, string]> = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)yahoo\./, 'yahoo'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'telegram'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)reddit\.com$/, 'reddit'],
];

/** Where a visit came from: one of the owner's ref codes, a known site, another domain, or direct */
export function sourceOf(referrer: string | null | undefined, ownHost: string, ref: string | null): string {
  if (ref) return `ref:${ref}`;
  let host: string;
  try {
    host = new URL(referrer ?? '').hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'direct';
  }
  if (!host || host === ownHost.replace(/^www\./, '')) return 'direct';
  for (const [re, name] of KNOWN_SOURCES) if (re.test(host)) return name;
  return /^[a-z0-9.-]{1,40}$/.test(host) ? host : 'other';
}

export function deviceOf(userAgent: string): 'phone' | 'tablet' | 'computer' {
  if (/iPad|Tablet/i.test(userAgent)) return 'tablet';
  return /Mobi|Android|iPhone|iPod/i.test(userAgent) ? 'phone' : 'computer';
}

/**
 * A page for the "most viewed" list: browse pages by their path (country, city, category), a
 * business by its page, every listing, event or seller page as one group, the rest by section
 */
export function pageGroup(path: string): string {
  const p = path.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
  const parts = p.split('/').filter(Boolean);
  if (!parts.length) return '/';
  const [first] = parts;
  const sections: Record<string, string> = { v: 'listing', e: 'event', u: 'seller', chat: 'chat', my: 'account', account: 'account', login: 'login', new: 'post', favorites: 'account', alerts: 'account' };
  if (first === 'b' && parts[1]) return `/b/${parts[1]}`.slice(0, 120);
  if (sections[first!]) return sections[first!]!;
  return `/${parts.slice(0, 3).join('/')}`.slice(0, 120);
}

async function salt(redis: Redis, day: string): Promise<string> {
  const key = `vs:${day}:salt`;
  await redis.set(key, randomBytes(32).toString('hex'), 'EX', KEEP_SECONDS, 'NX');
  return (await redis.get(key))!;
}

/** Today's (or that day's) code for one visitor: no IP or browser can be read back from it */
async function visitorOn(redis: Redis, day: string, ip: string | null, userAgent: string): Promise<string> {
  return createHash('sha256').update(`${await salt(redis, day)}|${ip ?? ''}|${userAgent}`).digest('base64url').slice(0, 22);
}

export type Visit = {
  path: string;
  /** The first page of a visit (the tab's first load) carries where it came from */
  landing: boolean;
  referrer: string | null;
  /** A valid ref code from the address (`?ref=`), already checked */
  ref: string | null;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  ownHost: string;
  now?: Date;
};

/** Counts one page view; false for bots and anything that isn't a page */
export async function countVisit(redis: Redis, v: Visit): Promise<boolean> {
  if (!v.userAgent || BOT.test(v.userAgent)) return false;
  if (!v.path.startsWith('/') || v.path.length > 300) return false;
  const now = v.now ?? new Date();
  const day = localDate(now, STATS_TIME_ZONE);
  const who = await visitorOn(redis, day, v.ip, v.userAgent);
  const keys: Array<[VisitDimension, string]> = [
    ['total', 'all'],
    ['page', pageGroup(v.path)],
    ['country', v.country && /^[A-Z]{2}$/.test(v.country) ? v.country : 'XX'],
    ['device', deviceOf(v.userAgent)],
  ];
  const source = v.landing ? sourceOf(v.referrer, v.ownHost, v.ref) : null;
  if (source) keys.push(['source', source]);
  const m = redis.multi();
  for (const [dim, key] of keys) {
    m.hincrby(`vs:${day}:v:${dim}`, key, 1).expire(`vs:${day}:v:${dim}`, KEEP_SECONDS);
    if (UNIQUE.includes(dim)) m.pfadd(`vs:${day}:u:${dim}:${key}`, who).expire(`vs:${day}:u:${dim}:${key}`, KEEP_SECONDS);
  }
  // Where today's visitor first came from, for their sign-up (sourceOfVisitor)
  if (source) m.hsetnx(`vs:${day}:who`, who, source).expire(`vs:${day}:who`, KEEP_SECONDS);
  await m.exec();
  return true;
}

/** Where someone signing up now came from today (or yesterday), worked out the same way; null if unknown */
export async function sourceOfVisitor(redis: Redis, ip: string | null, userAgent: string | null, now: Date = new Date()): Promise<string | null> {
  if (!userAgent) return null;
  for (const at of [now, new Date(now.getTime() - 86_400_000)]) {
    const day = localDate(at, STATS_TIME_ZONE);
    if (!(await redis.exists(`vs:${day}:salt`))) continue;
    const found = await redis.hget(`vs:${day}:who`, await visitorOn(redis, day, ip, userAgent));
    if (found) return found;
  }
  return null;
}

/**
 * Right after signing in: an account made in the last 10 minutes gets where its person came from
 * today (`users.signup_source`), or `direct` when that visit wasn't counted. Once.
 */
export async function recordSignupSource(db: Queryable, redis: Redis, opts: { userId: string; ip: string | null; userAgent: string | null; now?: Date }): Promise<void> {
  const now = opts.now ?? new Date();
  const source = (await sourceOfVisitor(redis, opts.ip, opts.userAgent, now)) ?? 'direct';
  await db.execute(sql`
    UPDATE users SET signup_source = ${source}
    WHERE id = ${opts.userId}::uuid AND signup_source IS NULL AND created_at > ${new Date(now.getTime() - 10 * 60_000).toISOString()}::timestamptz`);
}

/** Worker, every 10 minutes: today's and yesterday's counters into `visit_stats` (absolute numbers) */
export async function flushVisitStats(redis: Redis, db: Queryable, now: Date = new Date()): Promise<number> {
  let rows = 0;
  for (const at of [new Date(now.getTime() - 86_400_000), now]) {
    const day = localDate(at, STATS_TIME_ZONE);
    for (const dim of ['total', 'source', 'country', 'page', 'device'] as const) {
      const views = await redis.hgetall(`vs:${day}:v:${dim}`);
      const entries = Object.entries(views).filter(([key]) => key.length >= 1 && key.length <= 120);
      if (!entries.length) continue;
      const values = [];
      for (const [key, n] of entries) {
        const visitors = UNIQUE.includes(dim) ? await redis.pfcount(`vs:${day}:u:${dim}:${key}`) : 0;
        values.push(sql`(${day}::date, ${dim}, ${key}, ${Number(n)}, ${visitors})`);
      }
      await db.execute(sql`
        INSERT INTO visit_stats (day, dimension, key, views, visitors)
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT (day, dimension, key) DO UPDATE SET views = EXCLUDED.views, visitors = EXCLUDED.visitors`);
      rows += values.length;
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// The owner's links (admin › «آمار بازدید»)
// ---------------------------------------------------------------------------------------------

export const refCodeInput = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/),
  label: z.string().trim().min(1).max(80),
});

export type RefCodeResult = { ok: true } | { ok: false; reason: 'invalid' | 'taken' };

export async function createRefCode(db: Db, staff: { userId: string; sessionId: string | null }, input: unknown): Promise<RefCodeResult> {
  const parsed = refCodeInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  return db.transaction(async (tx) => {
    const added = await tx.insert(refCodes).values({ ...parsed.data, createdByUserId: staff.userId }).onConflictDoNothing().returning({ id: refCodes.id });
    if (!added.length) return { ok: false, reason: 'taken' };
    await tx.insert(auditLog).values({ actorType: 'staff', actorUserId: staff.userId, action: 'stats.ref_code_created', targetType: 'ref_code', targetId: added[0]!.id, data: parsed.data });
    return { ok: true };
  });
}

export async function archiveRefCode(db: Db, staff: { userId: string }, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const done = await tx.update(refCodes).set({ archivedAt: new Date() }).where(sql`${refCodes.id} = ${id}::uuid AND ${refCodes.archivedAt} IS NULL`).returning({ id: refCodes.id });
    if (done.length) await tx.insert(auditLog).values({ actorType: 'staff', actorUserId: staff.userId, action: 'stats.ref_code_archived', targetType: 'ref_code', targetId: id });
    return done.length > 0;
  });
}

/** The live codes, for checking `?ref=` (cached by the caller) */
export async function liveRefCodes(db: Queryable): Promise<Set<string>> {
  const rows = await db.execute<{ code: string }>(sql`SELECT code FROM ref_codes WHERE archived_at IS NULL`);
  return new Set(rows.map((r) => r.code));
}

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------

export type Row = { key: string; views: number; visitors: number };
export type FunnelRow = { source: string; signups: number; verified: number; posted: number; messaged: number };

export type VisitReport = {
  series: Array<{ day: string; views: number; visitors: number }>;
  totals: { views: number; visitors: number };
  sources: Row[];
  countries: Row[];
  pages: Row[];
  devices: Row[];
  funnel: FunnelRow[];
  answers: Array<{ answer: string; n: number }>;
  returning: number;
  refs: Array<{ id: string; code: string; label: string; createdAt: Date; archived: boolean; visits: number; visitors: number; signups: number }>;
};

/** The last `days` days (Berlin), today included */
export async function visitReport(db: Queryable, days: number, now: Date = new Date()): Promise<VisitReport> {
  const today = localDate(now, STATS_TIME_ZONE);
  const from = localDate(new Date(now.getTime() - (days - 1) * 86_400_000), STATS_TIME_ZONE);
  const fromInstant = new Date(now.getTime() - days * 86_400_000).toISOString();
  const sum = (dim: VisitDimension, limit: number) =>
    db.execute<{ key: string; views: number; visitors: number }>(sql`
      SELECT key, sum(views)::int AS views, sum(visitors)::int AS visitors FROM visit_stats
      WHERE dimension = ${dim} AND day BETWEEN ${from}::date AND ${today}::date
      GROUP BY key ORDER BY sum(visitors) DESC, sum(views) DESC, key LIMIT ${limit}`);
  const [daily, sources, countries, pages, devices, funnel, answers, returning, refs] = await Promise.all([
    db.execute<{ day: string; views: number; visitors: number }>(sql`
      SELECT g.day::text AS day, coalesce(s.views, 0)::int AS views, coalesce(s.visitors, 0)::int AS visitors
      FROM generate_series(${from}::date, ${today}::date, interval '1 day') AS g(day)
      LEFT JOIN visit_stats s ON s.day = g.day::date AND s.dimension = 'total' AND s.key = 'all'
      ORDER BY g.day`),
    sum('source', 30),
    sum('country', 20),
    sum('page', 20),
    sum('device', 5),
    db.execute<{ source: string; signups: number; verified: number; posted: number; messaged: number }>(sql`
      SELECT coalesce(u.signup_source, 'unknown') AS source, count(*)::int AS signups,
             count(*) FILTER (WHERE u.phone_verified_at IS NOT NULL)::int AS verified,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM listings l WHERE l.user_id = u.id AND l.published_at IS NOT NULL))::int AS posted,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM messages m WHERE m.sender_user_id = u.id))::int AS messaged
      FROM users u
      WHERE u.created_at >= ${fromInstant}::timestamptz AND u.status <> 'deleted' AND u.test_account IS NULL AND u.staff_role IS NULL
      GROUP BY 1 ORDER BY 2 DESC, 1`),
    db.execute<{ answer: string; n: number }>(sql`
      SELECT signup_answer AS answer, count(*)::int AS n FROM users
      WHERE signup_answer IS NOT NULL AND signup_answer <> 'skipped' AND created_at >= ${fromInstant}::timestamptz
      GROUP BY 1 ORDER BY 2 DESC`),
    // People with an account older than a week who were signed in this week
    db.execute<{ n: number }>(sql`
      SELECT count(DISTINCT s.user_id)::int AS n FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.updated_at >= ${new Date(now.getTime() - 7 * 86_400_000).toISOString()}::timestamptz
        AND u.created_at < ${new Date(now.getTime() - 7 * 86_400_000).toISOString()}::timestamptz
        AND u.status = 'active' AND u.test_account IS NULL AND u.staff_role IS NULL AND s.opened_by_user_id IS NULL`),
    db.execute<{ id: string; code: string; label: string; created_at: Date; archived: boolean; visits: number; visitors: number; signups: number }>(sql`
      SELECT r.id, r.code, r.label, r.created_at, r.archived_at IS NOT NULL AS archived,
             coalesce((SELECT sum(views) FROM visit_stats v WHERE v.dimension = 'source' AND v.key = 'ref:' || r.code AND v.day BETWEEN ${from}::date AND ${today}::date), 0)::int AS visits,
             coalesce((SELECT sum(visitors) FROM visit_stats v WHERE v.dimension = 'source' AND v.key = 'ref:' || r.code AND v.day BETWEEN ${from}::date AND ${today}::date), 0)::int AS visitors,
             (SELECT count(*) FROM users u WHERE u.signup_source = 'ref:' || r.code AND u.created_at >= ${fromInstant}::timestamptz)::int AS signups
      FROM ref_codes r ORDER BY r.archived_at IS NOT NULL, r.created_at DESC`),
  ]);
  const series = daily.map((d) => ({ day: d.day.slice(0, 10), views: d.views, visitors: d.visitors }));
  return {
    series,
    totals: { views: series.reduce((n, d) => n + d.views, 0), visitors: series.reduce((n, d) => n + d.visitors, 0) },
    sources: [...sources],
    countries: [...countries],
    pages: [...pages],
    devices: [...devices],
    funnel: [...funnel],
    answers: [...answers],
    returning: returning[0]?.n ?? 0,
    refs: refs.map((r) => ({ id: r.id, code: r.code, label: r.label, createdAt: new Date(r.created_at), archived: r.archived, visits: r.visits, visitors: r.visitors, signups: r.signups })),
  };
}
