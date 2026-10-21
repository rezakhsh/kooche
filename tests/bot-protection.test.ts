import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hit } from '../src/lib/rate-limit';
import { contentSecurityPolicy } from '../src/proxy';
import { LISTING_LIMITS, newAccountUploadChecks } from '../src/modules/listings/limits';
import { isLoginHuman, LOGIN_HUMAN_SECONDS, markLoginHuman } from '../src/modules/security/login-human';
import { TEST_SECRETS, verifyTurnstile, type TurnstileDeps } from '../src/modules/security/turnstile';
import { isNewAccount } from '../src/modules/users/new-account';
import { redis } from './accounts';

// Bot protection (roadmap step 3, Oct 21, 2026): Turnstile checked on the server, the "send the
// code again" window, the CSP for the widget, and the new-account photo limits. The publish
// limits for new accounts are in listings.test.ts and events.test.ts.

const DAY = 86_400_000;
const SECRET = '0x4AAAAAAAtestsecretnotreal';

type Call = { url: string; body: URLSearchParams };

/** A stand-in for Cloudflare's siteverify that records what it was sent */
function siteverify(answer: unknown, status = 200) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as URLSearchParams });
    return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof globalThis.fetch;
  return { calls, deps: { secret: SECRET, hostname: 'staging.peydoo.com', fetch } satisfies TurnstileDeps };
}

const good = { success: true, 'error-codes': [], hostname: 'staging.peydoo.com', action: 'login', challenge_ts: '2026-10-21T12:00:00Z' };

describe('Turnstile is checked with Cloudflare, never trusted from the browser', () => {
  it('a missing or malformed token is refused without asking Cloudflare', async () => {
    const { calls, deps } = siteverify(good);
    for (const token of [null, undefined, '', 42, 'x'.repeat(2049)]) {
      expect(await verifyTurnstile({ token, action: 'login', ip: '203.0.113.7' }, deps)).toEqual({ ok: false, reason: 'missing' });
    }
    expect(calls).toHaveLength(0);
  });

  it('a valid token passes, and Cloudflare gets the secret, the token and the IP', async () => {
    const { calls, deps } = siteverify(good);
    expect(await verifyTurnstile({ token: 'tok-123', action: 'login', ip: '203.0.113.7' }, deps)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(Object.fromEntries(calls[0]!.body)).toEqual({ secret: SECRET, response: 'tok-123', remoteip: '203.0.113.7' });
  });

  it('a forged token is refused', async () => {
    const { deps } = siteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await verifyTurnstile({ token: 'forged', action: 'login', ip: null }, deps)).toEqual({
      ok: false,
      reason: 'rejected',
      codes: ['invalid-input-response'],
    });
  });

  it('an expired or already used token is refused', async () => {
    const { deps } = siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    expect(await verifyTurnstile({ token: 'old', action: 'publish-listing', ip: null }, deps)).toMatchObject({
      ok: false,
      reason: 'rejected',
      codes: ['timeout-or-duplicate'],
    });
  });

  it('a token from another site or another form is refused', async () => {
    const other = siteverify({ ...good, hostname: 'evil.example' });
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, other.deps)).toMatchObject({ ok: false, codes: ['wrong-hostname'] });
    // Solved on the sign-in form, spent on publishing
    const login = siteverify(good);
    expect(await verifyTurnstile({ token: 't', action: 'publish-listing', ip: null }, login.deps)).toMatchObject({ ok: false, codes: ['wrong-action'] });
    expect(await verifyTurnstile({ token: 't', action: 'publish-event', ip: null }, login.deps)).toMatchObject({ ok: false, codes: ['wrong-action'] });
  });

  it('fails closed when Cloudflare gives no usable answer', async () => {
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, siteverify(good, 500).deps)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, siteverify({ nonsense: true }).deps)).toMatchObject({
      ok: false,
      reason: 'unavailable',
    });
    const down = { secret: SECRET, hostname: 'staging.peydoo.com', fetch: (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch };
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, down)).toEqual({ ok: false, reason: 'unavailable', codes: ['network'] });
    // Hangs: given up after the timeout
    const hangs = {
      secret: SECRET,
      hostname: 'staging.peydoo.com',
      timeoutMs: 50,
      fetch: ((_: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)))) as unknown as typeof fetch,
    };
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, hangs)).toEqual({ ok: false, reason: 'unavailable', codes: ['timeout'] });
  });

  it("Cloudflare's test secrets skip the hostname and action checks (local builds only, see env.ts)", async () => {
    const { deps } = siteverify({ success: true, hostname: 'example.com', 'error-codes': [] });
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, { ...deps, secret: TEST_SECRETS[0] })).toEqual({ ok: true });
    expect(await verifyTurnstile({ token: 't', action: 'login', ip: null }, deps)).toMatchObject({ ok: false, codes: ['wrong-hostname'] });
  });
});

