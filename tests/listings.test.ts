import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { snapToGrid } from '../src/lib/geo';
import { cachedCatalog, effectiveAttributes } from '../src/modules/listings/catalog';
import {
  changeDraftCategory,
  changeListingStatus,
  createDraft,
  expireDueListings,
  listingInputSchema,
  saveListing,
  type ListingInput,
} from '../src/modules/listings/listings';
import { appDb, workerDb } from './accounts';
import { db } from './db';
import { categoryBySlug, city, events, listing, outbox, user } from './listings-fixtures';

// Posting and managing listings, run as classifieds_app (the web) and classifieds_worker (expiry),
// so the tests also prove the grants are enough. Decided Oct 17, 2026: listings go live at once,
// edits keep them live, 30 days renewable with one tap.

const DAY = 86_400_000;

async function input(over: Partial<ListingInput> = {}): Promise<ListingInput> {
  const berlin = await city();
  return listingInputSchema.parse({
    title: 'آیفون ۱۳ در حد نو',
    description: 'باتری سالم، جعبه و شارژر دارد. فقط تحویل حضوری.',
    attributes: { condition: 'like_new', brand: 'apple', storage_gb: 128 },
    priceType: 'fixed',
    amount: '۴۵۰',
    currency: 'EUR',
    locationId: berlin.id,
    district: 'شارلوتنبورگ',
    ...over,
  });
}

async function draftFor(userId: string, slug = 'mobile-phones') {
  const result = await createDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!result.ok) throw new Error(`createDraft refused: ${result.reason}`);
  return result.listingId;
}

async function published(userId: string, now = new Date()) {
  const id = await draftFor(userId);
  const r = await saveListing(appDb, { userId, listingId: id, input: await input(), intent: 'publish', now });
  if (!r.ok) throw new Error(`publish refused: ${JSON.stringify(r)}`);
  return id;
}

describe('who may post', () => {
  it('an unverified user cannot start a listing', async () => {
    const u = await user({ verified: false });
    const r = await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('mobile-phones')).id });
    expect(r).toEqual({ ok: false, reason: 'phone_required' });
  });

  it('a signed-out visitor and a deactivated account cannot either', async () => {
    const phones = (await categoryBySlug('mobile-phones')).id;
    expect(await createDraft(appDb, { userId: '00000000-0000-7000-8000-000000000000', categoryId: phones })).toEqual({
      ok: false,
      reason: 'sign_in_required',
    });
    const u = await user();
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, u.id));
    expect(await createDraft(appDb, { userId: u.id, categoryId: phones })).toEqual({ ok: false, reason: 'account_disabled' });
  });

  it('only leaf categories, and no business-only ones without a business', async () => {
    const u = await user();
    expect(await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('electronics')).id })).toEqual({
      ok: false,
      reason: 'category_not_postable',
    });
    expect(await createDraft(appDb, { userId: u.id, categoryId: (await categoryBySlug('tax-accounting')).id })).toEqual({
      ok: false,
      reason: 'business_only',
    });
  });

  it('a draft is created with its history and outbox event', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const l = await listing(id);
    expect(l.status).toBe('draft');
    expect(l.publicToken).toMatch(/^[0-9a-hjkmnp-tv-z]{10}$/);
    expect((await events(id)).map((e) => e.eventType)).toEqual(['created']);
    expect(await outbox(id)).toEqual(['listing.created']);
  });
});

describe('only the owner changes a listing', () => {
  it('another user gets "not found" for every action', async () => {
    const owner = await user();
    const other = await user();
    const id = await published(owner.id);
    const before = await listing(id);

    expect(await saveListing(appDb, { userId: other.id, listingId: id, input: await input({ title: 'ربوده شد' }), intent: 'save' })).toEqual({
      ok: false,
      reason: 'not_found',
    });
    for (const action of ['pause', 'sold', 'renew', 'delete'] as const) {
      expect(await changeListingStatus(appDb, { userId: other.id, listingId: id, action })).toEqual({ ok: false, reason: 'not_found' });
    }
    const after = await listing(id);
    expect(after.title).toBe(before.title);
    expect(after.status).toBe('active');
    expect(after.revision).toBe(before.revision);
  });

  it('a draft moves to another category only for its owner', async () => {
    const owner = await user();
    const other = await user();
    const id = await draftFor(owner.id);
    const tablets = (await categoryBySlug('tablets')).id;
    expect(await changeDraftCategory(appDb, { userId: other.id, listingId: id, categoryId: tablets })).toEqual({ ok: false, reason: 'not_found' });
    expect(await changeDraftCategory(appDb, { userId: owner.id, listingId: id, categoryId: tablets })).toEqual({ ok: true });
    expect((await listing(id)).categoryId).toBe(tablets);
  });
});

