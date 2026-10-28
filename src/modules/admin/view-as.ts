import { createHmac, timingSafeEqual } from 'node:crypto';

// View as a country (wave 2 part 1, step 1c, owner Oct 28, 2026; mockup final/admin-viewas): staff
// pick a country in admin › users › «دیدن سایت از نگاه دیگران» and the site shows as for a visitor
// from there without an account. The choice is a cookie signed with AUTH_SECRET (only the admin
// action makes one) that lasts VIEW_AS_HOURS. On every page but the admin page, src/proxy.ts turns
// a valid cookie into VIEW_AS_HEADER (removing any header a client sent), and then:
// - the visitor's country (src/lib/client-ip.ts, visitorCountry) is the chosen one, Iran included
//   (its banner and its rules), but a request really from Iran stays Iran;
// - the session is hidden (src/modules/users/server.ts, currentSession), so pages show what a
//   visitor without an account sees, test accounts' content included (hidden);
// - the remembered country is left out, as on a first visit, and nothing is kept by Cloudflare;
// - a staff banner on every page says so, with «پایان».
// The header carries the signed token itself, because prefetches skip the proxy.

export const VIEW_AS_COOKIE = 'view_as';
export const VIEW_AS_HEADER = 'x-peydoo-view-as';
export const VIEW_AS_HOURS = 2;

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(`peydoo-view-as-v1:${payload}`).digest('base64url');

/** The cookie's value: the country, until when (seconds), and the signature */
export function viewAsToken(secret: string, country: string, until: Date): string {
  const payload = `${country}.${Math.floor(until.getTime() / 1000)}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** The country of a valid, unexpired token and until when, else null */
export function readViewAsUntil(token: string | null | undefined, secret: string, now = new Date()): { country: string; until: Date } | null {
  const m = token?.match(/^([A-Z]{2})\.(\d{1,12})\.([\w-]{43})$/);
  if (!m) return null;
  const expected = Buffer.from(sign(secret, `${m[1]}.${m[2]}`));
  const given = Buffer.from(m[3]!);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const until = new Date(Number(m[2]) * 1000);
  return until > now ? { country: m[1]!, until } : null;
}

/** The country of a valid, unexpired token, else null */
export function readViewAs(token: string | null | undefined, secret: string, now = new Date()): string | null {
  return readViewAsUntil(token, secret, now)?.country ?? null;
}

/** The country a request is viewed as (the proxy's header), else null */
export function viewAsCountry(headers: Headers): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret ? readViewAs(headers.get(VIEW_AS_HEADER), secret) : null;
}
