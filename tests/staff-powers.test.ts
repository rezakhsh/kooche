import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { can, staffState } from '../src/modules/admin/access';
import { actingState, allowActingChanges, closeActingSession, closeEndedActingSessions, openActingSession } from '../src/modules/admin/acting';
import type { StaffContext } from '../src/modules/admin/audit';
import { markedMethod, methodMark } from '../src/modules/admin/gate';
import { opPermission } from '../src/modules/admin/ops';
import { setStaffRole } from '../src/modules/admin/staff';
import { contactsListed, signOutEverywhere } from '../src/modules/admin/users';
import { appealFits } from '../src/modules/moderation/appeals';
import { liftSanction, restoreListing, sanctionUser, takeDownListing, type Grounds } from '../src/modules/moderation/decide';
import { signedOutMail, staffRoleMail } from '../src/modules/moderation/notices';
import { appDb, workerDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { user } from './listings-fixtures';

// Staff powers, fixed after the code check of Oct 30, 2026 (package 1): a moderator's sanctions
// have an end, appeals must be real, rank counts, sign-in-as ends with its record and email, the
// method mark can't be forged, and staff changes are told.

const tx = db as unknown as Tx;
const DAY = 86_400_000;
const MINUTE = 60_000;
const TZ = 'Europe/Berlin';
const APP = 'https://app.example.test';
const scam: Grounds = { reason: 'scam', section: '6.1', legalGround: null, facts: 'در توضیحات پیش‌پرداخت با کارت هدیه خواسته شده است.' };

async function staff(role: 'moderator' | 'admin'): Promise<StaffContext & { email: string }> {
  const u = await user({ createdAt: new Date(Date.now() - 90 * DAY) });
  await db.update(schema.users).set({ staffRole: role, twoFactorEnabled: true }).where(eq(schema.users.id, u.id));
  const [s] = await db.insert(schema.sessions).values({ userId: u.id, token: randomUUID().replace(/-/g, ''), expiresAt: new Date(Date.now() + DAY), staffVerifiedAt: new Date() }).returning();
  return { userId: u.id, role, sessionId: s!.id, ip: null, userAgent: null, email: u.email };
}

const someone = () => user({ createdAt: new Date(Date.now() - 60 * DAY) });
const audit = (action: string, targetId: string) => db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, action), eq(schema.auditLog.targetId, targetId)));
const outbox = (type: string, id: string) => db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, type), eq(schema.outboxEvents.aggregateId, id)));

/** A suspension by an admin, appealed by the person */
async function appealedSuspension() {
  const admin = await staff('admin');
  const s = await someone();
  const r = await sanctionUser(appDb, admin, { userId: s.id, kind: 'suspended', days: 30, ...scam }, { timeZone: TZ });
  if (!r.ok) throw new Error(r.reason);
  const [sanction] = await db.select().from(schema.userSanctions).where(eq(schema.userSanctions.moderationDecisionId, r.decisionId));
  const [appeal] = await db.insert(schema.moderationAppeals).values({ decisionId: r.decisionId, userId: s.id, body: 'اشتباه شده است' }).returning();
  return { person: s, sanction: sanction!, appeal: appeal! };
}

describe('a moderator’s restrictions', () => {
  it('without a number of days count as "until further notice": admins only', () => {
    expect(can('moderator', opPermission({ op: 'posting_restricted' }))).toBe(false);
    expect(can('moderator', opPermission({ op: 'messaging_restricted', days: 'none' }))).toBe(false);
    expect(can('moderator', opPermission({ op: 'posting_restricted', days: '7' }))).toBe(true);
    expect(can('admin', opPermission({ op: 'posting_restricted' }))).toBe(true);
  });
});

