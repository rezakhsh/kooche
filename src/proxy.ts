import { type NextRequest, NextResponse } from 'next/server';
import { COUNTRY_COOKIE } from './app/country-cookie-name';
import { webEnv } from './lib/env';

// Strict Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce from the
// request's CSP header and puts it on its own scripts. The other security headers are static and
// live in next.config.ts, except X-Robots-Tag, which depends on the environment at runtime.

/** First path segments of our own pages; anything else with one to three segments is a browse page */
const NOT_BROWSE = new Set([
  ...['account', 'api', 'chat', 'e', 'events', 'favorites', 'health', 'login', 'my', 'new', 'u', 'v', 'sitemaps'],
  // Legal and help pages (Oct 21, 2026)
  ...['contact', 'help', 'impressum', 'privacy', 'safety', 'terms'],
]);
const SESSION_COOKIES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

/** The country slug of a browse page (/germany, /germany/berlin/cars …), else null */
export function browseCountry(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 1 || segments.length > 3 || NOT_BROWSE.has(segments[0]!) || !/^[a-z][a-z-]{1,40}$/.test(segments[0]!)) return null;
  return segments[0]!;
}

/**
 * Cache-Control for browse pages. A logged-out visitor's page is the same for everyone, so
 * Cloudflare keeps it for 60 seconds (the Cache Rule in docs/setup.md, "Browsing and favorites").
 * Anything personal stays private: a session, the remembered layout, and a postal code or "near
 * me" in the address. The `country` cookie can't make a difference: proxy() renders every browse
 * page as if the page's own country were chosen, which RememberCountry then saves anyway. Only GET
 * and HEAD are shared. React Server Components requests (`RSC` header, `_rsc` parameter) get the
 * same header, because Next.js hides both from the proxy; the Cache Rule leaves them out instead
 * (Cloudflare ignores Vary). Other pages keep Next.js's own header.
 */
export function browseCacheControl(
  pathname: string,
  search: URLSearchParams,
  cookie: (name: string) => string | undefined,
  method = 'GET',
): string | null {
  if (!browseCountry(pathname)) return null;
  const personal = SESSION_COOKIES.some((c) => cookie(c) !== undefined) || cookie('view') !== undefined;
  return (method !== 'GET' && method !== 'HEAD') || personal || search.has('near') || search.has('postal') ? 'private, no-store' : 'public, max-age=0, s-maxage=60';
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const env = webEnv();
  // Photos come from imgproxy; the photo editor uploads straight to R2 (presigned PUT)
  const imageOrigin = env.IMAGE_URL ? ` ${new URL(env.IMAGE_URL).origin}` : '';
  const uploadOrigin = env.S3_ENDPOINT ? ` ${new URL(env.S3_ENDPOINT).origin}` : '';

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a nonced script are trusted, nothing else is.
    // React's dev tooling needs eval, so only in development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:${imageOrigin}`,
    "font-src 'self'",
    `connect-src 'self'${uploadOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  // A browse page shows its own country in the header, whatever was chosen before (see above)
  const country = browseCountry(request.nextUrl.pathname);
  if (country) request.cookies.set(COUNTRY_COOKIE, country);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (env.SEARCH_INDEXING === 'off') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  const cacheControl = browseCacheControl(request.nextUrl.pathname, request.nextUrl.searchParams, (n) => request.cookies.get(n)?.value, request.method);
  if (cacheControl) response.headers.set('Cache-Control', cacheControl);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not static files, not /health, not prefetches (they reuse the page's policy)
      source: '/((?!_next/static|_next/image|favicon.ico|health).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
