import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { sessions, users, verifications } from '../src/db/schema';
import { hit, reset } from '../src/lib/rate-limit';
import { authErrorCode } from '../src/modules/users/errors';
import { listDevices, revokeDevice, revokeOtherDevices } from '../src/modules/users/devices';
import { CODE_ATTEMPTS } from '../src/modules/users/auth';
import { db } from './db';
import { appDb, lastCode, redis, sentCodes, sessionFor, signIn, testAuth, visitor } from './accounts';

// Sign-in by email code (Better Auth on our tables) and the "my devices" session list.

async function errorOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
  } catch (e) {
    return authErrorCode(e) ?? String(e);
  }
  return null;
}

describe('sign-in by email code', () => {
  it('creates the account on first sign-in with a database-made id and a public token', async () => {
    const v = visitor();
    const { user } = await signIn(v.email, v.headers);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row!.email).toBe(v.email);
    expect(row!.emailVerified).toBe(true);
    expect(row!.publicToken).toMatch(/^[0-9a-hjkmnp-tv-z]{10}$/);
    expect(row!.displayName).toBe('کاربر');
    expect(row!.displayNameNormalized).toBe('کاربر');
    expect(row!.phoneE164).toBeNull();
    // uuidv7() from PostgreSQL: version nibble 7
    expect(row!.id[14]).toBe('7');

    const [session] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(session!.ipAddress).toBe(v.headers.get('x-forwarded-for'));
    expect(session!.userAgent).toContain('iPhone');
  });

  it('signs an existing email into the same account', async () => {
    const v = visitor();
    const first = await signIn(v.email, v.headers);
    await redis.flushdb(); // the second code request would hit the one-per-minute limit
    const second = await signIn(v.email.toUpperCase(), v.headers);
    expect(second.user.id).toBe(first.user.id);
  });

  it('stores only a hash of the code', async () => {
    const v = visitor();
    await testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers });
    const [row] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, `sign-in-otp-${v.email}`));
    expect(row!.value).not.toContain(lastCode(v.email));
  });

  it('refuses a code that was already used', async () => {
    const v = visitor();
    await signIn(v.email, v.headers);
    const code = lastCode(v.email);
    const error = await errorOf(
      testAuth.api.signInEmailOTP({ body: { email: v.email, otp: code }, headers: v.headers }),
    );
    expect(error).toBe('INVALID_OTP');
  });

  it('refuses an expired code', async () => {
    const v = visitor();
    await testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers });
    await db
      .update(verifications)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(verifications.identifier, `sign-in-otp-${v.email}`));
    const error = await errorOf(
      testAuth.api.signInEmailOTP({ body: { email: v.email, otp: lastCode(v.email) }, headers: v.headers }),
    );
    expect(error).toBe('OTP_EXPIRED');
  });

  it(`locks the code after ${CODE_ATTEMPTS} wrong tries, even for the right code`, async () => {
    const v = visitor();
    await testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers });
    const code = lastCode(v.email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < CODE_ATTEMPTS; i++) {
      expect(
        await errorOf(testAuth.api.signInEmailOTP({ body: { email: v.email, otp: wrong }, headers: v.headers })),
      ).toBe('INVALID_OTP');
    }
    const error = await errorOf(
      testAuth.api.signInEmailOTP({ body: { email: v.email, otp: code }, headers: v.headers }),
    );
    expect(error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('limits code requests per email', async () => {
    const v = visitor();
    await testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers });
    const before = sentCodes.length;
    const error = await errorOf(
      testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers }),
    );
    expect(error).toBe('RATE_LIMITED');
    expect(sentCodes.length).toBe(before);
  });

  it('limits code checks per email', async () => {
    const v = visitor();
    await testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers });
    const errors: Array<string | null> = [];
    for (let i = 0; i < 11; i++) {
      errors.push(
        await errorOf(
          testAuth.api.signInEmailOTP({ body: { email: v.email, otp: '999999x' }, headers: v.headers }),
        ),
      );
    }
    expect(errors.at(-1)).toBe('RATE_LIMITED');
  });

  it('only sends sign-in codes (no password reset or email change)', async () => {
    const v = visitor();
    const error = await errorOf(
      testAuth.api.sendVerificationOTP({
        body: { email: v.email, type: 'forget-password' },
        headers: v.headers,
      }),
    );
    expect(error).not.toBeNull();
  });

  it('refuses a session to a deactivated account', async () => {
    const v = visitor();
    const { user } = await signIn(v.email, v.headers);
    await db.update(users).set({ status: 'deactivated' }).where(eq(users.id, user.id));
    await redis.flushdb();
    await testAuth.api.sendVerificationOTP({ body: { email: v.email, type: 'sign-in' }, headers: v.headers });
    const error = await errorOf(
      testAuth.api.signInEmailOTP({ body: { email: v.email, otp: lastCode(v.email) }, headers: v.headers }),
    );
    expect(error).toBe('ACCOUNT_DISABLED');
  });
});

