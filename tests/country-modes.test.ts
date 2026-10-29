import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { adminCountries, countryMode, setCountryMode, type CountryMode } from '../src/modules/launch/countries';
import { activePauses, liftPause, pauseCategory, pauseFor } from '../src/modules/launch/pauses';
import { openCountry, waitingCountries } from '../src/modules/launch/waitlist';
import { createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { closedCountry } from '../src/modules/listings/queries';
import { createBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { appDb } from './accounts';
import { db, publicToken } from './db';
import { categoryBySlug, city, user } from './listings-fixtures';

// Country modes and emergency pauses (wave 2 part 2): hidden, waitlist, prestart, guide, open;
// drafts in prestart, publishing only when open; a category paused in a country or one city.

const DAY = 86_400_000;

async function staff(): Promise<StaffContext> {
  const [u] = await db.insert(schema.users).values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'مدیر', displayNameNormalized: 'مدیر', staffRole: 'admin' }).returning();
  return { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}

/** Puts a country's mode back after each test (the database is shared by the test files, one after another) */
const restore: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (restore.length) await restore.pop()!();
});
async function withMode(code: string, mode: CountryMode, opensOn: string | null = null) {
  const [before] = await db.select({ mode: schema.countries.mode, opensOn: schema.countries.opensOn }).from(schema.countries).where(eq(schema.countries.code, code));
  await db.update(schema.countries).set({ mode, isActive: mode === 'open', opensOn }).where(eq(schema.countries.code, code));
  restore.push(async () => {
    await db.update(schema.countries).set({ mode: before!.mode, isActive: before!.mode === 'open', opensOn: before!.opensOn }).where(eq(schema.countries.code, code));
  });
}

function input(over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'دوچرخهٔ شهری سالم',
    description: 'دوچرخهٔ شهری با دنده، ترمز نو و چراغ. فقط تحویل حضوری.',
    attributes: { condition: 'like_new' },
    priceType: 'fixed',
    amount: '120',
    countryCode: 'DE',
    place: 'برلین',
    ...over,
  });
}

async function post(intent: 'save' | 'publish', over: Partial<ListingInput> = {}, slug = 'bicycles') {
  const u = await user();
  const draft = await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug(slug)).id });
  if (!draft.ok) throw new Error(draft.reason);
  return saveListing(appDb, { userId: u.id, listingId: draft.listingId, input: input(over), intent });
}

