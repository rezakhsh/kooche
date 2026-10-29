import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { setCountryMode, type CountryMode } from '../src/modules/launch/countries';
import {
  countryByCode,
  countryBySlug,
  isPlanned,
  isStarter,
  openingDrafts,
  preparingCountries,
  soonCountries,
  STARTER_WEEKS,
  starterUntil,
} from '../src/modules/launch/country-page';
import { openCountry } from '../src/modules/launch/waitlist';
import { createDraft } from '../src/modules/listings/listings';
import { newestVerifiedBusinesses } from '../src/modules/organizations/queries';
import { appDb } from './accounts';
import { db, publicToken } from './db';
import { categoryBySlug, user } from './listings-fixtures';

// A country's own first pages (wave 2 part 8): «پیدو به‌زودی» for planned countries that aren't
// open, the chooser's «به‌زودی» list, the starter weeks after opening, and drafts in prestart.

const WEEK = 7 * 86_400_000;

async function staff(): Promise<StaffContext> {
  const [u] = await db.insert(schema.users).values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'مدیر', displayNameNormalized: 'مدیر', staffRole: 'admin' }).returning();
  return { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}

/** Puts a country back after each test (the database is shared by the test files, one after another) */
const restore: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (restore.length) await restore.pop()!();
});
async function keep(code: string) {
  const [before] = await db.select().from(schema.countries).where(eq(schema.countries.code, code));
  restore.push(async () => {
    await db.update(schema.countries).set({ mode: before!.mode, isActive: before!.isActive, opensOn: before!.opensOn, openedAt: before!.openedAt }).where(eq(schema.countries.code, code));
  });
}
async function withMode(code: string, mode: CountryMode, over: { opensOn?: string | null; openedAt?: Date | null } = {}) {
  await keep(code);
  await db.update(schema.countries).set({ mode, isActive: mode === 'open', opensOn: over.opensOn ?? null, openedAt: over.openedAt ?? null }).where(eq(schema.countries.code, code));
}

describe('which countries have a «به‌زودی» page', () => {
  it('a waitlist country with a city on its waitlist, prestart and guide do; one with no city planned and hidden ones don’t', async () => {
    const at = (await countryBySlug(db, 'austria'))!;
    expect(at).toMatchObject({ code: 'AT', mode: 'waitlist', currency: { code: 'EUR' } });
    expect(await isPlanned(db, at)).toBe(true);
    // Belgium: no city seeded, nothing promised
    const be = (await countryBySlug(db, 'belgium'))!;
    expect(await isPlanned(db, be)).toBe(false);
    expect(await isPlanned(db, { code: 'BE', mode: 'prestart' })).toBe(true);
    expect(await isPlanned(db, { code: 'TR', mode: 'guide' })).toBe(true);
    expect(await isPlanned(db, { code: 'DE', mode: 'open' })).toBe(false);
    await withMode('AT', 'hidden');
    expect(await countryBySlug(db, 'austria')).toBeNull();
    expect(await countryByCode(db, 'AT')).toBeNull();
  });

  it('the chooser lists them: announced days first, then the largest goals; never Belgium or a hidden one', async () => {
    await withMode('SE', 'prestart', { opensOn: '2027-04-01' });
    await withMode('NL', 'hidden');
    const soon = await soonCountries(db);
    expect(soon[0]).toMatchObject({ code: 'SE', mode: 'prestart', opensOn: '2027-04-01', city: null });
    const codes = soon.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['AT', 'CA', 'US', 'TR']));
    expect(codes).not.toContain('BE');
    expect(codes).not.toContain('NL');
    expect(codes).not.toContain('DE');
    expect(soon.find((c) => c.code === 'AT')).toMatchObject({ city: { slug: 'wien' }, goal: 15 });
    const goals = soon.filter((c) => !c.opensOn).map((c) => c.goal ?? 0);
    expect(goals).toEqual([...goals].sort((a, b) => b - a));
  });
});

