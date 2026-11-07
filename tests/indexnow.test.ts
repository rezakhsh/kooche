import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { parseWebEnv } from '../src/lib/env';
import { LISTING_OUTBOX } from '../src/modules/listings/events';
import { PAGES_CHANGED, pagePath } from '../src/modules/listings/page-purge';
import {
  addPendingIndexNow,
  INDEXNOW_BATCH,
  INDEXNOW_ENDPOINT,
  INDEXNOW_PENDING_KEY,
  indexNowBody,
  indexNowConfig,
  IndexNowBusy,
  IndexNowRefused,
  listingIndexUrls,
  ownerIndexUrls,
  sendPendingIndexNow,
  submitIndexNow,
} from '../src/modules/search/indexnow';
import { startModerationJobs, type ModerationJobOptions } from '../src/worker/moderation';
import type { OutboxJobData } from '../src/worker/outbox';
import { redis, workerDb } from './accounts';
import { db } from './db';
import { business, sellerWithListing } from './payments-fixtures';

// IndexNow (SEO plan step 7, Nov 7, 2026): off unless SEARCH_INDEXING=on and INDEXNOW_KEY are set;
// the call's body; batches of 10,000; the pages it names; the worker sends changed pages after a
// short gathering, and nothing on IndexNow's side fails the Cloudflare purge.

const APP = 'https://app.example.test';
const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CFG = { key: KEY, appUrl: APP };

type Body = { host: string; key: string; keyLocation: string; urlList: string[] };
const calls: Body[] = [];
const purges: string[][] = [];
let answer: number | 'network' = 200;
const fakeFetch = (async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body));
  if (String(url).startsWith('https://api.cloudflare.com/')) {
    purges.push(body.files);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  if (url !== INDEXNOW_ENDPOINT) throw new Error(`unexpected call to ${url}`);
  if (answer === 'network') throw new TypeError('fetch failed');
  calls.push(body);
  return new Response(null, { status: answer });
}) as unknown as typeof fetch;

afterEach(() => {
  calls.length = 0;
  purges.length = 0;
  answer = 200;
});