describe('the modes', () => {
  it('start as before: Germany open, Turkey guide, the rest waitlist; is_active follows the mode', async () => {
    expect(await countryMode(db, 'DE')).toBe('open');
    expect(await countryMode(db, 'TR')).toBe('guide');
    expect(await countryMode(db, 'AT')).toBe('waitlist');
    const rows = await db.select({ mode: schema.countries.mode, isActive: schema.countries.isActive }).from(schema.countries);
    for (const r of rows) expect(r.isActive).toBe(r.mode === 'open');
    // The database refuses the two apart
    await expect(db.update(schema.countries).set({ isActive: true }).where(eq(schema.countries.code, 'SE'))).rejects.toThrow();
  });

  it('admin changes a mode, with the opening day for prestart only, in audit_log', async () => {
    await withMode('SE', 'waitlist');
    const ctx = await staff();
    expect(await db.transaction((tx) => setCountryMode(tx, ctx, 'SE', { mode: 'prestart', opensOn: '2027-04-01' }))).toMatchObject({ slug: 'sweden' });
    expect((await adminCountries(db)).find((c) => c.code === 'SE')).toMatchObject({ mode: 'prestart', opensOn: '2027-04-01' });
    // Nothing changed: nothing written
    expect(await db.transaction((tx) => setCountryMode(tx, ctx, 'SE', { mode: 'prestart', opensOn: '2027-04-01' }))).toBeNull();
    await db.transaction((tx) => setCountryMode(tx, ctx, 'SE', { mode: 'open', opensOn: '2027-04-01' }));
    const [se] = await db.select().from(schema.countries).where(eq(schema.countries.code, 'SE'));
    expect(se).toMatchObject({ mode: 'open', isActive: true, opensOn: null });
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'country.mode'), eq(schema.auditLog.actorUserId, ctx.userId))).orderBy(schema.auditLog.id);
    expect(audit.map((a) => a.data)).toEqual([
      expect.objectContaining({ country: 'SE', from: 'waitlist', to: 'prestart', opensOn: '2027-04-01' }),
      expect.objectContaining({ country: 'SE', from: 'prestart', to: 'open', opensOn: null }),
    ]);
  });

  it('a hidden country has no pages and isn’t listed; prestart and guide show like waitlist', async () => {
    expect(await closedCountry(db, 'austria')).toMatchObject({ code: 'AT' });
    await withMode('AT', 'hidden');
    expect(await closedCountry(db, 'austria')).toBeNull();
    expect((await waitingCountries(appDb)).some((w) => w.code === 'AT')).toBe(false);
    await withMode('AT', 'prestart');
    expect(await closedCountry(db, 'austria')).toMatchObject({ code: 'AT' });
    expect((await waitingCountries(appDb)).some((w) => w.code === 'AT')).toBe(true);
  });

  it('opening the whole country opens the country too', async () => {
    await withMode('AT', 'prestart', '2027-03-20');
    const before = await db
      .select({ id: schema.locations.id, status: schema.locations.launchStatus, radius: schema.locations.launchRadiusKm, openedAt: schema.locations.openedAt })
      .from(schema.locations)
      .where(and(eq(schema.locations.countryCode, 'AT'), eq(schema.locations.kind, 'city')));
    restore.push(async () => {
      for (const c of before) await db.update(schema.locations).set({ launchStatus: c.status, launchRadiusKm: c.radius, openedAt: c.openedAt }).where(eq(schema.locations.id, c.id));
    });
    const ctx = await staff();
    // tests/waitlist.test.ts reads the first 'country.open' row: leave none behind
    restore.push(async () => {
      await db.delete(schema.auditLog).where(eq(schema.auditLog.actorUserId, ctx.userId));
    });
    await db.transaction((tx) => openCountry(tx, ctx, 'AT'));
    const [at] = await db.select().from(schema.countries).where(eq(schema.countries.code, 'AT'));
    expect(at).toMatchObject({ mode: 'open', isActive: true, opensOn: null });
  });
});

describe('posting by mode', () => {
  it('prestart: drafts are kept, publishing waits for the opening', async () => {
    await withMode('AT', 'prestart', '2027-03-20');
    const where = { countryCode: 'AT', place: 'وین' };
    expect(await post('save', where)).toMatchObject({ ok: true, status: 'draft' });
    expect(await post('publish', where)).toEqual(expect.objectContaining({ ok: false, reason: 'invalid', errors: expect.objectContaining({ countryCode: 'country_not_open' }) }));
  });

  it('waitlist and hidden: not even a draft in that country', async () => {
    for (const mode of ['waitlist', 'hidden'] as const) {
      await withMode('AT', mode);
      expect(await post('save', { countryCode: 'AT', place: 'وین' })).toEqual(expect.objectContaining({ ok: false, errors: expect.objectContaining({ countryCode: 'invalid' }) }));
    }
  });

  it('a business page can be made in a prestart country, not in a waitlist one', async () => {
    const details = (): BusinessInput => ({
      name: 'نان‌وایی وین',
      slug: `wien-${publicToken()}`,
      businessType: 'food',
      tagline: '',
      instagram: '',
      telegram: '',
      legalName: 'Bäckerei Wien',
      legalForm: 'Einzelunternehmen',
      representativeName: '',
      addressLine1: 'Kärntner Straße 1',
      addressLine2: '',
      place: 'وین',
      placeValue: '',
      legalPostal: '1010',
      phone: '',
      email: 'wien@example.test',
      website: '',
      registerCourt: '',
      registrationNumber: '',
      vatId: '',
      imprintExtra: '',
      description: 'نان تازه هر روز',
    } as BusinessInput);
    await withMode('AT', 'waitlist');
    expect(await createBusiness(appDb, { userId: (await user()).id, countryCode: 'AT', input: details() })).toMatchObject({ ok: false, reason: 'invalid' });
    await withMode('AT', 'prestart');
    expect(await createBusiness(appDb, { userId: (await user()).id, countryCode: 'AT', input: details() })).toMatchObject({ ok: true });
  });
});

