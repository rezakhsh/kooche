import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { parseWebEnv } from '../src/lib/env';
import { normalizePersian } from '../src/lib/normalize-persian';
import { sendMessage } from '../src/modules/chat/conversations';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema } from '../src/modules/events/input';
import { upcomingEvents } from '../src/modules/events/queries';
import { listingInputSchema } from '../src/modules/listings/listings';
import { countryCounts, publicListing } from '../src/modules/listings/queries';
import type { Mail } from '../src/modules/notifications/mailer';
import { businessBySlug } from '../src/modules/organizations/organizations';
import { browseListings, cardsByIds, categoryCounts, type SearchFilters } from '../src/modules/search/browse';
import { meiliFilter } from '../src/modules/search/keyword';
import { createAuth } from '../src/modules/users/auth';
import { acceptTelegramContact, bindTelegramLink, startTelegramVerification } from '../src/modules/users/phone';
import { sellerProfile } from '../src/modules/users/profile';
import { mixesTestAndReal, seesTestContent, testInbox } from '../src/modules/users/test-accounts';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, makeOrganization, publicToken, rollback, type Tx } from './db';
import { categoryBySlug, openEverywhereForTests, user } from './listings-fixtures';

// Test accounts (wave 2 part 1, owner Oct 28, 2026): the fixed sign-in code on staging only, test
// content hidden from real people everywhere unless the viewer is staff or a test account, no
// chat between test and real accounts, their mail and Telegram forwarded to the owner, and a
// made-up number given up when a real person verifies it.

const owner = db as unknown as Tx;
const DAY = 86_400_000;

async function account(kind: 'country' | 'personal' | null, over: Partial<typeof schema.users.$inferInsert> = {}) {
  const u = await user({ createdAt: new Date(Date.now() - 30 * DAY) });
  if (kind || Object.keys(over).length) await db.update(schema.users).set({ testAccount: kind, ...over }).where(eq(schema.users.id, u.id));
  return { ...u, testAccount: kind };
}

const filters = (over: Partial<SearchFilters> = {}): SearchFilters => ({
  countryCode: 'DE',
  keyword: null,
  categoryIds: null,
  locationId: null,
  postalCode: null,
  around: null,
  price: null,
  shipping: false,
  attributes: [],
  sort: 'newest',
  ...over,
});

beforeEach(async () => {
  await redis.flushdb();
});

describe('settings', () => {
  const base = {
    APP_URL: 'https://staging.example.org',
    DATABASE_URL: 'postgres://a:b@localhost/c',
    REDIS_URL: 'redis://localhost',
    AUTH_SECRET: 'x'.repeat(32),
    TELEGRAM_BOT_USERNAME: 'peydoo_bot',
    PHONE_CODE_SECRET: 'y'.repeat(32),
  };

  it('allows the fixed code on staging only, never with live payments or indexing', () => {
    expect(parseWebEnv({ ...base, TEST_ACCOUNT_CODE: '123456', SENTRY_ENVIRONMENT: 'staging' }).success).toBe(true);
    expect(parseWebEnv({ ...base, TEST_ACCOUNT_CODE: '123456' }).success).toBe(false);
    expect(parseWebEnv({ ...base, TEST_ACCOUNT_CODE: '123456', SENTRY_ENVIRONMENT: 'production' }).success).toBe(false);
    expect(parseWebEnv({ ...base, TEST_ACCOUNT_CODE: '123456', SENTRY_ENVIRONMENT: 'staging', PAYMENTS_LIVE: 'on' }).success).toBe(false);
    expect(parseWebEnv({ ...base, TEST_ACCOUNT_CODE: '123456', SENTRY_ENVIRONMENT: 'staging', SEARCH_INDEXING: 'on' }).success).toBe(false);
    expect(parseWebEnv({ ...base, TEST_ACCOUNT_CODE: '12345', SENTRY_ENVIRONMENT: 'staging' }).success).toBe(false);
    expect(parseWebEnv({ ...base, APP_URL: 'http://localhost:3000', TEST_ACCOUNT_CODE: '123456' }).success).toBe(true);
  });
});

