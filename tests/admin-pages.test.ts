import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { auditLog, organizations, outboxEvents, sessions, users } from '../src/db/schema';
import { can } from '../src/modules/admin/access';
import { auditRows } from '../src/modules/admin/audit-log';
import { opPermission, OPS } from '../src/modules/admin/ops';
import { cityMetrics, overview } from '../src/modules/admin/overview';
import { stripeLink } from '../src/modules/admin/payments';
import { collectStatus, readStatus, writeStatus } from '../src/modules/admin/system';
import { businessesAdmin, releasePhone, searchListingsAdmin, searchUsers, signOutEverywhere } from '../src/modules/admin/users';
import { setVerification } from '../src/modules/organizations/organizations';
import { normalizePersian } from '../src/lib/normalize-persian';
import { canPostListing, loadActor } from '../src/modules/users/permissions';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, makeOrganization, type Tx } from './db';
import { user } from './listings-fixtures';

// The rest of the admin page (roadmap step 8): who may do which operation, the overview's numbers,
// search by listing code, sessions and phone numbers, business verification, the audit log and the
// system snapshot. Runs as classifieds_app (the web) and classifieds_worker.

const tx = db as unknown as Tx;
const DAY = 86_400_000;
const staffCtx = async (role: 'moderator' | 'admin') => {
  const u = await user();
  await db.update(users).set({ staffRole: role }).where(eq(users.id, u.id));
  return { userId: u.id, role, sessionId: randomUUID(), ip: '203.0.113.8', userAgent: 'test' } as const;
};

describe('operations and roles', () => {
  it('moderators decide content, warn, restrict and suspend for a while; bans, businesses and lifting are for admins', () => {
    const mod = (op: (typeof OPS)[number], extra: { days?: '7' | '30' | 'none'; appealId?: string } = {}, type?: string) => can('moderator', opPermission({ op, ...extra }, type));
    for (const op of ['take_down', 'restore', 'no_violation', 'approve', 'warning', 'hide_message', 'unhide_message', 'keep'] as const) expect(mod(op), op).toBe(true);
    expect(mod('posting_restricted', { days: '30' })).toBe(true);
    expect(mod('messaging_restricted', { days: '7' })).toBe(true);
    expect(mod('suspended', { days: '30' })).toBe(true);
    expect(mod('posting_restricted', { days: 'none' })).toBe(false);
    expect(mod('banned')).toBe(false);
    expect(mod('suspend_business')).toBe(false);
    expect(mod('lift_business')).toBe(false);
    expect(mod('lift_sanction')).toBe(false);
    // … except when granting an appeal against a limited sanction
    expect(mod('lift_sanction', { appealId: randomUUID() }, 'suspended')).toBe(true);
    expect(mod('lift_sanction', { appealId: randomUUID() }, 'banned')).toBe(false);
    for (const op of OPS) expect(can('admin', opPermission({ op, days: 'none', appealId: undefined }, 'banned'))).toBe(true);
  });
});

describe('the overview', () => {
  it('counts new listings, chats and reports per day and country, and revenue after refunds', async () => {
    const before = await overview(appDb, { days: 30, timeZone: 'Europe/Berlin' });
    const s = await user();
    const l = await makeListing(tx, s.id);
    const buyer = await user();
    await db.insert(schema.conversations).values({ listingId: l.id, buyerUserId: buyer.id, sellerUserId: s.id });
    await db.insert(schema.reports).values({ reporterUserId: buyer.id, listingId: l.id, reasonCode: 'spam' });
    const after = await overview(appDb, { days: 30, timeZone: 'Europe/Berlin' });
    expect(after.totals.listings.today - before.totals.listings.today).toBe(1);
    expect(after.totals.listings.byCountry.DE! - (before.totals.listings.byCountry.DE ?? 0)).toBe(1);
    expect(after.totals.chats.week - before.totals.chats.week).toBe(1);
    expect(after.totals.reports.month - before.totals.reports.month).toBe(1);
    expect(after.totals.users.today - before.totals.users.today).toBe(2);
    expect(after.series.listings).toHaveLength(30);
    expect(after.series.listings.at(-1)!.value - before.series.listings.at(-1)!.value).toBe(1);
  });

  it('city metrics: live listings, the gate categories, weekly posters and chats within 7 days', async () => {
    const s = await user();
    const old = new Date(Date.now() - 10 * DAY);
    const a = await makeListing(tx, s.id, { publishedAt: old, rankedAt: old });
    await makeListing(tx, s.id, { publishedAt: old, rankedAt: old });
    const buyer = await user();
    await db.insert(schema.conversations).values({ listingId: a.id, buyerUserId: buyer.id, sellerUserId: s.id, createdAt: new Date(old.getTime() + 2 * DAY) });
    const berlin = (await cityMetrics(appDb)).find((c) => c.city === 'berlin')!;
    expect(berlin.active).toBeGreaterThanOrEqual(2);
    expect(berlin.cohort).toBeGreaterThanOrEqual(2);
    expect(berlin.withChat).toBeGreaterThanOrEqual(1);
    expect(berlin.withChat).toBeLessThanOrEqual(berlin.cohort);
    // Phones are not housing, services or jobs
    expect(berlin.gateActive).toBeLessThan(berlin.active);
  });
});

