import { createHash, generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { phoneVerifications, users } from '../src/db/schema';
import {
  TELEGRAM_ISSUER,
  finishTelegramLogin,
  startTelegramLogin,
  type OidcConfig,
  type OidcTransport,
} from '../src/modules/users/telegram-oidc';
import { appDb } from './accounts';
import { db } from './db';
import { user } from './listings-fixtures';

// "Log in with Telegram" (OpenID Connect, phone scope; wave 0, step 4) against a fake Telegram
// that checks PKCE and the client secret and signs RS256 id_tokens with a test key.

const config: OidcConfig = {
  clientId: '8123456789',
  clientSecret: 'test-client-secret-0123456789',
  redirectUri: 'https://app.example.test/account/phone/telegram/callback',
  secret: 'phone-code-secret-phone-code-secret-0123',
};

const telegramKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(telegramKey.publicKey.export({ format: 'jwk' }) as JsonWebKey), kid: 'k1', alg: 'RS256', use: 'sig' };

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function idToken(claims: Record<string, unknown>, key: KeyObject = telegramKey.privateKey, kid = 'k1'): string {
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64(claims);
  return `${head}.${body}.${sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url')}`;
}

/** A fake Telegram: answers the token request with `claims` once the code, PKCE and secret check out */
function fakeTelegram(url: string, claims: (base: Record<string, unknown>) => Record<string, unknown> = (c) => c, key?: KeyObject) {
  const params = new URL(url).searchParams;
  const seen: { verifierOk?: boolean; secretOk?: boolean } = {};
  const now = Math.floor(Date.now() / 1000);
  const base = {
    iss: TELEGRAM_ISSUER,
    aud: config.clientId,
    sub: '7000000001',
    iat: now,
    exp: now + 300,
    nonce: params.get('nonce'),
    phone_number: '4915112345678',
    phone_number_verified: true,
    name: 'نام واقعی',
    preferred_username: 'someone',
    picture: 'https://t.me/i/userpic/x.jpg',
  };
  const transport: OidcTransport = {
    async token(form, basic) {
      const challenge = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
      seen.verifierOk = challenge === params.get('code_challenge');
      seen.secretOk = basic === Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
      if (!seen.verifierOk || !seen.secretOk || form.get('code') !== 'the-code') return { ok: false, body: { error: 'invalid_grant' } };
      return { ok: true, body: { id_token: idToken(claims(base), key) } };
    },
    async jwks() {
      return { keys: [jwk] };
    },
  };
  return { transport, state: params.get('state')!, seen };
}

async function started(phoneVerified = false) {
  const u = await user({ verified: phoneVerified });
  const { url, verificationId } = await startTelegramLogin(appDb, { userId: u.id, ip: '203.0.113.9', config });
  return { u, url, verificationId };
}

const attempt = async (id: string) => (await db.select().from(phoneVerifications).where(eq(phoneVerifications.id, id)))[0]!;
const account = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0]!;

