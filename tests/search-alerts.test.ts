import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { and, eq, isNull } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { cachedCatalog, type Catalog } from '../src/modules/listings/catalog';
import { changeListingStatus, createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { activeCountries } from '../src/modules/listings/queries';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema } from '../src/modules/events/input';
import type { Mail } from '../src/modules/notifications/mailer';
import { TelegramClient } from '../src/modules/notifications/telegram-api';
import { markUnreachable } from '../src/modules/notifications/telegram-reach';
import { searchListings } from '../src/modules/search';
import { ALERTS_PER_USER, claimAlert, DEBOUNCE_MS, dueForDaily, GATHER_MS, matchListing, noticeDelay, purgeHits } from '../src/modules/search/alerts';
import { resolveTarget, saveSearch, searchFiltersOf } from '../src/modules/search/saved';
import { syncListings } from '../src/modules/search/sync';
import { setSavedSearchAlerts } from '../src/modules/users/notification-prefs';
import { startChatJobs } from '../src/worker/chat';
import { startSearchAlertJobs } from '../src/worker/search-alerts';
import { appDb, redis, workerDb } from './accounts';
import { db } from './db';
import { categoryBySlug, user } from './listings-fixtures';
import { meili, testIndex } from './meili';

// Alerts for saved searches (approved Oct 22, 2026): a listing alerts exactly the searches whose
// page shows it, once; instant notices gather matches and come at most every 15 minutes, daily
// ones at 18:00; at most 10 a day per user; Telegram, else email. Run as classifieds_worker.

const DAY = 86_400_000;
let catalog: Catalog;
let index: string;

beforeAll(async () => {
  catalog = await cachedCatalog(workerDb);
  index = await testIndex('alerts');
});

const old = () => user({ createdAt: new Date(Date.now() - 30 * DAY) });

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

/** Published and in the index, as when the matching job starts */
async function publish(userId: string, over: Partial<ListingInput> = {}) {
  const d = await createDraft(appDb, { userId, categoryId: (await categoryBySlug('mobile-phones')).id });
  if (!d.ok) throw new Error(d.reason);
  const r = await saveListing(appDb, { userId, listingId: d.listingId, input: input(over), intent: 'publish' });
  if (!r.ok || r.status !== 'active') throw new Error(`publish: ${JSON.stringify(r)}`);
  const s = await syncListings(workerDb, meili, index, catalog, [d.listingId]);
  for (const t of s.tasks) await meili.wait(t);
  return d.listingId;
}

async function save(userId: string, path: string, query = '') {
  const t = await resolveTarget(appDb, catalog, path, query);
  if (!t) throw new Error(`not a page: ${path}${query}`);
  const r = await saveSearch(appDb, userId, t);
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}

const match = (listingId: string) => matchListing(workerDb, catalog, listingId, { meili, index });
const hitsOf = (savedSearchId: string) => db.select().from(schema.savedSearchHits).where(eq(schema.savedSearchHits.savedSearchId, savedSearchId));
const pendingOf = (savedSearchId: string) =>
  db.select().from(schema.savedSearchHits).where(and(eq(schema.savedSearchHits.savedSearchId, savedSearchId), isNull(schema.savedSearchHits.notifiedAt)));