describe('granting an appeal', () => {
  it('needs the real, open appeal of that very sanction, not the staff member’s own', async () => {
    const { person, sanction, appeal } = await appealedSuspension();
    const mod = await staff('moderator');
    const fits = (o: Partial<Parameters<typeof appealFits>[1]>) =>
      appealFits(appDb, { appealId: appeal.id, staffUserId: mod.userId, op: 'lift_sanction', kind: 'user', itemId: person.id, sanctionId: sanction.id, ...o });
    expect(await fits({})).toBe(true);
    expect(await fits({ appealId: randomUUID() })).toBe(false);
    expect(await fits({ sanctionId: (await appealedSuspension()).sanction.id })).toBe(false);
    expect(await fits({ staffUserId: person.id })).toBe(false);
    expect(await fits({ op: 'warning' })).toBe(false);
    expect(await fits({ op: 'keep' })).toBe(true);
    expect(await fits({ op: 'keep', itemId: randomUUID() })).toBe(false);
    // Once answered it is closed
    expect((await liftSanction(appDb, mod, sanction.id, '', { timeZone: TZ, appealId: appeal.id })).ok).toBe(true);
    expect(await fits({ op: 'keep' })).toBe(false);
  });

  it('no one lifts their own sanction', async () => {
    const admin = await staff('admin');
    const mod = await staff('moderator');
    const r = await sanctionUser(appDb, admin, { userId: mod.userId, kind: 'posting_restricted', days: 7, ...scam }, { timeZone: TZ });
    if (!r.ok) throw new Error(r.reason);
    const [s] = await db.select().from(schema.userSanctions).where(eq(schema.userSanctions.moderationDecisionId, r.decisionId));
    expect(await liftSanction(appDb, mod, s!.id, '', { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });
  });
});

describe('rank', () => {
  it('only an admin sanctions a moderator, and no one an admin', async () => {
    const admin = await staff('admin');
    const mod = await staff('moderator');
    const other = await staff('moderator');
    const sanction = (by: StaffContext, userId: string) => sanctionUser(appDb, by, { userId, kind: 'warning', days: null, ...scam }, { timeZone: TZ });
    expect(await sanction(mod, other.userId)).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await sanction(mod, admin.userId)).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await sanction(admin, (await staff('admin')).userId)).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await sanction(admin, other.userId)).toMatchObject({ ok: true });
  });

  it('a suspended or banned staff member loses the admin page at once', async () => {
    const admin = await staff('admin');
    const mod = await staff('moderator');
    expect((await staffState(appDb, mod.userId, mod.sessionId)).kind).toBe('ok');
    const r = await sanctionUser(appDb, admin, { userId: mod.userId, kind: 'suspended', days: 7, ...scam }, { timeZone: TZ });
    expect(r.ok).toBe(true);
    expect((await staffState(appDb, mod.userId, mod.sessionId)).kind).toBe('none');
    // A warning alone doesn't
    const other = await staff('moderator');
    await sanctionUser(appDb, admin, { userId: other.userId, kind: 'warning', days: null, ...scam }, { timeZone: TZ });
    expect((await staffState(appDb, other.userId, other.sessionId)).kind).toBe('ok');
  });

  it('a moderator doesn’t restore their own taken-down listing', async () => {
    const admin = await staff('admin');
    const mod = await staff('moderator');
    const l = await makeListing(tx, mod.userId);
    expect((await takeDownListing(appDb, admin, l.id, scam, { timeZone: TZ })).ok).toBe(true);
    expect(await restoreListing(appDb, mod, l.id, 'اشتباه بود', { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });
    expect((await restoreListing(appDb, admin, l.id, 'اشتباه بود', { timeZone: TZ })).ok).toBe(true);
  });
});

