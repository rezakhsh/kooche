import { and, eq, sql } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { limitKey } from '../src/lib/rate-limit';
import { sendMessage } from '../src/modules/chat/conversations';
import { blockUser } from '../src/modules/users/blocks';
import { eraseRequestedUser, emailMatches, ERASE_REQUESTED, requestErasure } from '../src/modules/users/erasure';
import { exportUserData } from '../src/modules/users/export';
import { EXPORT_LIMIT, sameOrigin } from '../src/modules/users/export-request';
import { checkDisplayName, RENAME_LIMIT, sellerProfile, setDisplayName } from '../src/modules/users/profile';
import { addFavorite } from '../src/modules/listings/favorites';
import { startAccountJobs } from '../src/worker/accounts';
import { appDb, redis, workerDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, makeListing, makeOrganization, rollback, setRole, type Tx } from './db';
import { categoryBySlug, city, user } from './listings-fixtures';

// Your name, the public seller page, "download my data" and "delete my account" (approved
// Oct 21, 2026). The functions take the user id from the session, so these tests call them with
// one user's id and check that nothing of anyone else is read or changed.

const DAY = 86_400_000;
const owner = db as unknown as Tx;

async function aged(u: { id: string }) {
  await db.update(schema.users).set({ createdAt: new Date(Date.now() - 30 * DAY) }).where(eq(schema.users.id, u.id));
}

async function row(id: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return u!;
}

/** An active event of `userId` with one date, ending `endsInDays` from now (negative: over) */
async function event(userId: string, endsInDays = 10) {
  const [berlin, type] = await Promise.all([city('berlin'), categoryBySlug('event-concerts')]);
  const l = await makeListing(owner, userId, { categoryId: type.id, title: 'کنسرت آزمایشی', priceType: 'free', priceMinor: null, currency: null });
  await db.insert(schema.eventDetails).values({ listingId: l.id, timeZone: 'Europe/Berlin', venueName: 'سالن', venueNameNormalized: normalizePersian('سالن') });
  const ends = new Date(Date.now() + endsInDays * DAY);
  await db.insert(schema.eventDates).values({ listingId: l.id, countryCode: 'DE', locationId: berlin.id, startsAt: new Date(ends.getTime() - 3_600_000), endsAt: ends });
  return l;
}

describe('display name', () => {
  it('checks length and refuses names that pose as the site or its staff', () => {
    expect(checkDisplayName('  رضا   کریمی ')).toEqual({ ok: true, name: 'رضا کریمی' });
    expect(checkDisplayName('')).toEqual({ ok: false, error: 'required' });
    expect(checkDisplayName('ر')).toEqual({ ok: false, error: 'too_short' });
    expect(checkDisplayName('ر'.repeat(51))).toEqual({ ok: false, error: 'too_long' });
    for (const name of ['پشتیبانی پیدو', 'پشتیبـانی', 'مدیر سایت', 'مدیر‌سایت', 'Peydoo Team', 'ADMIN', 'Support 24', 'کاربر حذف‌شده']) {
      expect(checkDisplayName(name), name).toEqual({ ok: false, error: 'reserved' });
    }
    // An ordinary name that merely contains a common word is fine
    expect(checkDisplayName('مدیر فروش رضا').ok).toBe(true);
  });

  it('changes only the signed-in user’s own row, with the normalized form', async () => {
    const [me, other] = await Promise.all([user({ name: 'کاربر' }), user({ name: 'دیگری' })]);
    const r = await setDisplayName(appDb, redis, me.id, 'علي ۱۲');
    expect(r).toEqual({ ok: true, name: 'علي ۱۲' });
    const mine = await row(me.id);
    expect(mine.displayName).toBe('علي ۱۲');
    expect(mine.displayNameNormalized).toBe('علی 12');
    expect((await row(other.id)).displayName).toBe('دیگری');
  });

  it('a refused name changes nothing; ten changes a day', async () => {
    const me = await user({ name: 'نام اول' });
    expect(await setDisplayName(appDb, redis, me.id, 'admin')).toEqual({ ok: false, error: 'reserved' });
    expect((await row(me.id)).displayName).toBe('نام اول');
    await redis.set(limitKey(RENAME_LIMIT, me.id), String(RENAME_LIMIT.max), 'EX', 60);
    expect(await setDisplayName(appDb, redis, me.id, 'نام دوم')).toEqual({ ok: false, error: 'rate_limited' });
    expect((await row(me.id)).displayName).toBe('نام اول');
  });
});