describe('"send the code again" needs a Turnstile-checked request first', () => {
  it('is open for 10 minutes for that email only', async () => {
    const email = `resend-${Date.now()}@example.test`;
    expect(await isLoginHuman(redis, email)).toBe(false);
    await markLoginHuman(redis, email);
    expect(await isLoginHuman(redis, email)).toBe(true);
    expect(await isLoginHuman(redis, email.toUpperCase())).toBe(true);
    expect(await isLoginHuman(redis, `other-${email}`)).toBe(false);
    const key = `login-human:${createHash('sha256').update(email).digest('hex')}`;
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(LOGIN_HUMAN_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(LOGIN_HUMAN_SECONDS);
    // After the window, the key is gone
    await redis.pexpire(key, 1);
    await new Promise((r) => setTimeout(r, 20));
    expect(await isLoginHuman(redis, email)).toBe(false);
  });
});

describe('the CSP lets Turnstile in and nothing else', () => {
  const csp = contentSecurityPolicy('bm9uY2U=', { IMAGE_URL: undefined, S3_ENDPOINT: undefined });
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `));

  it('allows the widget frame and script from challenges.cloudflare.com only', () => {
    expect(directive('frame-src')).toBe('frame-src https://challenges.cloudflare.com');
    expect(directive('script-src')).toBe("script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic' https://challenges.cloudflare.com");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
  });
});

describe('photos for accounts in their first 7 days', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it('the rule is the same as chat: under 7 days from created_at', () => {
    expect(isNewAccount(new Date(now.getTime() - 7 * DAY + 1), now)).toBe(true);
    expect(isNewAccount(new Date(now.getTime() - 7 * DAY), now)).toBe(false);
  });

  it(`new accounts: ${LISTING_LIMITS.uploadsPerNewUserHour.max} an hour; older accounts get no extra limit`, async () => {
    const userId = `photos-${Date.now()}`;
    const fresh = newAccountUploadChecks(userId, new Date(now.getTime() - DAY), now);
    expect(fresh.map(([l]) => l.name)).toEqual(['listing-upload:new-user:1h', 'listing-upload:new-user:1d']);
    for (let i = 0; i < LISTING_LIMITS.uploadsPerNewUserHour.max; i++) expect(await hit(redis, fresh)).toEqual({ ok: true });
    expect(await hit(redis, fresh)).toMatchObject({ ok: false });

    expect(newAccountUploadChecks(userId, new Date(now.getTime() - 8 * DAY), now)).toEqual([]);
    expect(newAccountUploadChecks(userId, new Date(now.getTime() - 7 * DAY), now)).toEqual([]);
  });

  it(`and ${LISTING_LIMITS.uploadsPerNewUserDay.max} a day`, async () => {
    const userId = `photos-day-${Date.now()}`;
    const checks = newAccountUploadChecks(userId, now, now);
    // A new hour window, the day window keeps counting
    for (let i = 0; i < LISTING_LIMITS.uploadsPerNewUserDay.max; i++) {
      if (i === LISTING_LIMITS.uploadsPerNewUserHour.max) await redis.del(`rl:${LISTING_LIMITS.uploadsPerNewUserHour.name}:${userId}`);
      expect(await hit(redis, checks)).toEqual({ ok: true });
    }
    await redis.del(`rl:${LISTING_LIMITS.uploadsPerNewUserHour.name}:${userId}`);
    expect(await hit(redis, checks)).toMatchObject({ ok: false });
  });
});