describe('sign in as a user, when the time runs out', () => {
  async function opened(opts: { writable?: boolean } = {}) {
    const admin = await staff('admin');
    const u = await someone();
    const r = await db.transaction((t) => openActingSession(t, admin, { userId: u.id, reason: 'بررسی گزارش آگهی' }));
    if (!r.ok) throw new Error(r.reason);
    if (opts.writable) await db.transaction((t) => allowActingChanges(t, admin, r.token, 'درست کردن آگهی'));
    const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, r.token));
    return { admin, u, token: r.token, sessionId: s!.id };
  }

  it('the worker closes it within a minute: the end recorded, and the email when changes were allowed', async () => {
    const { admin, u, sessionId } = await opened({ writable: true });
    const quiet = await opened();
    expect(await closeEndedActingSessions(workerDb)).toBe(0);
    // Better Auth keeps pushing expires_at forward; the 30 minutes count from the start
    for (const id of [sessionId, quiet.sessionId]) {
      await db.update(schema.sessions).set({ createdAt: new Date(Date.now() - 31 * MINUTE), expiresAt: new Date(Date.now() + 30 * DAY) }).where(eq(schema.sessions.id, id));
    }
    expect(await closeEndedActingSessions(workerDb)).toBeGreaterThanOrEqual(2);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId))).toHaveLength(0);
    expect((await audit('staff.acting_ended', u.id))[0]).toMatchObject({ actorUserId: admin.userId, data: { writable: true, expired: true } });
    expect(await outbox('user.staff_acted', u.id)).toHaveLength(1);
    // A read-only look is recorded, but nobody is emailed
    expect(await audit('staff.acting_ended', quiet.u.id)).toHaveLength(1);
    expect(await outbox('user.staff_acted', quiet.u.id)).toHaveLength(0);
  });

  it('ends as soon as its admin is no longer an admin', async () => {
    const { admin, u, sessionId } = await opened();
    expect(await actingState(appDb, sessionId)).toMatchObject({ userId: u.id });
    await db.update(schema.users).set({ staffRole: null }).where(eq(schema.users.id, admin.userId));
    expect(await actingState(appDb, sessionId)).toBe('ended');
    expect(await closeEndedActingSessions(workerDb)).toBeGreaterThanOrEqual(1);
    expect((await audit('staff.acting_ended', u.id))[0]).toMatchObject({ data: { adminGone: true } });
  });

  it('«پایان» without a valid return cookie still records the end, under the admin who opened it', async () => {
    const { admin, u, token } = await opened({ writable: true });
    expect(await db.transaction((t) => closeActingSession(t, null, token))).toEqual({ userId: u.id });
    expect((await audit('staff.acting_ended', u.id))[0]).toMatchObject({ actorUserId: admin.userId });
    expect(await outbox('user.staff_acted', u.id)).toHaveLength(1);
  });
});

describe('the request method', () => {
  it('only the proxy’s signed mark counts; anything else is a change', () => {
    const secret = 'test-secret-test-secret-test-secret-0123';
    expect(markedMethod(methodMark('GET', secret), secret)).toBe('GET');
    expect(markedMethod(methodMark('POST', secret), secret)).toBe('POST');
    expect(markedMethod('GET', secret)).toBeNull();
    expect(markedMethod(methodMark('GET', 'another-secret-another-secret-0123456'), secret)).toBeNull();
    expect(markedMethod(`GET.${methodMark('POST', secret).split('.')[1]}`, secret)).toBeNull();
    expect(markedMethod(null, secret)).toBeNull();
  });
});

describe('staff changes are told', () => {
  it('a staff role given or taken away', async () => {
    const admin = await staff('admin');
    const u = await someone();
    const given = await db.transaction((t) => setStaffRole(t, { email: u.email, role: 'moderator', by: admin }));
    expect(given).toMatchObject({ ok: true });
    await db.transaction((t) => setStaffRole(t, { email: u.email, role: null, by: admin }));
    const events = await outbox('user.staff_role_changed', u.id);
    expect(events.map((e) => e.payload)).toEqual([
      { from: null, to: 'moderator' },
      { from: 'moderator', to: null },
    ]);
    expect((await staffRoleMail(db, u.id, { from: null, to: 'moderator' }, APP))!.subject).toContain('ناظر');
    expect((await staffRoleMail(db, u.id, { from: 'moderator', to: null }, APP))!.text).toContain('برداشته شد');
  });

  it('«خروج از همه دستگاه‌ها»', async () => {
    const admin = await staff('admin');
    const u = await someone();
    await signOutEverywhere(appDb, admin, u.id);
    expect(await outbox('user.signed_out', u.id)).toHaveLength(1);
    const mail = await signedOutMail(db, u.id, APP);
    expect(mail).toMatchObject({ to: u.email });
    expect(mail!.text).toContain(`${APP}/login`);
  });
});

describe('contact details in lists', () => {
  it('are written down once per page view, with whose', async () => {
    const admin = await staff('admin');
    const [a, b] = [await someone(), await someone()];
    await contactsListed(appDb, admin, 'users', [a.id, b.id, a.id, null]);
    const [row] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'staff.contacts_listed'), eq(schema.auditLog.actorUserId, admin.userId)));
    expect(row!.data).toMatchObject({ list: 'users', ids: [a.id, b.id] });
    await contactsListed(appDb, admin, 'reports', []);
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'staff.contacts_listed'), eq(schema.auditLog.actorUserId, admin.userId)))).toHaveLength(1);
  });
});