describe('signing in', () => {
  const sent: string[] = [];
  const auth = (testAccountCode?: string) =>
    createAuth({
      db: appDb,
      redis,
      secret: 'test-secret-test-secret-test-secret-0123',
      baseURL: 'https://app.example.test',
      sendLoginCode: async (email) => {
        sent.push(email);
      },
      testAccountCode,
    });
  const headers = () => new Headers({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250)}` });

  it('gives a per-country test account the fixed code and sends no email', async () => {
    // As scripts/test-accounts.ts makes them
    const a = await account('country', { emailVerified: true });
    const withCode = auth('123456');
    await withCode.api.sendVerificationOTP({ body: { email: a.email, type: 'sign-in' }, headers: headers() });
    expect(sent).not.toContain(a.email);
    const r = await withCode.api.signInEmailOTP({ body: { email: a.email, otp: '123456' }, headers: headers() });
    expect(r.user.id).toBe(a.id);
  });

  it('keeps random codes by email for everyone else, test accounts of real people included', async () => {
    const withCode = auth('123456');
    for (const a of [await account('personal'), await account(null)]) {
      await withCode.api.sendVerificationOTP({ body: { email: a.email, type: 'sign-in' }, headers: headers() });
      expect(sent).toContain(a.email);
      await expect(withCode.api.signInEmailOTP({ body: { email: a.email, otp: '123456' }, headers: headers() })).rejects.toThrow();
    }
  });

  it('without the setting (production) a per-country test account gets neither a code nor an email', async () => {
    const a = await account('country');
    const live = auth();
    await live.api.sendVerificationOTP({ body: { email: a.email, type: 'sign-in' }, headers: headers() });
    expect(sent).not.toContain(a.email);
    await expect(live.api.signInEmailOTP({ body: { email: a.email, otp: '123456' }, headers: headers() })).rejects.toThrow();
  });
});

describe('who sees test content', () => {
  it('staff and test accounts; not real people, not visitors', async () => {
    expect(await seesTestContent(appDb, (await account('country')).id)).toBe(true);
    expect(await seesTestContent(appDb, (await account('personal')).id)).toBe(true);
    expect(await seesTestContent(appDb, (await account(null, { staffRole: 'moderator' })).id)).toBe(true);
    expect(await seesTestContent(appDb, (await account(null)).id)).toBe(false);
    expect(await seesTestContent(appDb, null)).toBe(false);
  });

  it('browse, keyword cards and counts leave test listings out unless asked', async () => {
    await rollback(async (tx) => {
      const real = await account(null);
      const test = await account('country');
      const a = await makeListing(tx, real.id);
      const b = await makeListing(tx, test.id);
      const ids = async (f: SearchFilters) => (await browseListings(tx, f, null)).items.map((i) => i.id);
      expect(await ids(filters())).toContain(a.id);
      expect(await ids(filters())).not.toContain(b.id);
      expect(await ids(filters({ withTest: true }))).toEqual(expect.arrayContaining([a.id, b.id]));
      expect((await cardsByIds(tx, [a.id, b.id], null)).map((c) => c.id)).toEqual([a.id]);
      expect((await cardsByIds(tx, [a.id, b.id], null, true)).map((c) => c.id)).toEqual([a.id, b.id]);
      const before = (await categoryCounts(tx, 'DE')).get(b.categoryId!) ?? 0;
      await tx.update(schema.users).set({ testAccount: null }).where(eq(schema.users.id, test.id));
      expect((await categoryCounts(tx, 'DE')).get(b.categoryId!)).toBe(before + 1);
      expect((await countryCounts(tx)).get('DE')).toBeGreaterThan(0);
    });
  });

  it('keyword search asks Meilisearch for real listings only, unless asked', () => {
    expect(meiliFilter(filters({ keyword: 'x' }))).toContain('is_test != true');
    expect(meiliFilter(filters({ keyword: 'x', withTest: true }))).not.toContain('is_test');
  });

  it('marks test listings and businesses for their pages, and hides a test seller page', async () => {
    const test = await account('country');
    const real = await account(null);
    const l = await makeListing(owner, test.id);
    expect((await publicListing(appDb, l.publicToken))?.testOwner).toBe(true);
    expect((await publicListing(appDb, (await makeListing(owner, real.id)).publicToken))?.testOwner).toBe(false);
    const org = await makeOrganization(owner, test.id);
    expect((await businessBySlug(appDb, org.slug))?.testOwner).toBe(true);
    expect(await sellerProfile(appDb, test.publicToken)).toBeNull();
    expect((await sellerProfile(appDb, test.publicToken, { withTest: true }))?.listings.map((x) => x.id)).toContain(l.id);
    expect(await sellerProfile(appDb, real.publicToken)).not.toBeNull();
  });
});

describe('events', () => {
  let closeAgain: () => Promise<void>;
  beforeAll(async () => {
    closeAgain = await openEverywhereForTests();
  });
  afterAll(async () => {
    await closeAgain();
  });

  it('leaves test accounts’ events out of the lists unless asked', async () => {
    const test = await account('country');
    const d = await createEventDraft(appDb, { userId: test.id, categoryId: (await categoryBySlug('event-concerts')).id });
    if (!d.ok) throw new Error(d.reason);
    const now = new Date();
    const day = new Date(now.getTime() + 10 * DAY).toISOString().slice(0, 10);
    const r = await saveEvent(appDb, {
      userId: test.id,
      listingId: d.listingId,
      input: listingInputSchema.parse({ title: 'شب شعر آزمایشی', description: 'یک شب شعرخوانی برای آزمایش سایت، با چای و موسیقی.', priceType: 'free', countryCode: 'DE', place: '12043' }),
      event: eventInputSchema.parse({ startDate: day, startTime: '19:00', endTime: '22:00', venueName: `Saal ${publicToken()}`, streetAddress: 'Karl-Marx-Straße 141', languages: ['fa'] }),
      intent: 'publish',
      now,
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const ids = async (withTest?: boolean) => (await upcomingEvents(appDb, { countryCode: 'DE', from: now, to: null, withTest, sellerId: test.id }, now)).items.map((e) => e.id);
    expect(await ids()).toEqual([]);
    expect(await ids(true)).toEqual([d.listingId]);
  });
});

describe('chat', () => {
  it('test accounts and real people never meet; staff and other test accounts may', async () => {
    const test = await account('country');
    const other = await account('personal');
    const real = await account(null);
    const staff = await account(null, { staffRole: 'admin' });
    expect(await mixesTestAndReal(appDb, test.id, real.id)).toBe(true);
    expect(await mixesTestAndReal(appDb, real.id, test.id)).toBe(true);
    expect(await mixesTestAndReal(appDb, test.id, other.id)).toBe(false);
    expect(await mixesTestAndReal(appDb, test.id, staff.id)).toBe(false);
    expect(await mixesTestAndReal(appDb, real.id, staff.id)).toBe(false);

    const testListing = await makeListing(owner, test.id);
    const realListing = await makeListing(owner, real.id);
    const send = (userId: string, token: string) => sendMessage(appDb, redis, { userId, target: { listingToken: token }, body: 'سلام، هنوز هست؟' });
    expect(await send(real.id, testListing.publicToken)).toEqual({ ok: false, reason: 'not_found' });
    expect(await send(test.id, realListing.publicToken)).toEqual({ ok: false, reason: 'not_found' });
    expect((await send(other.id, testListing.publicToken)).ok).toBe(true);
    expect((await send(staff.id, testListing.publicToken)).ok).toBe(true);
  });
});

describe('forwarding to the owner', () => {
  it('sends a per-country test account’s mail to the inbox account, marked with its name', async () => {
    const inbox = await account(null, { telegramUserId: 9_100_000_000 + Math.floor(Math.random() * 1e6) });
    const name = 'آزمایشی · اتریش';
    const test = await account('country', { displayName: name, displayNameNormalized: normalizePersian(name), telegramUserId: -(5000 + Math.floor(Math.random() * 1e6)) });
    const personal = await account('personal');
    const route = testInbox(workerDb, inbox.email);
    const mail = (to: string): Mail => ({ to, subject: 'آگهی شما منتشر شد', text: 't', html: 'h' });

    expect(await route.mail(mail(test.email))).toMatchObject({ to: inbox.email, subject: `[${name}] آگهی شما منتشر شد` });
    expect(await route.mail(mail(personal.email))).toMatchObject({ to: personal.email, subject: 'آگهی شما منتشر شد' });
    expect(await testInbox(workerDb, undefined).mail(mail(test.email))).toBeNull();

    const tg = async (id: string) => (await db.select({ tg: schema.users.telegramUserId }).from(schema.users).where(eq(schema.users.id, id)))[0]!.tg!;
    expect(await route.chat(await tg(test.id), 'پیام تازه')).toEqual({ chatId: await tg(inbox.id), text: `[${name}]\nپیام تازه` });
    expect(await route.chat(123, 'x')).toEqual({ chatId: 123, text: 'x' });
  });
});

describe('phone numbers', () => {
  it('a real person verifying a test account’s made-up number gets it; the test account loses it', async () => {
    const phone = `+49151${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const test = await account('country', { phoneE164: phone, phoneVerifiedAt: new Date(), phoneVerificationMethod: 'telegram' });
    const real = await account(null, { phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null });
    const tg = 8_100_000_000 + Math.floor(Math.random() * 1e6);
    const { token } = await startTelegramVerification(appDb, { userId: real.id, ip: null });
    await bindTelegramLink(workerDb, { token, telegramUserId: tg });
    expect(await acceptTelegramContact(workerDb, { fromId: tg, contactUserId: tg, phoneE164: phone })).toEqual({ ok: true, phoneE164: phone });
    const [t] = await db.select({ phone: schema.users.phoneE164 }).from(schema.users).where(eq(schema.users.id, test.id));
    expect(t!.phone).toBeNull();
  });

  it('a real person’s number stays theirs', async () => {
    const phone = `+49151${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    await account(null, { phoneE164: phone, phoneVerifiedAt: new Date(), phoneVerificationMethod: 'telegram' });
    const other = await account(null, { phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null });
    const tg = 8_200_000_000 + Math.floor(Math.random() * 1e6);
    const { token } = await startTelegramVerification(appDb, { userId: other.id, ip: null });
    await bindTelegramLink(workerDb, { token, telegramUserId: tg });
    expect(await acceptTelegramContact(workerDb, { fromId: tg, contactUserId: tg, phoneE164: phone })).toMatchObject({ ok: false, reason: 'phone_in_use' });
  });
});