describe('which searches a new listing alerts', () => {
  it('exactly those whose page shows it, checked against the page itself', async () => {
    const seller = await old();
    const searcher = await old();
    const word = `زیمنس${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ب')}`;
    const searches = {
      category: await save(searcher.id, '/germany/mobile-phones'),
      city: await save(searcher.id, '/germany/berlin/mobile-phones'),
      otherCity: await save(searcher.id, '/germany/hamburg'),
      cheap: await save(searcher.id, '/germany/mobile-phones', '?price=..100'),
      keyword: await save(searcher.id, '/germany/mobile-phones', `?q=${encodeURIComponent(`آيفون ${word}`)}`),
      otherKeyword: await save(searcher.id, '/germany', `?q=${encodeURIComponent(`سامسونگ ${word}`)}`),
      synonym: await save(searcher.id, '/germany', `?q=${encodeURIComponent(`موبایل ${word}`)}`),
      brand: await save(searcher.id, '/germany/mobile-phones', '?brand=apple'),
      otherBrand: await save(searcher.id, '/germany/mobile-phones', '?brand=samsung'),
      radius: await save(searcher.id, '/germany', '?postal=10117&r=10'),
      farRadius: await save(searcher.id, '/germany', '?postal=20095&r=5'),
      cars: await save(searcher.id, '/germany/cars'),
    };
    const own = await save(seller.id, '/germany/mobile-phones');
    const id = await publish(seller.id, { title: `آیفون ۱۳ ${word}` });

    // Other tests' searches may match too; only this test's count
    const mine = new Set([...Object.values(searches), own]);
    const hits = (await match(id)).filter((h) => mine.has(h.savedSearchId));
    const hit = new Set(hits.map((h) => h.savedSearchId));
    const expected = new Set([searches.category, searches.city, searches.keyword, searches.synonym, searches.brand, searches.radius]);
    expect(hit).toEqual(expected);
    expect(hit.has(own)).toBe(false);
    expect(hits.every((h) => h.frequency === 'instant' && h.lastNotifiedAt === null)).toBe(true);

    // The same answer as each search's page: the listing is on page 1 (newest first) exactly when it alerted
    const countries = await activeCountries(appDb);
    const rows = await db.select().from(schema.savedSearches).where(eq(schema.savedSearches.userId, searcher.id));
    for (const row of rows) {
      const f = searchFiltersOf(catalog, countries, { filters: row.filters, point: row.point, radiusM: row.radiusM })!;
      const page = await searchListings(appDb, { ...f, sort: f.keyword ? 'relevance' : 'newest' }, null, { meili, index });
      expect(page.items.some((l) => l.id === id), String(row.name)).toBe(expected.has(row.id));
    }

    // Once only
    expect(await match(id)).toEqual([]);
    expect(await hitsOf(searches.category)).toHaveLength(1);
  });

  it('not for searches saved after the listing, switched off, or of inactive users; never for events', async () => {
    const seller = await old();
    const off = await old();
    const quiet = await old();
    const gone = await old();
    const word = `مونستر${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ک')}`;
    const q = `?q=${encodeURIComponent(word)}`;
    const offSearch = await save(off.id, '/germany', q);
    await db.update(schema.savedSearches).set({ notifyFrequency: 'off' }).where(eq(schema.savedSearches.id, offSearch));
    const quietSearch = await save(quiet.id, '/germany', q);
    await setSavedSearchAlerts(appDb, quiet.id, false);
    const goneSearch = await save(gone.id, '/germany', q);
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, gone.id));

    const id = await publish(seller.id, { title: `آیفون ${word}` });
    const late = await save((await old()).id, '/germany', q);
    await match(id);
    for (const s of [offSearch, quietSearch, goneSearch, late]) expect(await hitsOf(s)).toEqual([]);

    // An event matches nothing (events have their own section)
    const evSearch = await save((await old()).id, '/germany', `?q=${encodeURIComponent(`یلدا ${word}`)}`);
    const d = await createEventDraft(appDb, { userId: seller.id, categoryId: (await categoryBySlug('event-celebrations')).id });
    if (!d.ok) throw new Error(d.reason);
    await saveEvent(appDb, {
      userId: seller.id,
      listingId: d.listingId,
      input: listingInputSchema.parse({ title: `جشن یلدا ${word}`, description: 'موسیقی زنده و شام ایرانی برای همه.', priceType: 'free', countryCode: 'DE', place: '12045' }),
      event: eventInputSchema.parse({ startDate: new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10), startTime: '20:00', endTime: '23:00', venueName: 'Kulturhaus', languages: ['fa'] }),
      intent: 'publish',
    });
    expect(await match(d.listingId)).toEqual([]);
    expect(await hitsOf(evSearch)).toEqual([]);
  });
});

