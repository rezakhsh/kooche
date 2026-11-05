import { readdirSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { outlineFor, STATIC_ROUTES } from '../src/components/nav-outline-kind';

// Smooth loading (docs/research/smooth-loading.md, approved Nov 5, 2026): which outline a tapped
// link shows, and Cloudflare's stale-while-revalidate header on shared browse pages only.

describe('the outline for a tapped link', () => {
  it('knows every top-level route folder, so a new one never passes for a country', () => {
    const folders = readdirSync('src/app', { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('['))
      .map((d) => d.name);
    expect(new Set(folders)).toEqual(STATIC_ROUTES);
  });

  it('draws the page kinds of the plan and leaves the rest to the top line', () => {
    const cases: Array<[string, string | null]> = [
      ['/v/otagh-dar-wg/w5zyhzxsqk', 'listing'],
      ['/v/x', null],
      ['/germany', 'browse'],
      ['/germany/berlin', 'browse'],
      ['/germany/cars', 'browse'],
      ['/germany/berlin/cars', 'browse'],
      ['/germany/berlin/events', null],
      ['/germany/events', null],
      ['/germany/online', null],
      ['/germany/berlin/founding', null],
      ['/germany/berlin/cars/x', null],
      ['/my/listings', 'list'],
      ['/my/favorites', 'list'],
      ['/my/searches', 'list'],
      ['/my/listings/01a17f08-c375-70db-bd13-17ffe1393e38', 'posting'],
      ['/my/listings/01a17f08-c375-70db-bd13-17ffe1393e38/promote', null],
      ['/new', 'posting'],
      ['/new/cars', 'posting'],
      ['/chat', 'chat'],
      ['/chat/01a17f08-c375-70db-bd13-17ffe1393e38', 'thread'],
      ['/chat/new', null],
      ['/account', 'account'],
      ['/account/settings', 'account'],
      ['/account/devices', null],
      ['/', null],
      ['/help', null],
      ['/login', null],
      ['/admin', null],
      ['/e/nava/abc', null],
    ];
    for (const [path, kind] of cases) expect(outlineFor(path), path).toBe(kind);
  });
});

const CLOUDFLARE = '172.71.10.20'; // a Cloudflare address, as Traefik writes it
const from = (country: string, cookie?: string) => {
  const h = new Headers({ 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': country });
  if (cookie) h.set('cookie', cookie);
  return h;
};

describe("Cloudflare's own copy of browse pages", () => {
  beforeAll(() => {
    vi.stubEnv('APP_URL', 'https://app.example.test');
    vi.stubEnv('DATABASE_URL', 'postgres://x:y@localhost:5432/z');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', 'test-secret-test-secret-test-secret-0123');
    vi.stubEnv('PHONE_CODE_SECRET', 'test-secret-test-secret-test-secret-0123');
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'test_bot');
  });
  afterAll(() => vi.unstubAllEnvs());

  const get = async (path: string, opts: { country?: string; cookie?: string; method?: string } = {}) => {
    const { proxy } = await import('../src/proxy');
    return proxy(new NextRequest(`https://app.example.test${path}`, { method: opts.method ?? 'GET', headers: from(opts.country ?? 'DE', opts.cookie) })).headers;
  };

  it('lets Cloudflare serve a stored copy while it refreshes, and on server errors', async () => {
    const { BROWSE_CDN_CACHE_CONTROL } = await import('../src/proxy');
    expect(BROWSE_CDN_CACHE_CONTROL).toBe('public, max-age=60, stale-while-revalidate=600, stale-if-error=86400');
    // s-maxage would forbid serving stale (Cloudflare's revalidation docs)
    expect(BROWSE_CDN_CACHE_CONTROL).not.toContain('s-maxage');
    for (const path of ['/germany', '/germany/berlin', '/germany/berlin/cars?sort=price_asc']) {
      const h = await get(path);
      expect(h.get('cloudflare-cdn-cache-control'), path).toBe(BROWSE_CDN_CACHE_CONTROL);
      // Browsers still ask again every time
      expect(h.get('cache-control'), path).toBe('public, max-age=0, s-maxage=60');
    }
  });

  it('never on anything personal or private', async () => {
    const privateCases: Array<[string, Parameters<typeof get>[1]]> = [
      ['/germany/berlin', { cookie: '__Secure-better-auth.session_token=abc' }],
      ['/germany/berlin', { cookie: 'view=list' }],
      ['/germany/berlin', { cookie: 'theme=dark' }],
      ['/germany/berlin', { country: 'IR' }],
      ['/germany/berlin', { method: 'POST' }],
      ['/germany/berlin?q=bmw', {}],
      ['/germany/berlin?postal=10115', {}],
    ];
    for (const [path, opts] of privateCases) {
      const h = await get(path, opts);
      expect(h.get('cache-control'), `${path} ${JSON.stringify(opts)}`).toBe('private, no-store');
      expect(h.get('cloudflare-cdn-cache-control'), `${path} ${JSON.stringify(opts)}`).toBeNull();
    }
    for (const path of ['/', '/help', '/login', '/v/x/w5zyhzxsqk', '/my/listings', '/chat']) {
      expect((await get(path)).get('cloudflare-cdn-cache-control'), path).toBeNull();
    }
  });
});
