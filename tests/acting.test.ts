import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import {
  actingGate,
  actingState,
  allowActingChanges,
  closeActingSession,
  findUserToActAs,
  openActingSession,
  readReturn,
  returningAdmin,
  returnToken,
  sessionCookieName,
  sessionTokenOf,
  signSessionToken,
  STAFF_RETURN_COOKIE,
} from '../src/modules/admin/acting';
import type { StaffContext } from '../src/modules/admin/audit';
import { markedMethod, METHOD_HEADER } from '../src/modules/admin/gate';
import { staffActedMail } from '../src/modules/moderation/notices';
import { appDb, signIn, testAuth, visitor } from './accounts';
import { db, publicToken } from './db';

// Sign in as a user (wave 2 part 1, step 1d): admins only, never into staff, a reason for real
// people, read only until changes are allowed, 30 minutes, the admin's own session back after.

const SECRET = 'test-secret-test-secret-test-secret-0123';
const APP = 'https://app.example.test';
const MINUTE = 60_000;

async function person(opts: { staff?: 'admin' | 'moderator'; test?: 'country' | 'personal'; status?: 'active' | 'deleted' } = {}) {
  const email = `${randomUUID()}@example.test`;
  const [u] = await db
    .insert(schema.users)
    .values({
      publicToken: publicToken(),
      email,
      emailVerified: true,
      displayName: 'کاربر',
      displayNameNormalized: 'کاربر',
      staffRole: opts.staff ?? null,
      testAccount: opts.test ?? null,
      ...(opts.status === 'deleted' ? { status: 'deleted' as const, deletedAt: new Date() } : {}),
    })
    .returning();
  return u!;
}

async function adminCtx(): Promise<StaffContext> {
  const a = await person({ staff: 'admin' });
  const [s] = await db.insert(schema.sessions).values({ userId: a.id, token: randomUUID().replace(/-/g, ''), expiresAt: new Date(Date.now() + 86_400_000) }).returning();
  return { userId: a.id, sessionId: s!.id, role: 'admin', ip: null, userAgent: null };
}

const open = (ctx: StaffContext, userId: string, reason = 'بررسی گزارش آگهی') => db.transaction((tx) => openActingSession(tx, ctx, { userId, reason }));
const audit = (action: string, targetId: string) => db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, action), eq(schema.auditLog.targetId, targetId)));

describe('the cookies', () => {
  it('our session cookie is the one Better Auth signs and reads', async () => {
    const { token, cookie } = await signIn(visitor().email, visitor().headers);
    const value = decodeURIComponent(cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(sessionCookieName(APP)))!.split('=')[1]!);
    expect(sessionTokenOf(SECRET, value)).toBe(token);
    expect(signSessionToken(SECRET, token)).toBe(value);
    expect(sessionTokenOf('another-secret-another-secret-0123456', value)).toBeNull();
    expect(sessionTokenOf(SECRET, `${token}x.${value.split('.').at(-1)}`)).toBeNull();
  });

  it('the return cookie keeps the admin’s own cookie and the end, signed', () => {
    const until = new Date(Date.now() + 30 * MINUTE);
    const r = readReturn(SECRET, returnToken(SECRET, 'abc.def+/=', until));
    expect(r).toEqual({ ownCookie: 'abc.def+/=', until: new Date(Math.floor(until.getTime() / 1000) * 1000) });
    expect(readReturn('another-secret-another-secret-0123456', returnToken(SECRET, 'abc', until))).toBeNull();
    expect(readReturn(SECRET, returnToken(SECRET, 'abc', until).replace(/^\d/, '9'))).toBeNull();
    expect(readReturn(SECRET, undefined)).toBeNull();
  });
});

