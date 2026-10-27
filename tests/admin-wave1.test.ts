import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { change, hoursToDeadline, systemProblems, type Live } from '../src/modules/admin/attention';
import { reportsOn, sameTextCount } from '../src/modules/admin/items';
import { bySeverity, nextPath, type Op } from '../src/modules/admin/ops';
import { overview } from '../src/modules/admin/overview';
import { riskyParts } from '../src/modules/admin/risky';
import type { StatusSnapshot } from '../src/modules/admin/system';
import { appDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { user } from './listings-fixtures';

// Wave 1, part 9 (mockups admin-item, admin-overview, admin-system): the system's problems with
// what to do, the 24-hour clock, the decision options from mild to severe with nothing chosen,
// «… و بعدی» only to an item or the queue, scam phrases marked, the change against the period
// before, the reporter's history and the same text in a seller's other listings.

const tx = db as unknown as Tx;
const DAY = 86_400_000;
const now = new Date('2026-11-02T12:00:00Z');
const healthy: Live = { database: 2, valkey: 1, meili: 4 };
const queues = (failed = 0): StatusSnapshot['queues'] => ({ media: { waiting: 0, active: 0, delayed: 0, failed: 0 }, payments: { waiting: 0, active: 0, delayed: 3, failed } });
const snapshot = (over: Partial<StatusSnapshot> = {}): StatusSnapshot => ({
  at: new Date(now.getTime() - 60_000).toISOString(),
  queues: queues(),
  outbox: { backlog: 0, oldest: null },
  webhooks: 0,
  activeListings: 4,
  meili: { ok: true, documents: 4 },
  sitemapAt: null,
  ...over,
});

describe('the system’s problems', () => {
  it('none when everything answers and the worker reported a minute ago', () => {
    expect(systemProblems(healthy, { snapshot: snapshot(), backupAt: new Date(now.getTime() - 19 * 3_600_000).toISOString() }, 300, now)).toEqual([]);
    // A backup that never reported (development) isn't counted as late
    expect(systemProblems(healthy, { snapshot: snapshot(), backupAt: null }, 300, now)).toEqual([]);
  });

  it('names each problem, with the numbers for what to do', () => {
    const old = new Date(now.getTime() - 20 * 60_000).toISOString();
    const problems = systemProblems(
      { database: 3, valkey: null, meili: null },
      { snapshot: snapshot({ webhooks: 4, queues: queues(2), outbox: { backlog: 7, oldest: old } }), backupAt: new Date(now.getTime() - 2 * DAY).toISOString() },
      300,
      now,
    );
    expect(problems.map((p) => p.key)).toEqual(['valkey', 'meili', 'webhooks', 'failed', 'outbox', 'backup']);
    expect(problems.find((p) => p.key === 'failed')).toMatchObject({ count: 2, queues: ['payments'] });
    expect(problems.find((p) => p.key === 'webhooks')).toMatchObject({ count: 4 });
    // Meilisearch not configured is not a problem
    expect(systemProblems({ ...healthy, meili: undefined }, { snapshot: snapshot(), backupAt: null }, 300, now)).toEqual([]);
  });

  it('a missing or old snapshot means the worker is down', () => {
    expect(systemProblems(healthy, { snapshot: null, backupAt: null }, 300, now)).toEqual([{ key: 'worker', since: null }]);
    const at = new Date(now.getTime() - 6 * 60_000).toISOString();
    expect(systemProblems(healthy, { snapshot: snapshot({ at }), backupAt: null }, 300, now)).toEqual([{ key: 'worker', since: at }]);
  });
});

describe('one item at a time', () => {
  it('counts down the 24 hours and the change against the period before', () => {
    expect(hoursToDeadline(new Date(now.getTime() - 5 * 3_600_000), now)).toBe(19);
    expect(hoursToDeadline(new Date(now.getTime() - 30 * 3_600_000), now)).toBe(-6);
    expect(change(112, 100)).toBe(12);
    expect(change(9, 10)).toBe(-10);
    expect(change(5, 0)).toBeNull();
  });

  it('lists the options from mild to severe, keeping the order of equals', () => {
    const ops: Op[] = ['take_down', 'no_violation', 'approve', 'warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned', 'restore'];
    expect(bySeverity(ops.map((op) => ({ op }))).map((o) => o.op)).toEqual(['no_violation', 'approve', 'restore', 'warning', 'take_down', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned']);
  });

  it('goes on only to an item page or the queue', () => {
    const id = '01a17f46-c852-7000-8000-000000000001';
    expect(nextPath(`/items/listing/${id}`)).toBe(`/items/listing/${id}`);
    expect(nextPath(`/items/message/${id}`)).toBe(`/items/message/${id}`);
    for (const bad of ['//evil.example', 'https://evil.example', `/items/listing/${id}/../../x`, '/users', null, 7]) expect(nextPath(bad)).toBe('/queue');
  });

  it('marks scam phrases however they are typed, and keeps the text whole', () => {
    const text = 'اتاق مبله. برای رزرو لطفا بيعانه را اول واریز کنید تا کلید را پست کنم. Western Union هم می‌شود.';
    const parts = riskyParts(text);
    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.risky).map((p) => p.text)).toEqual(['بيعانه', 'اول واریز', 'کلید را پست', 'Western Union']);
    expect(riskyParts('کلید را‌ می‌فرستم').some((p) => p.risky)).toBe(true);
    expect(riskyParts('یک دوچرخهٔ سالم').every((p) => !p.risky)).toBe(true);
  });
});

describe('the numbers', () => {
  it('totals the chosen days and the same number of days before them', async () => {
    const before = await overview(appDb, { days: 7, timeZone: 'Europe/Berlin' });
    const s = await user();
    await makeListing(tx, s.id, { publishedAt: new Date(Date.now() - 2 * DAY) });
    await makeListing(tx, s.id, { publishedAt: new Date(Date.now() - 10 * DAY) });
    await makeListing(tx, s.id, { publishedAt: new Date(Date.now() - 20 * DAY) });
    const after = await overview(appDb, { days: 7, timeZone: 'Europe/Berlin' });
    expect(after.totals.listings.period - before.totals.listings.period).toBe(1);
    expect(after.totals.listings.previous - before.totals.listings.previous).toBe(1);
    expect(after.series.listings).toHaveLength(7);
  });

  it('the reporter’s baseless reports and the same text in the seller’s other listings', async () => {
    const seller = await user();
    const reporter = await user();
    const description = 'اتاق کاملاً مبله، خودم فعلاً در ترکیه هستم. برای رزرو لطفاً بیعانه را اول واریز کنید.';
    const l = await makeListing(tx, seller.id, { description });
    await makeListing(tx, seller.id, { description });
    await makeListing(tx, seller.id, { description: `${description} دوباره` });
    expect(await sameTextCount(appDb, l.id)).toBe(1);

    const other = await makeListing(tx, (await user()).id);
    await db.insert(schema.reports).values([
      { reporterUserId: reporter.id, listingId: other.id, reasonCode: 'spam', status: 'dismissed' },
      { reporterUserId: reporter.id, listingId: other.id, reasonCode: 'scam', status: 'dismissed' },
      { reporterUserId: reporter.id, listingId: l.id, reasonCode: 'scam' },
    ]);
    const [row] = await reportsOn(appDb, { listingId: l.id });
    expect(row).toMatchObject({ reason: 'scam', reporterDismissed: 2 });
  });
});
