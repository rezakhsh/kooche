import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { cachedCatalog, type Catalog } from '../src/modules/listings/catalog';
import { EVENT_OUTBOX } from '../src/modules/events/events';
import { cancelEvent, createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema } from '../src/modules/events/input';
import { LISTING_OUTBOX } from '../src/modules/listings/events';
import { changeListingStatus, createDraft, expireDueListings, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { runListingChecks } from '../src/modules/moderation/checks';
import { DOC_VERSION, documentsFor, indexCode, indexSettings, LISTINGS_INDEX, type ListingDocument } from '../src/modules/search/documents';
import { WEB_KEY, WORKER_KEY } from '../src/modules/search/keys';
import { phraseCode, rebuildPhrases, SUGGESTIONS_INDEX } from '../src/modules/search/phrases';
import { findSuggestions } from '../src/modules/search/suggest';
import { Meili } from '../src/modules/search/meili';
import { indexState, rebuildIndex, settingsMatch, syncListings } from '../src/modules/search/sync';
import { eraseRequestedUser } from '../src/modules/users/erasure';
import { leaveToOtherCode, STAMP_WAIT_MS, startSearchJobs, SYNC_EVENTS } from '../src/worker/search';
import { appDb, workerDb } from './accounts';
import { db } from './db';
import { categoryBySlug, user } from './listings-fixtures';
import { indexName, keyLike, meili, meiliUrl, settled, testIndex } from './meili';

// The index follows PostgreSQL (approved Oct 22, 2026): every change that can move a listing in or
// out of search reaches the worker through the outbox, the job re-reads the listing, and a rebuild
// repairs anything missed. Runs as classifieds_worker, like the worker.

const DAY = 86_400_000;
let catalog: Catalog;
let index: string;

beforeAll(async () => {
  catalog = await cachedCatalog(workerDb);
  index = await testIndex('sync');
});

/** An account older than a week, so the new-account limits don't get in the way */
const seller = () => user({ createdAt: new Date(Date.now() - 30 * DAY) });

function input(over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'آیفون ۱۳ در حد نو',
    description: 'باتری سالم، جعبه و شارژر دارد.',
    attributes: { condition: 'like_new', brand: 'apple', storage_gb: 128 },
    priceType: 'fixed',
    amount: '۴۵۰',
    countryCode: 'DE',
    place: 'برلین',
    ...over,
  });
}

async function draft(userId: string) {
  const r = await createDraft(appDb, { userId, categoryId: (await categoryBySlug('mobile-phones')).id });
  if (!r.ok) throw new Error(r.reason);
  return r.listingId;
}

async function publish(userId: string, over: Partial<ListingInput> = {}) {
  const id = await draft(userId);
  const r = await saveListing(appDb, { userId, listingId: id, input: input(over), intent: 'publish' });
  if (!r.ok || r.status !== 'active') throw new Error(`publish: ${JSON.stringify(r)}`);
  return id;
}

/** What the outbox job does, then waits for Meilisearch */
async function sync(id: string) {
  const r = await syncListings(workerDb, meili, index, catalog, [id]);
  for (const t of r.tasks) await meili.wait(t);
  return r;
}

/** Ids found for the query, among the given listing (the shared test database has others) */
async function finds(q: string, id: string): Promise<boolean> {
  const r = await meili.search(index, { q: normalizePersian(q), filter: `id = "${id}"`, attributesToRetrieve: ['id'] });
  return r.hits.some((h) => h.id === id);
}

async function inIndex(id: string): Promise<boolean> {
  const r = await meili.fetchDocuments(index, { filter: `id = "${id}"`, limit: 1 });
  return r.results.length === 1;
}