describe('publishing', () => {
  it('goes live at once for 30 days, with normalized text and the city centre', async () => {
    const u = await user();
    const now = new Date('2026-10-17T10:00:00Z');
    const id = await published(u.id, now);
    const l = await listing(id);
    const berlin = await city();
    expect(l.status).toBe('active');
    expect(l.publishedAt).toEqual(now);
    expect(l.rankedAt).toEqual(now);
    expect(l.expiresAt).toEqual(new Date(now.getTime() + 30 * DAY));
    expect(l.priceMinor).toBe(45_000);
    expect(l.currency).toBe('EUR');
    expect(l.titleNormalized).toBe('آیفون 13 در حد نو');
    expect(l.district).toBe('شارلوتنبورگ');
    expect(l.point).toEqual(berlin.center);
    expect(l.locationPrecision).toBe('city');
    expect(l.countryCode).toBe('DE');
    expect((await events(id)).map((e) => e.eventType)).toEqual(['created', 'published']);
    expect(await outbox(id)).toEqual(['listing.created', 'listing.published']);
  });

  it('a draft saves half-finished, but publishing needs everything', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const partial = await input({ title: 'آیفون', description: '', attributes: {}, amount: '', locationId: null });
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: partial, intent: 'save' })).toMatchObject({ ok: true, status: 'draft' });

    const r = await saveListing(appDb, { userId: u.id, listingId: id, input: partial, intent: 'publish' });
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
    if (!r.ok && r.reason === 'invalid') {
      expect(r.errors).toEqual({
        description: 'required',
        'attr.condition': 'required',
        amount: 'required',
        locationId: 'required',
      });
    }
    expect((await listing(id)).status).toBe('draft');
  });

  it('a seller still called «کاربر» must give a name to publish', async () => {
    const u = await user({ name: 'کاربر' });
    const id = await draftFor(u.id);
    const r = await saveListing(appDb, { userId: u.id, listingId: id, input: await input(), intent: 'publish' });
    expect(r).toMatchObject({ ok: false, errors: { displayName: 'required' } });
    const ok = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ displayName: ' سارا  ' }), intent: 'publish' });
    expect(ok).toMatchObject({ ok: true, status: 'active' });
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(row!.displayName).toBe('سارا');
  });

  it('a position is snapped to the ~500 m grid and must be near the city', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    const exact = { lat: 52.516_275, lng: 13.377_704 };
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ area: exact }), intent: 'publish' })).toMatchObject({ ok: true });
    const l = await listing(id);
    expect(l.point).toEqual(snapToGrid(exact));
    expect(l.point).not.toEqual(exact);
    expect(l.locationPrecision).toBe('area');

    const far = await draftFor(u.id);
    const munich = { lat: 48.137, lng: 11.575 };
    expect(await saveListing(appDb, { userId: u.id, listingId: far, input: await input({ area: munich }), intent: 'publish' })).toMatchObject({
      ok: false,
      errors: { area: 'too_far' },
    });
  });

  it('price rules follow the category: none in jobs, a price type outside the list refused', async () => {
    const u = await user();
    const job = await draftFor(u.id, 'it-jobs');
    const r = await saveListing(appDb, {
      userId: u.id,
      listingId: job,
      input: await input({ title: 'برنامه‌نویس وب', attributes: { employment_type: 'full_time' }, amount: '100' }),
      intent: 'publish',
    });
    expect(r).toMatchObject({ ok: true });
    const l = await listing(job);
    expect([l.priceType, l.priceMinor, l.currency]).toEqual(['on_request', null, null]);

    const phone = await draftFor(u.id);
    expect(await saveListing(appDb, { userId: u.id, listingId: phone, input: await input({ priceType: 'on_request' }), intent: 'publish' })).toMatchObject({
      ok: false,
      errors: { priceType: 'not_allowed' },
    });
    const free = await saveListing(appDb, { userId: u.id, listingId: phone, input: await input({ priceType: 'free', amount: '' }), intent: 'publish' });
    expect(free).toMatchObject({ ok: true });
    expect((await listing(phone)).priceMinor).toBeNull();
  });
});

