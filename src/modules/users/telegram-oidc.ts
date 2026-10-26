import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { phoneVerifications, users } from '../../db/schema';
import { hmacSha256, linkToken, sha256 } from '../../lib/tokens';
import { completeVerification, failVerification, type FailureReason } from './phone';
import { checkVerifiedNumber, telegramNumberToE164 } from './phone-number';

// "Log in with Telegram" (OpenID Connect, scope `openid phone`) as the main phone check (wave 0,
// docs/wave0-plan.md, item 2b; tested by the owner on Oct 25, 2026 with the staging bot, see
// docs/design-options/research/telegram-login-test/server.mjs). Telegram returns a signed id_token
// with the verified number. The bot (./telegram-bot.ts) stays as the fallback.
//
// Nothing secret is stored: the attempt row keeps the SHA-256 of the random `state`, and the PKCE
// verifier and the nonce are derived from the state with PHONE_CODE_SECRET. Name, picture and
// username come back unasked and are thrown away. The `sub` is not linked as the Telegram account
// until it is confirmed to equal the bot's user id (then notifications could use it).

export const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
/** Telegram's codes expire within minutes (round 11); the attempt lives a little longer */
export const TELEGRAM_LOGIN_TTL_MS = 10 * 60_000;
/** Clock difference allowed on the token's exp and iat */
const LEEWAY_S = 60;

export type OidcConfig = { clientId: string; clientSecret: string; redirectUri: string; secret: string };

/** Telegram's two endpoints; tests replace them */
export interface OidcTransport {
  token(form: URLSearchParams, basicAuth: string): Promise<{ ok: boolean; body: Record<string, unknown> }>;
  jwks(): Promise<{ keys: JsonWebKey[] }>;
}

const b64url = (b: Buffer) => b.toString('base64url');
const pkceVerifier = (secret: string, state: string) => b64url(hmacSha256(secret, `telegram-oidc-pkce:${state}`));
const nonceFor = (secret: string, state: string) => b64url(hmacSha256(secret, `telegram-oidc-nonce:${state}`)).slice(0, 32);

/** Starts an attempt and returns Telegram's address to send the browser to */
export async function startTelegramLogin(
  db: Queryable,
  { userId, ip, config }: { userId: string; ip: string | null; config: OidcConfig },
): Promise<{ url: string; verificationId: string }> {
  const state = linkToken();
  const [row] = await db
    .insert(phoneVerifications)
    .values({
      userId,
      method: 'telegram_oidc',
      linkTokenHash: sha256(state),
      ipAddress: ip,
      expiresAt: new Date(Date.now() + TELEGRAM_LOGIN_TTL_MS),
    })
    .returning({ id: phoneVerifications.id });
  const url = new URL(`${TELEGRAM_ISSUER}/auth`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid phone',
    state,
    nonce: nonceFor(config.secret, state),
    code_challenge: b64url(sha256(pkceVerifier(config.secret, state))),
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), verificationId: row!.id };
}

export type LoginResult =
  | { ok: true; phoneE164: string }
  | {
      ok: false;
      /** invalid_state: no such attempt for this account (old, used, or someone else's) */
      reason: 'invalid_state' | 'declined' | 'oidc_failed' | 'country_not_allowed' | 'no_country' | 'phone_in_use' | 'telegram_in_use';
      country?: string | null;
    };

type Claims = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  sub?: unknown;
  phone_number?: unknown;
  phone_number_verified?: unknown;
};

/** Checks the id_token's RS256 signature against Telegram's keys and its claims; null if anything is off */
export async function verifyIdToken(
  idToken: string,
  { transport, clientId, nonce, now = Date.now() }: { transport: OidcTransport; clientId: string; nonce: string; now?: number },
): Promise<Claims | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: unknown; kid?: unknown };
  let claims: Claims;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;
  const { keys } = await transport.jwks();
  const jwk = keys.find((k) => (k as { kid?: unknown }).kid === header.kid) ?? (keys.length === 1 ? keys[0] : undefined);
  if (!jwk) return null;
  let valid = false;
  try {
    valid = verifySignature('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  } catch {
    return null;
  }
  if (!valid) return null;

  const seconds = now / 1000;
  const audiences = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud)];
  if (claims.iss !== TELEGRAM_ISSUER) return null;
  if (!audiences.includes(clientId)) return null;
  if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_S < seconds) return null;
  if (typeof claims.iat === 'number' && claims.iat - LEEWAY_S > seconds) return null;
  if (claims.nonce !== nonce) return null;
  return claims;
}

