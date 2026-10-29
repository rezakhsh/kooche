import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { freshListings } from '../src/modules/admin/queue';
import { changeListingStatus, createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { numberCountry, zoneOf } from '../src/modules/listings/zones';
import { appDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { categoryBySlug, listing, user } from './listings-fixtures';
import { business, seedCatalog } from './payments-fixtures';

// Posting across borders (wave 2 part 5, the zone rule, owner Oct 29, 2026): the same zone posts
// everything; another zone only wanted posts, events, online services and a verified business's
// listings; one listing outside the number's country in the first week; listings from another zone
// in admin «آگهی‌های تازه».

const DAY = 86_400_000;
const owner = db as unknown as Tx;
const digits = (n: number) => String(Math.floor(10 ** (n - 1) + Math.random() * 9 * 10 ** (n - 1)));

beforeAll(async () => {
  await seedCatalog();
});

/** A seller whose verified number is Turkish (+90), Austrian (+43) or German (+49) */
async function seller(country: 'TR' | 'AT' | 'DE', opts: { old?: boolean } = {}) {
  const u = await user(opts.old ? { createdAt: new Date(Date.now() - 30 * DAY) } : {});
  const phone = { TR: `+90532${digits(7)}`, AT: `+43664${digits(7)}`, DE: `+4917${digits(8)}` }[country];
  await db.update(schema.users).set({ phoneE164: phone }).where(eq(schema.users.id, u.id));
  return u;
}

function input(over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'آیفون ۱۳ در حد نو',
    description: 'باتری سالم، جعبه و شارژر دارد. فقط تحویل حضوری.',
    attributes: { condition: 'like_new', brand: 'apple', storage_gb: 128 },
    priceType: 'fixed',
    amount: '۴۵۰',
    countryCode: 'DE',
    place: 'برلین',
    ...over,
  });
}

async function publish(userId: string, slug = 'mobile-phones', over: Partial<ListingInput> = {}) {
  const draft = await createDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!draft.ok) throw new Error(draft.reason);
  return { id: draft.listingId, result: await saveListing(appDb, { userId, listingId: draft.listingId, input: input(over), intent: 'publish' }) };
}

const itService = { title: 'نصب ویندوز و رفع مشکل لپ‌تاپ', description: 'کمک در نصب برنامه‌ها و رفع مشکلات رایانه، از راه دور.', priceType: 'fixed' as const, amount: '۲۰' };

describe('zones', () => {
  it('Europe is the EU, the EEA, Switzerland and the UK; the US and Canada one zone; the rest their own', () => {
    expect(['DE', 'AT', 'GB', 'CH', 'NO', 'SE'].map(zoneOf)).toEqual(Array(6).fill('europe'));
    expect([zoneOf('US'), zoneOf('CA'), zoneOf('AU'), zoneOf('TR'), zoneOf('MY')]).toEqual(['north_america', 'north_america', 'australia', 'turkey', 'MY']);
    expect(numberCountry('+905321234567')).toBe('TR');
    expect(numberCountry(null)).toBeNull();
  });
});

describe('posting from another zone', () => {
  it('a Turkish number in Germany: selling waits for a European number; a wanted post goes out', async () => {
    const u = await seller('TR', { old: true });
    expect((await publish(u.id)).result).toEqual({ ok: false, reason: 'zone_number_required' });
    const wanted = await publish(u.id, 'mobile-phones', { kind: 'wanted' });
    expect(wanted.result).toMatchObject({ ok: true, status: 'active' });
    expect((await listing(wanted.id)).numberCountry).toBe('TR');
  });

  it('online services are open, the same service in person is not', async () => {
    const u = await seller('TR', { old: true });
    expect((await publish(u.id, 'it-services', { ...itService, attributes: { online_possible: true } })).result).toMatchObject({ ok: true });
    expect((await publish(u.id, 'it-services', { ...itService, attributes: {} })).result).toEqual({ ok: false, reason: 'zone_number_required' });
  });

  it("a verified business's listings are open; an unverified one's are not", async () => {
    const u = await seller('TR', { old: true });
    const { org } = await business(u.id);
    expect((await publish(u.id, 'mobile-phones', { organizationId: org.id })).result).toEqual({ ok: false, reason: 'zone_number_required' });
    await db.update(schema.organizations).set({ verificationStatus: 'verified', verifiedAt: new Date() }).where(eq(schema.organizations.id, org.id));
    expect((await publish(u.id, 'mobile-phones', { organizationId: org.id })).result).toMatchObject({ ok: true });
  });

  it('renewing a listing that went out from another zone waits too', async () => {
    const u = await seller('TR', { old: true });
    const old = await makeListing(owner, u.id, { status: 'expired', expiresAt: new Date(Date.now() - DAY), numberCountry: 'DE' });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: old.id, action: 'renew' })).toEqual({ ok: false, reason: 'zone_number_required' });
  });
});

describe('the same zone', () => {
  it('an Austrian number in Germany posts everything, and the listing keeps the number’s country', async () => {
    const u = await seller('AT', { old: true });
    const first = await publish(u.id);
    expect(first.result).toMatchObject({ ok: true, status: 'active' });
    expect((await listing(first.id)).numberCountry).toBe('AT');
    expect((await publish(u.id)).result).toMatchObject({ ok: true });
  });

  it('a German number in Germany is not "abroad"', async () => {
    const u = await seller('DE');
    expect((await publish(u.id)).result).toMatchObject({ ok: true });
    expect((await publish(u.id)).result).toMatchObject({ ok: true });
  });
});

describe('the first week', () => {
  it('one listing outside the number’s country; deleting it doesn’t give another', async () => {
    const u = await seller('AT');
    const first = await publish(u.id);
    expect(first.result).toMatchObject({ ok: true });
    expect((await publish(u.id)).result).toEqual({ ok: false, reason: 'abroad_first_week' });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: first.id, action: 'delete' })).toMatchObject({ ok: true });
    expect((await publish(u.id)).result).toEqual({ ok: false, reason: 'abroad_first_week' });
  });
});

describe('admin «آگهی‌های تازه»', () => {
  it('shows listings from another zone whatever the account’s age, with the number’s country', async () => {
    const tr = await seller('TR', { old: true });
    const wanted = await publish(tr.id, 'mobile-phones', { kind: 'wanted' });
    const at = await seller('AT', { old: true });
    const same = await publish(at.id);
    const rows = await freshListings(db, 1000);
    expect(rows.find((r) => r.id === wanted.id)?.other_zone).toBe('TR');
    expect(rows.find((r) => r.id === same.id)).toBeUndefined();
  });
});