describe('when a notice goes out', () => {
  it('gathers matches, waits 2 minutes the first time and 15 minutes between notices', async () => {
    const seller = await old();
    const searcher = await old();
    const word = `پوتسدام${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ج')}`;
    const s = await save(searcher.id, '/germany', `?q=${encodeURIComponent(word)}`);
    const a = await publish(seller.id, { title: `آیفون الف ${word}` });
    const b = await publish(seller.id, { title: `آیفون ب ${word}` });
    const c = await publish(seller.id, { title: `آیفون پ ${word}` });
    const first = (await match(a)).find((h) => h.savedSearchId === s);
    expect(noticeDelay(first!.lastNotifiedAt, new Date())).toBe(GATHER_MS);
    await match(b);
    await match(c);

    const t0 = new Date();
    const sent = await claimAlert(workerDb, redis, s, t0);
    expect(sent).toMatchObject({ send: 'email', job: { savedSearchId: s, userId: searcher.id } });
    // One notice for all three, newest first
    expect('job' in sent && sent.job.listingIds).toEqual([c, b, a]);
    expect(await pendingOf(s)).toEqual([]);

    // A fourth match five minutes later waits for the rest of the 15 minutes
    const d = await publish(seller.id, { title: `آیفون ت ${word}` });
    const fourth = (await match(d)).find((h) => h.savedSearchId === s);
    const t5 = new Date(t0.getTime() + 5 * 60_000);
    expect(noticeDelay(fourth!.lastNotifiedAt, t5)).toBeGreaterThan(9 * 60_000);
    expect(await claimAlert(workerDb, redis, s, t5)).toEqual({ later: DEBOUNCE_MS - 5 * 60_000 });
    expect(await pendingOf(s)).toHaveLength(1);
    const later = await claimAlert(workerDb, redis, s, new Date(t0.getTime() + DEBOUNCE_MS + 1_000));
    expect('job' in later && later.job.listingIds).toEqual([d]);
    // Nothing left: no empty notice
    expect(await claimAlert(workerDb, redis, s, new Date(t0.getTime() + 3 * DEBOUNCE_MS))).toEqual({ skip: 'nothing' });
  });

  it('daily searches wait for the daily run; instant ones left waiting an hour join it', async () => {
    const seller = await old();
    const searcher = await old();
    const word = `کوتبوس${randomUUID().slice(0, 4).replace(/[0-9]/g, 'د')}`;
    const daily = await save(searcher.id, '/germany', `?q=${encodeURIComponent(word)}`);
    await db.update(schema.savedSearches).set({ notifyFrequency: 'daily' }).where(eq(schema.savedSearches.id, daily));
    const instant = await save(searcher.id, '/germany/mobile-phones', `?q=${encodeURIComponent(word)}`);
    const id = await publish(seller.id, { title: `آیفون ${word}` });
    const hits = (await match(id)).filter((h) => h.savedSearchId === daily || h.savedSearchId === instant);
    expect(new Map(hits.map((h) => [h.savedSearchId, h.frequency]))).toEqual(new Map([[daily, 'daily'], [instant, 'instant']]));

    const now = new Date();
    expect(await dueForDaily(workerDb, now)).toContain(daily);
    expect(await dueForDaily(workerDb, now)).not.toContain(instant);
    expect(await dueForDaily(workerDb, new Date(now.getTime() + 61 * 60_000))).toContain(instant);
    expect(await claimAlert(workerDb, redis, daily, now, 'daily')).toMatchObject({ send: 'email', job: { listingIds: [id] } });
    expect(await dueForDaily(workerDb, now)).not.toContain(daily);
  });

  it('at most 10 notices a day per user; the rest wait', async () => {
    const seller = await old();
    const searcher = await old();
    const word = `لاندسبرگ${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ر')}`;
    const ids: string[] = [];
    const cities = ['', '/berlin'];
    for (let i = 0; i < ALERTS_PER_USER.max + 1; i++) ids.push(await save(searcher.id, `/germany${cities[i % 2]}`, `?q=${encodeURIComponent(`${word} آیفون`)}&price=..${1000 + i}`));
    const id = await publish(seller.id, { title: `آیفون ${word}` });
    expect((await match(id)).filter((h) => ids.includes(h.savedSearchId))).toHaveLength(ALERTS_PER_USER.max + 1);
    const results = [];
    for (const s of ids) results.push(await claimAlert(workerDb, redis, s, new Date()));
    expect(results.filter((r) => 'send' in r)).toHaveLength(ALERTS_PER_USER.max);
    expect(results.at(-1)).toEqual({ skip: 'capped' });
    expect(await pendingOf(ids.at(-1)!)).toHaveLength(1);
  });

  it('a listing gone before the notice is dropped; alerts turned off drop the matches', async () => {
    const seller = await old();
    const searcher = await old();
    const word = `هاله${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ز')}`;
    const s = await save(searcher.id, '/germany', `?q=${encodeURIComponent(word)}`);
    const id = await publish(seller.id, { title: `آیفون ${word}` });
    await match(id);
    await changeListingStatus(appDb, { userId: seller.id, listingId: id, action: 'pause' });
    expect(await claimAlert(workerDb, redis, s, new Date())).toEqual({ skip: 'nothing' });
    expect(await pendingOf(s)).toEqual([]);

    const s2 = await save(searcher.id, '/germany/mobile-phones', `?q=${encodeURIComponent(word)}`);
    const id2 = await publish(seller.id, { title: `آیفون دو ${word}` });
    await match(id2);
    await setSavedSearchAlerts(appDb, searcher.id, false);
    expect(await claimAlert(workerDb, redis, s2, new Date())).toEqual({ skip: 'turned_off' });
    expect(await pendingOf(s2)).toEqual([]);
  });

  it('Telegram when linked and reachable, else email', async () => {
    const seller = await old();
    const searcher = await old();
    const tg = 700_000_000 + Math.floor(Math.random() * 1_000_000);
    await db.update(schema.users).set({ telegramUserId: tg }).where(eq(schema.users.id, searcher.id));
    const word = `ینا${randomUUID().slice(0, 4).replace(/[0-9]/g, 'س')}`;
    const a = await save(searcher.id, '/germany', `?q=${encodeURIComponent(word)}`);
    const b = await save(searcher.id, '/germany/mobile-phones', `?q=${encodeURIComponent(word)}`);
    await match(await publish(seller.id, { title: `آیفون ${word}` }));
    expect(await claimAlert(workerDb, redis, a, new Date())).toMatchObject({ send: 'telegram' });
    await markUnreachable(redis, tg);
    expect(await claimAlert(workerDb, redis, b, new Date())).toMatchObject({ send: 'email' });
  });

  it('old matches are purged after 30 days', async () => {
    const seller = await old();
    const searcher = await old();
    const word = `فولدا${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ش')}`;
    const s = await save(searcher.id, '/germany', `?q=${encodeURIComponent(word)}`);
    await match(await publish(seller.id, { title: `آیفون ${word}` }));
    expect(await purgeHits(workerDb, new Date(Date.now() + 29 * DAY))).toBe(0);
    expect(await purgeHits(workerDb, new Date(Date.now() + 31 * DAY), 1)).toBeGreaterThanOrEqual(1);
    expect(await hitsOf(s)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End to end through the queues, with a fake Telegram Bot API and a mail list
// ---------------------------------------------------------------------------

let server: Server;
let base = '';
const calls: Array<{ chatId: number; text: string; markup: { inline_keyboard: { text: string; url: string }[][] } }> = [];
let failNext = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as { chat_id: number; text: string; reply_markup?: string | object };
      const markup = typeof body.reply_markup === 'string' ? JSON.parse(body.reply_markup) : body.reply_markup;
      if (failNext > 0) {
        failNext--;
        res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }));
        return;
      }
      calls.push({ chatId: body.chat_id, text: body.text, markup });
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result: {} }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
});