describe('editing a live listing (decided Oct 17, 2026: stays live, same post-checks)', () => {
  it('stays active, gets a new revision, history with old and new values, and listing.updated', async () => {
    const u = await user();
    const id = await published(u.id);
    const r = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ amount: '420' }), intent: 'save' });
    expect(r).toMatchObject({ ok: true, status: 'active' });
    const l = await listing(id);
    expect(l.status).toBe('active');
    expect(l.revision).toBe(2);
    expect(l.priceMinor).toBe(42_000);
    const edited = (await events(id)).at(-1)!;
    expect(edited.eventType).toBe('edited');
    expect(edited.data).toEqual({ priceMinor: [45_000, 42_000] });
    expect((await outbox(id)).at(-1)).toBe('listing.updated');
  });

  it('a live listing cannot be saved incomplete', async () => {
    const u = await user();
    const id = await published(u.id);
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ title: '' }), intent: 'save' })).toMatchObject({
      ok: false,
      errors: { title: 'required' },
    });
  });

  it('saving without changes writes nothing', async () => {
    const u = await user();
    const id = await published(u.id);
    await saveListing(appDb, { userId: u.id, listingId: id, input: await input(), intent: 'save' });
    expect((await listing(id)).revision).toBe(1);
    expect((await events(id)).length).toBe(2);
  });
});

describe('pause, sold, delete', () => {
  it('follow the lifecycle and refuse what does not apply', async () => {
    const u = await user();
    const id = await published(u.id);
    const act = (action: 'pause' | 'resume' | 'sold' | 'renew' | 'delete') => changeListingStatus(appDb, { userId: u.id, listingId: id, action });

    expect(await act('resume')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await act('pause')).toEqual({ ok: true, status: 'paused' });
    expect(await act('resume')).toEqual({ ok: true, status: 'active' });
    expect(await act('sold')).toEqual({ ok: true, status: 'sold' });
    expect(await act('renew')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await act('pause')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input(), intent: 'save' })).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await act('delete')).toEqual({ ok: true, status: 'deleted' });
    expect(await act('delete')).toEqual({ ok: false, reason: 'not_found' });

    const l = await listing(id);
    expect(l.deletedAt).not.toBeNull();
    expect((await events(id)).map((e) => e.eventType)).toEqual(['created', 'published', 'paused', 'resumed', 'sold', 'deleted']);
    expect(await outbox(id)).toEqual([
      'listing.created',
      'listing.published',
      'listing.paused',
      'listing.resumed',
      'listing.sold',
      'listing.deleted',
    ]);
  });
});

describe('expiry and renewal', () => {
  it('the worker expires listings whose time is up, and only those', async () => {
    const u = await user();
    const start = new Date('2026-09-01T10:00:00Z');
    const due = await published(u.id, start);
    const fresh = await published(u.id, new Date());

    const n = await expireDueListings(workerDb, new Date(start.getTime() + 30 * DAY + 1000));
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await listing(due)).status).toBe('expired');
    expect((await listing(fresh)).status).toBe('active');
    const ev = (await events(due)).at(-1)!;
    expect([ev.eventType, ev.actorType, ev.fromStatus, ev.toStatus]).toEqual(['expired', 'system', 'active', 'expired']);
    expect((await outbox(due)).at(-1)).toBe('listing.expired');
  });

  it('renew: one tap gives 30 days from now and keeps the ranking', async () => {
    const u = await user();
    const start = new Date('2026-08-01T10:00:00Z');
    const id = await published(u.id, start);
    await expireDueListings(workerDb, new Date(start.getTime() + 31 * DAY));
    const now = new Date('2026-09-05T08:00:00Z');
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'renew', now })).toEqual({ ok: true, status: 'active' });
    const l = await listing(id);
    expect(l.expiresAt).toEqual(new Date(now.getTime() + 30 * DAY));
    expect(l.rankedAt).toEqual(start);
    expect((await events(id)).at(-1)!.eventType).toBe('renewed');
  });

  it('an active listing can be renewed only in its last 3 days', async () => {
    const u = await user();
    const start = new Date('2026-10-01T10:00:00Z');
    const id = await published(u.id, start);
    const early = new Date(start.getTime() + 10 * DAY);
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'renew', now: early })).toEqual({ ok: false, reason: 'not_allowed' });
    const late = new Date(start.getTime() + 28 * DAY);
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'renew', now: late })).toEqual({ ok: true, status: 'active' });
    expect((await listing(id)).expiresAt).toEqual(new Date(late.getTime() + 30 * DAY));
  });

  it('renewing needs a verified phone, like posting', async () => {
    const u = await user();
    const id = await published(u.id, new Date('2026-08-01T10:00:00Z'));
    await expireDueListings(workerDb, new Date('2026-09-15T00:00:00Z'));
    await db.update(schema.users).set({ phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null }).where(eq(schema.users.id, u.id));
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'renew' })).toEqual({ ok: false, reason: 'phone_required' });
    // Taking it down needs no phone
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: id, action: 'delete' })).toEqual({ ok: true, status: 'deleted' });
  });
});