describe('documents', () => {
  it('hold normalized text, the filterable fields and nothing personal', async () => {
    const u = await seller();
    const id = await publish(u.id, { title: 'آيفون ۱۳ كم كار', description: 'تحویل در شارلوتنبورگ' });
    const { upsert, remove } = await documentsFor(workerDb, catalog, [id]);
    expect(remove).toEqual([]);
    const doc = upsert[0]! as ListingDocument;
    expect(doc).toMatchObject({
      id,
      v: DOC_VERSION,
      country: 'DE',
      title: 'آیفون 13 کم کار', // Arabic ي and ك, Persian digits
      price_value: 45_000,
      shipping: false,
      kind: 'offer',
      is_event: false,
      is_test: false,
      attrs: { condition: 'like_new', brand: 'apple', storage_gb: 128 },
    });
    expect(doc.category_text).toContain(normalizePersian('موبایل'));
    expect(doc.attr_text).toContain('اپل');
    expect(doc.place_text).toContain('برلین');
    expect(typeof doc.ranked_at).toBe('number');
    // No user, email, phone, token or exact position
    const json = JSON.stringify(doc);
    expect(json).not.toContain(u.id);
    expect(json).not.toContain(u.email);
    expect(Object.keys(doc).sort()).toEqual(
      ['_geo', 'attr_text', 'attrs', 'category_id', 'category_text', 'country', 'description', 'id', 'is_event', 'is_test', 'kind', 'location_id', 'place_text', 'postal_code', 'price_value', 'ranked_at', 'shipping', 'title', 'v'].sort(),
    );
  });

  it('free is 0, exchange and on request have no price', async () => {
    const u = await seller();
    const free = await publish(u.id, { priceType: 'free', amount: '' });
    const swap = await publish(u.id, { priceType: 'exchange', amount: '' });
    const { upsert } = await documentsFor(workerDb, catalog, [free, swap]);
    expect(upsert.find((d) => d.id === free)!.price_value).toBe(0);
    expect(upsert.find((d) => d.id === swap)!).not.toHaveProperty('price_value');
  });
});

describe('the index follows every change', () => {
  it('create (draft), publish, edit, pause, resume, sold, delete', async () => {
    const u = await seller();
    const id = await draft(u.id);
    expect((await sync(id)).removed).toEqual([id]);
    expect(await inIndex(id)).toBe(false);

    const r = await saveListing(appDb, { userId: u.id, listingId: id, input: input({ title: 'سامسونگ گلکسی اس ۲۲' }), intent: 'publish' });
    expect(r).toMatchObject({ ok: true, status: 'active' });
    await sync(id);
    expect(await finds('گلکسی', id)).toBe(true);

    await saveListing(appDb, { userId: u.id, listingId: id, input: input({ title: 'شیائومی ردمی نوت' }), intent: 'save' });
    await sync(id);
    expect(await finds('ردمی', id)).toBe(true);
    expect(await finds('گلکسی', id)).toBe(false);

    for (const [action, there] of [['pause', false], ['resume', true], ['sold', false]] as const) {
      expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action })).toMatchObject({ ok: true });
      await sync(id);
      expect(await inIndex(id), action).toBe(there);
    }

    const other = await publish(u.id);
    await sync(other);
    expect(await inIndex(other)).toBe(true);
    await changeListingStatus(appDb, { userId: u.id, listingId: other, action: 'delete' });
    await sync(other);
    expect(await inIndex(other)).toBe(false);
  });

  it('expiry leaves the index, renewal comes back', async () => {
    const u = await seller();
    const id = await publish(u.id);
    await sync(id);
    await db.update(schema.listings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.listings.id, id));
    expect(await expireDueListings(workerDb)).toBeGreaterThanOrEqual(1);
    await sync(id);
    expect(await inIndex(id)).toBe(false);
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'renew' })).toMatchObject({ ok: true });
    await sync(id);
    expect(await inIndex(id)).toBe(true);
  });

  it('a take-down by the checks removes it; the corrected listing comes back after review', async () => {
    const u = await seller();
    const id = await publish(u.id, { description: 'حواله به ایران با بهترین نرخ' });
    await sync(id);
    expect(await inIndex(id)).toBe(true);
    expect(await runListingChecks(workerDb, id)).toBe('taken_down');
    await sync(id);
    expect(await inIndex(id)).toBe(false);

    const again = await saveListing(appDb, { userId: u.id, listingId: id, input: input({ description: 'گوشی سالم، فقط تحویل حضوری.' }), intent: 'publish' });
    expect(again).toMatchObject({ ok: true, status: 'pending_review' });
    await sync(id);
    expect(await inIndex(id)).toBe(false);
    expect(await runListingChecks(workerDb, id)).toBe('published');
    await sync(id);
    expect(await inIndex(id)).toBe(true);
  });

  it('erasing an account removes its listings', async () => {
    const u = await seller();
    const id = await publish(u.id);
    await sync(id);
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, u.id));
    expect(await eraseRequestedUser(workerDb, u.id)).toBe('erased');
    await sync(id);
    expect(await inIndex(id)).toBe(false);
  });

  it('events are indexed as events and stay until they end', async () => {
    const u = await seller();
    const d = await createEventDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('event-parties')).id });
    if (!d.ok) throw new Error(d.reason);
    const start = new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10);
    const r = await saveEvent(appDb, {
      userId: u.id,
      listingId: d.listingId,
      input: listingInputSchema.parse({ title: 'جشن شب یلدا', description: 'موسیقی زنده و شام ایرانی برای همه.', priceType: 'free', countryCode: 'DE', place: '12045' }),
      event: eventInputSchema.parse({ startDate: start, startTime: '20:00', endTime: '23:00', venueName: 'Kulturhaus', languages: ['fa'] }),
      intent: 'publish',
    });
    expect(r).toMatchObject({ ok: true, status: 'active' });
    await sync(d.listingId);
    const doc = (await meili.fetchDocuments<ListingDocument>(index, { filter: `id = "${d.listingId}"`, limit: 1 })).results[0];
    expect(doc).toMatchObject({ is_event: true });
    expect(await finds('یلدا', d.listingId)).toBe(true);
    // A cancelled event stays visible (marked) until its last date
    expect(await cancelEvent(appDb, { userId: u.id, listingId: d.listingId })).toMatchObject({ ok: true });
    await sync(d.listingId);
    expect(await inIndex(d.listingId)).toBe(true);
  });

  it('repeated and late events do no harm: the listing is always read as it is now', async () => {
    const u = await seller();
    const id = await publish(u.id);
    await sync(id);
    await sync(id);
    await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'delete' });
    // The job of the old "published" event runs late, after the delete
    await sync(id);
    expect(await inIndex(id)).toBe(false);
    // An id that never existed is simply removed
    expect((await sync(randomUUID())).removed).toHaveLength(1);
  });
});