describe('finding things', () => {
  it('a listing by its code, token, pasted address or title words', async () => {
    const l = await makeListing(tx, (await user()).id, { title: 'دوچرخه کوهستان قرمز', titleNormalized: normalizePersian('دوچرخه کوهستان قرمز') });
    const persian = String(l.refNumber).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
    for (const q of [String(l.refNumber), persian, l.publicToken, `https://staging.peydoo.com/v/x/${l.publicToken}`, 'کوهستان قرمز']) {
      expect((await searchListingsAdmin(appDb, { q, status: null, country: null, events: null })).map((r) => r.id), q).toContain(l.id);
    }
    expect(await searchListingsAdmin(appDb, { q: String(l.refNumber), status: 'paused', country: null, events: null })).toEqual([]);
  });

  it('email and phone search only for those who may see them', async () => {
    const u = await user();
    expect((await searchUsers(appDb, u.email, { withContact: true })).map((r) => r.id)).toContain(u.id);
    expect((await searchUsers(appDb, u.email, { withContact: false })).map((r) => r.id)).not.toContain(u.id);
    expect((await searchUsers(appDb, u.phoneE164!, { withContact: true })).map((r) => r.id)).toContain(u.id);
    expect((await searchUsers(appDb, u.phoneE164!, { withContact: false })).map((r) => r.id)).not.toContain(u.id);
    expect((await searchUsers(appDb, u.publicToken, { withContact: false })).map((r) => r.id)).toEqual([u.id]);
  });
});

describe('accounts', () => {
  it('signing someone out everywhere and releasing a number are audited; the number can be verified again', async () => {
    const admin = await staffCtx('admin');
    const u = await user();
    await db.insert(sessions).values([1, 2].map((i) => ({ userId: u.id, token: `t-${u.id}-${i}`, expiresAt: new Date(Date.now() + DAY) })));
    expect(await signOutEverywhere(appDb, admin, u.id)).toBe(2);
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toEqual([]);

    expect(await releasePhone(appDb, admin, u.id, 'صاحب تازه شماره')).toBe(true);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after).toMatchObject({ phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null });
    expect(canPostListing(await loadActor(appDb, u.id))).toEqual({ ok: false, reason: 'phone_required' });
    const rows = await db.select().from(auditLog).where(eq(auditLog.targetId, u.id));
    expect(rows.map((r) => r.action).sort()).toEqual(['user.phone_released', 'user.signed_out']);
    const released = rows.find((r) => r.action === 'user.phone_released')!;
    expect(released.data).toMatchObject({ last4: u.phoneE164!.slice(-4), role: 'admin' });
    expect(JSON.stringify(released.data)).not.toContain(u.phoneE164!);
    expect((await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, u.id))).map((e) => e.eventType)).toContain('user.phone_released');
    expect(await releasePhone(appDb, admin, u.id, '')).toBe(false);
  });
});

describe('businesses', () => {
  it('the waiting list holds businesses with legal details; verifying writes the audit row with the session', async () => {
    const admin = await staffCtx('admin');
    const owner = await user();
    const org = await makeOrganization(tx, owner.id);
    expect((await businessesAdmin(appDb, { waiting: true, q: '' })).some((b) => b.id === org.id)).toBe(false);
    await db.update(organizations).set({ legalName: 'Muster GmbH', registrationNumber: 'HRB 1234' }).where(eq(organizations.id, org.id));
    expect((await businessesAdmin(appDb, { waiting: true, q: '' })).some((b) => b.id === org.id)).toBe(true);
    await appDb.transaction((t) => setVerification(t, { slug: org.slug, status: 'verified', byUserId: admin.userId, staff: admin, note: 'HRB geprüft' }));
    expect((await db.select().from(organizations).where(eq(organizations.id, org.id)))[0]).toMatchObject({ verificationStatus: 'verified', verifiedByUserId: admin.userId });
    const [row] = await db.select().from(auditLog).where(and(eq(auditLog.targetId, org.id), eq(auditLog.action, 'organization.verification')));
    expect(row).toMatchObject({ actorType: 'staff', sessionId: admin.sessionId, data: { status: 'verified', note: 'HRB geprüft', role: 'admin' } });
    expect((await businessesAdmin(appDb, { waiting: true, q: '' })).some((b) => b.id === org.id)).toBe(false);
  });
});

describe('audit log and status', () => {
  it('moderators see only their own rows', async () => {
    const mod = await staffCtx('moderator');
    const other = await staffCtx('admin');
    await db.insert(auditLog).values([
      { actorType: 'staff', actorUserId: mod.userId, action: 'listing.taken_down' },
      { actorType: 'staff', actorUserId: other.userId, action: 'listing.taken_down' },
    ]);
    const mine = await auditRows(appDb, { action: 'listing.', actor: '', target: '', onlyUserId: mod.userId });
    expect(mine.every((r) => r.actorId === mod.userId)).toBe(true);
    expect(mine.length).toBeGreaterThan(0);
    const all = await auditRows(appDb, { action: 'listing.taken', actor: other.userId, target: '', onlyUserId: null });
    expect(all.every((r) => r.actorId === other.userId)).toBe(true);
  });

  it('the worker snapshot reaches the status page and expires', async () => {
    const snap = await collectStatus(workerDb, redis, null, `test-status-${randomUUID().slice(0, 6)}`);
    expect(Object.keys(snap.queues)).toContain('moderation');
    expect(snap.activeListings).toBeGreaterThan(0);
    await writeStatus(redis, snap);
    expect((await readStatus(redis)).snapshot).toEqual(snap);
    expect(await redis.ttl('admin:status')).toBeGreaterThan(200);
  });

  it('Stripe links go to the test dashboard unless live', () => {
    expect(stripeLink('pi_123', false)).toBe('https://dashboard.stripe.com/test/payments/pi_123');
    expect(stripeLink('sub_1', true)).toBe('https://dashboard.stripe.com/subscriptions/sub_1');
    expect(stripeLink(null, true)).toBeNull();
  });
});