describe('opening a session for someone', () => {
  it('never for staff, oneself, a deleted or unknown account; a real person needs a reason', async () => {
    const ctx = await adminCtx();
    expect(await open(ctx, (await person({ staff: 'moderator' })).id)).toEqual({ ok: false, reason: 'staff' });
    expect(await open(ctx, ctx.userId)).toEqual({ ok: false, reason: 'self' });
    expect(await open(ctx, (await person({ status: 'deleted' })).id)).toEqual({ ok: false, reason: 'not_found' });
    expect(await open(ctx, randomUUID())).toEqual({ ok: false, reason: 'not_found' });
    expect(await open(ctx, (await person()).id, ' x ')).toEqual({ ok: false, reason: 'reason_required' });
  });

  it('a real person: read only, 30 minutes, in audit_log, and Better Auth accepts the session', async () => {
    const ctx = await adminCtx();
    const u = await person();
    const r = await open(ctx, u.id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.test).toBe(false);
    expect(r.until.getTime() - Date.now()).toBeGreaterThan(29 * MINUTE);
    const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, r.token));
    expect(s).toMatchObject({ userId: u.id, openedByUserId: ctx.userId, openedReason: 'بررسی گزارش آگهی', writableAt: null });
    expect(await actingState(db, s!.id)).toMatchObject({ userId: u.id, openedBy: ctx.userId, writable: false, test: false });
    expect((await audit('staff.acting_started', u.id))[0]).toMatchObject({ actorUserId: ctx.userId, data: { reason: 'بررسی گزارش آگهی', test: false } });
    const session = await testAuth.api.getSession({ headers: new Headers({ cookie: `${sessionCookieName(APP)}=${encodeURIComponent(signSessionToken(SECRET, r.token))}` }) });
    expect(session?.user.id).toBe(u.id);
  });

  it('a test account: no reason needed, changes allowed from the start', async () => {
    const ctx = await adminCtx();
    const u = await person({ test: 'country' });
    const r = await open(ctx, u.id, '');
    if (!r.ok) throw new Error(r.reason);
    const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, r.token));
    expect(await actingState(db, s!.id)).toMatchObject({ writable: true, test: true });
  });

  it('finds the person by email, id or public token', async () => {
    const u = await person();
    expect(await findUserToActAs(db, u.email.toUpperCase())).toBe(u.id);
    expect(await findUserToActAs(db, u.id)).toBe(u.id);
    expect(await findUserToActAs(db, u.publicToken)).toBe(u.id);
    expect(await findUserToActAs(db, '  ')).toBeNull();
  });
});

describe('while it lasts', () => {
  it('reads always; changes only once allowed, and then each is recorded', () => {
    expect(actingGate({ writable: false }, { method: 'GET', action: false })).toBe('read');
    expect(actingGate({ writable: false }, { method: 'POST', action: true })).toBe('block');
    expect(actingGate({ writable: false }, { method: 'DELETE', action: false })).toBe('block');
    expect(actingGate({ writable: true }, { method: 'POST', action: true })).toBe('record');
    expect(actingGate({ writable: true }, { method: 'HEAD', action: false })).toBe('read');
  });

  it('ends after 30 minutes, however long Better Auth keeps the session', async () => {
    const ctx = await adminCtx();
    const r = await open(ctx, (await person()).id);
    if (!r.ok) throw new Error(r.reason);
    await db.update(schema.sessions).set({ createdAt: new Date(Date.now() - 31 * MINUTE), expiresAt: new Date(Date.now() + 86_400_000) }).where(eq(schema.sessions.token, r.token));
    const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, r.token));
    expect(await actingState(db, s!.id)).toBe('ended');
  });

  it('«اجازهٔ تغییر» needs a reason and only the admin who opened it', async () => {
    const ctx = await adminCtx();
    const other = await adminCtx();
    const u = await person();
    const r = await open(ctx, u.id);
    if (!r.ok) throw new Error(r.reason);
    expect(await db.transaction((tx) => allowActingChanges(tx, ctx, r.token, 'کم'))).toBe('reason_required');
    expect(await db.transaction((tx) => allowActingChanges(tx, other, r.token, 'درست کردن آگهی'))).toBe('not_found');
    expect(await db.transaction((tx) => allowActingChanges(tx, ctx, r.token, 'درست کردن آگهی'))).toBe('ok');
    expect((await audit('staff.acting_writable', u.id))[0]).toMatchObject({ actorUserId: ctx.userId, data: { reason: 'درست کردن آگهی' } });
  });
});

describe('«پایان»', () => {
  it('deletes the session; a real person whose account could be changed is told by email', async () => {
    const ctx = await adminCtx();
    const u = await person();
    const r = await open(ctx, u.id);
    if (!r.ok) throw new Error(r.reason);
    await db.transaction((tx) => allowActingChanges(tx, ctx, r.token, 'درست کردن آگهی'));
    expect(await db.transaction((tx) => closeActingSession(tx, ctx, r.token))).toEqual({ userId: u.id });
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.token, r.token))).toHaveLength(0);
    expect((await audit('staff.acting_ended', u.id))[0]).toMatchObject({ data: { writable: true } });
    const events = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, 'user.staff_acted'), eq(schema.outboxEvents.aggregateId, u.id)));
    expect(events).toHaveLength(1);
    const mail = await staffActedMail(db, u.id, APP);
    expect(mail).toMatchObject({ to: u.email });
    expect(mail!.text).toContain(`${APP}/contact`);
  });

  it('a read-only look and a test account tell nobody', async () => {
    const ctx = await adminCtx();
    for (const u of [await person(), await person({ test: 'personal' })]) {
      const r = await open(ctx, u.id, 'نگاه به صفحه');
      if (!r.ok) throw new Error(r.reason);
      await db.transaction((tx) => closeActingSession(tx, ctx, r.token));
      expect(await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, 'user.staff_acted'), eq(schema.outboxEvents.aggregateId, u.id)))).toHaveLength(0);
    }
    expect(await staffActedMail(db, (await person({ test: 'country' })).id, APP)).toBeNull();
  });

  it('only another admin’s session can’t end it', async () => {
    const ctx = await adminCtx();
    const r = await open(ctx, (await person()).id);
    if (!r.ok) throw new Error(r.reason);
    expect(await db.transaction(async (tx) => closeActingSession(tx, await adminCtx(), r.token))).toBeNull();
  });
});