describe('my devices', () => {
  async function twoDevices() {
    const v = visitor();
    const phone = await signIn(v.email, v.headers);
    await redis.flushdb();
    const laptop = await signIn(
      v.email,
      new Headers({
        'x-forwarded-for': '198.51.100.7',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36',
      }),
    );
    const phoneSession = (await sessionFor(phone.cookie))!.session;
    const laptopSession = (await sessionFor(laptop.cookie))!.session;
    return { userId: phone.user.id, phone, laptop, phoneSession, laptopSession };
  }

  it('lists each session with its device, the current one first', async () => {
    const { userId, laptopSession } = await twoDevices();
    const devices = await listDevices(appDb, userId, laptopSession.id);
    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({ id: laptopSession.id, current: true, browser: 'Chrome', os: 'Windows' });
    expect(devices[1]).toMatchObject({ current: false, os: 'iOS' });
  });

  it('a revoked session stops working on its next request', async () => {
    const { userId, phone, laptop, phoneSession } = await twoDevices();
    expect(await revokeDevice(appDb, userId, phoneSession.id)).toBe(true);
    expect(await sessionFor(phone.cookie)).toBeNull();
    expect(await sessionFor(laptop.cookie)).not.toBeNull();
  });

  it("can't revoke another user's session", async () => {
    const a = await twoDevices();
    const b = await twoDevices();
    expect(await revokeDevice(appDb, b.userId, a.phoneSession.id)).toBe(false);
    expect(await sessionFor(a.phone.cookie)).not.toBeNull();
  });

  it('logs out every other device', async () => {
    const { userId, phone, laptop, laptopSession } = await twoDevices();
    expect(await revokeOtherDevices(appDb, userId, laptopSession.id)).toBe(1);
    expect(await sessionFor(phone.cookie)).toBeNull();
    expect(await sessionFor(laptop.cookie)).not.toBeNull();
  });

  it('sign-out deletes the session', async () => {
    const { phone } = await twoDevices();
    await testAuth.api.signOut({ headers: new Headers({ cookie: phone.cookie }) });
    expect(await sessionFor(phone.cookie)).toBeNull();
  });
});

describe('rate limiter', () => {
  it('trips after the maximum and resets', async () => {
    const limit = { name: 'test', max: 2, windowSeconds: 60 };
    const subject = `s-${Date.now()}`;
    expect((await hit(redis, [[limit, subject]])).ok).toBe(true);
    expect((await hit(redis, [[limit, subject]])).ok).toBe(true);
    const third = await hit(redis, [[limit, subject]]);
    expect(third).toEqual({ ok: false, retryAfterSeconds: expect.any(Number) });
    expect(await redis.ttl(`rl:test:${subject}`)).toBeGreaterThan(0);
    await reset(redis, [[limit, subject]]);
    expect((await hit(redis, [[limit, subject]])).ok).toBe(true);
  });
});
