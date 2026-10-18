import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { addFavorite, favoriteCounts, FAVORITE_LIMIT, FAVORITES_MAX, myFavorites, removeFavorite, savedAmong } from '../src/modules/listings/favorites';
import { limitKey } from '../src/lib/rate-limit';
import { appDb, redis } from './accounts';
import { db, publicToken } from './db';
import { categoryBySlug, city, user } from './listings-fixtures';

// Favorites (approved Oct 18, 2026): signed-in users only, active listings only and not your own,
// removing only your own, counts only for the seller, and a ♡ tapped while logged out saved once
// after sign-in.

// The server action and the pending cookie run inside Next.js; these stand-ins give them a cookie
// jar, a session, the test database and the test Valkey.
const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
let sessionUserId: string | null = null;
class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => void jar.set(name, { value, options }),
    delete: (o: string | { name: string }) => void jar.delete(typeof o === 'string' ? o : o.name),
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock('../src/db/drizzle', async () => {
  const { appDb: test } = await import('./accounts');
  return { appDb: () => test };
});
vi.mock('../src/lib/valkey', async () => {
  const { redis: test } = await import('./accounts');
  return { valkey: () => test };
});
vi.mock('../src/lib/env', () => ({ webEnv: () => ({ APP_URL: 'https://staging.example.test' }) }));
vi.mock('../src/modules/users/server', () => ({
  currentSession: async () => (sessionUserId ? { user: { id: sessionUserId } } : null),
  safeNext: (v: unknown) => (typeof v === 'string' && /^\/(?![/\\])[^\s]*$/.test(v) ? v : '/'),
}));

type Status = (typeof schema.listings.$inferInsert)['status'];

/** A committed listing of `sellerId` in Berlin */
async function listing(sellerId: string, status: Status = 'active') {
  const [berlin, phones] = await Promise.all([city('berlin'), categoryBySlug('mobile-phones')]);
  const now = new Date();
  const [l] = await db
    .insert(schema.listings)
    .values({
      publicToken: publicToken(),
      userId: sellerId,
      categoryId: phones.id,
      title: 'گوشی برای نشان کردن',
      titleNormalized: normalizePersian('گوشی برای نشان کردن'),
      priceType: 'fixed',
      priceMinor: 10_000,
      currency: 'EUR',
      countryCode: 'DE',
      locationId: berlin.id,
      point: berlin.center,
      locationPrecision: 'city',
      status,
      publishedAt: now,
      rankedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
      deletedAt: status === 'deleted' ? now : null,
    })
    .returning();
  return l!;
}

async function rows(userId: string) {
  return db.select().from(schema.favorites).where(eq(schema.favorites.userId, userId));
}

beforeEach(() => {
  jar.clear();
  sessionUserId = null;
});