describe('outbox handlers', () => {
  it('every listing and event change that can move a listing is synced', () => {
    const listing = Object.values(LISTING_OUTBOX).filter((t) => t !== LISTING_OUTBOX.created);
    const events = [EVENT_OUTBOX.published, EVENT_OUTBOX.changed, EVENT_OUTBOX.cancelled];
    expect([...SYNC_EVENTS].sort()).toEqual([...listing, ...events].sort());
  });

  it('the queue syncs the listing, then hands a publication to the matching', async () => {
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const handed: string[] = [];
    const jobs = await startSearchJobs(workerDb, connection, {
      meili,
      index,
      suggestIndex: indexName('sync_phrases_a'),
      prefix: `test-${randomUUID()}`,
      schedules: false,
      afterPublish: async (id) => {
        // It is already in the index when matching starts
        expect(await inIndex(id)).toBe(true);
        handed.push(id);
      },
    });
    try {
      expect(Object.keys(jobs.handlers).sort()).toEqual([...SYNC_EVENTS].sort());
      const u = await seller();
      const id = await publish(u.id, { title: 'گوشی پیکسل هفت' });
      const data = { outboxId: randomUUID(), eventType: LISTING_OUTBOX.published, aggregateId: id, payload: {} };
      const job = await jobs.queue.add('search_sync', data);
      await job.waitUntilFinished(new (await import('bullmq')).QueueEvents('search-sync', { connection: connection.duplicate(), prefix: jobs.queue.opts.prefix }), 30_000);
      expect(handed).toEqual([id]);
      expect(await finds('پیکسل', id)).toBe(true);
    } finally {
      await jobs.close();
      await connection.quit();
    }
  });
});

