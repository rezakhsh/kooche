import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { grantWaitlistRewards, sendRewardNotices, usableRewards, useReward } from '../src/modules/launch/rewards';
import { changeCityLaunch, openCountry } from '../src/modules/launch/waitlist';
import { applyDueRewards } from '../src/modules/payments/bumps';
import type { Mail } from '../src/modules/notifications/mailer';
import { db, expectError, INSUFFICIENT_PRIVILEGE, location, makeListing, makeUser, rollback, setRole, type Tx } from './db';

// The waitlist reward (wave 2 part 9): the first confirmed signups of a city that opens get one
// free bump, from day 3 to day 60, for the account with that email; one email on day 3; used on a
// listing, the bump job applies it.

const DAY = 86_400_000;
let n = 0;

async function signup(tx: Tx, citySlug: string, opts: { email?: string; confirmedAt?: Date | null } = {}) {
  const city = await location(tx, citySlug);
  const email = opts.email ?? `wait-${randomUUID().slice(0, 8)}-${n++}@example.test`;
  await tx.insert(schema.cityWaitlist).values({
    locationId: city.id,
    email,
    role: 'private',
    confirmTokenHash: Buffer.from(randomUUID().replace(/-/g, ''), 'hex'),
    confirmedAt: opts.confirmedAt === undefined ? new Date(Date.now() - (1000 - n) * 60_000) : opts.confirmedAt,
    leaveToken: randomUUID().replace(/-/g, ''),
  });
  return email;
}