/** Telegram's answer at the callback: the code (or an error such as access_denied) and the state */
export async function finishTelegramLogin(
  db: Queryable,
  transport: OidcTransport,
  opts: { userId: string; state: string; code: string | null; error: string | null; config: OidcConfig; now?: number },
): Promise<LoginResult> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(opts.state)) return { ok: false, reason: 'invalid_state' };
  const [row] = await db
    .select({ id: phoneVerifications.id })
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.linkTokenHash, sha256(opts.state)),
        eq(phoneVerifications.method, 'telegram_oidc'),
        eq(phoneVerifications.status, 'pending'),
        // Only the account that started it: a callback address shared or opened elsewhere is useless
        eq(phoneVerifications.userId, opts.userId),
        gt(phoneVerifications.expiresAt, sql`now()`),
      ),
    );
  if (!row) return { ok: false, reason: 'invalid_state' };

  const fail = async (reason: FailureReason, country?: string | null): Promise<LoginResult> => {
    await failVerification(db, row.id, reason, country === undefined ? {} : { numberCountry: country });
    return { ok: false, reason: reason as Extract<LoginResult, { ok: false }>['reason'], ...(country === undefined ? {} : { country }) };
  };
  if (opts.error || !opts.code) return fail('declined');

  const { config } = opts;
  let claims: Claims | null = null;
  try {
    const answer = await transport.token(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: opts.code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        code_verifier: pkceVerifier(config.secret, opts.state),
      }),
      Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64'),
    );
    const idToken = answer.ok ? answer.body.id_token : undefined;
    if (typeof idToken === 'string') {
      claims = await verifyIdToken(idToken, { transport, clientId: config.clientId, nonce: nonceFor(config.secret, opts.state), now: opts.now });
    } else {
      console.error('telegram-oidc: token exchange refused:', String(answer.body.error ?? 'no id_token'));
    }
  } catch (e) {
    console.error('telegram-oidc: token exchange failed:', e instanceof Error ? e.message : e);
  }
  if (!claims || claims.phone_number_verified !== true || typeof claims.phone_number !== 'string') return fail('oidc_failed');

  const e164 = telegramNumberToE164(claims.phone_number);
  const number = e164 ? checkVerifiedNumber(e164) : null;
  if (!number) return fail('oidc_failed');
  if (!number.ok) return number.reason === 'invalid' ? fail('oidc_failed') : fail(number.reason, number.country);

  // Open question (round 11): is `sub` the bot's user id? Logged as yes/no only, for accounts that
  // also used the bot; never the id or the number. Linking waits for the answer.
  const [known] = await db.select({ telegramUserId: users.telegramUserId }).from(users).where(eq(users.id, opts.userId));
  if (known?.telegramUserId) console.log(`telegram-oidc: sub equals the bot's user id: ${String(claims.sub) === String(known.telegramUserId) ? 'yes' : 'no'}`);

  const done = await completeVerification(db, {
    verificationId: row.id,
    userId: opts.userId,
    phoneE164: number.e164,
    numberCountry: number.country,
    method: 'telegram_oidc',
  });
  return done.ok ? { ok: true, phoneE164: number.e164 } : done;
}

/** Telegram's real endpoints. The signing keys are kept for an hour. */
export function telegramTransport(): OidcTransport {
  let cached: { keys: JsonWebKey[]; at: number } | null = null;
  return {
    async token(form, basicAuth) {
      const res = await fetch(`${TELEGRAM_ISSUER}/token`, {
        method: 'POST',
        headers: { authorization: `Basic ${basicAuth}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, body };
    },
    async jwks() {
      if (cached && Date.now() - cached.at < 3_600_000) return cached;
      const res = await fetch(`${TELEGRAM_ISSUER}/.well-known/jwks.json`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`jwks: HTTP ${res.status}`);
      const body = (await res.json()) as { keys?: JsonWebKey[] };
      cached = { keys: body.keys ?? [], at: Date.now() };
      return cached;
    },
  };
}