describe('the phrase index of suggestions', () => {
  it('follows listing changes a moment later, one rebuild for a burst of them', async () => {
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const suggestIndex = indexName('sync_phrases');
    const jobs = await startSearchJobs(workerDb, connection, { meili, index, suggestIndex, suggestDelayMs: 1_000, prefix: `test-${randomUUID()}`, schedules: false });
    const events = new (await import('bullmq')).QueueEvents('search-sync', { connection: connection.duplicate(), prefix: jobs.queue.opts.prefix });
    try {
      const u = await seller();
      const ids = [await publish(u.id, { title: 'گوشی شیائومی' }), await publish(u.id, { title: 'گوشی شیائومی دو' })];
      for (const id of ids) {
        const job = await jobs.queue.add('search_sync', { outboxId: randomUUID(), eventType: LISTING_OUTBOX.published, aggregateId: id, payload: {} });
        await job.waitUntilFinished(events, 30_000);
      }
      // Both changes joined one waiting rebuild
      const waiting = await jobs.queue.getJobs(['delayed', 'waiting']);
      expect(waiting.map((j) => j.name)).toEqual(['suggest-rebuild']);
      await waiting[0]!.waitUntilFinished(events, 30_000);
      const phones = await meili.search(suggestIndex, { q: 'گوشی موبایل', filter: 'scope = "DE"', limit: 1, attributesToRetrieve: ['label', 'count'] });
      expect(phones.hits[0]).toMatchObject({ label: 'گوشی موبایل' });
      expect(Number(phones.hits[0]!.count)).toBeGreaterThanOrEqual(2);
    } finally {
      await events.close();
      await jobs.close();
      await connection.quit();
    }
  });
});

describe('during a deploy (old and new worker both taking jobs)', () => {
  it('a start-up rebuild runs only on the code that asked for it, until that worker is gone', () => {
    const now = Date.now();
    expect(leaveToOtherCode({ reason: 'version', code: 'abc', queuedAt: now }, 'abc', now)).toBe(false);
    expect(leaveToOtherCode({ reason: 'version', code: 'new', queuedAt: now }, 'old', now)).toBe(true);
    expect(leaveToOtherCode({ reason: 'version', code: 'new', queuedAt: now - STAMP_WAIT_MS - 1 }, 'old', now)).toBe(false);
    // Scheduled and change-driven jobs carry no stamp
    expect(leaveToOtherCode({ reason: 'changes' } as never, 'old', now)).toBe(false);
    expect(leaveToOtherCode(undefined, 'old', now)).toBe(false);
  });

  it('the queue puts back a rebuild from other code and runs its own', async () => {
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const suggestIndex = indexName('stamp_phrases');
    // An index of its own: the drift test below needs this file's index as the earlier tests left it
    const jobs = await startSearchJobs(workerDb, connection, { meili, index: await testIndex('stamp'), suggestIndex, stampRetryMs: 100, prefix: `test-${randomUUID()}`, schedules: false });
    const events = new (await import('bullmq')).QueueEvents('search-sync', { connection: connection.duplicate(), prefix: jobs.queue.opts.prefix });
    try {
      const other = await jobs.queue.add('suggest-rebuild', { reason: 'version', code: 'newer-code', queuedAt: Date.now() });
      await new Promise((r) => setTimeout(r, 1_500));
      expect(await other.getState()).toBe('delayed');
      expect(await meili.indexStats(suggestIndex)).toBeNull();
      // The worker that asked is gone: after the wait, anyone runs it
      const late = await jobs.queue.add('suggest-rebuild', { reason: 'version', code: 'newer-code', queuedAt: Date.now() - STAMP_WAIT_MS - 1 });
      await late.waitUntilFinished(events, 30_000);
      expect(await meili.indexStats(suggestIndex)).not.toBeNull();
      const own = await jobs.queue.add('reindex', { reason: 'version', code: indexCode(), queuedAt: Date.now() });
      await own.waitUntilFinished(events, 60_000);
      await other.remove().catch(() => {});
    } finally {
      await events.close();
      await jobs.close();
      await connection.quit();
    }
  });

  it('a phrase index another code built is rebuilt even when the records are the same', async () => {
    const phrases = indexName('stamp_rebuilt');
    expect(await rebuildPhrases(workerDb, meili, phrases, catalog)).toBeGreaterThan(0);
    expect(await rebuildPhrases(workerDb, meili, phrases, catalog)).toBeNull();
    const [doc] = (await meili.fetchDocuments<Record<string, unknown>>(phrases, { limit: 1 })).results;
    expect(doc!.code).toBe(phraseCode());
    await meili.wait(await meili.addDocuments(phrases, [{ ...doc, code: 'older-code' }]));
    expect(await rebuildPhrases(workerDb, meili, phrases, catalog)).toBeGreaterThan(0);
  });
});

