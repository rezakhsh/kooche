import type { NextConfig } from 'next';

// Static security headers for every response. The Content-Security-Policy needs a per-request
// nonce, so it is set in src/proxy.ts instead.
const securityHeaders = [
  // Two years. `preload` only once the production app serves peydoo.com itself (decided at launch:
  // it is hard to undo and covers every subdomain).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // `npm run typecheck` (tsc 7) checks types before every build. Next's own check needs the
  // TypeScript 5/6 JavaScript API, which TypeScript 7 doesn't ship.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
