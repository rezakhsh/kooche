import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { visitorCountry } from '../src/lib/client-ip';
import { isIranRequest } from '../src/lib/region';
import { ADMIN_GATE_HEADER } from '../src/modules/admin/gate';
import { testAccountsAdmin } from '../src/modules/admin/users';
import { readViewAs, readViewAsUntil, VIEW_AS_HEADER, viewAsCountry, viewAsToken } from '../src/modules/admin/view-as';
import { db, publicToken } from './db';

// View as a country (wave 2 part 1, step 1c): a signed cookie only admin makes, turned by the proxy
// into a header that sets the visitor's country (a real Iran visitor stays Iran) and hides the session.

const SECRET = 'test-secret-test-secret-test-secret-0123';
const ADMIN_PATH = 'k7x2m9q4w8e1r5t3y6u0i2o4';
const CLOUDFLARE = '172.71.10.20';
const HOUR = 3_600_000;
const soon = () => new Date(Date.now() + HOUR);

describe('the token', () => {
  it('carries a country until it ends, and only with our secret', () => {
    const until = soon();
    const token = viewAsToken(SECRET, 'AT', until);
    expect(readViewAs(token, SECRET)).toBe('AT');
    expect(readViewAsUntil(token, SECRET)).toEqual({ country: 'AT', until: new Date(Math.floor(until.getTime() / 1000) * 1000) });
    expect(readViewAs(token, 'another-secret-another-secret-0123456')).toBeNull();
    expect(readViewAs(token, SECRET, new Date(until.getTime() + 1000))).toBeNull();
    // Another country with the same signature, or anything else
    expect(readViewAs(token.replace(/^AT/, 'DE'), SECRET)).toBeNull();
    for (const bad of [undefined, null, '', 'AT', 'at.1.x', `${token}x`]) expect(readViewAs(bad, SECRET)).toBeNull();
  });
});

describe('the visitor’s country', () => {
  beforeAll(() => vi.stubEnv('AUTH_SECRET', SECRET));
  afterAll(() => vi.unstubAllEnvs());
  const viewing = (country: string, extra: Record<string, string> = {}) => new Headers({ [VIEW_AS_HEADER]: viewAsToken(SECRET, country, soon()), ...extra });

  it('is the chosen country, Iran included', () => {
    expect(viewAsCountry(viewing('CA'))).toBe('CA');
    expect(visitorCountry(viewing('CA'))).toBe('CA');
    expect(visitorCountry(viewing('AT', { 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': 'DE' }))).toBe('AT');
    expect(isIranRequest(viewing('IR'))).toBe(true);
  });

  it('a request really from Iran stays Iran', () => {
    expect(isIranRequest(viewing('DE', { 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': 'IR' }))).toBe(true);
  });

  it('a header without our signature counts for nothing', () => {
    expect(viewAsCountry(new Headers({ [VIEW_AS_HEADER]: viewAsToken('another-secret-another-secret-0123456', 'DE', soon()) }))).toBeNull();
    expect(visitorCountry(new Headers({ [VIEW_AS_HEADER]: 'DE', 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': 'IR' }))).toBe('IR');
  });
});

describe('the proxy', () => {
  beforeAll(() => {
    vi.stubEnv('APP_URL', 'https://app.example.test');
    vi.stubEnv('DATABASE_URL', 'postgres://x:y@localhost:5432/z');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', SECRET);
    vi.stubEnv('PHONE_CODE_SECRET', SECRET);
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'test_bot');
    vi.stubEnv('ADMIN_PATH', ADMIN_PATH);
  });
  afterAll(() => vi.unstubAllEnvs());

  const page = (path: string, cookie: string, headers: Record<string, string> = {}) =>
    new NextRequest(`https://app.example.test${path}`, { headers: { cookie, ...headers } });
  const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

  it('turns the cookie into the header, as on a first visit, never kept by Cloudflare', async () => {
    const { proxy } = await import('../src/proxy');
    const token = viewAsToken(SECRET, 'AT', soon());
    const res = proxy(page('/', `view_as=${token}; country=germany`));
    expect(forwarded(res, VIEW_AS_HEADER)).toBe(token);
    expect(forwarded(res, 'cookie')).not.toContain('country=germany');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    // A browse page still shows its own country, and still isn't shared
    const browse = proxy(page('/austria/wien', `view_as=${token}`));
    expect(forwarded(browse, 'cookie')).toContain('country=austria');
    expect(browse.headers.get('cache-control')).toBe('private, no-store');
  });

  it('not on the admin page, and not with a bad or old cookie', async () => {
    const { proxy } = await import('../src/proxy');
    const admin = proxy(page(`/${ADMIN_PATH}/users`, `view_as=${viewAsToken(SECRET, 'AT', soon())}`));
    expect(forwarded(admin, VIEW_AS_HEADER)).toBeNull();
    expect(forwarded(admin, ADMIN_GATE_HEADER)).not.toBeNull();
    for (const cookie of [`view_as=${viewAsToken('another-secret-another-secret-0123456', 'AT', soon())}`, `view_as=${viewAsToken(SECRET, 'AT', new Date(Date.now() - 1000))}`]) {
      const res = proxy(page('/', `${cookie}; country=germany`));
      expect(forwarded(res, VIEW_AS_HEADER)).toBeNull();
      expect(forwarded(res, 'cookie') ?? 'country=germany').toContain('country=germany');
    }
  });

  it('removes a header a client sent', async () => {
    const { proxy } = await import('../src/proxy');
    const res = proxy(page('/', '', { [VIEW_AS_HEADER]: viewAsToken(SECRET, 'AT', soon()) }));
    expect(forwarded(res, VIEW_AS_HEADER)).toBeNull();
    expect(res.headers.get('x-middleware-override-headers')?.split(',')).not.toContain(VIEW_AS_HEADER);
  });
});

describe('the test accounts list in admin', () => {
  it('shows a personal test account’s email to admins only', async () => {
    const email = `${randomUUID()}@example.test`;
    await db.insert(schema.users).values({ publicToken: publicToken(), email, displayName: 'حمید', displayNameNormalized: 'حمید', testAccount: 'personal' });
    const mine = (rows: Awaited<ReturnType<typeof testAccountsAdmin>>) => rows.find((r) => r.name === 'حمید' && (r.email === email || r.email === null));
    expect(mine(await testAccountsAdmin(db, { withContact: true }))?.email).toBe(email);
    expect(mine(await testAccountsAdmin(db, { withContact: false }))?.email).toBeNull();
  });
});