describe('rebuild', () => {
  it('builds a second index and swaps it in, repairing drift', async () => {
    const u = await seller();
    const kept = await publish(u.id);
    const gone = await publish(u.id);
    await sync(kept);
    await sync(gone);
    // Drift: a stale entry, and a listing whose job was lost
    await changeListingStatus(appDb, { userId: u.id, listingId: gone, action: 'delete' });
    await meili.wait(await meili.deleteDocuments(index, [kept]));
    expect(await indexState(workerDb, meili, index)).toBe('count');

    const n = await rebuildIndex(workerDb, meili, index, catalog, 7);
    const ids = new Set(await meili.documentIds(index));
    const active = (await db.select({ id: schema.listings.id }).from(schema.listings).where(eq(schema.listings.status, 'active'))).map((r) => r.id);
    expect(n).toBe(active.length);
    expect(ids).toEqual(new Set(active));
    expect(ids.has(kept)).toBe(true);
    expect(ids.has(gone)).toBe(false);
    expect(await meili.indexStats(`${index}_new`)).toBeNull();
    await settled();
    expect(await indexState(workerDb, meili, index)).toBe('ok');
  });

  it('notices a missing index and outdated settings', async () => {
    expect(await indexState(workerDb, meili, `${index}_missing`)).toBe('missing');
    const other = await testIndex('settings');
    await meili.wait(await meili.updateSettings(other, { stopWords: [] }));
    expect(await indexState(workerDb, meili, other)).toBe('settings');
  });

  it("the worker's key (as made on the server) can sync and rebuild; the web key can only search", async () => {
    // The server's key definitions, with this file's index in place of `listings`
    const worker = new Meili({ url: meiliUrl!, key: await keyLike({ ...WORKER_KEY, uid: randomUUID() }) });
    const web = new Meili({ url: meiliUrl!, key: await keyLike({ ...WEB_KEY, uid: randomUUID(), indexes: [index] }) });
    const u = await seller();
    const id = await publish(u.id);
    const r = await syncListings(workerDb, worker, index, catalog, [id]);
    for (const t of r.tasks) await worker.wait(t);
    expect(await rebuildIndex(workerDb, worker, index, catalog)).toBeGreaterThan(0);
    expect((await web.search(index, { q: '', filter: `id = "${id}"` })).hits).toHaveLength(1);
    await expect(web.addDocuments(index, [{ id: randomUUID() }])).rejects.toMatchObject({ status: 403 });
    await expect(web.deleteDocuments(index, [id])).rejects.toMatchObject({ status: 403 });
    await expect(web.getSettings(index)).rejects.toMatchObject({ status: 403 });
    await expect(web.search(`${index}_other`, { q: '' })).rejects.toMatchObject({ status: 403 });
  });

  it('the same for the phrase index: the worker builds it, the web key searches both indexes at once', async () => {
    expect(WEB_KEY.indexes).toEqual([LISTINGS_INDEX, SUGGESTIONS_INDEX]);
    const phrases = indexName('keys_phrases');
    const worker = new Meili({ url: meiliUrl!, key: await keyLike({ ...WORKER_KEY, uid: randomUUID() }) });
    const web = new Meili({ url: meiliUrl!, key: await keyLike({ ...WEB_KEY, uid: randomUUID(), indexes: [index, phrases] }) });
    expect(await rebuildPhrases(workerDb, worker, phrases, catalog)).toBeGreaterThan(0);
    const scope = { country: { code: 'DE', slug: 'germany', nameFa: 'آلمان', minorUnit: 2 }, city: null };
    const found = await findSuggestions(web, { listings: index, suggestions: phrases }, scope, 'گوشی');
    expect(found.phrases.length).toBeGreaterThan(0);
    await expect(web.addDocuments(phrases, [{ id: 'x' }])).rejects.toMatchObject({ status: 403 });
  });

  it('compares settings the way Meilisearch returns them', async () => {
    expect(settingsMatch(indexSettings(), await meili.getSettings(index))).toBe(true);
    expect(settingsMatch({ synonyms: { a: ['b'] } }, { synonyms: { a: ['b'], c: ['d'] } })).toBe(false);
    expect(settingsMatch({ filterableAttributes: ['a', 'b'] }, { filterableAttributes: ['b', 'a'] })).toBe(true);
    expect(settingsMatch({ searchableAttributes: ['a', 'b'] }, { searchableAttributes: ['b', 'a'] })).toBe(false);
  });
});

afterAll(async () => {
  await settled();
});