async function staff(tx: Tx): Promise<StaffContext> {
  const u = await makeUser(tx, { staffRole: 'admin' });
  return { userId: u.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}

/** Inside the rolled-back transaction: these cities' waitlists start empty (other tests sign up too) */
async function emptyWaitlists(tx: Tx, ...slugs: string[]) {
  await tx.execute(sql`DELETE FROM city_waitlist WHERE location_id IN (SELECT id FROM locations WHERE kind = 'city' AND slug IN (${sql.join(slugs.map((x) => sql`${x}`), sql`, `)}))`);
}

const rewardsOf = (tx: Tx, citySlug: string) =>
  tx.execute<{ email: string; available_from: Date; ends_at: Date }>(sql`
    SELECT w.email, r.available_from, r.ends_at FROM waitlist_rewards r JOIN city_waitlist w ON w.id = r.waitlist_id
    JOIN locations c ON c.id = r.location_id WHERE c.slug = ${citySlug} AND c.kind = 'city' ORDER BY w.confirmed_at`);

describe('giving the reward', () => {
  it('the first confirmed signups of the city and those launching with it, one per email, when it opens', async () => {
    await rollback(async (tx) => {
      await emptyWaitlists(tx, 'koeln', 'bonn');
      const ctx = await staff(tx);
      const cologne = await location(tx, 'koeln');
      // Cologne has over a million people: 200 places. Bonn's signups count with Cologne's.
      const first = await signup(tx, 'koeln');
      const both = await signup(tx, 'koeln');
      await signup(tx, 'bonn', { email: both });
      const bonn = await signup(tx, 'bonn');
      await signup(tx, 'koeln', { confirmedAt: null });
      await setRole(tx, 'classifieds_app');
      expect(await changeCityLaunch(tx, ctx, cologne.id, { kind: 'open' })).not.toBeNull();
      const rows = await rewardsOf(tx, 'koeln');
      expect(rows.map((r) => r.email)).toEqual([first, both, bonn]);
      const opened = Date.now();
      expect(new Date(rows[0]!.available_from).getTime()).toBeGreaterThan(opened + 3 * DAY - 120_000);
      expect(new Date(rows[0]!.ends_at).getTime()).toBeGreaterThan(opened + 60 * DAY - 120_000);
      // Opening again gives nobody a second one
      expect(await grantWaitlistRewards(tx, [cologne.id])).toBe(0);
    });
  });

  it('only as many as the city’s places, in confirmation order', async () => {
    await rollback(async (tx) => {
      await emptyWaitlists(tx, 'hamburg');
      const hamburg = await location(tx, 'hamburg');
      await tx.update(schema.locations).set({ population: 120_000 }).where(eq(schema.locations.id, hamburg.id));
      const emails: string[] = [];
      for (let i = 0; i < 52; i++) emails.push(await signup(tx, 'hamburg'));
      expect(await grantWaitlistRewards(tx, [hamburg.id])).toBe(50);
      expect((await rewardsOf(tx, 'hamburg')).map((r) => r.email)).toEqual(emails.slice(0, 50));
    });
  });

  it('opening the whole country rewards each city group that wasn’t open', async () => {
    await rollback(async (tx) => {
      await tx.execute(sql`DELETE FROM city_waitlist WHERE location_id IN (SELECT id FROM locations WHERE country_code = 'AT')`);
      const ctx = await staff(tx);
      const wien = await signup(tx, 'wien');
      expect(await openCountry(tx, ctx, 'AT')).toBeGreaterThan(0);
      expect((await rewardsOf(tx, 'wien')).map((r) => r.email)).toEqual([wien]);
    });
  });
});

describe('using the reward', () => {
  it('from day 3 to day 60, by the account with that verified email, on its own live listing', async () => {
    await rollback(async (tx) => {
      const hamburg = await location(tx, 'hamburg');
      const email = await signup(tx, 'hamburg');
      const opened = new Date();
      await grantWaitlistRewards(tx, [hamburg.id], opened);
      const u = await makeUser(tx, { email, emailVerified: true });
      const other = await makeUser(tx, { emailVerified: true });
      const own = await makeListing(tx, u.id);
      const theirs = await makeListing(tx, other.id);
      const day = (d: number) => new Date(opened.getTime() + d * DAY);
      expect(await usableRewards(tx, u.id, day(2))).toEqual([]);
      expect((await usableRewards(tx, u.id, day(3.01))).map((r) => r.cityFa)).toEqual(['هامبورگ']);
      expect(await usableRewards(tx, u.id, day(61))).toEqual([]);
      expect(await usableRewards(tx, other.id, day(5))).toEqual([]);

      await setRole(tx, 'classifieds_app');
      expect(await useReward(tx, { userId: u.id, listingId: theirs.id, now: day(5) })).toEqual({ ok: false, reason: 'not_allowed' });
      expect(await useReward(tx, { userId: u.id, listingId: own.id, now: day(5) })).toEqual({ ok: true });
      expect(await useReward(tx, { userId: u.id, listingId: own.id, now: day(5) })).toEqual({ ok: false, reason: 'none' });
      // The app can't mark it applied: that's the bump job's
      await expectError(tx.execute(sql`UPDATE waitlist_rewards SET applied_at = now()`), INSUFFICIENT_PRIVILEGE);
    });
  });

  it('an unverified email gets nothing', async () => {
    await rollback(async (tx) => {
      const hamburg = await location(tx, 'hamburg');
      const email = await signup(tx, 'hamburg');
      await grantWaitlistRewards(tx, [hamburg.id], new Date(Date.now() - 4 * DAY));
      const u = await makeUser(tx, { email, emailVerified: false });
      expect(await usableRewards(tx, u.id)).toEqual([]);
    });
  });

  it('the bump job moves the listing up, and frees a reward whose listing closed', async () => {
    await rollback(async (tx) => {
      const hamburg = await location(tx, 'hamburg');
      const [a, b] = [await signup(tx, 'hamburg'), await signup(tx, 'hamburg')];
      await grantWaitlistRewards(tx, [hamburg.id], new Date(Date.now() - 4 * DAY));
      const ua = await makeUser(tx, { email: a, emailVerified: true });
      const ub = await makeUser(tx, { email: b, emailVerified: true });
      const old = new Date(Date.now() - 10 * DAY);
      const la = await makeListing(tx, ua.id, { rankedAt: old });
      const lb = await makeListing(tx, ub.id, { rankedAt: old });
      expect(await useReward(tx, { userId: ua.id, listingId: la.id })).toEqual({ ok: true });
      expect(await useReward(tx, { userId: ub.id, listingId: lb.id })).toEqual({ ok: true });
      await tx.update(schema.listings).set({ status: 'sold' }).where(eq(schema.listings.id, lb.id));
      await setRole(tx, 'classifieds_worker');
      const now = new Date();
      expect(await applyDueRewards(tx, now)).toEqual({ applied: 1, revoked: 1 });
      const [moved] = await tx.select({ rankedAt: schema.listings.rankedAt }).from(schema.listings).where(eq(schema.listings.id, la.id));
      expect(moved!.rankedAt!.getTime()).toBe(now.getTime());
      const [history] = await tx.select().from(schema.listingEvents).where(and(eq(schema.listingEvents.listingId, la.id), eq(schema.listingEvents.eventType, 'bumped')));
      expect(history).toBeTruthy();
      // b can use it again on another listing
      expect((await usableRewards(tx, ub.id)).length).toBe(1);
      expect(await applyDueRewards(tx, now)).toEqual({ applied: 0, revoked: 0 });
    });
  });
});

describe('the "ready" email', () => {
  it('goes once, from day 3, at 9:00 on the city’s clock, to the address that signed up', async () => {
    await rollback(async (tx) => {
      const hamburg = await location(tx, 'hamburg');
      const email = await signup(tx, 'hamburg');
      // Opened Monday Nov 5, 2029, 12:00 Berlin; day 3 is Thursday the 8th; 9:00 Berlin is 08:00 UTC
      await grantWaitlistRewards(tx, [hamburg.id], new Date('2029-11-05T11:00:00Z'));
      await setRole(tx, 'classifieds_worker');
      const sent: Mail[] = [];
      const mail = async (m: Mail) => void sent.push(m);
      const mine = () => sent.filter((m) => m.to === email);
      await sendRewardNotices(tx, mail, 'https://app.example.test', new Date('2029-11-07T08:00:00Z'));
      expect(mine()).toHaveLength(0);
      await sendRewardNotices(tx, mail, 'https://app.example.test', new Date('2029-11-08T12:00:00Z'));
      expect(mine()).toHaveLength(0);
      await sendRewardNotices(tx, mail, 'https://app.example.test', new Date('2029-11-09T08:00:00Z'));
      expect(mine()).toHaveLength(1);
      expect(mine()[0]!.text).toContain('هامبورگ');
      expect(mine()[0]!.text).toContain('https://app.example.test/my/listings');
      await sendRewardNotices(tx, mail, 'https://app.example.test', new Date('2029-11-10T08:00:00Z'));
      expect(mine()).toHaveLength(1);
    });
  });
});