async function until(check: () => boolean | Promise<boolean>, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('timed out');
}

describe('through the queues', () => {
  it('a Telegram notice with the listings and the search; email (with one-click unsubscribe) when the bot is blocked', async () => {
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const prefix = `test-${randomUUID()}`;
    const mails: Mail[] = [];
    const chat = await startChatJobs(workerDb, connection, {
      telegram: new TelegramClient('123:test-token-test-token-test-token-xx', undefined, base),
      mailer: async (m) => void mails.push(m),
      appUrl: 'https://app.example.test',
      prefix,
      telegramBackoffMs: 50,
    });
    const alerts = await startSearchAlertJobs(workerDb, connection, { meili, index, send: chat.queues, telegram: true, prefix, schedules: false });
    try {
      const seller = await old();
      const searcher = await old();
      const tg = 710_000_000 + Math.floor(Math.random() * 1_000_000);
      await db.update(schema.users).set({ telegramUserId: tg }).where(eq(schema.users.id, searcher.id));
      const word = `کیل${randomUUID().slice(0, 4).replace(/[0-9]/g, 'ف')}`;
      const s = await save(searcher.id, '/germany', `?q=${encodeURIComponent(word)}`);
      const id = await publish(seller.id, { title: `آیفون کیل ${word}` });
      // What the search queue does once the listing is indexed
      await alerts.afterPublish(id);
      await until(async () => (await hitsOf(s)).length === 1);
      // The notice itself waits GATHER_MS; run it now
      await alerts.queue.add('notify', { savedSearchId: s }, { jobId: `now_${s}` });
      await until(() => calls.some((c) => c.chatId === tg));
      const call = calls.find((c) => c.chatId === tg)!;
      expect(call.text).toContain(word);
      const buttons = call.markup.inline_keyboard.flat();
      expect(buttons[0]!.text).toContain('آیفون کیل');
      expect(buttons[0]!.url).toMatch(/^https:\/\/app\.example\.test\/v\/.+\/[0-9a-z]{10}$/);
      expect(buttons.some((b) => b.url === `https://app.example.test/germany?q=${encodeURIComponent(word)}`)).toBe(true);
      expect(buttons.some((b) => b.url === 'https://app.example.test/my/searches')).toBe(true);

      // The bot is blocked now: the next notice arrives by email instead
      const id2 = await publish(seller.id, { title: `آیفون دوم ${word}` });
      await alerts.afterPublish(id2);
      await until(async () => (await hitsOf(s)).length === 2);
      await db.update(schema.savedSearches).set({ lastNotifiedAt: new Date(Date.now() - DEBOUNCE_MS - 1_000) }).where(eq(schema.savedSearches.id, s));
      failNext = 1;
      await alerts.queue.add('notify', { savedSearchId: s }, { jobId: `now2_${s}` });
      await until(() => mails.some((m) => m.html.includes(word)));
      const mail = mails.find((m) => m.html.includes(word))!;
      expect(mail.to).toBe(searcher.email);
      expect(mail.html).toContain('آیفون دوم');
      expect(mail.headers!['List-Unsubscribe']).toMatch(/^<https:\/\/app\.example\.test\/alerts\/off\/one-click\?t=[0-9a-f]{32}>$/);
      expect(mail.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect(mail.text).toMatch(/\/alerts\/off\?t=[0-9a-f]{32}/);
      // Nothing about the seller
      expect(mail.html).not.toContain(seller.email);
    } finally {
      await alerts.close();
      await chat.close();
      await connection.quit();
    }
  });
});