describe('favorites', () => {
  it('only active listings, never your own, and saving twice changes nothing', async () => {
    const [seller, buyer] = await Promise.all([user(), user({ verified: false })]); // no verified phone needed
    const active = await listing(seller.id);
    expect(await addFavorite(appDb, redis, buyer.id, active.publicToken)).toEqual({ ok: true, saved: true });
    expect(await addFavorite(appDb, redis, buyer.id, active.publicToken)).toEqual({ ok: true, saved: true });
    expect(await rows(buyer.id)).toHaveLength(1);
    expect(await addFavorite(appDb, redis, seller.id, active.publicToken)).toEqual({ ok: false, reason: 'own' });
    for (const status of ['draft', 'paused', 'sold', 'expired', 'rejected', 'deleted'] as const) {
      const other = await listing(seller.id, status === 'draft' ? 'draft' : status);
      expect(await addFavorite(appDb, redis, buyer.id, other.publicToken), status).toEqual({ ok: false, reason: 'not_found' });
    }
    expect(await addFavorite(appDb, redis, buyer.id, 'not-a-token')).toEqual({ ok: false, reason: 'not_found' });
    expect(await addFavorite(appDb, redis, buyer.id, "x' OR 1=1")).toEqual({ ok: false, reason: 'not_found' });
    expect(await rows(buyer.id)).toHaveLength(1);
  });

  it('removes only your own favorite, also of a listing that went away', async () => {
    const [seller, a, b] = await Promise.all([user(), user(), user()]);
    const l = await listing(seller.id);
    await addFavorite(appDb, redis, a.id, l.publicToken);
    await addFavorite(appDb, redis, b.id, l.publicToken);
    await db.update(schema.listings).set({ status: 'sold' }).where(eq(schema.listings.id, l.id));
    expect(await removeFavorite(appDb, b.id, l.publicToken)).toEqual({ ok: true, saved: false });
    expect(await rows(b.id)).toHaveLength(0);
    expect(await rows(a.id)).toHaveLength(1); // b could not touch a's
  });

  it('at most 1,000 per account, and 60 saves a minute', async () => {
    const [seller, buyer] = await Promise.all([user(), user()]);
    const many = await db
      .insert(schema.listings)
      .values(
        Array.from({ length: FAVORITES_MAX }, () => ({
          publicToken: publicToken(),
          userId: seller.id,
          title: 'پیش‌نویس',
          titleNormalized: 'پیش‌نویس',
        })),
      )
      .returning({ id: schema.listings.id });
    await db.insert(schema.favorites).values(many.map((m) => ({ userId: buyer.id, listingId: m.id })));
    const one = await listing(seller.id);
    expect(await addFavorite(appDb, redis, buyer.id, one.publicToken)).toEqual({ ok: false, reason: 'limit' });

    const other = await user();
    await redis.del(limitKey(FAVORITE_LIMIT, other.id));
    for (let i = 0; i < FAVORITE_LIMIT.max; i++) await addFavorite(appDb, redis, other.id, one.publicToken);
    expect(await addFavorite(appDb, redis, other.id, one.publicToken)).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('the seller sees how many saved each listing; asking for other listings gives nothing', async () => {
    const [seller, rival, a, b] = await Promise.all([user(), user(), user(), user()]);
    const mine = await listing(seller.id);
    const theirs = await listing(rival.id);
    for (const u of [a, b]) {
      await addFavorite(appDb, redis, u.id, mine.publicToken);
      await addFavorite(appDb, redis, u.id, theirs.publicToken);
    }
    expect(await favoriteCounts(appDb, seller.id, [mine.id, theirs.id])).toEqual(new Map([[mine.id, 2]]));
    expect(await favoriteCounts(appDb, a.id, [mine.id, theirs.id])).toEqual(new Map());
    // The filled hearts: only what this user saved
    expect(await savedAmong(appDb, a.id, [mine.id, theirs.id])).toEqual(new Set([mine.id, theirs.id]));
    expect(await savedAmong(appDb, seller.id, [mine.id, theirs.id])).toEqual(new Set());
  });

  it('"my favorites": newest first, page by page, listings that went away marked', async () => {
    const [seller, buyer] = await Promise.all([user(), user()]);
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      const l = await listing(seller.id);
      await addFavorite(appDb, redis, buyer.id, l.publicToken);
      ids.push(l.id);
    }
    // Saved at the same moment: the id breaks the tie
    await db.execute(sql`UPDATE favorites SET created_at = '2026-10-18T10:00:00.123456Z' WHERE user_id = ${buyer.id}`);
    await db.update(schema.listings).set({ status: 'sold' }).where(eq(schema.listings.id, ids[0]!));
    await db.update(schema.listings).set({ status: 'deleted', deletedAt: new Date() }).where(eq(schema.listings.id, ids[1]!));

    const first = await myFavorites(appDb, buyer.id, null);
    expect(first.items).toHaveLength(24);
    const second = await myFavorites(appDb, buyer.id, first.next);
    expect(second.next).toBeNull();
    const seen = [...first.items, ...second.items];
    expect(new Set(seen.map((x) => x.id))).toEqual(new Set(ids));
    expect(seen).toHaveLength(30);
    const sold = seen.find((x) => x.id === ids[0])!;
    const gone = seen.find((x) => x.id === ids[1])!;
    expect(sold).toMatchObject({ available: false, linkable: true });
    expect(gone).toMatchObject({ available: false, linkable: false, coverKey: null });
    expect(seen.filter((x) => x.available)).toHaveLength(28);
    // Someone else's list is empty
    expect((await myFavorites(appDb, seller.id, null)).items).toEqual([]);
  });
});

describe('the ♡ while logged out', () => {
  it('remembers the listing in an HTTP-only cookie and goes to sign-in, then sign-in saves it once', async () => {
    const { favoriteAction } = await import('../src/app/favorites/actions');
    const { savePendingFavorite, PENDING_FAVORITE_COOKIE } = await import('../src/app/favorites/pending');
    const [seller, buyer] = await Promise.all([user(), user()]);
    const l = await listing(seller.id);
    const form = new FormData();
    form.set('token', l.publicToken);
    form.set('back', '/germany/berlin?view=list');

    await expect(favoriteAction({ saved: false }, form)).rejects.toMatchObject({ url: `/login?next=${encodeURIComponent('/germany/berlin?view=list')}` });
    const cookie = jar.get(PENDING_FAVORITE_COOKIE)!;
    expect(cookie.value).toBe(l.publicToken);
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 1800 });
    expect(await rows(buyer.id)).toHaveLength(0); // nothing saved before sign-in

    await savePendingFavorite(buyer.id);
    expect(await rows(buyer.id)).toHaveLength(1);
    expect(jar.has(PENDING_FAVORITE_COOKIE)).toBe(false);
    await savePendingFavorite(buyer.id); // once only
    expect(await rows(buyer.id)).toHaveLength(1);
  });

  it('a forged back address goes home, a bad token is never stored, and your own listing is not saved', async () => {
    const { favoriteAction } = await import('../src/app/favorites/actions');
    const { savePendingFavorite, PENDING_FAVORITE_COOKIE } = await import('../src/app/favorites/pending');
    const form = new FormData();
    form.set('token', "nope' --");
    form.set('back', '//evil.example/');
    await expect(favoriteAction({ saved: false }, form)).rejects.toMatchObject({ url: `/login?next=${encodeURIComponent('/')}` });
    expect(jar.has(PENDING_FAVORITE_COOKIE)).toBe(false);

    const seller = await user();
    const l = await listing(seller.id);
    jar.set(PENDING_FAVORITE_COOKIE, { value: l.publicToken });
    await savePendingFavorite(seller.id);
    expect(await rows(seller.id)).toHaveLength(0);
    expect(jar.has(PENDING_FAVORITE_COOKIE)).toBe(false);
  });

  it('signed in, the action saves and removes', async () => {
    const { favoriteAction } = await import('../src/app/favorites/actions');
    const [seller, buyer] = await Promise.all([user(), user()]);
    const l = await listing(seller.id);
    sessionUserId = buyer.id;
    const form = new FormData();
    form.set('token', l.publicToken);
    form.set('back', '/germany');
    expect(await favoriteAction({ saved: false }, form)).toEqual({ saved: true });
    form.set('intent', 'remove');
    expect(await favoriteAction({ saved: true }, form)).toEqual({ saved: false });
    expect(await rows(buyer.id)).toHaveLength(0);
    sessionUserId = seller.id;
    form.set('intent', 'add');
    expect(await favoriteAction({ saved: false }, form)).toMatchObject({ saved: false, error: expect.any(String) });
  });

  it('erasing an account removes its favorites', async () => {
    const [seller, buyer] = await Promise.all([user(), user()]);
    const l = await listing(seller.id);
    await addFavorite(appDb, redis, buyer.id, l.publicToken);
    await db.execute(sql`SELECT erase_user(${buyer.id}::uuid)`);
    expect(await db.select().from(schema.favorites).where(and(eq(schema.favorites.userId, buyer.id)))).toHaveLength(0);
  });
});
