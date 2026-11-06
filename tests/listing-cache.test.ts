import { randomUUID } from 'node:crypto';
import { QueueEvents } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { needsServerHeader, serverCountry, type HeaderCookieData } from '../src/components/header-place';
import { LISTING_OUTBOX } from '../src/modules/listings/events';
import { listingPageUrls, PAGES_CHANGED, pagePath, queuePagesPurge, sellerPageUrls } from '../src/modules/listings/page-purge';
import { listingPageToken } from '../src/modules/listings/shared-page';
import { titleSlug } from '../src/modules/listings/slug';
import { countPageView, flushViews } from '../src/modules/listings/views';
import { EVENT_OUTBOX } from '../src/modules/events/events';
import { setDisplayName } from '../src/modules/users/profile';
import { PAGE_PURGE_EVENTS, startModerationJobs } from '../src/worker/moderation';
import type { OutboxJobData } from '../src/worker/outbox';
import { appDb, redis, workerDb } from './accounts';
import { db } from './db';
import { listing as listingRow, user } from './listings-fixtures';
import { business, sellerWithListing } from './payments-fixtures';

// Signed-out listing and event pages kept by Cloudflare (Nov 6, 2026, owner's approval;
// docs/research/smooth-loading.md, 3.2): which requests get the shared copy, the header drawn for
// the page's own country, views counted after the page loads, and the purge on every change.

const APP = 'https://app.example.test';
const CLOUDFLARE = '172.71.10.20';
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';
const PAGE = '/v/%D8%A2%DB%8C%D9%81%D9%88%D9%86/w5zyhzxsqk';
const EVENT_PAGE = '/e/%D8%B4%D8%A8-%DB%8C%D9%84%D8%AF%D8%A7/w5zyhzxsqk';

