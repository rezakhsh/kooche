import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { IRAN_WRITE_PATHS, IRAN_WRITE_PREFIXES, iranBlocksRequest, iranWafExpression, isIranRequest } from '../src/lib/region';
import { messages } from '../src/messages/fa';

// Iran read-only (wave 0, docs/wave0-plan.md, item 5): reading works, writing doesn't, except
// what protects the person (report, sign out, sessions, delete, download, notifications).

const CLOUDFLARE = '172.71.10.20'; // a Cloudflare address, as Traefik writes it
const fromCloudflare = (country: string) => new Headers({ 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': country });

describe('who counts as Iran', () => {
  it('trusts CF-IPCountry only behind Cloudflare', () => {
    expect(isIranRequest(fromCloudflare('IR'))).toBe(true);
    expect(isIranRequest(fromCloudflare('ir'))).toBe(true);
    expect(isIranRequest(fromCloudflare('DE'))).toBe(false);
    // Sent straight to the server (the origin lock stops this, but the app doesn't rely on it)
    expect(isIranRequest(new Headers({ 'x-forwarded-for': '203.0.113.9', 'cf-ipcountry': 'IR' }))).toBe(false);
    expect(isIranRequest(new Headers())).toBe(false);
  });
});

describe('what Iran may write', () => {
  it('reads everything', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
      expect(iranBlocksRequest('/new', method)).toBe(false);
      expect(iranBlocksRequest('/germany/berlin', method)).toBe(false);
    }
  });

  it('refuses sign-in, phone checks, posting, chat, favorites, payments and the waitlist', () => {
    for (const path of ['/login', '/login/code', '/account/phone', '/account/phone/sms', '/account/name', '/account/place', '/new', '/new/bicycles', '/events/new', '/business/new', '/chat/abc', '/chat/new', '/favorites', '/my/listings/x/promote', '/b/shop/billing', '/v/x/y', '/germany/berlin', '/my/searches', '/']) {
      expect(iranBlocksRequest(path, 'POST'), path).toBe(true);
    }
    expect(iranBlocksRequest('/new', 'PUT')).toBe(true);
    expect(iranBlocksRequest('/new', 'DELETE')).toBe(true);
  });

  it('allows what protects the person', () => {
    for (const path of ['/report', '/report/sent', '/account', '/account/', '/account/devices', '/account/delete', '/account/data/export', '/account/notifications', '/alerts/off', '/alerts/off/one-click', '/api/monitoring', '/api/stripe/webhook', '/api/whatsapp/webhook']) {
      expect(iranBlocksRequest(path, 'POST'), path).toBe(false);
    }
    // A prefix is a whole path segment
    expect(iranBlocksRequest('/reports', 'POST')).toBe(true);
    expect(iranBlocksRequest('/account/devicesx', 'POST')).toBe(true);
  });

  it('gives Cloudflare the same rule', () => {
    const rule = iranWafExpression();
    expect(rule).toContain('ip.src.country eq "IR"');
    expect(rule).toContain('not http.request.method in {"GET" "HEAD" "OPTIONS"}');
    for (const p of IRAN_WRITE_PATHS) expect(rule).toContain(`"${p}"`);
    for (const p of IRAN_WRITE_PREFIXES) {
      expect(rule).toContain(`http.request.uri.path eq "${p}"`);
      expect(rule).toContain(`starts_with(http.request.uri.path, "${p}/")`);
    }
  });

  it('never says "sanctions" to the person', () => {
    const texts = JSON.stringify([messages.iran, messages.bot.iranNumber, messages.phone.failed.country_not_allowed]);
    expect(texts).not.toContain('تحریم');
    expect(texts).not.toMatch(/وی‌?پی‌?ان|VPN/i);
  });
});

describe('the proxy', () => {
  beforeAll(() => {
    vi.stubEnv('APP_URL', 'https://app.example.test');
    vi.stubEnv('DATABASE_URL', 'postgres://x:y@localhost:5432/z');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', 'test-secret-test-secret-test-secret-0123');
    vi.stubEnv('PHONE_CODE_SECRET', 'test-secret-test-secret-test-secret-0123');
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'test_bot');
  });
  afterAll(() => vi.unstubAllEnvs());

  const request = (path: string, method: string, country: string) =>
    new NextRequest(`https://app.example.test${path}`, { method, headers: fromCloudflare(country) });

  it('refuses a write from Iran with a Persian page, never cached', async () => {
    const { proxy } = await import('../src/proxy');
    const res = proxy(request('/new', 'POST', 'IR'));
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.text();
    expect(body).toContain(messages.iran.refused.title);
    expect(body).toContain('dir="rtl"');
  });

  it('lets Iran report and read, and never lets Cloudflare keep its pages', async () => {
    const { proxy } = await import('../src/proxy');
    expect(proxy(request('/report', 'POST', 'IR')).status).not.toBe(403);
    const page = proxy(request('/germany/berlin', 'GET', 'IR'));
    expect(page.status).toBe(200);
    expect(page.headers.get('cache-control')).toBe('private, no-store');
  });

  it('leaves everyone else alone', async () => {
    const { proxy } = await import('../src/proxy');
    expect(proxy(request('/new', 'POST', 'DE')).status).not.toBe(403);
    expect(proxy(request('/germany/berlin', 'GET', 'DE')).headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60');
  });
});
