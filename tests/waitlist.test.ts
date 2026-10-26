import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import {
  changeCityLaunch,
  cityLaunch,
  confirmWaitlist,
  deleteUnconfirmedWaitlist,
  exportWaitlist,
  joinWaitlist,
  leaveWaitlist,
  openCountry,
  rewardPlaces,
} from '../src/modules/launch/waitlist';
import { normalizePersian } from '../src/lib/normalize-persian';
import { appDb, workerSql } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, publicToken, rollback, setRole, type Tx } from './db';
import { city, user } from './listings-fixtures';

// City waitlists (round 12, wave 0, step 8): the goal is only the number of verified businesses;
// people sign up with double opt-in and are counted for information; the owner opens a city.

const email = () => `wait-${randomUUID().slice(0, 8)}@example.test`;

async function business(locationSlug: string, verified: boolean, status: 'active' | 'suspended' = 'active') {
  const loc = await city(locationSlug);
  const owner = await user();
  const slug = `b-${publicToken()}`;
  await db.insert(schema.organizations).values({
    createdByUserId: owner.id,
    slug,
    name: 'کسب‌وکار آزمایشی',
    nameNormalized: normalizePersian('کسب‌وکار آزمایشی'),
    countryCode: 'DE',
    locationId: loc.id,
    status,
    verificationStatus: verified ? 'verified' : 'pending',
  });
  return slug;
}

async function confirmed(citySlug: string) {
  const c = await city(citySlug);
  const r = await joinWaitlist(appDb, { cityId: c.id, email: email(), role: 'looking' });
  if (!r.ok || !r.token) throw new Error('join failed');
  await confirmWaitlist(appDb, r.token);
}

const staffCtx = async (tx: Tx): Promise<StaffContext> => {
  const [u] = await tx
    .insert(schema.users)
    .values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'مدیر', displayNameNormalized: 'مدیر' })
    .returning();
  return { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: '203.0.113.9', userAgent: 'test' };
};

describe('a waiting city', () => {
  it('counts only verified, active businesses, and people only once confirmed', async () => {
    const before = (await cityLaunch(appDb, (await city('hamburg')).id))!;
    await business('hamburg', true);
    await business('hamburg', false);
    await business('hamburg', true, 'suspended');
    const hamburg = await city('hamburg');
    await joinWaitlist(appDb, { cityId: hamburg.id, email: email(), role: 'private' }); // never confirmed
    await confirmed('hamburg');
    const after = (await cityLaunch(appDb, hamburg.id))!;
    expect(after).toMatchObject({ status: 'waitlist', goal: 20, groupNames: ['هامبورگ'] });
    expect(after.businesses).toBe(before.businesses + 1);
    expect(after.waiting).toBe(before.waiting + 1);
    expect(after.reward).toEqual({ places: 200, left: 200 - after.waiting });
  });

  it('counts Bonn with Cologne, under Cologne’s goal', async () => {
    const cologne = (await cityLaunch(appDb, (await city('koeln')).id))!;
    await business('bonn', true);
    await confirmed('bonn');
    const bonn = (await cityLaunch(appDb, (await city('bonn')).id))!;
    expect(bonn).toMatchObject({ status: 'waitlist', goal: 25, anchor: { slug: 'koeln' } });
    expect(bonn.groupNames).toEqual(['کلن', 'بن']);
    expect(bonn.businesses).toBe(cologne.businesses + 1);
    expect(bonn.waiting).toBe(cologne.waiting + 1);
  });

  it('lists the country’s key cities, open first', async () => {
    const l = (await cityLaunch(appDb, (await city('muenchen')).id))!;
    expect(l).toMatchObject({ status: 'later', goal: null });
    expect(l.keyCities.map((k) => k.slug)).toEqual(['berlin', 'hamburg', 'koeln', 'frankfurt', 'duesseldorf']);
    expect(l.keyCities[0]!.status).toBe('open');
  });

  it('gives a free bump to the first 200, 100 or 50 by city size', () => {
    expect(rewardPlaces(1_973_896)).toBe(200);
    expect(rewardPlaces(618_685)).toBe(100);
    expect(rewardPlaces(184_754)).toBe(50);
    expect(rewardPlaces(null)).toBe(50);
  });
});