describe('seller page', () => {
  it('shows only active listings of the seller, newest first, and upcoming events apart', async () => {
    const seller = await user({ name: 'فروشنده صفحه' });
    const other = await user();
    const active = await makeListing(owner, seller.id, { title: 'فعال' });
    for (const status of ['paused', 'sold', 'expired', 'draft', 'rejected', 'pending_review'] as const) {
      await makeListing(owner, seller.id, { status, title: status });
    }
    await makeListing(owner, seller.id, { status: 'deleted', deletedAt: new Date(), title: 'deleted' });
    const org = await makeOrganization(owner, seller.id);
    await makeListing(owner, seller.id, { organizationId: org.id, title: 'کسب‌وکار' });
    await makeListing(owner, other.id, { title: 'مال دیگری' });
    const upcoming = await event(seller.id, 10);
    await event(seller.id, -1);

    const p = await sellerProfile(appDb, seller.publicToken);
    expect(p).not.toBeNull();
    expect(p!.listings.map((l) => l.publicToken)).toEqual([active.publicToken]);
    expect(p!.events.map((e) => e.publicToken)).toEqual([upcoming.publicToken]);
    expect(p!.name).toBe('فروشنده صفحه');
    expect(p!.phoneVerified).toBe(true);
    expect(p!.isOwner).toBe(false);
    expect((await sellerProfile(appDb, seller.publicToken, { viewerId: seller.id }))!.isOwner).toBe(true);
  });

  it('never carries the email, the phone number or the seller’s id', async () => {
    const seller = await user();
    await makeListing(owner, seller.id);
    const p = await sellerProfile(appDb, seller.publicToken);
    const text = JSON.stringify(p);
    expect(text).not.toContain(seller.email);
    expect(text).not.toContain(seller.phoneE164!);
    expect(text).not.toContain(seller.id);
    expect(Object.keys(p!).sort()).toEqual(['events', 'isOwner', 'listings', 'memberSince', 'name', 'next', 'phoneVerified']);
  });

  it('an unverified seller shows as such; unknown, malformed, deactivated and deleted accounts have no page', async () => {
    const plain = await user({ verified: false });
    expect((await sellerProfile(appDb, plain.publicToken))!.phoneVerified).toBe(false);
    expect(await sellerProfile(appDb, '0000000000')).toBeNull();
    expect(await sellerProfile(appDb, "x' OR 1=1")).toBeNull();
    const off = await user();
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, off.id));
    expect(await sellerProfile(appDb, off.publicToken)).toBeNull();
    const gone = await user();
    await db.execute(sql`SELECT erase_user(${gone.id}::uuid)`);
    expect(await sellerProfile(appDb, gone.publicToken)).toBeNull();
  });

  it('pages through the listings with the cursor', async () => {
    const seller = await user();
    const made = [];
    for (let i = 0; i < 26; i++) {
      made.push(await makeListing(owner, seller.id, { rankedAt: new Date(Date.now() - i * 60_000), title: `آگهی ${i}` }));
    }
    const first = await sellerProfile(appDb, seller.publicToken);
    expect(first!.listings).toHaveLength(24);
    expect(first!.next).not.toBeNull();
    const second = await sellerProfile(appDb, seller.publicToken, { after: first!.next });
    expect(second!.listings.map((l) => l.publicToken)).toEqual(made.slice(24).map((l) => l.publicToken));
    expect(second!.next).toBeNull();
    expect(second!.events).toEqual([]);
    // A forged cursor starts from the top again
    expect((await sellerProfile(appDb, seller.publicToken, { after: 'bm9wZQ' }))!.listings).toHaveLength(24);
  });
});

describe('download my data', () => {
  it('holds the user’s own data and nothing private of anyone else', async () => {
    const [me, seller] = await Promise.all([user({ name: 'من' }), user({ name: 'فروشنده' })]);
    await Promise.all([aged(me), aged(seller)]);
    const mine = await makeListing(owner, me.id, { title: 'آگهی خودم' });
    const theirs = await makeListing(owner, seller.id, { title: 'آگهی فروشنده' });
    await addFavorite(appDb, redis, me.id, theirs.publicToken);
    const sent = await sendMessage(appDb, redis, { userId: me.id, target: { listingToken: theirs.publicToken }, body: 'سلام، هنوز هست؟' });
    expect(sent.ok).toBe(true);
    // The seller writes back; after I block them, their next message is withheld from me
    if (sent.ok) await sendMessage(appDb, redis, { userId: seller.id, target: { conversationId: sent.conversationId }, body: 'بله هست' });
    await blockUser(appDb, me.id, seller.id);
    if (sent.ok) await sendMessage(appDb, redis, { userId: seller.id, target: { conversationId: sent.conversationId }, body: 'پیام پنهان' });

    const data = await exportUserData(appDb, me.id, 'https://app.example.test');
    expect(data.account.email).toBe(me.email);
    expect(data.account.phone_e164).toBe(me.phoneE164);
    expect(data.account.public_page).toBe(`https://app.example.test/u/${me.publicToken}`);
    expect(data.listings.map((l) => l.title)).toEqual(['آگهی خودم']);
    expect(data.listings[0]!.url).toContain(mine.publicToken);
    expect(data.favorites.map((f) => f.title)).toEqual(['آگهی فروشنده']);
    expect(data.blocked).toHaveLength(1);
    expect(data.blocked[0]!.display_name).toBe('فروشنده');
    const bodies = data.chats.flatMap((c) => c.messages.map((m) => m.body));
    expect(bodies).toEqual(expect.arrayContaining(['سلام، هنوز هست؟', 'بله هست']));
    expect(bodies).not.toContain('پیام پنهان');

    const text = JSON.stringify(data);
    expect(text).not.toContain(seller.email);
    expect(text).not.toContain(seller.phoneE164!);
  });

  it('accepts only a form from the site itself, three downloads an hour', () => {
    const h = (o?: string) => new Headers(o ? { origin: o } : {});
    expect(sameOrigin(h('https://app.example.test'), 'https://app.example.test')).toBe(true);
    expect(sameOrigin(h('https://evil.example'), 'https://app.example.test')).toBe(false);
    expect(sameOrigin(h('https://app.example.test.evil.example'), 'https://app.example.test')).toBe(false);
    expect(sameOrigin(h(), 'https://app.example.test')).toBe(false);
    expect(sameOrigin(h('null'), 'https://app.example.test')).toBe(false);
    expect(EXPORT_LIMIT.max).toBe(3);
  });
});

