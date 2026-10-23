import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { and, desc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { auditLog, sessions, users } from '../src/db/schema';
import { can, cleanCode, confirmTwoFactorSetup, PERMISSIONS, startTwoFactorSetup, staffState, verifyStaffCode } from '../src/modules/admin/access';
import { ADMIN_GATE_HEADER, adminGateValue, adminRoute, gateOpen, isInternalAdminPath } from '../src/modules/admin/gate';
import { setStaffRole } from '../src/modules/admin/staff';
import { reset } from '../src/lib/rate-limit';
import { LIMITS } from '../src/modules/users/limits';
import { appDb, redis, signIn, testAuth, visitor } from './accounts';
import { db } from './db';

// The admin page's door (roadmap step 8): the secret address, staff roles, and the TOTP check
// that every admin page and action needs on top of the email sign-in.

const ADMIN_PATH = 'k7x2m9q4w8e1r5t3y6u0i2o4';
const SECRET = 'test-secret-test-secret-test-secret-0123';

describe('the secret address', () => {
  beforeAll(() => {
    vi.stubEnv('APP_URL', 'https://app.example.test');
    vi.stubEnv('DATABASE_URL', 'postgres://x:y@localhost:5432/z');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', SECRET);
    vi.stubEnv('PHONE_CODE_SECRET', SECRET);
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'test_bot');
    vi.stubEnv('ADMIN_PATH', ADMIN_PATH);
  });
  afterAll(() => vi.unstubAllEnvs());

  it('maps only the secret prefix to the internal route', () => {
    expect(adminRoute(`/${ADMIN_PATH}`, ADMIN_PATH)).toBe('/admin');
    expect(adminRoute(`/${ADMIN_PATH}/queue/abc`, ADMIN_PATH)).toBe('/admin/queue/abc');
    expect(adminRoute(`/${ADMIN_PATH}x/queue`, ADMIN_PATH)).toBeNull();
    expect(adminRoute('/admin', ADMIN_PATH)).toBeNull();
    expect(adminRoute(`/${ADMIN_PATH}`, undefined)).toBeNull();
    expect(isInternalAdminPath('/admin/users')).toBe(true);
    expect(isInternalAdminPath('/administrator')).toBe(false);
  });

  it('the mark can only be made with AUTH_SECRET', () => {
    expect(gateOpen(adminGateValue(SECRET), SECRET)).toBe(true);
    expect(gateOpen(adminGateValue('another-secret-another-secret-0123456'), SECRET)).toBe(false);
    expect(gateOpen('', SECRET)).toBe(false);
    expect(gateOpen(null, SECRET)).toBe(false);
  });

  it('the proxy rewrites the secret address with the mark, never cached or indexed', async () => {
    const { proxy } = await import('../src/proxy');
    const res = proxy(new NextRequest(`https://app.example.test/${ADMIN_PATH}/queue?sort=oldest`));
    expect(new URL(res.headers.get('x-middleware-rewrite')!).pathname).toBe('/admin/queue');
    expect(new URL(res.headers.get('x-middleware-rewrite')!).search).toBe('?sort=oldest');
    expect(res.headers.get(`x-middleware-request-${ADMIN_GATE_HEADER}`)).toBe(adminGateValue(SECRET));
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('/admin itself goes on unmarked, and a mark sent by a client is removed', async () => {
    const { proxy } = await import('../src/proxy');
    for (const path of ['/admin', '/admin/queue', '/germany']) {
      const res = proxy(new NextRequest(`https://app.example.test${path}`, { headers: { [ADMIN_GATE_HEADER]: adminGateValue(SECRET) } }));
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(res.headers.get(`x-middleware-request-${ADMIN_GATE_HEADER}`)).toBeNull();
      expect(res.headers.get('x-middleware-override-headers')?.split(',')).not.toContain(ADMIN_GATE_HEADER);
    }
    const res = proxy(new NextRequest('https://app.example.test/admin'));
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});

describe('roles', () => {
  it('moderators may not do what is for admins', () => {
    const adminOnly = Object.entries(PERMISSIONS).filter(([, r]) => r === 'admin').map(([a]) => a);
    expect(adminOnly).toEqual(
      expect.arrayContaining(['user.ban', 'user.contact', 'user.sessions', 'user.release_phone', 'sanction.lift', 'organization.verify', 'organization.suspend', 'payments.view', 'audit.all', 'system.view', 'staff.manage']),
    );
    for (const a of adminOnly) expect(can('moderator', a as keyof typeof PERMISSIONS)).toBe(false);
    for (const a of Object.keys(PERMISSIONS)) expect(can('admin', a as keyof typeof PERMISSIONS)).toBe(true);
    for (const a of ['queue.view', 'listing.moderate', 'user.warn', 'user.restrict', 'user.suspend', 'appeal.decide'] as const) expect(can('moderator', a)).toBe(true);
  });

  it('make-staff and the staff page write staff.role_changed; admins are made only by the script', async () => {
    const v = visitor();
    const { user } = await signIn(v.email, v.headers);
    const r = await db.transaction((tx) => setStaffRole(tx, { email: v.email.toUpperCase(), role: 'moderator', by: null }));
    expect(r).toMatchObject({ ok: true, from: null, to: 'moderator' });
    const [row] = await db.select().from(auditLog).where(and(eq(auditLog.targetId, user.id), eq(auditLog.action, 'staff.role_changed')));
    expect(row).toMatchObject({ actorType: 'system', data: { from: null, to: 'moderator', by: 'make-staff' } });

    expect(await db.transaction((tx) => setStaffRole(tx, { email: 'nobody@example.test', role: 'admin', by: null }))).toEqual({ ok: false, reason: 'not_found' });
    const by = { userId: user.id, role: 'admin' as const, sessionId: user.id, ip: null, userAgent: null };
    const other = visitor();
    await signIn(other.email, other.headers);
    expect(await db.transaction((tx) => setStaffRole(tx, { email: other.email, role: 'admin', by }))).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await db.transaction((tx) => setStaffRole(tx, { email: v.email, role: null, by }))).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await db.transaction((tx) => setStaffRole(tx, { email: other.email, role: 'moderator', by }))).toMatchObject({ ok: true });
  });
});

/** Signs in once more with the same email (the login code limit allows one a minute) */
async function signInAgain(email: string, headers: Headers) {
  await reset(redis, [[LIMITS.codeSendPerEmailMinute, email], [LIMITS.codeSendPerEmailHour, email], [LIMITS.codeCheckPerEmail, email]]);
  return signIn(email, headers);
}

/** The six-digit code an authenticator app would show for this TOTP URI, `steps` periods from now */
async function totpFor(uri: string, steps = 0): Promise<string> {
  const raw = new TextDecoder().decode(base32.decode(new URL(uri).searchParams.get('secret')!));
  return createOTP(raw).hotp(Math.floor(Date.now() / 30_000) + steps);
}

describe('two-factor for staff', () => {
  const deps = { db: appDb, redis, auth: testAuth };

  async function staffMember(role: 'moderator' | 'admin' = 'moderator') {
    const v = visitor();
    const s = await signIn(v.email, v.headers);
    await db.update(users).set({ staffRole: role }).where(eq(users.id, s.user.id));
    const headers = new Headers({ cookie: s.cookie, 'user-agent': 'test' });
    const session = (await testAuth.api.getSession({ headers }))!;
    const ctx = { userId: s.user.id, sessionId: session.session.id, ip: '203.0.113.9', userAgent: 'test' };
    return { ...v, ...s, headers, ctx };
  }

  /** Staff with two-factor on and a fresh session that still needs the check */
  async function enrolled(role: 'moderator' | 'admin' = 'moderator') {
    const m = await staffMember(role);
    const setup = await startTwoFactorSetup(testAuth, m.headers);
    expect(await confirmTwoFactorSetup(deps, m.ctx, { code: await totpFor(setup.totpURI), headers: m.headers })).toEqual({ ok: true });
    // Better Auth replaced the session when two-factor was turned on: sign in again
    const again = await signInAgain(m.email, m.headers);
    const headers = new Headers({ cookie: again.cookie, 'user-agent': 'test' });
    const session = (await testAuth.api.getSession({ headers }))!;
    return { ...m, headers, setup, ctx: { ...m.ctx, sessionId: session.session.id } };
  }

  it('non-staff, deactivated staff and unknown users are nobody to the admin page', async () => {
    const v = visitor();
    const s = await signIn(v.email, v.headers);
    const session = (await testAuth.api.getSession({ headers: new Headers({ cookie: s.cookie }) }))!;
    expect(await staffState(appDb, s.user.id, session.session.id)).toEqual({ kind: 'none' });
    await db.update(users).set({ staffRole: 'admin', status: 'deactivated' }).where(eq(users.id, s.user.id));
    expect(await staffState(appDb, s.user.id, session.session.id)).toEqual({ kind: 'none' });
    expect(await staffState(appDb, '00000000-0000-7000-8000-000000000000', session.session.id)).toEqual({ kind: 'none' });
  });

  it('staff without two-factor can only set it up', async () => {
    const m = await staffMember();
    expect(await staffState(appDb, m.ctx.userId, m.ctx.sessionId)).toMatchObject({ kind: 'setup', role: 'moderator' });
  });

  it('set-up: a wrong code keeps it off, the right one turns it on and writes the audit row', async () => {
    const m = await staffMember();
    const setup = await startTwoFactorSetup(testAuth, m.headers);
    expect(setup.backupCodes).toHaveLength(10);
    expect(new URL(setup.totpURI).searchParams.get('issuer')).toBe('Peydoo');
    expect(await confirmTwoFactorSetup(deps, m.ctx, { code: '000000', headers: m.headers })).toEqual({ ok: false, reason: 'invalid' });
    expect((await db.select({ on: users.twoFactorEnabled }).from(users).where(eq(users.id, m.ctx.userId)))[0]!.on).toBe(false);
    expect(await confirmTwoFactorSetup(deps, m.ctx, { code: await totpFor(setup.totpURI), headers: m.headers })).toEqual({ ok: true });
    expect((await db.select({ on: users.twoFactorEnabled }).from(users).where(eq(users.id, m.ctx.userId)))[0]!.on).toBe(true);
    expect(await db.select().from(auditLog).where(and(eq(auditLog.actorUserId, m.ctx.userId), eq(auditLog.action, 'staff.two_factor_enabled')))).toHaveLength(1);
  });

  it('the check stamps only this session, for 8 hours; a reused or wrong code is refused and audited', async () => {
    const m = await enrolled('admin');
    expect(await staffState(appDb, m.ctx.userId, m.ctx.sessionId)).toMatchObject({ kind: 'verify', role: 'admin' });

    expect(await verifyStaffCode(deps, m.ctx, { code: '123 456', kind: 'totp', headers: m.headers })).toEqual({ ok: false, reason: 'invalid' });
    const code = await totpFor(m.setup.totpURI, 1);
    // Persian digits as typed on a Persian keyboard
    const persian = code.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
    expect(await verifyStaffCode(deps, m.ctx, { code: persian, kind: 'totp', headers: m.headers })).toEqual({ ok: true });
    expect(await staffState(appDb, m.ctx.userId, m.ctx.sessionId)).toMatchObject({ kind: 'ok' });

    // A second device signed in to the same account still needs its own check
    const other = await signInAgain(m.email, m.headers);
    const otherSession = (await testAuth.api.getSession({ headers: new Headers({ cookie: other.cookie }) }))!;
    expect(await staffState(appDb, m.ctx.userId, otherSession.session.id)).toMatchObject({ kind: 'verify' });
    // … and can't use the code the first one used
    const otherCtx = { ...m.ctx, sessionId: otherSession.session.id };
    expect(await verifyStaffCode(deps, otherCtx, { code, kind: 'totp', headers: new Headers({ cookie: other.cookie }) })).toEqual({ ok: false, reason: 'reused' });

    // After 8 hours the stamp is stale
    expect(await staffState(appDb, m.ctx.userId, m.ctx.sessionId, new Date(Date.now() + 8 * 3_600_000 + 1_000))).toMatchObject({ kind: 'verify' });

    const rows = await db.select({ action: auditLog.action, data: auditLog.data, actorType: auditLog.actorType }).from(auditLog).where(eq(auditLog.actorUserId, m.ctx.userId)).orderBy(desc(auditLog.createdAt));
    expect(rows.filter((r) => r.action === 'auth.two_factor_failed').map((r) => r.data)).toEqual(expect.arrayContaining([{ method: 'totp', reason: 'invalid' }, { method: 'totp', reason: 'reused' }]));
    expect(rows.find((r) => r.action === 'staff.two_factor_passed')).toMatchObject({ actorType: 'staff', data: { method: 'totp' } });
  });

  it('a stamp on a session of another user never counts', async () => {
    const a = await enrolled();
    const b = await enrolled();
    await db.update(sessions).set({ staffVerifiedAt: new Date() }).where(eq(sessions.id, a.ctx.sessionId));
    expect(await staffState(appDb, b.ctx.userId, a.ctx.sessionId)).toMatchObject({ kind: 'verify' });
  });

  it('five wrong codes lock the check', async () => {
    const m = await enrolled();
    for (let i = 0; i < 5; i++) expect(await verifyStaffCode(deps, m.ctx, { code: '000000', kind: 'totp', headers: m.headers })).toMatchObject({ ok: false, reason: 'invalid' });
    const locked = await verifyStaffCode(deps, m.ctx, { code: await totpFor(m.setup.totpURI), kind: 'totp', headers: m.headers });
    expect(locked).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(await staffState(appDb, m.ctx.userId, m.ctx.sessionId)).toMatchObject({ kind: 'verify' });
  });

  it('a backup code works once', async () => {
    const m = await enrolled();
    const code = m.setup.backupCodes[3]!;
    expect(await verifyStaffCode(deps, m.ctx, { code: code.replace('-', ' '), kind: 'backup', headers: m.headers })).toEqual({ ok: true });
    await db.update(sessions).set({ staffVerifiedAt: null }).where(eq(sessions.id, m.ctx.sessionId));
    expect(await verifyStaffCode(deps, m.ctx, { code, kind: 'backup', headers: m.headers })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('codes are cleaned as typed', () => {
    expect(cleanCode(' ۱۲۳ ۴۵۶ ', 'totp')).toBe('123456');
    expect(cleanCode('12345', 'totp')).toBeNull();
    expect(cleanCode('abcde fghij', 'backup')).toBe('abcde-fghij');
    expect(cleanCode('abc', 'backup')).toBeNull();
  });
});

describe('every admin page and action checks staff itself', () => {
  // A layout doesn't protect server actions (they can be posted to any address), and a page
  // added later could forget its check. So every page and every exported action under
  // src/app/admin must call the guard directly.
  it('walks src/app/admin', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const root = join(process.cwd(), 'src/app/admin');
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        if (e.isDirectory()) await walk(join(dir, e.name));
        else files.push(join(dir, e.name));
      }
    };
    await walk(root);
    const missing: string[] = [];
    for (const f of files) {
      const text = await readFile(f, 'utf8');
      if (f.endsWith('/page.tsx') && !/\b(requireStaff|staffSession)\(/.test(text)) missing.push(f);
      if (/^'use server';/.test(text)) {
        // Each exported async function body must call a guard before anything else it awaits
        for (const m of text.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) {
          const firstAwait = m[2]!.match(/await (\w+)\(/)?.[1];
          if (!['requireStaffAction', 'requireStaff', 'staffSession'].includes(firstAwait ?? '')) missing.push(`${f}: ${m[1]}`);
        }
      }
    }
    expect(files.some((f) => f.endsWith('/page.tsx'))).toBe(true);
    expect(missing).toEqual([]);
  });
});

describe('resetting two-factor (script)', () => {
  it('switches it off, ends the admin checks and writes the audit row', async () => {
    const { resetTwoFactor } = await import('../src/modules/admin/staff');
    const v = visitor();
    const s = await signIn(v.email, v.headers);
    await db.update(users).set({ staffRole: 'admin', twoFactorEnabled: true }).where(eq(users.id, s.user.id));
    await db.update(sessions).set({ staffVerifiedAt: new Date() }).where(eq(sessions.userId, s.user.id));
    expect(await db.transaction((tx) => resetTwoFactor(tx, v.email))).toMatchObject({ ok: true });
    expect((await db.select().from(users).where(eq(users.id, s.user.id)))[0]!.twoFactorEnabled).toBe(false);
    expect((await db.select().from(sessions).where(eq(sessions.userId, s.user.id))).every((x) => x.staffVerifiedAt === null)).toBe(true);
    expect(await db.select().from(auditLog).where(and(eq(auditLog.targetId, s.user.id), eq(auditLog.action, 'staff.two_factor_reset')))).toHaveLength(1);
    expect(await db.transaction((tx) => resetTwoFactor(tx, 'nobody@example.test'))).toEqual({ ok: false, reason: 'not_found' });
  });
});
