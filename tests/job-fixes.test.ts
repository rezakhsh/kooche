import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { purgeDeletedListings } from '../src/modules/listings/purge';
import { LISTING_OUTBOX } from '../src/modules/listings/events';
import type { ObjectStorage } from '../src/modules/media/storage';
import { sendExpiryReminders } from '../src/modules/notifications/expiry-reminder';
import { localDate, scheduledTime } from '../src/modules/notifications/local-hour';
import type { Mail } from '../src/modules/notifications/mailer';
import { localParts } from '../src/modules/events/time';
import { claimAlert, dueForDaily, unclaimAlert } from '../src/modules/search/alerts';
import { quietDelay } from '../src/modules/users/notification-prefs';
import { startSearchJobs } from '../src/worker/search';
import { redis, workerDb } from './accounts';
import { db, makeListing, publicToken, type Tx } from './db';
import { user } from './listings-fixtures';

// Background jobs, fixed after the code check of Oct 30, 2026 (package 4). The weekly message and
// digest are in tests/events-wave1.test.ts.

const tx = db as unknown as Tx;
const DAY = 86_400_000;

describe('the clock-change night', () => {
  it('quiet hours end at 8:00 on the real clock, also on the 25-hour night', () => {
    // Saturday Oct 24, 2026, 22:30 in Berlin (summer time); the clocks go back that night
    const now = new Date('2026-10-24T20:30:00Z');
    const wake = new Date(now.getTime() + quietDelay(now, 'Europe/Berlin'));
    expect(localParts(wake, 'Europe/Berlin')).toMatchObject({ d: 25, h: 8, mi: 0 });
    expect(quietDelay(wake, 'Europe/Berlin')).toBe(0);
    // Spring: the 23-hour night
    const spring = new Date('2027-03-27T21:30:00Z');
    expect(localParts(new Date(spring.getTime() + quietDelay(spring, 'Europe/Berlin')), 'Europe/Berlin')).toMatchObject({ d: 28, h: 8, mi: 0 });
  });
});

describe('hourly jobs that run late', () => {
  it('serve the hour they were scheduled for', () => {
    const tick = Date.parse('2026-11-02T08:00:00Z');
    const late = new Date(tick + 70 * 60_000);
    expect(scheduledTime({ timestamp: tick - 3_600_000, opts: { delay: 3_600_000 }, repeatJobKey: 'x' }, late).getTime()).toBe(tick);
    // Not from a scheduler, or hours old: now
    expect(scheduledTime({ timestamp: tick, opts: {} }, late)).toBe(late);
    expect(scheduledTime({ timestamp: tick, opts: {}, repeatJobKey: 'x' }, new Date(tick + 5 * 3_600_000)).getTime()).toBe(tick + 5 * 3_600_000);
    expect(localDate(new Date('2026-11-01T23:30:00Z'), 'Europe/Berlin')).toBe('2026-11-02');
  });

  it('the expiry reminder leaves no listing out on the 25-hour day', async () => {
    const u = await user();
    const l = await makeListing(tx, u.id);
    // Saturday 9:00 CEST and Sunday 9:00 CET are 25 hours apart; this listing expires in the gap
    const sat = new Date('2026-10-24T07:00:00Z');
    const sun = new Date('2026-10-25T08:00:00Z');
    await db.update(schema.listings).set({ expiresAt: new Date('2026-10-27T07:30:00Z') }).where(eq(schema.listings.id, l.id));
    const sent: Mail[] = [];
    const mail = async (m: Mail) => void sent.push(m);
    await sendExpiryReminders(workerDb, redis, mail, 'https://app.example.test', sat, { localHour: 9 });
    await sendExpiryReminders(workerDb, redis, mail, 'https://app.example.test', sun, { localHour: 9 });
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(1);
  });
});