describe('Telegram login', () => {
  it('sends Telegram the phone scope, PKCE and a nonce, and keeps only the state’s hash', async () => {
    const { url, verificationId } = await started();
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${TELEGRAM_ISSUER}/auth`);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid phone',
      code_challenge_method: 'S256',
    });
    const row = await attempt(verificationId);
    expect(row).toMatchObject({ method: 'telegram_oidc', status: 'pending' });
    expect(row.linkTokenHash!.equals(createHash('sha256').update(u.searchParams.get('state')!).digest())).toBe(true);
  });

  it('verifies the number Telegram signed, and throws the rest away', async () => {
    const { u, url, verificationId } = await started();
    const tg = fakeTelegram(url);
    const r = await finishTelegramLogin(appDb, tg.transport, { userId: u.id, state: tg.state, code: 'the-code', error: null, config });
    expect(r).toEqual({ ok: true, phoneE164: '+4915112345678' });
    expect(tg.seen).toEqual({ verifierOk: true, secretOk: true });
    const me = await account(u.id);
    expect(me).toMatchObject({ phoneE164: '+4915112345678', phoneVerificationMethod: 'telegram_oidc', telegramUserId: null, displayName: u.displayName });
    expect(await attempt(verificationId)).toMatchObject({ status: 'verified', numberCountry: 'DE' });
    // The same state can't be used twice
    expect(await finishTelegramLogin(appDb, tg.transport, { userId: u.id, state: tg.state, code: 'the-code', error: null, config })).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('refuses +98 and +888, keeping only the country', async () => {
    for (const [phone, reason, country] of [['989121234567', 'country_not_allowed', 'IR'], ['88804123456', 'no_country', null]] as const) {
      const { u, url, verificationId } = await started();
      const tg = fakeTelegram(url, (c) => ({ ...c, phone_number: phone }));
      expect(await finishTelegramLogin(appDb, tg.transport, { userId: u.id, state: tg.state, code: 'the-code', error: null, config })).toEqual({ ok: false, reason, country });
      expect(await attempt(verificationId)).toMatchObject({ status: 'failed', failureReason: reason, numberCountry: country, phoneE164: null });
      expect((await account(u.id)).phoneE164).toBeNull();
    }
  });

  it('records a refusal on Telegram’s page', async () => {
    const { u, url, verificationId } = await started();
    const tg = fakeTelegram(url);
    expect(await finishTelegramLogin(appDb, tg.transport, { userId: u.id, state: tg.state, code: null, error: 'access_denied', config })).toEqual({ ok: false, reason: 'declined' });
    expect(await attempt(verificationId)).toMatchObject({ status: 'failed', failureReason: 'declined' });
  });

  it('refuses a token that doesn’t check out', async () => {
    const bad: Array<[string, (c: Record<string, unknown>) => Record<string, unknown>, KeyObject?]> = [
      ['another key', (c) => c, otherKey.privateKey],
      ['another audience', (c) => ({ ...c, aud: '999' })],
      ['another issuer', (c) => ({ ...c, iss: 'https://evil.example' })],
      ['expired', (c) => ({ ...c, exp: Math.floor(Date.now() / 1000) - 600 })],
      ['another nonce', (c) => ({ ...c, nonce: 'x' })],
      ['no nonce', (c) => ({ ...c, nonce: undefined })],
      ['number not verified', (c) => ({ ...c, phone_number_verified: false })],
      ['no number', (c) => ({ ...c, phone_number: undefined })],
    ];
    for (const [label, claims, key] of bad) {
      const { u, url, verificationId } = await started();
      const tg = fakeTelegram(url, claims, key);
      const r = await finishTelegramLogin(appDb, tg.transport, { userId: u.id, state: tg.state, code: 'the-code', error: null, config });
      expect(r, label).toEqual({ ok: false, reason: 'oidc_failed' });
      expect((await attempt(verificationId)).failureReason, label).toBe('oidc_failed');
      expect((await account(u.id)).phoneE164, label).toBeNull();
    }
  });

  it('refuses a wrong code (Telegram says invalid_grant)', async () => {
    const { u, url } = await started();
    const tg = fakeTelegram(url);
    expect(await finishTelegramLogin(appDb, tg.transport, { userId: u.id, state: tg.state, code: 'another-code', error: null, config })).toEqual({ ok: false, reason: 'oidc_failed' });
  });

  it('works only for the account that started it, and only for 10 minutes', async () => {
    const { url, verificationId } = await started();
    const someoneElse = await user({ verified: false });
    const tg = fakeTelegram(url);
    expect(await finishTelegramLogin(appDb, tg.transport, { userId: someoneElse.id, state: tg.state, code: 'the-code', error: null, config })).toEqual({ ok: false, reason: 'invalid_state' });
    expect((await attempt(verificationId)).status).toBe('pending');

    const late = await started();
    await db.update(phoneVerifications).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(phoneVerifications.id, late.verificationId));
    const tg2 = fakeTelegram(late.url);
    expect(await finishTelegramLogin(appDb, tg2.transport, { userId: late.u.id, state: tg2.state, code: 'the-code', error: null, config })).toEqual({ ok: false, reason: 'invalid_state' });
    expect(await finishTelegramLogin(appDb, tg2.transport, { userId: late.u.id, state: 'short', code: 'the-code', error: null, config })).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('refuses a number another account already has', async () => {
    const first = await started();
    const tg1 = fakeTelegram(first.url, (c) => ({ ...c, phone_number: '4915199999901' }));
    expect(await finishTelegramLogin(appDb, tg1.transport, { userId: first.u.id, state: tg1.state, code: 'the-code', error: null, config })).toMatchObject({ ok: true });
    const second = await started();
    const tg2 = fakeTelegram(second.url, (c) => ({ ...c, phone_number: '4915199999901' }));
    expect(await finishTelegramLogin(appDb, tg2.transport, { userId: second.u.id, state: tg2.state, code: 'the-code', error: null, config })).toEqual({ ok: false, reason: 'phone_in_use' });
  });
});
