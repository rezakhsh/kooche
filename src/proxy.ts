import { type NextRequest, NextResponse } from 'next/server';
import { COUNTRY_COOKIE } from './app/country-cookie-name';
import { webEnv, type WebEnv } from './lib/env';
import { isIranRequest } from './lib/region';
import { OWN_COOKIE_DAYS, readReturn, sessionCookieName, STAFF_RETURN_COOKIE } from './modules/admin/acting-cookies';
import { ADMIN_GATE_HEADER, adminGateValue, adminRoute, isInternalAdminPath, METHOD_HEADER, methodMark } from './modules/admin/gate';
import { readViewAs, VIEW_AS_COOKIE, VIEW_AS_HEADER } from './modules/admin/view-as';

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
  // City waitlist: confirming and leaving (wave 0)
  'waitlist',
]);
/**
 * Stripe's hosted Checkout and Customer Portal. A purchase form posts to our server action, which
 * redirects there; browsers apply form-action to that redirect too.
 */
const STRIPE_FORM_TARGETS = 'https://checkout.stripe.com https://billing.stripe.com';
/** "Log in with Telegram": the phone page's form posts to our action, which redirects there */
const TELEGRAM_LOGIN_TARGET = 'https://oauth.telegram.org';
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
 * Anything personal stays private: a session, the remembered layout or colours (light or dark),
 * and a postal code or "near me" or a keyword in the address (keyword pages are rarely asked twice,
 * so a shared copy would mostly cache typos). The `country` cookie can't make a difference: proxy() renders every browse
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
  const personal = SESSION_COOKIES.some((c) => cookie(c) !== undefined) || cookie('view') !== undefined || cookie('theme') !== undefined;
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
    `form-action 'self' ${STRIPE_FORM_TARGETS} ${TELEGRAM_LOGIN_TARGET}`,
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  // Pages for Iran carry the Iran banner (src/lib/region.ts)
  const fromIran = isIranRequest(request.headers);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const env = webEnv();
  const csp = contentSecurityPolicy(nonce, env, process.env.NODE_ENV === 'development');

  // Staff viewing the site as a country (src/modules/admin/view-as.ts), never on the admin page:
  // as on a first visit, without the country chosen before
  const admin = adminRoute(request.nextUrl.pathname, env.ADMIN_PATH) || isInternalAdminPath(request.nextUrl.pathname);
  const viewAs = admin ? null : request.cookies.get(VIEW_AS_COOKIE)?.value;
  const viewing = !!readViewAs(viewAs, env.AUTH_SECRET);
  if (viewing) request.cookies.delete(COUNTRY_COOKIE);

  // An admin signed in as a user (src/modules/admin/acting.ts): after the 30 minutes their own
  // session comes back here (a bad return cookie is just dropped); until then Better Auth's own
  // endpoints (sign-out, email change, two-step settings …) are closed
  const back = request.cookies.get(STAFF_RETURN_COOKIE)?.value;
  const acting = back ? readReturn(env.AUTH_SECRET, back) : null;
  const restore = back !== undefined && (!acting || acting.until <= new Date());
  if (restore) {
    request.cookies.delete(STAFF_RETURN_COOKIE);
    if (acting) request.cookies.set(sessionCookieName(env.APP_URL), acting.ownCookie);
  } else if (acting && request.nextUrl.pathname.startsWith('/api/auth/') && request.method !== 'GET' && request.method !== 'HEAD') {
    return new NextResponse(null, { status: 403 });
  }
  const putBack = (response: NextResponse) => {
    if (!restore) return response;
    response.cookies.delete(STAFF_RETURN_COOKIE);
    if (acting) response.cookies.set(sessionCookieName(env.APP_URL), acting.ownCookie, { path: '/', httpOnly: true, secure: env.APP_URL.startsWith('https://'), sameSite: 'lax', maxAge: OWN_COOKIE_DAYS * 86_400 });
    return response;
  };

  // A browse page shows its own country in the header, whatever was chosen before (see above)
  const country = admin ? null : browseCountry(request.nextUrl.pathname);
  if (country) request.cookies.set(COUNTRY_COOKIE, country);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // The header names the page's city in its place chip (src/components/site-header.tsx)
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('Content-Security-Policy', csp);
  // Only this proxy marks a request as coming through the admin page's secret address, or as viewed as a country
  requestHeaders.delete(ADMIN_GATE_HEADER);
  requestHeaders.delete(VIEW_AS_HEADER);
  if (viewing) requestHeaders.set(VIEW_AS_HEADER, viewAs!);
  requestHeaders.set(METHOD_HEADER, methodMark(request.method, env.AUTH_SECRET));

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
    return putBack(response);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (env.SEARCH_INDEXING === 'off') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  // A page for Iran carries the Iran banner, and a viewed-as page the staff banner: never kept by Cloudflare for anyone else
  const cacheControl = fromIran || viewing
    ? 'private, no-store'
    : browseCacheControl(pathname, request.nextUrl.searchParams, (n) => request.cookies.get(n)?.value, request.method);
  if (cacheControl) response.headers.set('Cache-Control', cacheControl);
  return putBack(response);
}

export const config = {
  matcher: [
    {
      // Pages only: not static files, not /health, not the street map's tiles, letters and worker
      // (src/app/map/, the same for everyone and kept for a year), not prefetches (they reuse the
      // page's policy)
      source: '/((?!_next/static|_next/image|favicon.ico|health|map/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