describe('emergency pause', () => {
  it('stops new listings in the category and its subcategories, in the country or one city, until it ends', async () => {
    const ctx = await staff();
    const bicycles = await categoryBySlug('bicycles');
    const [parent] = await db.select().from(schema.categories).where(eq(schema.categories.id, bicycles.parentId!));
    const hamburg = await city('hamburg');
    const berlin = await city('berlin');
    const potsdam = await city('potsdam');
    const now = new Date();
    expect(await db.transaction((tx) => pauseCategory(tx, ctx, { categoryId: parent!.id, countryCode: 'DE', locationId: berlin.id, days: 7, reason: 'موج کلاهبرداری' }, now))).toBe('ok');
    const at = (locationId: string | null) => pauseFor(db, { categoryId: bicycles.id, countryCode: 'DE', locationId }, now);
    expect(await at(berlin.id)).toMatchObject({ until: new Date(now.getTime() + 7 * DAY) });
    // Potsdam launches with Berlin, so it counts as Berlin
    expect(await at(potsdam.id)).not.toBeNull();
    expect(await at(hamburg.id)).toBeNull();
    // Over in a week
    expect(await pauseFor(db, { categoryId: bicycles.id, countryCode: 'DE', locationId: berlin.id }, new Date(now.getTime() + 8 * DAY))).toBeNull();

    // Publishing is refused, the draft is kept
    expect(await post('publish')).toEqual({ ok: false, reason: 'paused' });
    expect(await post('save')).toMatchObject({ ok: true, status: 'draft' });

    // Lifted early: publishing works again
    const [p] = (await activePauses(db, 'DE')).filter((x) => x.categoryId === parent!.id);
    expect(p).toMatchObject({ categoryName: parent!.nameFa, city: berlin.nameFa, reason: 'موج کلاهبرداری' });
    expect(await db.transaction((tx) => liftPause(tx, ctx, p!.id))).toBe(true);
    expect(await at(berlin.id)).toBeNull();
    expect(await post('publish')).toMatchObject({ ok: true });
    const audit = await db.select({ action: schema.auditLog.action }).from(schema.auditLog).where(eq(schema.auditLog.actorUserId, ctx.userId)).orderBy(schema.auditLog.id);
    expect(audit.map((a) => a.action)).toEqual(['category.paused', 'category.pause_lifted']);
  });

  it('a pause on the whole country reaches every city; bad input is refused', async () => {
    const ctx = await staff();
    const bicycles = await categoryBySlug('bicycles');
    expect(await db.transaction((tx) => pauseCategory(tx, ctx, { categoryId: bicycles.id, countryCode: 'DE', locationId: null, days: 0, reason: 'دلیل' }))).toBe('invalid');
    expect(await db.transaction((tx) => pauseCategory(tx, ctx, { categoryId: bicycles.id, countryCode: 'DE', locationId: null, days: 31, reason: 'دلیل' }))).toBe('invalid');
    expect(await db.transaction((tx) => pauseCategory(tx, ctx, { categoryId: bicycles.id, countryCode: 'DE', locationId: null, days: 1, reason: ' ' }))).toBe('invalid');
    // A city of another country
    expect(await db.transaction(async (tx) => pauseCategory(tx, ctx, { categoryId: bicycles.id, countryCode: 'DE', locationId: (await city('wien')).id, days: 1, reason: 'دلیل' }))).toBe('invalid');
    expect(await db.transaction((tx) => pauseCategory(tx, ctx, { categoryId: bicycles.id, countryCode: 'DE', locationId: null, days: 1, reason: 'آزمایش کل کشور' }))).toBe('ok');
    expect(await pauseFor(db, { categoryId: bicycles.id, countryCode: 'DE', locationId: (await city('hamburg')).id })).not.toBeNull();
    expect(await pauseFor(db, { categoryId: bicycles.id, countryCode: 'AT', locationId: null })).toBeNull();
    for (const p of await activePauses(db, 'DE')) await db.transaction((tx) => liftPause(tx, ctx, p.id));
  });
});