describe('attribute validation (against category_attributes)', () => {
  it('cars: required brand, model must belong to the brand, number bounds, unknown keys', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'cars');
    const save = async (attributes: Record<string, unknown>) =>
      saveListing(appDb, { userId: u.id, listingId: id, input: await input({ title: 'ب‌ام‌و سری ۳', attributes, amount: '15000' }), intent: 'publish' });

    expect(await save({ model: 'bmw-3-series' })).toMatchObject({ errors: { 'attr.brand': 'required' } });
    expect(await save({ brand: 'audi', model: 'bmw-3-series' })).toMatchObject({ errors: { 'attr.model': 'parent_mismatch' } });
    expect(await save({ brand: 'bmw', model: 'bmw-3-series', year: 1900 })).toMatchObject({ errors: { 'attr.year': 'too_small' } });
    expect(await save({ brand: 'bmw', mileage_km: 1200.5 })).toMatchObject({ errors: { 'attr.mileage_km': 'not_integer' } });
    expect(await save({ brand: 'bmw', fuel: 'kerosene' })).toMatchObject({ errors: { 'attr.fuel': 'unknown_option' } });
    expect(await save({ brand: 'bmw', fuel: 'بنزین' })).toMatchObject({ errors: { 'attr.fuel': 'unknown_option' } });
    expect(await save({ brand: 'bmw', mileage_km: '120000' })).toMatchObject({ errors: { 'attr.mileage_km': 'invalid' } });
    expect(await save({ brand: 'bmw', color_hex: '#fff' })).toMatchObject({ errors: { 'attr.color_hex': 'unknown_field' } });

    const ok = await save({ brand: 'bmw', model: 'bmw-3-series', year: 2018, mileage_km: 120_000, fuel: 'diesel' });
    expect(ok).toMatchObject({ ok: true, status: 'active' });
    expect((await listing(id)).attributes).toEqual({ brand: 'bmw', model: 'bmw-3-series', year: 2018, mileage_km: 120_000, fuel: 'diesel' });
  });

  it('inherited fields count: a phone gets electronics «condition»', async () => {
    const catalog = await cachedCatalog(appDb);
    const keys = effectiveAttributes(catalog, (await categoryBySlug('mobile-phones')).id).map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining(['condition', 'brand', 'storage_gb']));
    expect(keys.indexOf('condition')).toBeLessThan(keys.indexOf('brand'));
  });

  it('multi-select: values from the list, no repeats, at most max_items', async () => {
    const { validateAttributes } = await import('../src/modules/listings/attributes');
    const defs = [
      {
        key: 'extras',
        type: 'multi_select' as const,
        labelFa: 'امکانات',
        unitFa: null,
        helpFa: null,
        validation: { max_items: 2 },
        dependsOn: null,
        isRequired: false,
        showOnCard: false,
        isActive: true,
        options: ['a', 'b', 'c'].map((value) => ({ value, labelFa: value, parentValue: null })),
      },
    ];
    expect(validateAttributes(defs, { extras: ['a', 'a'] }, 'draft')).toEqual({ ok: false, errors: { extras: 'invalid' } });
    expect(validateAttributes(defs, { extras: ['nope'] }, 'draft')).toEqual({ ok: false, errors: { extras: 'unknown_option' } });
    expect(validateAttributes(defs, { extras: ['a', 'b', 'c'] }, 'draft')).toEqual({ ok: false, errors: { extras: 'too_many' } });
    expect(validateAttributes(defs, { extras: 'a' }, 'draft')).toEqual({ ok: false, errors: { extras: 'invalid' } });
    expect(validateAttributes(defs, { extras: ['a', 'c'] }, 'draft')).toEqual({ ok: true, value: { extras: ['a', 'c'] } });
  });
});