describe('the shared copy of listing and event pages', () => {
  beforeAll(() => {
    vi.stubEnv('APP_URL', APP);
    vi.stubEnv('DATABASE_URL', 'postgres://x:y@localhost:5432/z');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', 'test-secret-test-secret-test-secret-0123');
    vi.stubEnv('PHONE_CODE_SECRET', 'test-secret-test-secret-test-secret-0123');
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'test_bot');
  });
  afterAll(() => vi.unstubAllEnvs());

  const get = async (path: string, opts: { country?: string; cookie?: string; method?: string; headers?: Record<string, string> } = {}) => {
    const { proxy } = await import('../src/proxy');
    const h = new Headers({ 'x-forwarded-for': CLOUDFLARE, 'cf-ipcountry': opts.country ?? 'DE', ...opts.headers });
    if (opts.cookie) h.set('cookie', opts.cookie);
    return proxy(new NextRequest(`${APP}${path}`, { method: opts.method ?? 'GET', headers: h })).headers;
  };

  it('knows the pages by their address, not their sub-pages', () => {
    expect(listingPageToken(PAGE)).toEqual({ kind: 'listing', token: 'w5zyhzxsqk' });
    expect(listingPageToken(EVENT_PAGE)).toEqual({ kind: 'event', token: 'w5zyhzxsqk' });
    for (const p of [`${EVENT_PAGE}/calendar`, '/v/x', '/v/x/short', '/v/x/w5zyhzxsqU', '/u/w5zyhzxsqk', '/germany/v/w5zyhzxsqk']) expect(listingPageToken(p), p).toBeNull();
  });

  it('is kept for signed-out visitors like a browse page, drawn without their remembered country', async () => {
    const { BROWSE_CDN_CACHE_CONTROL } = await import('../src/proxy');
    for (const path of [PAGE, EVENT_PAGE]) {
      for (const opts of [{}, { cookie: 'country=austria' }, { method: 'HEAD' }, { country: 'NL' }]) {
        const h = await get(path, opts);
        expect(h.get('cache-control'), `${path} ${JSON.stringify(opts)}`).toBe('public, max-age=0, s-maxage=60');
        expect(h.get('cloudflare-cdn-cache-control')).toBe(BROWSE_CDN_CACHE_CONTROL);
        // The page's token goes to the layout; the country cookie doesn't
        expect(h.get('x-middleware-request-x-shared-page')).toBe('w5zyhzxsqk');
        expect(h.get('x-middleware-request-cookie') ?? '').not.toContain('country=');
      }
    }
  });

  it('stays private for anything personal, and nobody can mark a request shared', async () => {
    const cases: Array<[string, Parameters<typeof get>[1]]> = [
      [PAGE, { cookie: '__Secure-better-auth.session_token=abc' }],
      [PAGE, { cookie: 'better-auth.session_token=abc; country=germany' }],
      [PAGE, { cookie: 'theme=dark' }],
      [PAGE, { cookie: 'view=list' }],
      [PAGE, { country: 'IR' }],
      [PAGE, { method: 'POST' }],
      [`${PAGE}?published=1`, {}],
      [`${EVENT_PAGE}?followed=1`, {}],
      [`${PAGE}?utm_source=telegram`, {}],
      [EVENT_PAGE, { cookie: '__Secure-better-auth.session_token=abc', headers: { 'x-shared-page': 'w5zyhzxsqk' } }],
    ];
    for (const [path, opts] of cases) {
      const h = await get(path, opts);
      expect(h.get('cache-control'), `${path} ${JSON.stringify(opts)}`).toBe('private, no-store');
      expect(h.get('cloudflare-cdn-cache-control')).toBeNull();
      expect(h.get('x-middleware-request-x-shared-page')).toBeNull();
    }
    // The country cookie stays for a signed-in visitor's page
    expect((await get(PAGE, { cookie: 'better-auth.session_token=abc; country=germany' })).get('x-middleware-request-cookie')).toContain('country=germany');
    // The calendar file keeps Next.js's own header
    expect((await get(`${EVENT_PAGE}/calendar`)).get('cloudflare-cdn-cache-control')).toBeNull();
  });

  it('the header in the browser accepts the shared copy instead of asking the server again', () => {
    const d: HeaderCookieData = { cookie: null, footer: 'germany', viewAs: false, adminRoot: null, open: ['germany', 'austria'], closed: [], countrySlug: 'germany', shared: 'w5zyhzxsqk' };
    // On the page itself: the same copy would come back, whatever the visitor remembered
    for (const cookie of [null, 'germany', 'austria']) expect(needsServerHeader(d, serverCountry(PAGE, d, cookie)), String(cookie)).toBe(false);
    // Elsewhere as before: a remembered other country asks once, nothing remembered keeps the header
    expect(needsServerHeader(d, serverCountry('/help', d, 'austria'))).toBe(true);
    expect(needsServerHeader(d, serverCountry('/help', d, null))).toBe(false);
    expect(needsServerHeader(d, serverCountry('/v/x/abcdefghjk', d, 'austria'))).toBe(true);
  });
});

describe('views counted after the page has loaded', () => {
  // Leave no counted views behind for the other test files
  afterAll(() => flushViews(redis, workerDb));
  const view = (path: string, opts: { ip?: string; ua?: string | null; viewer?: string | null } = {}) =>
    countPageView(redis, appDb, { path, ip: opts.ip ?? `198.51.100.${Math.floor(Math.random() * 250)}`, userAgent: opts.ua === undefined ? BROWSER : opts.ua, viewer: async () => opts.viewer ?? null });

  it('counts a visitor once per half hour on an active listing, never the seller, bots or other pages', async () => {
    await flushViews(redis, workerDb);
    const { seller, listing: l } = await sellerWithListing();
    const path = pagePath('listing', l.title, l.publicToken);
    expect(await view(path, { ip: '203.0.113.50' })).toBe(true);
    expect(await view(path, { ip: '203.0.113.50' })).toBe(false);
    // The same listing under an old or mangled title is the same page
    expect(await view(`/v/x/${l.publicToken}`, { ip: '203.0.113.51' })).toBe(true);
    expect(await view(path, { viewer: seller.id })).toBe(false);
    expect(await view(path, { ua: 'Googlebot/2.1' })).toBe(false);
    expect(await view(path, { ua: null })).toBe(false);
    // Not on its event address, its calendar file or another page
    expect(await view(`/e/x/${l.publicToken}`)).toBe(false);
    expect(await view(`${path}/calendar`)).toBe(false);
    expect(await view('/germany/berlin')).toBe(false);
    expect(await view('/v/x/zzzzzzzzzz')).toBe(false);
    await flushViews(redis, workerDb);
    expect((await listingRow(l.id)).viewCount).toBe(2);
  });

  it('not on a page nobody sees: paused, draft, deleted, or a test account’s for others', async () => {
    for (const status of ['paused', 'sold', 'draft', 'deleted', 'pending_review'] as const) {
      const { listing: l } = await sellerWithListing({ status, ...(status === 'deleted' ? { deletedAt: new Date() } : {}) });
      expect(await view(pagePath('listing', l.title, l.publicToken)), status).toBe(false);
    }
    const { seller, listing: l } = await sellerWithListing();
    await db.update(schema.users).set({ testAccount: 'country' }).where(eq(schema.users.id, seller.id));
    expect(await view(pagePath('listing', l.title, l.publicToken))).toBe(false);
    const tester = await user();
    await db.update(schema.users).set({ testAccount: 'personal' }).where(eq(schema.users.id, tester.id));
    expect(await view(pagePath('listing', l.title, l.publicToken), { viewer: tester.id })).toBe(true);
  });

  it('counts an event on its own page only', async () => {
    const { listing: ev } = await sellerWithListing();
    await db.insert(schema.eventDetails).values({ listingId: ev.id, timeZone: 'Europe/Berlin' });
    expect(await view(pagePath('listing', ev.title, ev.publicToken))).toBe(false);
    expect(await view(pagePath('event', ev.title, ev.publicToken))).toBe(true);
  });
});