describe('the admin behind the return cookie', () => {
  it('must still have a live admin session of their own', async () => {
    const ctx = await adminCtx();
    const [own] = await db.select({ token: schema.sessions.token }).from(schema.sessions).where(eq(schema.sessions.id, ctx.sessionId));
    const cookie = returnToken(SECRET, signSessionToken(SECRET, own!.token), new Date(Date.now() + 30 * MINUTE));
    expect(await returningAdmin(appDb, SECRET, cookie)).toMatchObject({ userId: ctx.userId, sessionId: ctx.sessionId });
    await db.update(schema.users).set({ staffRole: 'moderator' }).where(eq(schema.users.id, ctx.userId));
    expect(await returningAdmin(appDb, SECRET, cookie)).toBeNull();
    expect(await returningAdmin(appDb, SECRET, 'nonsense')).toBeNull();
  });
});

describe('the proxy', () => {
  beforeAll(() => {
    vi.stubEnv('APP_URL', APP);
    vi.stubEnv('DATABASE_URL', 'postgres://x:y@localhost:5432/z');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', SECRET);
    vi.stubEnv('PHONE_CODE_SECRET', SECRET);
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'test_bot');
  });
  afterAll(() => vi.unstubAllEnvs());

  const own = signSessionToken(SECRET, 'OwnSessionToken0123456789abcdefgh');
  const acting = signSessionToken(SECRET, 'ActingSessionToken0123456789abcde');
  const req = (path: string, until: Date, method = 'GET', headers: Record<string, string> = {}) =>
    new NextRequest(`${APP}${path}`, {
      method,
      headers: { cookie: `${sessionCookieName(APP)}=${encodeURIComponent(acting)}; ${STAFF_RETURN_COOKIE}=${returnToken(SECRET, own, until)}`, ...headers },
    });

  it('puts the admin’s own session back after the 30 minutes', async () => {
    const { proxy } = await import('../src/proxy');
    const res = proxy(req('/germany', new Date(Date.now() - 1000)));
    expect(res.headers.get('x-middleware-request-cookie')).toContain(`${sessionCookieName(APP)}=${encodeURIComponent(own)}`);
    expect(res.headers.get('x-middleware-request-cookie')).not.toContain(STAFF_RETURN_COOKIE);
    const set = res.headers.getSetCookie().join('\n');
    expect(set).toContain(`${sessionCookieName(APP)}=${encodeURIComponent(own)}`);
    expect(set).toMatch(new RegExp(`${STAFF_RETURN_COOKIE}=;`));
  });

  it('until then leaves the user’s session, closes Better Auth’s own endpoints, and tells the server the method', async () => {
    const { proxy } = await import('../src/proxy');
    const later = new Date(Date.now() + 10 * MINUTE);
    const page = proxy(req('/germany', later, 'GET', { [METHOD_HEADER]: 'GET' }));
    expect(page.headers.getSetCookie()).toHaveLength(0);
    expect(proxy(req('/api/auth/sign-out', later, 'POST')).status).toBe(403);
    expect(proxy(req('/api/auth/get-session', later)).status).not.toBe(403);
    const action = proxy(req('/my/listings', later, 'POST', { [METHOD_HEADER]: 'GET' }));
    // Signed by the proxy: a client's own header can't pass for a read (code check, Oct 30, 2026)
    expect(markedMethod(action.headers.get(`x-middleware-request-${METHOD_HEADER}`), SECRET)).toBe('POST');
    expect(markedMethod('GET', SECRET)).toBeNull();
  });

  it('drops a return cookie without our signature', async () => {
    const { proxy } = await import('../src/proxy');
    const res = proxy(new NextRequest(`${APP}/germany`, { headers: { cookie: `${STAFF_RETURN_COOKIE}=forged` } }));
    expect(res.headers.getSetCookie().join('\n')).toMatch(new RegExp(`${STAFF_RETURN_COOKIE}=;`));
    expect(res.headers.getSetCookie().join('\n')).not.toContain('better-auth.session_token=');
  });
});