describe('notify me', () => {
  it('needs a confirmed email; a second request replaces the link', async () => {
    const hamburg = await city('hamburg');
    const address = email();
    const first = await joinWaitlist(appDb, { cityId: hamburg.id, email: address.toUpperCase(), role: 'business' });
    const second = await joinWaitlist(appDb, { cityId: hamburg.id, email: address, role: 'private' });
    if (!first.ok || !second.ok) throw new Error('join failed');
    expect(await confirmWaitlist(appDb, first.token!)).toEqual({ ok: false });
    expect(await confirmWaitlist(appDb, second.token!)).toEqual({ ok: true, citySlug: 'hamburg' });
    // Clicking again changes nothing; asking again sends no new email
    expect(await confirmWaitlist(appDb, second.token!)).toEqual({ ok: true, citySlug: 'hamburg' });
    expect(await joinWaitlist(appDb, { cityId: hamburg.id, email: address, role: 'looking' })).toEqual({ ok: true, token: null });
    const [row] = await db.select().from(schema.cityWaitlist).where(and(eq(schema.cityWaitlist.locationId, hamburg.id), eq(schema.cityWaitlist.email, address)));
    expect(row).toMatchObject({ email: address, role: 'private' });
    expect(row!.confirmedAt).toBeInstanceOf(Date);
  });

  it('is only for cities that aren’t open', async () => {
    expect(await joinWaitlist(appDb, { cityId: (await city('berlin')).id, email: email(), role: 'looking' })).toEqual({ ok: false, reason: 'not_waiting' });
  });

  it('refuses junk tokens', async () => {
    expect(await confirmWaitlist(appDb, 'x')).toEqual({ ok: false });
    expect(await confirmWaitlist(appDb, 'a'.repeat(32))).toEqual({ ok: false });
    expect(await leaveWaitlist(appDb, 'nope')).toBe(false);
  });

  it('leaving deletes the signup; the export carries each person’s leave link', async () => {
    const frankfurt = await city('frankfurt');
    const address = email();
    const r = await joinWaitlist(appDb, { cityId: frankfurt.id, email: address, role: 'looking' });
    if (!r.ok) throw new Error('join failed');
    await confirmWaitlist(appDb, r.token!);
    const rows = await exportWaitlist(appDb, frankfurt.id, { appUrl: 'https://app.example.test' });
    const mine = rows.find((x) => x.email === address)!;
    expect(mine.leaveUrl).toMatch(/^https:\/\/app\.example\.test\/waitlist\/leave\?t=[A-Za-z0-9_-]{32}$/);
    expect(mine.leaveUrl).not.toContain(frankfurt.id);
    const token = new URL(mine.leaveUrl).searchParams.get('t')!;
    expect(await leaveWaitlist(appDb, token)).toBe(true);
    expect(await leaveWaitlist(appDb, token)).toBe(false);
    expect((await exportWaitlist(appDb, frankfurt.id, { appUrl: 'https://app.example.test' })).some((x) => x.email === address)).toBe(false);
  });

  it('exports only confirmed signups', async () => {
    const duesseldorf = await city('duesseldorf');
    const pending = email();
    await joinWaitlist(appDb, { cityId: duesseldorf.id, email: pending, role: 'looking' });
    expect((await exportWaitlist(appDb, duesseldorf.id, { appUrl: 'https://x.test' })).some((x) => x.email === pending)).toBe(false);
  });

  it('forgets unconfirmed signups after 30 days (as the worker)', async () => {
    const hamburg = await city('hamburg');
    const old = email();
    const fresh = email();
    await joinWaitlist(appDb, { cityId: hamburg.id, email: old, role: 'looking' });
    await joinWaitlist(appDb, { cityId: hamburg.id, email: fresh, role: 'looking' });
    await db.update(schema.cityWaitlist).set({ createdAt: sql`now() - interval '31 days'` }).where(eq(schema.cityWaitlist.email, old));
    expect(await deleteUnconfirmedWaitlist(workerSql)).toBeGreaterThanOrEqual(1);
    const left = await db.select({ email: schema.cityWaitlist.email }).from(schema.cityWaitlist).where(eq(schema.cityWaitlist.locationId, hamburg.id));
    expect(left.map((r) => r.email)).not.toContain(old);
    expect(left.map((r) => r.email)).toContain(fresh);
  });
});