describe('purging the page on every change', () => {
  it('names the page under its current and earlier titles, as browsers ask for them', async () => {
    const { listing: l } = await sellerWithListing({ title: 'آیفون ۱۳ پرو' });
    await db.insert(schema.listingEvents).values({ listingId: l.id, eventType: 'edited', actorType: 'user', fromStatus: 'active', toStatus: 'active', revision: 2, data: { title: ['آیفون ۱۲', 'آیفون ۱۳ پرو'], price: [1, 2] } });
    await db.insert(schema.listingEvents).values({ listingId: l.id, eventType: 'edited', actorType: 'user', fromStatus: 'active', toStatus: 'active', revision: 3, data: { description: ['a', 'b'] } });
    const urls = await listingPageUrls(workerDb, l.id, APP);
    const slug = encodeURIComponent(titleSlug('آیفون ۱۳ پرو'));
    expect(urls).toContain(`${APP}/v/${slug}/${l.publicToken}`);
    expect(urls).toContain(`${APP}/e/${slug}/${l.publicToken}`);
    expect(urls).toContain(`${APP}/v/${encodeURIComponent(titleSlug('آیفون ۱۲'))}/${l.publicToken}`);
    expect(urls).toHaveLength(4);
    // Upper-case escapes, as browsers send them and Cloudflare keys them
    expect(urls[0]).toMatch(/%[0-9A-F]{2}/);
    expect(urls[0]).toBe(urls[0]!.replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase()));
    // A deleted listing's copies go too
    await db.update(schema.listings).set({ status: 'deleted', deletedAt: new Date() }).where(eq(schema.listings.id, l.id));
    expect(await listingPageUrls(workerDb, l.id, APP)).toHaveLength(4);
    expect(await listingPageUrls(workerDb, randomUUID(), APP)).toEqual([]);
  });

  it('names every public page of a business or a private seller', async () => {
    const { org, ownerId } = await business();
    const { listing: a } = await sellerWithListing({ organizationId: org.id });
    await db.update(schema.listings).set({ userId: ownerId }).where(eq(schema.listings.id, a.id));
    const { listing: b } = await sellerWithListing({ organizationId: org.id, status: 'sold' });
    const { listing: draft } = await sellerWithListing({ organizationId: org.id, status: 'draft' });
    await db.insert(schema.eventDetails).values({ listingId: b.id, timeZone: 'Europe/Berlin' });
    const urls = await sellerPageUrls(workerDb, { organizationId: org.id }, APP);
    expect(urls.sort()).toEqual([`${APP}${pagePath('listing', a.title, a.publicToken)}`, `${APP}${pagePath('event', b.title, b.publicToken)}`].sort());
    expect(urls.join()).not.toContain(draft.publicToken);
    expect(await sellerPageUrls(workerDb, { userId: ownerId }, APP)).toEqual([`${APP}${pagePath('listing', a.title, a.publicToken)}`]);
  });

  it('every listing and event change reaches the purge, and a new name or badge too', async () => {
    for (const t of Object.values(LISTING_OUTBOX)) if (t !== LISTING_OUTBOX.created) expect(PAGE_PURGE_EVENTS, t).toContain(t);
    for (const t of [EVENT_OUTBOX.published, EVENT_OUTBOX.changed, EVENT_OUTBOX.cancelled]) expect(PAGE_PURGE_EVENTS).toContain(t);
    const me = await user();
    expect((await setDisplayName(appDb, redis, me.id, 'نام تازه')).ok).toBe(true);
    const rows = await db.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.aggregateId, me.id));
    expect(rows.find((r) => r.eventType === PAGES_CHANGED)?.payload).toEqual({ owner: 'user' });
  });

  describe('the worker', () => {
    const prefix = `test-purge-${randomUUID().slice(0, 8)}`;
    const calls: string[][] = [];
    let fail = 0;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      if (fail > 0) {
        fail--;
        return new Response(JSON.stringify({ success: false, errors: [{ code: 1015, message: 'rate limited' }] }), { status: 429 });
      }
      calls.push(JSON.parse(String(init.body)).files);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const bull = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    let jobs: Awaited<ReturnType<typeof startModerationJobs>>;
    let events: QueueEvents;

    beforeAll(async () => {
      const { Queue } = await import('bullmq');
      const q = (name: string) => new Queue(name, { connection: redis, prefix });
      jobs = await startModerationJobs(workerDb, bull, {
        appUrl: APP,
        send: { email: q('email-send'), telegram: q('telegram-send') },
        alert: null,
        purge: { zoneId: 'f'.repeat(32), token: 'token' },
        purgeAgainMs: 300,
        seo: null,
        fetchFn: fakeFetch,
        prefix,
        software: null,
      });
      events = new QueueEvents('moderation', { connection: bull.duplicate(), prefix });
      await events.waitUntilReady();
    });
    afterAll(async () => {
      await jobs.close();
      await events.close();
      await bull.quit();
    });

    const data = (eventType: string, aggregateId: string, payload: Record<string, unknown> = {}): OutboxJobData => ({ outboxId: randomUUID(), eventType, aggregateId, payload });

    it('purges the page at once and again a moment later, retrying when Cloudflare refuses', async () => {
      const { listing: l } = await sellerWithListing();
      const handlers = jobs.handlers[LISTING_OUTBOX.sold]!;
      expect(handlers.map((h) => h.name)).toEqual(['page_purge']);
      expect(jobs.handlers[LISTING_OUTBOX.rejected]!.map((h) => h.name)).toEqual(['listing_changed', 'page_purge']);
      expect(jobs.handlers[PAGES_CHANGED]!.map((h) => h.name)).toEqual(['seller_pages_purge']);
      expect(jobs.handlers[LISTING_OUTBOX.created]).toBeUndefined();
      calls.length = 0;
      fail = 1;
      const job = await jobs.queue.add('page_purge', data(LISTING_OUTBOX.sold, l.id), { jobId: `${randomUUID()}_page_purge`, backoff: { type: 'fixed', delay: 100 } });
      expect(await job.waitUntilFinished(events, 20_000)).toBe('purged 2');
      expect(calls[0]).toEqual([`${APP}${pagePath('listing', l.title, l.publicToken)}`, `${APP}${pagePath('event', l.title, l.publicToken)}`]);
      const again = await jobs.queue.getJob(`${job.id}_again`);
      expect(again).toBeTruthy();
      expect(await again!.waitUntilFinished(events, 20_000)).toBe('purged 2');
      expect(calls).toHaveLength(2);
      // The second purge doesn't queue a third
      expect(await jobs.queue.getJob(`${job.id}_again_again`)).toBeUndefined();
    });

    it('purges a business’s pages in calls of 30', async () => {
      const { org } = await business();
      for (let i = 0; i < 31; i++) await sellerWithListing({ organizationId: org.id });
      await queuePagesPurge(db, { organizationId: org.id });
      calls.length = 0;
      const job = await jobs.queue.add('seller_pages_purge', data(PAGES_CHANGED, org.id, { owner: 'organization' }));
      expect(await job.waitUntilFinished(events, 20_000)).toBe('purged 31');
      expect(calls.map((c) => c.length)).toEqual([30, 1]);
    });
  });
});