describe('delete my account', () => {
  it('needs the account’s own email typed again', async () => {
    const me = await user();
    expect(emailMatches(` ${me.email.toUpperCase()} `, me.email)).toBe(true);
    const other = await user();
    expect(await requestErasure(appDb, me.id, other.email)).toEqual({ ok: false, error: 'email_mismatch' });
    expect((await row(me.id)).status).toBe('active');
  });

  it('deactivates, logs out every device and hands the erasure to the worker', async () => {
    const me = await user();
    const other = await user();
    for (const u of [me, me, other]) {
      await db.insert(schema.sessions).values({ userId: u.id, token: `t-${crypto.randomUUID()}`, expiresAt: new Date(Date.now() + DAY) });
    }
    expect(await requestErasure(appDb, me.id, me.email)).toEqual({ ok: true });
    expect((await row(me.id)).status).toBe('deactivated');
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, me.id))).toHaveLength(0);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, other.id))).toHaveLength(1);
    const events = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.aggregateId, me.id), eq(schema.outboxEvents.eventType, ERASE_REQUESTED)));
    expect(events).toHaveLength(1);
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.actorUserId, me.id), eq(schema.auditLog.action, ERASE_REQUESTED)));
    expect(audit).toHaveLength(1);
    // A second request (another open tab) finds the account no longer active
    expect(await requestErasure(appDb, me.id, me.email)).toEqual({ ok: false, error: 'not_active' });
  });

  it('refuses the only owner of an organization before anything changes', async () => {
    const me = await user();
    await makeOrganization(owner, me.id);
    expect(await requestErasure(appDb, me.id, me.email)).toEqual({ ok: false, error: 'sole_owner' });
    expect((await row(me.id)).status).toBe('active');
  });

  it('the worker erases only accounts that asked, once; the app can’t call erase_user', async () => {
    const me = await user({ name: 'رفتنی' });
    const listing = await makeListing(owner, me.id);
    await requestErasure(appDb, me.id, me.email);
    expect(await eraseRequestedUser(workerDb, me.id)).toBe('erased');
    const gone = await row(me.id);
    expect(gone.status).toBe('deleted');
    expect(gone.email).toBe(`deleted-${me.id}@deleted.invalid`);
    expect(gone.phoneE164).toBeNull();
    const [l] = await db.select().from(schema.listings).where(eq(schema.listings.id, listing.id));
    expect(l!.status).toBe('deleted');
    expect(await sellerProfile(appDb, me.publicToken)).toBeNull();
    // Retried: nothing more happens
    expect(await eraseRequestedUser(workerDb, me.id)).toBe('already_deleted');
    // An active account is never erased by a stray event
    const active = await user();
    expect(await eraseRequestedUser(workerDb, active.id)).toBe('not_requested');
    expect((await row(active.id)).status).toBe('active');

    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      await expectError(tx.execute(sql`SELECT erase_user(${active.id}::uuid)`), INSUFFICIENT_PRIVILEGE);
    });
  });

  it('runs through the accounts queue the outbox hands the event to', async () => {
    const me = await user();
    const prefix = `test-accounts-${Date.now()}`;
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const jobs = await startAccountJobs(workerDb, connection, { prefix });
    try {
      await requestErasure(appDb, me.id, me.email);
      const [ev] = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.aggregateId, me.id), eq(schema.outboxEvents.eventType, ERASE_REQUESTED)));
      // What processOutboxBatch does for this row (src/worker/outbox.ts)
      const [handler] = jobs.handlers[ERASE_REQUESTED]!;
      expect(handler!.name).toBe('erase');
      expect(jobs.handlers['user.erased']).toEqual([]);
      await handler!.queue.add(handler!.name, { outboxId: ev!.id, eventType: ev!.eventType, aggregateId: me.id, payload: {} }, { jobId: `${ev!.id}_${handler!.name}` });
      const deadline = Date.now() + 10_000;
      while ((await row(me.id)).status !== 'deleted' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      expect((await row(me.id)).status).toBe('deleted');
    } finally {
      await jobs.close();
      const q = new Queue('accounts', { connection, prefix });
      await q.obliterate({ force: true });
      await q.close();
      await connection.quit();
    }
  });
});
