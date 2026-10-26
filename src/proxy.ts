import { type NextRequest, NextResponse } from 'next/server';
import { COUNTRY_COOKIE } from './app/country-cookie-name';
import { webEnv, type WebEnv } from './lib/env';
import { iranBlocksRequest, isIranRequest } from './lib/region';
import { messages } from './messages/fa';
import { ADMIN_GATE_HEADER, adminGateValue, adminRoute, isInternalAdminPath } from './modules/admin/gate';

// Strict Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce from the
// request's CSP header and puts it on its own scripts. The other security headers are static and
// live in next.config.ts, except X-Robots-Tag, which depends on the environment at runtime.

/** First path segments of our own pages; anything else with one to three segments is a browse page */
const NOT_BROWSE = new Set([
  ...['account', 'api', 'chat', 'e', 'events', 'favorites', 'health', 'login', 'my', 'new', 'u', 'v', 'sitemaps'],
  // Legal and help pages (Oct 21, 2026)
  ...['contact', 'help', 'impressum', 'privacy', 'safety', 'terms'],
  // Turning off a saved-search alert from its email (Oct 22, 2026)
  'alerts',
  // Business pages, creating a business, the Pro page (Oct 22, 2026)
  ...['b', 'business', 'pro'],
  // Reporting content; the admin page's internal route (Oct 23, 2026)
  ...['report', 'admin'],
]);
/**
 * Stripe's hosted Checkout and Customer Portal. A purchase form posts to our server action, which
 * redirects there; browsers apply form-action to that redirect too.
 */
const STRIPE_FORM_TARGETS = 'https://checkout.stripe.com https://billing.stripe.com';
/** Cloudflare Turnstile (src/components/turnstile.tsx) */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
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
 * me" or a keyword in the address (keyword pages are rarely asked twice, so a shared copy would
 * mostly cache typos). The `country` cookie can't make a difference: proxy() renders every browse
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
  return (method !== 'GET' && method !== 'HEAD') || personal || search.has('near') || search.has('postal') || search.has('q') ? 'private, no-store' : 'public, max-age=0, s-maxage=60';
}

/** The Content-Security-Policy for one response */
export function contentSecurityPolicy(nonce: string, env: Pick<WebEnv, 'IMAGE_URL' | 'S3_ENDPOINT'>, dev = false): string {
  // Photos come from imgproxy; the photo editor uploads straight to R2 (presigned PUT)
  const imageOrigin = env.IMAGE_URL ? ` ${new URL(env.IMAGE_URL).origin}` : '';
  const uploadOrigin = env.S3_ENDPOINT ? ` ${new URL(env.S3_ENDPOINT).origin}` : '';

  return [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a nonced script are trusted, nothing else is.
    // React's dev tooling needs eval, so only in development. Turnstile's host is for browsers
    // without 'strict-dynamic' (the others ignore host entries and trust our script that adds it).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:${imageOrigin}`,
    "font-src 'self'",
    `connect-src 'self'${uploadOrigin}`,
    // The photo editor shrinks photos in a Web Worker from our own /_next/static (roadmap step
    // 10). Without this, worker-src falls back to script-src, where 'strict-dynamic' ignores 'self'.
    "worker-src 'self'",
    // Turnstile's widget on sign-in and publishing. On every page, not just those: a page reached
    // by an in-app link keeps the CSP of the page the visit started on.
    `frame-src ${TURNSTILE_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${STRIPE_FORM_TARGETS}`,
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/**
 * The page a write from Iran gets (src/lib/region.ts). Plain HTML: it can also answer a server
 * action. The pages already show the notice before anyone fills in a form, so this is rare.
 */
export function iranRefusal(): NextResponse {
  const t = messages.iran.refused;
  const body = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title}</title></head><body style="font-family:Tahoma,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:2"><h1 style="font-size:1.3rem">${t.title}</h1><p>${t.body}</p><p><a href="/">${t.back}</a></p></body></html>`;
  return new NextResponse(body, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}

export function proxy(request: NextRequest) {
  // Iran is read-only (src/lib/region.ts): a write is refused before anything else runs
  const fromIran = isIranRequest(request.headers);
  if (fromIran && iranBlocksRequest(request.nextUrl.pathname, request.method)) return iranRefusal();

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const env = webEnv();
  const csp = contentSecurityPolicy(nonce, env, process.env.NODE_ENV === 'development');

  // A browse page shows its own country in the header, whatever was chosen before (see above)
  const country = adminRoute(request.nextUrl.pathname, env.ADMIN_PATH) ? null : browseCountry(request.nextUrl.pathname);
  if (country) request.cookies.set(COUNTRY_COOKIE, country);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  // Only this proxy marks a request as coming through the admin page's secret address
  requestHeaders.delete(ADMIN_GATE_HEADER);

  // The admin page (src/modules/admin/gate.ts): /<ADMIN_PATH>/… becomes /admin/… with the mark.
  // Never indexed, never kept by any cache; /admin itself goes on unmarked and answers 404.
  const pathname = request.nextUrl.pathname;
  const internal = adminRoute(pathname, env.ADMIN_PATH);
  if (internal || isInternalAdminPath(pathname)) {
    let response: NextResponse;
    if (internal) {
      requestHeaders.set(ADMIN_GATE_HEADER, adminGateValue(env.AUTH_SECRET));
      const url = request.nextUrl.clone();
      url.pathname = internal;
      response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    } else response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (env.SEARCH_INDEXING === 'off') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  // A page for Iran carries the Iran banner: never kept by Cloudflare for anyone else
  const cacheControl = fromIran
    ? 'private, no-store'
    : browseCacheControl(pathname, request.nextUrl.searchParams, (n) => request.cookies.get(n)?.value, request.method);
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
