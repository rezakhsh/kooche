import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isIranRequest } from '../src/lib/region';
import { messages, pages } from '../src/messages/fa';
import { openBillingPortal, startListingCheckout, startPlanCheckout } from '../src/modules/payments/checkout';
import { startFoundingCheckout } from '../src/modules/payments/founding';
import { appDb } from './accounts';
import { business, FakeGateway, seedCatalog, sellerWithListing } from './payments-fixtures';

// People in Iran (owner's rule, Oct 27, 2026; src/lib/region.ts): the account decides, as
// everywhere; only paying is refused from Iran.

const APP = 'https://app.example.test';
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

describe('what Iran may do (owner, Oct 27, 2026)', () => {
  it('pays for nothing: the checkouts and the portal are refused before Stripe is asked', async () => {
    await seedCatalog();
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    expect(await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP, fromIran: true })).toEqual({ ok: false, reason: 'from_iran' });
    const { org, ownerId } = await business();
    const plan = { userId: ownerId, organizationId: org.id, appUrl: APP, business: true, fromIran: true };
    expect(await startPlanCheckout(appDb, gateway, { ...plan, plan: 'pro', interval: 'month' })).toEqual({ ok: false, reason: 'from_iran' });
    expect(await startFoundingCheckout(appDb, gateway, plan)).toEqual({ ok: false, reason: 'from_iran' });
    expect(await openBillingPortal(appDb, gateway, plan)).toEqual({ ok: false, reason: 'from_iran' });
    expect(gateway.checkouts).toHaveLength(0);
    // The same purchase from elsewhere goes ahead
    expect(await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP, fromIran: false })).toMatchObject({ ok: true });
  });

  it('never says "sanctions" to the person', () => {
    const texts = JSON.stringify([messages.iran, pages.help, messages.bot.iranNumber, messages.phone.failed.country_not_allowed, messages.promote.errors, messages.business.billing.errors]);
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

  it('lets Iran sign in, post and write like anyone (the account decides), and never lets Cloudflare keep its pages', async () => {
    const { proxy } = await import('../src/proxy');
    for (const path of ['/login', '/new', '/chat/new', '/account/phone', '/my/orders/x/withdraw', '/report']) {
      expect(proxy(request(path, 'POST', 'IR')).status, path).not.toBe(403);
    }
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