async function until(check: () => boolean | Promise<boolean>, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('settings', () => {
  const env = { SEARCH_INDEXING: 'on' as const, INDEXNOW_KEY: KEY, APP_URL: APP };

  it('is off without the key or with SEARCH_INDEXING off (staging, production before go-live)', () => {
    expect(indexNowConfig({ ...env, INDEXNOW_KEY: undefined })).toBeNull();
    expect(indexNowConfig({ ...env, SEARCH_INDEXING: 'off' })).toBeNull();
    expect(indexNowConfig({ APP_URL: APP, INDEXNOW_KEY: KEY })).toBeNull();
    expect(indexNowConfig(env)).toEqual(CFG);
  });

  it('accepts 8–128 letters, digits and dashes; empty is unset', () => {
    const base = {
      APP_URL: APP,
      DATABASE_URL: 'postgres://a:b@localhost/c',
      REDIS_URL: 'redis://localhost',
      AUTH_SECRET: 'x'.repeat(32),
      TELEGRAM_BOT_USERNAME: 'peydoo_bot',
      PHONE_CODE_SECRET: 'y'.repeat(32),
    };
    for (const k of [KEY, 'abcd-1234', 'A'.repeat(128)]) expect(parseWebEnv({ ...base, INDEXNOW_KEY: k }).success, k).toBe(true);
    for (const k of ['short', 'A'.repeat(129), 'has space1', 'under_score', 'ümlaut123']) expect(parseWebEnv({ ...base, INDEXNOW_KEY: k }).success, k).toBe(false);
    const empty = parseWebEnv({ ...base, INDEXNOW_KEY: '' });
    expect(empty.success && empty.data.INDEXNOW_KEY).toBeUndefined();
  });

  describe('the key file', () => {
    const get = async (vars: Record<string, string>) => {
      vi.resetModules();
      for (const [k, v] of Object.entries({ APP_URL: APP, DATABASE_URL: 'postgres://x:y@localhost:5432/z', REDIS_URL: 'redis://localhost:6379', AUTH_SECRET: 'x'.repeat(32), PHONE_CODE_SECRET: 'y'.repeat(32), TELEGRAM_BOT_USERNAME: 'test_bot', SEARCH_INDEXING: 'off', INDEXNOW_KEY: '', ...vars })) vi.stubEnv(k, v);
      const { GET } = await import('../src/app/indexnow.txt/route');
      return GET();
    };
    afterAll(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('serves the key as plain text only while indexing is on', async () => {
      const on = await get({ SEARCH_INDEXING: 'on', INDEXNOW_KEY: KEY });
      expect(on.status).toBe(200);
      expect(on.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      expect(await on.text()).toBe(KEY);
      expect((await get({ SEARCH_INDEXING: 'off', INDEXNOW_KEY: KEY })).status).toBe(404);
      expect((await get({ SEARCH_INDEXING: 'on' })).status).toBe(404);
    });
  });
});

describe('the call', () => {
  it('names our host, the key and where to find it; only our own addresses, each once', () => {
    const page = `${APP}/v/x/w5zyhzxsqk`;
    expect(indexNowBody(CFG, [page, page, 'https://staging.example.test/v/x/w5zyhzxsqk', 'not a url', `${APP}/b/shop`])).toEqual({
      host: 'app.example.test',
      key: KEY,
      keyLocation: `${APP}/indexnow.txt`,
      urlList: [page, `${APP}/b/shop`],
    });
  });

  it('posts JSON to IndexNow; busy, refused and unreached are told apart, never with the key', async () => {
    const urls = [`${APP}/v/a/w5zyhzxsqk`, `${APP}/e/b/w5zyhzxsqm`];
    for (const status of [200, 202]) {
      answer = status;
      expect(await submitIndexNow(CFG, urls, fakeFetch)).toBe(2);
    }
    expect(calls[0]).toEqual({ host: 'app.example.test', key: KEY, keyLocation: `${APP}/indexnow.txt`, urlList: urls });
    for (const [a, kind] of [[429, IndexNowBusy], [503, IndexNowBusy], ['network', IndexNowBusy], [403, IndexNowRefused], [422, IndexNowRefused]] as const) {
      answer = a;
      const e = await submitIndexNow(CFG, urls, fakeFetch).catch((x: unknown) => x);
      expect(e, String(a)).toBeInstanceOf(kind);
      expect((e as Error).message).not.toContain(KEY);
    }
    // Nothing of ours: no call
    calls.length = 0;
    answer = 200;
    expect(await submitIndexNow(CFG, ['https://other.example.test/v/a/w5zyhzxsqk'], fakeFetch)).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('sends what was gathered in calls of 10,000, and keeps what IndexNow could not take yet', async () => {
    const key = `test-indexnow-${randomUUID()}`;
    const urls = Array.from({ length: INDEXNOW_BATCH + 1 }, (_, i) => `${APP}/v/p/${i}`);
    await addPendingIndexNow(redis, key, urls.slice(0, 5_000));
    await addPendingIndexNow(redis, key, urls.slice(5_000));
    await addPendingIndexNow(redis, key, urls.slice(0, 10));
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await sendPendingIndexNow(redis, key, CFG, fakeFetch)).toBe(INDEXNOW_BATCH + 1);
    expect(calls.map((c) => c.urlList.length)).toEqual([INDEXNOW_BATCH, 1]);
    expect(new Set(calls.flatMap((c) => c.urlList)).size).toBe(INDEXNOW_BATCH + 1);
    expect(await redis.scard(key)).toBe(0);
    expect(await sendPendingIndexNow(redis, key, CFG, fakeFetch)).toBe(0);

    // Busy: they wait for the retry; refused: dropped
    await addPendingIndexNow(redis, key, urls.slice(0, 3));
    answer = 429;
    await expect(sendPendingIndexNow(redis, key, CFG, fakeFetch)).rejects.toBeInstanceOf(IndexNowBusy);
    expect(await redis.scard(key)).toBe(3);
    answer = 'network';
    await expect(sendPendingIndexNow(redis, key, CFG, fakeFetch)).rejects.toBeInstanceOf(IndexNowBusy);
    expect(await redis.scard(key)).toBe(3);
    answer = 403;
    await expect(sendPendingIndexNow(redis, key, CFG, fakeFetch)).rejects.toBeInstanceOf(IndexNowRefused);
    expect(await redis.scard(key)).toBe(0);
  });
});

describe('the pages it names', () => {
  it('a listing or event by its current address, also when gone; never a draft or a test account’s', async () => {
    const { listing: l } = await sellerWithListing({ title: 'آیفون ۱۳ پرو' });
    await db.insert(schema.listingEvents).values({ listingId: l.id, eventType: 'edited', actorType: 'user', fromStatus: 'active', toStatus: 'active', revision: 2, data: { title: ['آیفون ۱۲', 'آیفون ۱۳ پرو'] } });
    expect(await listingIndexUrls(workerDb, l.id, APP)).toEqual([`${APP}${pagePath('listing', 'آیفون ۱۳ پرو', l.publicToken)}`]);
    await db.update(schema.listings).set({ status: 'deleted', deletedAt: new Date() }).where(eq(schema.listings.id, l.id));
    expect(await listingIndexUrls(workerDb, l.id, APP)).toHaveLength(1);

    const { listing: ev } = await sellerWithListing();
    await db.insert(schema.eventDetails).values({ listingId: ev.id, timeZone: 'Europe/Berlin' });
    expect(await listingIndexUrls(workerDb, ev.id, APP)).toEqual([`${APP}${pagePath('event', ev.title, ev.publicToken)}`]);

    const { listing: draft } = await sellerWithListing({ status: 'draft', publishedAt: null, rankedAt: null, expiresAt: null });
    expect(await listingIndexUrls(workerDb, draft.id, APP)).toEqual([]);
    const { seller, listing: test } = await sellerWithListing();
    await db.update(schema.users).set({ testAccount: 'country' }).where(eq(schema.users.id, seller.id));
    expect(await listingIndexUrls(workerDb, test.id, APP)).toEqual([]);
    expect(await listingIndexUrls(workerDb, randomUUID(), APP)).toEqual([]);
  });

  it('a business: its page and its active pages; a test account’s business not at all', async () => {
    const { org, ownerId } = await business();
    const { listing: a } = await sellerWithListing({ organizationId: org.id });
    await sellerWithListing({ organizationId: org.id, status: 'sold' });
    await sellerWithListing({ organizationId: org.id, status: 'draft' });
    expect(await ownerIndexUrls(workerDb, { organizationId: org.id }, APP)).toEqual([`${APP}/b/${org.slug}`, `${APP}${pagePath('listing', a.title, a.publicToken)}`]);
    await db.update(schema.users).set({ testAccount: 'country' }).where(eq(schema.users.id, ownerId));
    expect(await ownerIndexUrls(workerDb, { organizationId: org.id }, APP)).toEqual([`${APP}${pagePath('listing', a.title, a.publicToken)}`]);
    // A private seller: their active pages
    expect(await ownerIndexUrls(workerDb, { userId: a.userId }, APP)).toEqual([`${APP}${pagePath('listing', a.title, a.publicToken)}`]);
  });
});

describe('the worker', () => {
  const data = (eventType: string, aggregateId: string, payload: Record<string, unknown> = {}): OutboxJobData => ({ outboxId: randomUUID(), eventType, aggregateId, payload });
  const bull = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
  afterAll(() => bull.quit());

  async function start(opts: Pick<ModerationJobOptions, 'purge'>) {
    const prefix = `test-indexnow-${randomUUID().slice(0, 8)}`;
    const q = (name: string) => new Queue(name, { connection: redis, prefix });
    const jobs = await startModerationJobs(workerDb, bull, {
      appUrl: APP,
      send: { email: q('email-send'), telegram: q('telegram-send') },
      alert: null,
      ...opts,
      purgeAgainMs: 200,
      indexNow: CFG,
      indexNowGatherMs: 300,
      seo: null,
      fetchFn: fakeFetch,
      prefix,
      software: null,
    });
    const events = new QueueEvents('moderation', { connection: bull.duplicate(), prefix });
    await events.waitUntilReady();
    const close = async () => {
      await jobs.close();
      await events.close();
    };
    return { jobs, events, pendingKey: `${prefix}${INDEXNOW_PENDING_KEY}`, close };
  }

  describe('with the purge', () => {
    let w: Awaited<ReturnType<typeof start>>;
    beforeAll(async () => {
      w = await start({ purge: { zoneId: 'f'.repeat(32), token: 'token' } });
    });
    afterAll(() => w.close());

    it('sends a changed page and a business’s pages after the gathering, once', async () => {
      const { listing: l } = await sellerWithListing();
      const page = `${APP}${pagePath('listing', l.title, l.publicToken)}`;
      const job = await w.jobs.queue.add('page_purge', data(LISTING_OUTBOX.sold, l.id));
      expect(await job.waitUntilFinished(w.events, 20_000)).toBe('purged 2');
      await until(() => calls.length > 0);
      expect(calls).toEqual([{ host: 'app.example.test', key: KEY, keyLocation: `${APP}/indexnow.txt`, urlList: [page] }]);
      // The purge's second round doesn't send it again
      const again = await w.jobs.queue.getJob(`${job.id}_again`);
      expect(await again!.waitUntilFinished(w.events, 20_000)).toBe('purged 2');
      await new Promise((r) => setTimeout(r, 700));
      expect(calls).toHaveLength(1);
      expect(await redis.scard(w.pendingKey)).toBe(0);

      calls.length = 0;
      const { org } = await business();
      const { listing: a } = await sellerWithListing({ organizationId: org.id });
      const seller = await w.jobs.queue.add('seller_pages_purge', data(PAGES_CHANGED, org.id, { owner: 'organization' }));
      expect(await seller.waitUntilFinished(w.events, 20_000)).toBe('purged 1');
      await until(() => calls.length > 0);
      expect(calls[0]!.urlList.sort()).toEqual([`${APP}/b/${org.slug}`, `${APP}${pagePath('listing', a.title, a.publicToken)}`].sort());
    });

    it('IndexNow failing never fails the purge; the page waits for the retry', async () => {
      answer = 503;
      const { listing: l } = await sellerWithListing();
      const page = `${APP}${pagePath('listing', l.title, l.publicToken)}`;
      const job = await w.jobs.queue.add('page_purge', data(LISTING_OUTBOX.updated, l.id));
      expect(await job.waitUntilFinished(w.events, 20_000)).toBe('purged 2');
      expect(purges[0]).toContain(page);
      await until(() => calls.length > 0);
      expect(await redis.sismember(w.pendingKey, page)).toBe(1);
    });
  });

  describe('without the purge', () => {
    let w: Awaited<ReturnType<typeof start>>;
    beforeAll(async () => {
      w = await start({ purge: null });
    });
    afterAll(() => w.close());

    it('still sends; a failure while noting the page doesn’t fail the job', async () => {
      const { listing: l } = await sellerWithListing();
      const ok = await w.jobs.queue.add('page_purge', data(LISTING_OUTBOX.published, l.id));
      expect(await ok.waitUntilFinished(w.events, 20_000)).toBe('no purge');
      await until(() => calls.length > 0);
      expect(calls[0]!.urlList).toEqual([`${APP}${pagePath('listing', l.title, l.publicToken)}`]);
      // Not a listing id: the lookup fails inside, the job goes on
      const bad = await w.jobs.queue.add('page_purge', data(LISTING_OUTBOX.updated, 'not-a-uuid'), { attempts: 1 });
      expect(await bad.waitUntilFinished(w.events, 20_000)).toBe('no purge');
    });
  });
});