describe('saved-search notices', () => {
  async function searches(n: number, prefs: Record<string, unknown>) {
    const u = await user({ createdAt: new Date(Date.now() - 30 * DAY) });
    await db.update(schema.users).set({ notificationPrefs: { quiet: false, ...prefs } }).where(eq(schema.users.id, u.id));
    const seller = await user();
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const filters = { q: `${publicToken()}-${i}` };
      const [s] = await db
        .insert(schema.savedSearches)
        .values({ userId: u.id, filters, filtersHash: createHash('sha256').update(JSON.stringify(filters)).digest(), countryCode: 'DE', notifyFrequency: 'daily', notifyChannels: ['email'] })
        .returning();
      const l = await makeListing(tx, seller.id);
      await db.insert(schema.savedSearchHits).values({ savedSearchId: s!.id, listingId: l.id });
      ids.push(s!.id);
    }
    return { u, ids };
  }

  it('a bundling person’s daily message counts once against the daily limit: all their searches get through', async () => {
    await redis.flushdb();
    const { ids } = await searches(12, { bundle: true });
    const now = new Date();
    const results = [];
    for (const id of ids) results.push(await claimAlert(workerDb, redis, id, now, 'daily'));
    expect(results.filter((r) => 'send' in r)).toHaveLength(12);
  });

  it('over the limit, the searches that waited longest go first the next day', async () => {
    await redis.flushdb();
    const { ids } = await searches(12, {});
    const now = new Date();
    for (const id of ids) await claimAlert(workerDb, redis, id, now, 'daily');
    const pending = await db.select({ id: schema.savedSearchHits.savedSearchId }).from(schema.savedSearchHits).where(isNull(schema.savedSearchHits.notifiedAt));
    const left = ids.filter((id) => pending.some((p) => p.id === id));
    expect(left).toHaveLength(2);
    const order = (await dueForDaily(workerDb, new Date(now.getTime() + DAY))).filter((id) => ids.includes(id));
    expect(order.slice(0, 2).sort()).toEqual([...left].sort());
  });

  it('a notice that couldn’t be queued waits again', async () => {
    await redis.flushdb();
    const { ids } = await searches(1, {});
    const at = new Date();
    const claim = await claimAlert(workerDb, redis, ids[0]!, at, 'daily');
    if (!('send' in claim)) throw new Error('not claimed');
    const pending = () => db.select().from(schema.savedSearchHits).where(and(eq(schema.savedSearchHits.savedSearchId, ids[0]!), isNull(schema.savedSearchHits.notifiedAt)));
    expect(await pending()).toHaveLength(0);
    await unclaimAlert(workerDb, claim.job, at);
    expect(await pending()).toHaveLength(1);
  });
});

describe('search down for a whole job', () => {
  it('saved searches still hear about the new listing on the last attempt', async () => {
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const handed: string[] = [];
    const broken = new Proxy({}, { get: () => async () => { throw new Error('meilisearch is down'); } });
    const prefix = `test-${randomUUID()}`;
    const jobs = await startSearchJobs(workerDb, connection, { meili: broken as never, index: 'nowhere', prefix, schedules: false, afterPublish: async (id) => void handed.push(id) });
    const events = new QueueEvents('search-sync', { connection: connection.duplicate(), prefix });
    try {
      const id = randomUUID();
      const job = await jobs.queue.add('search_sync', { outboxId: randomUUID(), eventType: LISTING_OUTBOX.published, aggregateId: id, payload: {} }, { attempts: 1 });
      await expect(job.waitUntilFinished(events, 30_000)).rejects.toThrow('meilisearch is down');
      expect(handed).toEqual([id]);
    } finally {
      await events.close();
      await jobs.close();
      await connection.quit();
    }
  });
});

describe('deleted listings after 12 months', () => {
  it('are purged with their photos, unless something still points at them', async () => {
    const u = await user();
    const deletedAgo = (months: number) => new Date(Date.now() - months * 31 * DAY);
    const old = await makeListing(tx, u.id, { status: 'deleted', deletedAt: deletedAgo(13) });
    const recent = await makeListing(tx, u.id, { status: 'deleted', deletedAt: deletedAgo(11) });
    const reported = await makeListing(tx, u.id, { status: 'deleted', deletedAt: deletedAgo(13) });
    await db.insert(schema.reports).values({ reporterUserId: (await user()).id, listingId: reported.id, reasonCode: 'spam' });
    const key = `listings/test/${randomUUID()}.webp`;
    await db.insert(schema.listingImages).values({ listingId: old.id, uploaderUserId: u.id, position: 0, storageKey: key, status: 'pending_upload', mimeType: 'image/webp' } as never);
    const deleted: string[] = [];
    const storage = { delete: async (k: string) => void deleted.push(k) } as unknown as ObjectStorage;
    const r = await purgeDeletedListings(workerDb, storage);
    expect(r.purged).toBeGreaterThanOrEqual(1);
    const left = async (id: string) => (await db.select({ id: schema.listings.id }).from(schema.listings).where(eq(schema.listings.id, id))).length;
    expect(await left(old.id)).toBe(0);
    expect(await left(recent.id)).toBe(1);
    expect(await left(reported.id)).toBe(1);
    expect(deleted).toContain(key);
  });
});
