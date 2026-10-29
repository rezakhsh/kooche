import { createHmac, timingSafeEqual } from 'node:crypto';

// The cookies of signing in as a user (./acting.ts), apart so src/proxy.ts can read them without
// the database code.

export const ACTING_MINUTES = 30;
/** How long the admin's own session cookie lasts once put back (Better Auth's SESSION_DAYS) */
export const OWN_COOKIE_DAYS = 30;
export const STAFF_RETURN_COOKIE = 'staff_return';
/** Set for a few seconds when a change was refused, so the banner can say why */
export const ACTING_BLOCKED_COOKIE = 'acting_blocked';

/** Better Auth's session cookie (the __Secure- prefix on https, as `useSecureCookies` in ../users/auth.ts) */
export const sessionCookieName = (appUrl: string) => `${appUrl.startsWith('https://') ? '__Secure-' : ''}better-auth.session_token`;

const hmac = (secret: string, value: string, encoding: 'base64' | 'base64url') => createHmac('sha256', secret).update(value).digest(encoding);

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A session cookie's value as Better Auth signs it (better-call: token, a dot, base64 HMAC) */
export const signSessionToken = (secret: string, token: string) => `${token}.${hmac(secret, token, 'base64')}`;

/** The token in a signed session cookie value, else null */
export function sessionTokenOf(secret: string, value: string | null | undefined): string | null {
  const dot = value?.lastIndexOf('.') ?? -1;
  if (!value || dot < 1) return null;
  const token = value.slice(0, dot);
  return same(value.slice(dot + 1), hmac(secret, token, 'base64')) ? token : null;
}

/** The return cookie: the admin's own session cookie value and the end time, signed */
export function returnToken(secret: string, ownCookie: string, until: Date): string {
  const payload = `${Math.floor(until.getTime() / 1000)}.${Buffer.from(ownCookie).toString('base64url')}`;
  return `${payload}.${hmac(secret, `peydoo-acting-v1:${payload}`, 'base64url')}`;
}

/** The admin's own cookie value and the end time in a return cookie, else null (wrong signature) */
export function readReturn(secret: string, value: string | null | undefined): { ownCookie: string; until: Date } | null {
  const m = value?.match(/^(\d{1,12})\.([\w-]+)\.([\w-]{43})$/);
  if (!m || !same(m[3]!, hmac(secret, `peydoo-acting-v1:${m[1]}.${m[2]}`, 'base64url'))) return null;
  return { ownCookie: Buffer.from(m[2]!, 'base64url').toString(), until: new Date(Number(m[1]) * 1000) };
}
