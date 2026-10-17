import { type NextRequest, NextResponse } from 'next/server';
import { webEnv } from './lib/env';

// Strict Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce from the
// request's CSP header and puts it on its own scripts. The other security headers are static and
// live in next.config.ts, except X-Robots-Tag, which depends on the environment at runtime.

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a nonced script are trusted, nothing else is.
    // React's dev tooling needs eval, so only in development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (webEnv().SEARCH_INDEXING === 'off') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
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