describe('the starter weeks', () => {
  it('last 8 weeks from the day the owner opens a country; Germany, open from the start, has none', () => {
    const now = new Date('2027-01-20T12:00:00Z');
    expect(STARTER_WEEKS).toBe(8);
    expect(isStarter({ mode: 'open', openedAt: new Date(now.getTime() - WEEK) }, now)).toBe(true);
    expect(isStarter({ mode: 'open', openedAt: new Date(now.getTime() - 8 * WEEK - 1) }, now)).toBe(false);
    expect(isStarter({ mode: 'open', openedAt: null }, now)).toBe(false);
    expect(isStarter({ mode: 'prestart', openedAt: new Date(now.getTime() - WEEK) }, now)).toBe(false);
    expect(starterUntil(new Date('2027-01-01T00:00:00Z'))).toEqual(new Date('2027-02-26T00:00:00Z'));
  });

  it('opening in admin starts them, saving it open again keeps the day, closing and opening again starts anew', async () => {
    await withMode('SE', 'waitlist');
    const ctx = await staff();
    restore.push(async () => {
      await db.delete(schema.auditLog).where(eq(schema.auditLog.actorUserId, ctx.userId));
    });
    const openedAt = async () => (await db.select({ at: schema.countries.openedAt }).from(schema.countries).where(eq(schema.countries.code, 'SE')))[0]!.at;
    expect(await openedAt()).toBeNull();
    await db.transaction((tx) => setCountryMode(tx, ctx, 'SE', { mode: 'open' }));
    const first = await openedAt();
    expect(first).toBeInstanceOf(Date);
    expect(isStarter((await countryByCode(db, 'SE'))!)).toBe(true);
    await db.update(schema.countries).set({ openedAt: new Date('2026-01-01T00:00:00Z') }).where(eq(schema.countries.code, 'SE'));
    await db.transaction((tx) => openCountry(tx, ctx, 'SE'));
    expect(await openedAt()).toEqual(new Date('2026-01-01T00:00:00Z'));
    await db.transaction((tx) => setCountryMode(tx, ctx, 'SE', { mode: 'waitlist' }));
    await db.transaction((tx) => setCountryMode(tx, ctx, 'SE', { mode: 'open' }));
    expect((await openedAt())!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('opening every city of a waiting country starts them too', async () => {
    await withMode('AU', 'waitlist');
    const before = await db
      .select({ id: schema.locations.id, status: schema.locations.launchStatus, radius: schema.locations.launchRadiusKm, openedAt: schema.locations.openedAt })
      .from(schema.locations)
      .where(and(eq(schema.locations.countryCode, 'AU'), eq(schema.locations.kind, 'city')));
    restore.push(async () => {
      for (const c of before) await db.update(schema.locations).set({ launchStatus: c.status, launchRadiusKm: c.radius, openedAt: c.openedAt }).where(eq(schema.locations.id, c.id));
    });
    const ctx = await staff();
    // Its audit row would look like the newest opening to tests/waitlist.test.ts
    restore.push(async () => {
      await db.delete(schema.auditLog).where(eq(schema.auditLog.actorUserId, ctx.userId));
    });
    await db.transaction((tx) => openCountry(tx, ctx, 'AU'));
    expect(isStarter((await countryByCode(db, 'AU'))!)).toBe(true);
  });
});

describe('preparing to open (prestart)', () => {
  it('open and prestart countries take new listings and businesses, with their mode; waitlist ones don’t', async () => {
    await withMode('AT', 'prestart', { opensOn: '2026-12-21' });
    const list = await preparingCountries(db);
    expect(list.find((c) => c.code === 'AT')).toMatchObject({ slug: 'austria', mode: 'prestart', currency: { code: 'EUR' } });
    expect(list.find((c) => c.code === 'DE')).toMatchObject({ mode: 'open' });
    expect(list.find((c) => c.code === 'NL')).toBeUndefined();
  });

  it('the country page lists someone’s own drafts for the opening day, nobody else’s', async () => {
    await withMode('AT', 'prestart', { opensOn: '2026-12-21' });
    const [me, other] = [await user(), await user()];
    const bikes = await categoryBySlug('bicycles');
    const mine = await createDraft(appDb, { userId: me.id, categoryId: bikes.id });
    const theirs = await createDraft(appDb, { userId: other.id, categoryId: bikes.id });
    if (!mine.ok || !theirs.ok) throw new Error('draft');
    await db.update(schema.listings).set({ countryCode: 'AT', title: 'دوچرخهٔ شهری' }).where(eq(schema.listings.id, mine.listingId));
    await db.update(schema.listings).set({ countryCode: 'AT' }).where(eq(schema.listings.id, theirs.listingId));
    restore.push(async () => {
      await db.delete(schema.listings).where(inArray(schema.listings.id, [mine.listingId, theirs.listingId]));
    });
    expect(await openingDrafts(db, me.id, 'AT')).toEqual([{ id: mine.listingId, title: 'دوچرخهٔ شهری', status: 'draft' }]);
    expect(await openingDrafts(db, me.id, 'DE')).toEqual([]);
  });
});

describe('the starter page’s businesses', () => {
  it('only verified, active ones of the country, newest first; test accounts’ only for staff and test accounts', async () => {
    const owner = await user();
    const [tester] = await db
      .insert(schema.users)
      .values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'آزمایش', displayNameNormalized: 'آزمایش', testAccount: 'country' })
      .returning();
    await withMode('SE', 'open', { openedAt: new Date() });
    const org = (name: string, by: string, verifiedAt: Date | null) => ({
      slug: `t-${randomUUID().slice(0, 8)}`,
      name,
      nameNormalized: name,
      countryCode: 'SE',
      createdByUserId: by,
      status: 'active' as const,
      verificationStatus: verifiedAt ? ('verified' as const) : ('unverified' as const),
      verifiedAt,
    });
    const made = await db.insert(schema.organizations).values([
      org('قدیمی', owner.id, new Date('2026-01-01T00:00:00Z')),
      org('تازه', owner.id, new Date('2026-06-01T00:00:00Z')),
      org('تأییدنشده', owner.id, null),
      org('آزمایشی', tester!.id, new Date('2026-07-01T00:00:00Z')),
    ]).returning({ id: schema.organizations.id });
    restore.push(async () => {
      await db.delete(schema.organizations).where(inArray(schema.organizations.id, made.map((o) => o.id)));
    });
    expect((await newestVerifiedBusinesses(db, 'SE', { limit: 5, withTest: false })).map((b) => b.name)).toEqual(['تازه', 'قدیمی']);
    expect((await newestVerifiedBusinesses(db, 'SE', { limit: 5, withTest: true })).map((b) => b.name)).toEqual(['آزمایشی', 'تازه', 'قدیمی']);
  });
});