describe('the owner opens cities (as the web role)', () => {
  it('opens a city with the cities launching with it, and writes audit_log', async () => {
    await rollback(async (tx) => {
      const ctx = await staffCtx(tx);
      await setRole(tx, 'classifieds_app');
      const koeln = await location(tx, 'koeln');
      const r = await changeCityLaunch(tx, ctx, koeln.id, { kind: 'open' });
      expect(r).toEqual({ country: 'germany', slugs: expect.arrayContaining(['koeln', 'bonn']) });
      const rows = await tx.select({ slug: schema.locations.slug, status: schema.locations.launchStatus, openedAt: schema.locations.openedAt }).from(schema.locations).where(sql`${schema.locations.slug} IN ('koeln', 'bonn') AND ${schema.locations.kind} = 'city'`);
      expect(rows.every((x) => x.status === 'open' && x.openedAt)).toBe(true);
      const [audit] = await tx.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'city.launch'), eq(schema.auditLog.targetId, koeln.id)));
      expect(audit!.data).toMatchObject({ change: 'open', before: { status: 'waitlist', goal: 25 }, role: 'admin' });
    });
  });

  it('changes a goal, moves a city to the waitlist or back, and refuses a bad goal', async () => {
    await rollback(async (tx) => {
      const ctx = await staffCtx(tx);
      await setRole(tx, 'classifieds_app');
      const hamburg = await location(tx, 'hamburg');
      const muenchen = await location(tx, 'muenchen');
      expect(await changeCityLaunch(tx, ctx, hamburg.id, { kind: 'goal', goal: 15 })).not.toBeNull();
      expect(await changeCityLaunch(tx, ctx, muenchen.id, { kind: 'waitlist', goal: 15 })).not.toBeNull();
      expect(await changeCityLaunch(tx, ctx, hamburg.id, { kind: 'goal', goal: 0 })).toBeNull();
      expect(await changeCityLaunch(tx, ctx, hamburg.id, { kind: 'goal', goal: 2.5 })).toBeNull();
      const [h] = await tx.select().from(schema.locations).where(eq(schema.locations.id, hamburg.id));
      const [m] = await tx.select().from(schema.locations).where(eq(schema.locations.id, muenchen.id));
      expect(h).toMatchObject({ launchStatus: 'waitlist', businessGoal: 15 });
      expect(m).toMatchObject({ launchStatus: 'waitlist', businessGoal: 15 });
      await changeCityLaunch(tx, ctx, muenchen.id, { kind: 'later' });
      const [m2] = await tx.select().from(schema.locations).where(eq(schema.locations.id, muenchen.id));
      expect(m2!.launchStatus).toBe('later');
    });
  });

  it('opens the whole country, without the Berlin radius', async () => {
    await rollback(async (tx) => {
      const ctx = await staffCtx(tx);
      await setRole(tx, 'classifieds_app');
      expect(await openCountry(tx, ctx, 'DE')).toBeGreaterThan(50);
      const closed = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.locations).where(sql`${schema.locations.countryCode} = 'DE' AND ${schema.locations.kind} = 'city' AND (${schema.locations.launchStatus} <> 'open' OR ${schema.locations.launchRadiusKm} IS NOT NULL)`);
      expect(closed[0]!.n).toBe(0);
      const [audit] = await tx.select().from(schema.auditLog).where(eq(schema.auditLog.action, 'country.open'));
      expect(audit!.data).toMatchObject({ country: 'DE', role: 'admin' });
    });
  });

  it('may change only the launch columns of a city', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      await expectError(tx.update(schema.locations).set({ nameFa: 'x' }).where(eq(schema.locations.slug, 'hamburg')), INSUFFICIENT_PRIVILEGE);
    });
  });
});

async function location(tx: Tx, slug: string) {
  const [l] = await tx.select().from(schema.locations).where(and(eq(schema.locations.slug, slug), eq(schema.locations.kind, 'city')));
  return l!;
}
