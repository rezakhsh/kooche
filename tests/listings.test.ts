import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { snapToGrid } from '../src/lib/geo';
import { cachedCatalog, effectiveAttributes } from '../src/modules/listings/catalog';
import {
  categoryPriceTypes,
  changeDraftCategory,
  changeListingStatus,
  createDraft,
  expireDueListings,
  listingInputSchema,
  saveListing,
  type ListingInput,
} from '../src/modules/listings/listings';
import { NEW_ACCOUNT_LISTINGS_PER_DAY } from '../src/modules/listings/limits';
import { rentUnit } from '../src/modules/listings/card';
import { REGISTRATION_WORD, registrationNumberRequired } from '../src/modules/listings/country-fields';
import { countryCatalog } from '../src/modules/listings/country-rules';
import { business } from './payments-fixtures';
import { eventLanguagesIn } from '../src/modules/events/languages';
import { cardFacts } from '../src/modules/listings/attribute-text';
import { exchangeAllowed, rentKind, rentPeriodOf, shippable } from '../src/modules/listings/safety-kind';
import { normalizePersian } from '../src/lib/normalize-persian';
import { firstStepWithErrors, stepOf } from '../src/app/my/listings/[id]/steps';
import { matchCategories } from '../src/app/new/category-search';
import { appDb, workerDb } from './accounts';
import { db } from './db';
import { categoryBySlug, city, events, listing, outbox, user } from './listings-fixtures';

// Posting and managing listings, run as classifieds_app (the web) and classifieds_worker (expiry),
// so the tests also prove the grants are enough. Decided Oct 17, 2026: listings go live at once,
// edits keep them live, 30 days renewable with one tap.

const DAY = 86_400_000;

// The place is Berlin by its Persian name: the city itself, so the point is the city centre.
// Postal codes, the browser position and the currency rules are in tests/places.test.ts.
async function input(over: Partial<ListingInput> = {}): Promise<ListingInput> {
  return listingInputSchema.parse({
    title: 'آیفون ۱۳ در حد نو',
    description: 'باتری سالم، جعبه و شارژر دارد. فقط تحویل حضوری.',
    attributes: { condition: 'like_new', brand: 'apple', storage_gb: 128 },
    priceType: 'fixed',
    amount: '۴۵۰',
    countryCode: 'DE',
    place: 'برلین',
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

describe('accounts in their first 7 days', () => {
  const NOW = new Date('2026-10-21T12:00:00Z');
  const publishAt = async (userId: string, now: Date, id?: string) =>
    saveListing(appDb, { userId, listingId: id ?? (await draftFor(userId)), input: await input(), intent: 'publish', now });

  it(`publish at most ${NEW_ACCOUNT_LISTINGS_PER_DAY} listings in 24 hours; deleting one doesn't help`, async () => {
    const u = await user({ createdAt: new Date(NOW.getTime() - DAY) });
    const ids: string[] = [];
    for (let i = 0; i < NEW_ACCOUNT_LISTINGS_PER_DAY; i++) {
      const id = await draftFor(u.id);
      expect(await publishAt(u.id, NOW, id)).toMatchObject({ ok: true, status: 'active' });
      ids.push(id);
    }
    const next = await draftFor(u.id);
    expect(await publishAt(u.id, NOW, next)).toEqual({ ok: false, reason: 'new_account_limit' });
    expect((await listing(next)).status).toBe('draft');
    // Saving still works, and so do edits of the live ones
    expect(await saveListing(appDb, { userId: u.id, listingId: next, input: await input({ title: 'پیش‌نویس' }), intent: 'save', now: NOW })).toMatchObject({ ok: true });
    expect(await saveListing(appDb, { userId: u.id, listingId: ids[0]!, input: await input({ title: 'ویرایش' }), intent: 'save', now: NOW })).toMatchObject({ ok: true });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: ids[0]!, action: 'delete' })).toMatchObject({ ok: true, status: 'deleted' });
    expect(await publishAt(u.id, NOW, next)).toEqual({ ok: false, reason: 'new_account_limit' });
    // 24 hours later the next ones go out
    expect(await publishAt(u.id, new Date(NOW.getTime() + DAY + 60_000), next)).toMatchObject({ ok: true, status: 'active' });
  });

  it('the limit ends when the account is 7 days old, and never applies to older accounts', async () => {
    const born = new Date(NOW.getTime() - 7 * DAY + 3_600_000);
    const u = await user({ createdAt: born });
    for (let i = 0; i < NEW_ACCOUNT_LISTINGS_PER_DAY; i++) expect(await publishAt(u.id, NOW)).toMatchObject({ ok: true });
    expect(await publishAt(u.id, NOW)).toEqual({ ok: false, reason: 'new_account_limit' });
    expect(await publishAt(u.id, new Date(born.getTime() + 7 * DAY))).toMatchObject({ ok: true, status: 'active' });

    const old = await user({ createdAt: new Date(NOW.getTime() - 8 * DAY) });
    for (let i = 0; i < NEW_ACCOUNT_LISTINGS_PER_DAY + 2; i++) expect(await publishAt(old.id, NOW)).toMatchObject({ ok: true, status: 'active' });
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
    const partial = await input({ title: 'آیفون', description: '', attributes: {}, amount: '', place: '' });
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: partial, intent: 'save' })).toMatchObject({ ok: true, status: 'draft' });

    const r = await saveListing(appDb, { userId: u.id, listingId: id, input: partial, intent: 'publish' });
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
    if (!r.ok && r.reason === 'invalid') {
      expect(r.errors).toEqual({
        description: 'required',
        'attr.condition': 'required',
        amount: 'required',
        place: 'required',
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

  it('a position is snapped to the ~500 m grid and must be near the place', async () => {
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
      // A job seeker's listing: job offers need a business since Oct 22, 2026 (tests/business.test.ts)
      input: await input({ kind: 'wanted', title: 'برنامه‌نویس وب', attributes: { employment_type: 'full_time' }, amount: '100' }),
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

describe('deleting drafts (bug found on staging, Oct 17, 2026)', () => {
  it('an empty draft and a half-finished one can be deleted', async () => {
    const u = await user();
    const empty = await draftFor(u.id);
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: empty, action: 'delete' })).toEqual({ ok: true, status: 'deleted' });

    const half = await draftFor(u.id);
    await saveListing(appDb, { userId: u.id, listingId: half, input: await input({ title: 'دوچ', amount: '', place: '' }), intent: 'save' });
    expect(await changeListingStatus(appDb, { userId: u.id, listingId: half, action: 'delete' })).toEqual({ ok: true, status: 'deleted' });
    expect((await listing(half)).deletedAt).not.toBeNull();
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

    expect(await save({ fuel: 'diesel' })).toMatchObject({ errors: { 'attr.brand': 'required', 'attr.model': 'required' } });
    // A model chosen from the grouped list without a brand brings its brand (Oct 23, 2026)
    const modelOnly = await save({ model: 'bmw-3-series' });
    expect(modelOnly.ok).toBe(false);
    expect(modelOnly).not.toMatchObject({ errors: { 'attr.brand': expect.anything() } });
    expect(modelOnly).not.toMatchObject({ errors: { 'attr.model': expect.anything() } });
    expect(await save({ brand: 'audi', model: 'bmw-3-series' })).toMatchObject({ errors: { 'attr.model': 'parent_mismatch' } });
    expect(await save({ brand: 'bmw', model: 'bmw-3-series', year: 1900 })).toMatchObject({ errors: { 'attr.year': 'too_small' } });
    expect(await save({ brand: 'bmw', mileage_km: 1200.5 })).toMatchObject({ errors: { 'attr.mileage_km': 'not_integer' } });
    expect(await save({ brand: 'bmw', fuel: 'kerosene' })).toMatchObject({ errors: { 'attr.fuel': 'unknown_option' } });
    expect(await save({ brand: 'bmw', fuel: 'بنزین' })).toMatchObject({ errors: { 'attr.fuel': 'unknown_option' } });
    expect(await save({ brand: 'bmw', mileage_km: '120000' })).toMatchObject({ errors: { 'attr.mileage_km': 'invalid' } });
    expect(await save({ brand: 'bmw', color_hex: '#fff' })).toMatchObject({ errors: { 'attr.color_hex': 'unknown_field' } });

    const car = { brand: 'bmw', model: 'bmw-3-series', year: 2018, mileage_km: 120_000, fuel: 'diesel', gearbox: 'automatic' };
    expect(await save(car)).toMatchObject({ errors: { 'attr.damage': 'required' } });
    const ok = await save({ ...car, damage: 'accident_free', inspection_until: '2027-03' });
    expect(ok).toMatchObject({ ok: true, status: 'active' });
    expect((await listing(id)).attributes).toEqual({ ...car, damage: 'accident_free', inspection_until: '2027-03' });
  });

  it('every car make has «other models», so a required model is always possible', async () => {
    const catalog = await cachedCatalog(appDb);
    const defs = effectiveAttributes(catalog, (await categoryBySlug('cars')).id, 'DE');
    const brands = defs.find((d) => d.key === 'brand')!.options;
    const models = defs.find((d) => d.key === 'model')!.options;
    expect(brands.length).toBeGreaterThanOrEqual(45);
    for (const b of brands) expect(models.some((m) => m.parentValue === b.value && m.value.endsWith('-other-model'))).toBe(true);
  });

  it('dates: a day or a month, real calendar dates only', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'tickets');
    const save = async (attributes: Record<string, unknown>) =>
      saveListing(appDb, { userId: u.id, listingId: id, input: await input({ title: 'دو بلیت کنسرت', attributes, amount: '80' }), intent: 'publish' });

    expect(await save({})).toMatchObject({ errors: { 'attr.event_date': 'required' } });
    for (const bad of ['2027-02-30', '2027-13-01', '27-03-01', '2027-03', '1800-01-01', 20270301]) {
      expect(await save({ event_date: bad })).toMatchObject({ errors: { 'attr.event_date': 'invalid' } });
    }
    expect(await save({ event_date: '2028-02-29', ticket_count: 2 })).toMatchObject({ ok: true });
    expect((await listing(id)).attributes).toEqual({ event_date: '2028-02-29', ticket_count: 2 });

    const { validateAttributes } = await import('../src/modules/listings/attributes');
    const catalog = await cachedCatalog(appDb);
    const motorbike = effectiveAttributes(catalog, (await categoryBySlug('motorcycles')).id, 'DE');
    expect(validateAttributes(motorbike, { inspection_until: '2027-03' }, 'draft')).toEqual({ ok: true, value: { inspection_until: '2027-03' } });
    expect(validateAttributes(motorbike, { inspection_until: '2027-03-01' }, 'draft')).toMatchObject({ ok: false });
    expect(validateAttributes(motorbike, { inspection_until: '2027-00' }, 'draft')).toMatchObject({ ok: false });
  });

  it('rent: amounts are minor units of the country currency; the extra costs are required', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'apartments-rent');
    const flat = { area_m2: 62, bedrooms: 'b2', rooms: 2.5, apartment_type: 'attic', features: ['cellar', 'fitted_kitchen'], available_from: '2026-12-01' };
    const save = async (attributes: Record<string, unknown>) =>
      saveListing(appDb, { userId: u.id, listingId: id, input: await input({ title: 'آپارتمان ۲٫۵ خوابه', attributes, amount: '900' }), intent: 'publish' });

    expect(await save(flat)).toMatchObject({ errors: { 'attr.extra_costs': 'required' } });
    expect(await save({ ...flat, extra_costs: 'دویست' })).toMatchObject({ errors: { 'attr.extra_costs': 'invalid' } });
    expect(await save({ ...flat, extra_costs: -5 })).toMatchObject({ errors: { 'attr.extra_costs': 'invalid' } });
    expect(await save({ ...flat, extra_costs: '۱۸۰٫۵۰', deposit: '2.700' })).toMatchObject({ ok: true });
    expect((await listing(id)).attributes).toMatchObject({ extra_costs: 18_050, deposit: 270_000 });
    // An integer is already minor units (API callers, the stored value on a second save)
    expect(await save({ ...flat, extra_costs: 18_050 })).toMatchObject({ ok: true });
    expect((await listing(id)).attributes).toMatchObject({ extra_costs: 18_050 });
  });

  it('a retired field keeps its value when the listing is edited', async () => {
    // «نوع اجاره» (cold or warm) was retired on Oct 18, 2026: on staging its definition is still
    // there, inactive, and older listings carry it. The test database never had it, so add it.
    const flats = await categoryBySlug('apartments-rent');
    const [retired] = await db
      .insert(schema.categoryAttributes)
      .values({ categoryId: flats.id, key: 'rent_type', type: 'text', labelFa: 'نوع اجاره', isActive: false })
      .returning();
    const resetCatalog = () => ((globalThis as { catalog?: unknown }).catalog = undefined);
    resetCatalog();
    try {
      const u = await user();
      const id = await draftFor(u.id, 'apartments-rent');
      const flat = { area_m2: 40, bedrooms: 'studio', rooms: 1, extra_costs: 15_000 };
      const save = async (attributes: Record<string, unknown>, intent: 'publish' | 'save') =>
        saveListing(appDb, { userId: u.id, listingId: id, input: await input({ attributes, amount: '700' }), intent });
      expect(await save(flat, 'publish')).toMatchObject({ ok: true });
      await db.update(schema.listings).set({ attributes: { ...flat, rent_type: 'warm' } }).where(eq(schema.listings.id, id));

      expect(await save({ ...flat, rooms: 2 }, 'save')).toMatchObject({ ok: true });
      expect((await listing(id)).attributes).toEqual({ ...flat, rooms: 2, rent_type: 'warm' });
      // New input can't set it
      expect(await save({ ...flat, rent_type: 'cold' }, 'save')).toMatchObject({ errors: { 'attr.rent_type': 'unknown_field' } });
    } finally {
      await db.delete(schema.categoryAttributes).where(eq(schema.categoryAttributes.id, retired!.id));
      resetCatalog();
    }
  });

  it('a required field can be optional in one category: no size for a parking space', async () => {
    const catalog = await cachedCatalog(appDb);
    const area = async (slug: string) =>
      effectiveAttributes(catalog, (await categoryBySlug(slug)).id, 'DE').find((d) => d.key === 'area_m2')!.isRequired;
    expect(await area('apartments-rent')).toBe(true);
    expect(await area('parking-garages')).toBe(false);
  });

  it('dependent select: a karat only for gold', async () => {
    const { validateAttributes } = await import('../src/modules/listings/attributes');
    const catalog = await cachedCatalog(appDb);
    const defs = effectiveAttributes(catalog, (await categoryBySlug('jewelry-watches')).id, 'DE');
    expect(validateAttributes(defs, { jewelry_material: 'gold', gold_karat: 'k18' }, 'draft')).toMatchObject({ ok: true });
    expect(validateAttributes(defs, { jewelry_material: 'silver', gold_karat: 'k18' }, 'draft')).toEqual({
      ok: false,
      errors: { gold_karat: 'parent_mismatch' },
    });
  });

  it('inherited fields count: a phone gets electronics «condition»', async () => {
    const catalog = await cachedCatalog(appDb);
    const keys = effectiveAttributes(catalog, (await categoryBySlug('mobile-phones')).id, 'DE').map((d) => d.key);
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
        isFilterable: false,
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

describe('posting in steps (wave 1)', () => {
  it('saves a draft at each «ادامه» and says what publishing would still refuse', async () => {
    const u = await user();
    const id = await draftFor(u.id);
    // Step 2 left with a title only: the description is missing, and so is the step 3 price
    const first = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ description: '', amount: '' }), intent: 'save', check: true });
    expect(first).toMatchObject({ ok: true, status: 'draft' });
    const missing = first.ok ? first.missing : undefined;
    expect(missing).toMatchObject({ description: 'required' });
    expect(firstStepWithErrors(missing, 2)).toBe(2);
    expect((await listing(id)).title).toBe('آیفون ۱۳ در حد نو');
    // Text filled in: step 2 is done; what is left belongs to later steps
    const second = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ amount: '' }), intent: 'save', check: true });
    const left = second.ok ? second.missing : undefined;
    expect(firstStepWithErrors(left, 2)).toBeNull();
    expect(firstStepWithErrors(left, 3)).toBe(3);
    // Everything there: nothing is missing, and it is still a draft until «انتشار»
    const third = await saveListing(appDb, { userId: u.id, listingId: id, input: await input(), intent: 'save', check: true });
    expect(third).toMatchObject({ ok: true, status: 'draft', missing: {} });
  });

  it('puts every field and error in its step', () => {
    expect(stepOf('title')).toBe(2);
    expect(stepOf('kind')).toBe(2);
    expect(stepOf('attr.storage_gb')).toBe(3);
    expect(stepOf('amount')).toBe(3);
    expect(stepOf('place')).toBe(4);
    expect(stepOf('displayName')).toBe(4);
    expect(firstStepWithErrors({ place: 'required', amount: 'required' }, 4)).toBe(3);
    expect(firstStepWithErrors({}, 4)).toBeNull();
  });

  it('finds categories by name for step 1', async () => {
    const all = [
      { slug: 'shared-rooms', nameFa: 'اتاق و خانه اشتراکی (WG)', parentFa: 'املاک', search: normalizePersian('اتاق و خانه اشتراکی (WG) املاک') },
      { slug: 'bedroom', nameFa: 'اتاق خواب، تخت و کمد', parentFa: 'خانه و آشپزخانه', search: normalizePersian('اتاق خواب، تخت و کمد خانه و آشپزخانه') },
      { slug: 'bicycles', nameFa: 'دوچرخه', parentFa: 'ورزش', search: normalizePersian('دوچرخه ورزش') },
    ];
    expect(matchCategories(all, 'اتاق').map((c) => c.slug)).toEqual(['shared-rooms', 'bedroom']);
    expect(matchCategories(all, 'اتاق املاک').map((c) => c.slug)).toEqual(['shared-rooms']);
    expect(matchCategories(all, 'اتاق خواب').map((c) => c.slug)).toEqual(['bedroom']);
    // Arabic kaf (U+0643) and yeh (U+064A), as some keyboards type them
    expect(matchCategories(all, '\u0643مد').map((c) => c.slug)).toEqual(['bedroom']);
    expect(matchCategories(all, 'اشترا\u0643\u064A').map((c) => c.slug)).toEqual(['shared-rooms']);
    expect(matchCategories(all, '  ')).toEqual([]);
  });
});

// The field audit's first changes (owner, Nov 5, 2026; docs/research/field-audit.md §19)
describe('posting fields after the field audit', () => {
  it('a flat needs its bedrooms; the German count of rooms is optional', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'apartments-rent');
    const save = (attributes: Record<string, unknown>) =>
      input({ title: 'آپارتمان دو خوابه', attributes, amount: '900' }).then((x) => saveListing(appDb, { userId: u.id, listingId: id, input: x, intent: 'publish' }));
    expect(await save({ area_m2: 60, extra_costs: '200' })).toMatchObject({ errors: { 'attr.bedrooms': 'required' } });
    expect(await save({ area_m2: 60, extra_costs: '200', bedrooms: 'b2' })).toMatchObject({ ok: true });
    expect((await listing(id)).attributes).toMatchObject({ bedrooms: 'b2' });
    expect((await listing(id)).attributes).not.toHaveProperty('rooms');
  });

  it('a short let has one price per night, week or month, and no furnished field', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'short-term-rent');
    const save = (attributes: Record<string, unknown>) =>
      input({ title: 'آپارتمان مبله برای چند شب', attributes, amount: '80' }).then((x) => saveListing(appDb, { userId: u.id, listingId: id, input: x, intent: 'publish' }));
    expect(await save({ area_m2: 45 })).toMatchObject({ errors: { 'attr.rent_period': 'required' } });
    expect(await save({ area_m2: 45, rent_period: 'night', furnished: true })).toMatchObject({ errors: { 'attr.furnished': 'unknown_field' } });
    expect(
      await save({ area_m2: 45, rent_period: 'night', guests: 4, cleaning_fee: '40', min_stay: 'n2', room_type: 'entire_place', registration_number: '01/Z/AZ/012345-26', anmeldung: false }),
    ).toMatchObject({ ok: true });
    expect((await listing(id)).attributes).toMatchObject({ rent_period: 'night', guests: 4, cleaning_fee: 4_000, min_stay: 'n2' });
    const catalog = await cachedCatalog(appDb);
    const l = await listing(id);
    expect(rentUnit(catalog, l.categoryId, l.priceMinor, 'DE', l.attributes as Record<string, unknown>)).toBe('هر شب');
    expect(rentUnit(catalog, l.categoryId, l.priceMinor, 'DE', { rent_period: 'month' })).toBe('هر ماه');
    // Flats keep the cold rent, rooms the plain monthly rent
    expect(rentUnit(catalog, (await categoryBySlug('apartments-rent')).id, 90_000, 'DE', {})).toBe('سرد، ماهانه');
    expect(rentUnit(catalog, (await categoryBySlug('shared-rooms')).id, 50_000, 'DE', {})).toBe('ماهانه');
  });

  it('a room in a shared flat is never the entire place, and says whether bills are included', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'shared-rooms');
    const save = (attributes: Record<string, unknown>) =>
      input({ title: 'اتاق در WG', attributes, amount: '550' }).then((x) => saveListing(appDb, { userId: u.id, listingId: id, input: x, intent: 'publish' }));
    expect(await save({ area_m2: 14, room_type: 'entire_place' })).toMatchObject({ errors: { 'attr.room_type': 'unknown_option' } });
    expect(await save({ area_m2: 14, room_type: 'private_room', bills_included: 'all', min_stay: 'm6', private_bathroom: true, couples_ok: false })).toMatchObject({ ok: true });
    const catalog = await cachedCatalog(appDb);
    const fields = (slug: string) => effectiveAttributes(catalog, catalog.bySlug.get(slug)!.id, 'DE');
    expect(fields('shared-rooms').find((d) => d.key === 'room_type')!.options.map((o) => o.value)).toEqual(['private_room', 'shared_room']);
    expect(fields('short-term-rent').find((d) => d.key === 'room_type')!.options.map((o) => o.value)).toContain('entire_place');
  });

  it('the area has a hint only where it means something else', async () => {
    const catalog = await cachedCatalog(appDb);
    const area = (slug: string) => effectiveAttributes(catalog, catalog.bySlug.get(slug)!.id, 'DE').find((d) => d.key === 'area_m2')!;
    expect(area('apartments-rent').helpFa).toBeNull();
    expect(area('shared-rooms').helpFa).toBe('متراژ خود اتاق');
    expect(area('land-gardens').helpFa).toBe('متراژ کل زمین');
    // Still optional for a parking space
    expect(area('parking-garages').isRequired).toBe(false);
    expect(area('houses-sale').isRequired).toBe(true);
  });

  it('live animals, pet care and boats are never sent by post', async () => {
    const path = (slug: string) => [{ slug: 'x' }, { slug }];
    for (const slug of ['dogs', 'cats', 'birds', 'small-animals', 'pet-care', 'boats']) expect(shippable(path(slug))).toBe(false);
    for (const slug of ['fish-aquariums', 'pet-supplies', 'car-parts', 'mobile-phones']) expect(shippable(path(slug))).toBe(true);
    expect(shippable([{ slug: 'services' }, { slug: 'cleaning' }])).toBe(false);
    expect(shippable([])).toBe(true);
    // Whatever the form sends
    const u = await user();
    const id = await draftFor(u.id, 'cats');
    const r = await saveListing(appDb, {
      userId: u.id,
      listingId: id,
      input: await input({ title: 'بچه گربه', attributes: {}, amount: '50', shippingOffered: true }),
      intent: 'publish',
    });
    expect(r).toMatchObject({ ok: true });
    expect((await listing(id)).shippingOffered).toBe(false);
  });

  it('no exchange for services, lessons, pet care, rideshare, dogs and cats', async () => {
    const catalog = await cachedCatalog(appDb);
    const types = (slug: string) => categoryPriceTypes(catalog, catalog.bySlug.get(slug)!);
    for (const slug of ['cleaning', 'tutoring', 'pet-care', 'rideshare', 'dogs', 'cats']) expect(types(slug)).not.toContain('exchange');
    for (const slug of ['mobile-phones', 'birds', 'bicycles']) expect(types(slug)).toContain('exchange');
    expect(types('cleaning')).toContain('on_request');
    expect(exchangeAllowed([{ slug: 'services' }, { slug: 'cleaning' }])).toBe(false);
    const u = await user();
    const id = await draftFor(u.id, 'cleaning');
    const r = await saveListing(appDb, {
      userId: u.id,
      listingId: id,
      input: await input({ title: 'نظافت منزل', attributes: {}, priceType: 'exchange', amount: '' }),
      intent: 'publish',
    });
    expect(r).toMatchObject({ errors: { priceType: 'not_allowed' } });
  });

  it('rent kinds: a short let is per period', () => {
    expect(rentKind([{ slug: 'real-estate' }, { slug: 'short-term-rent' }], 'DE')).toBe('period');
    expect(rentPeriodOf({ rent_period: 'week' })).toBe('week');
    expect(rentPeriodOf({ rent_period: 'year' })).toBeNull();
    expect(rentPeriodOf(null)).toBeNull();
  });
});

// Field audit items 5–6 (approved by the owner on Nov 5, 2026; docs/research/field-audit.md §20):
// each country sees its own words and fields; values are stored the same way everywhere.
describe('posting fields per country', () => {
  const fieldsIn = async (slug: string, country: string | null) => {
    const catalog = await cachedCatalog(appDb);
    return effectiveAttributes(catalog, catalog.bySlug.get(slug)!.id, country);
  };
  const field = async (slug: string, country: string | null, key: string) => (await fieldsIn(slug, country)).find((d) => d.key === key)!;
  const offered = async (slug: string, country: string | null) => (await fieldsIn(slug, country)).filter((d) => d.isActive).map((d) => d.key);

  it('Germany reads as before', async () => {
    expect((await field('shared-rooms', 'DE', 'anmeldung')).labelFa).toBe('Anmeldung ممکن');
    const costs = await field('apartments-rent', 'DE', 'extra_costs');
    expect(costs.labelFa).toBe('هزینه‌های جانبی ماهانه (Nebenkosten)');
    expect(costs.isRequired).toBe(true);
    expect((await field('apartments-rent', 'DE', 'wbs_required')).isActive).toBe(true);
    expect((await field('apartments-rent', 'DE', 'rooms')).labelFa).toBe('تعداد اتاق به حساب آلمانی (Zimmer)');
    expect((await field('apartments-rent', 'DE', 'apartment_type')).options.find((o) => o.value === 'attic')!.labelFa).toBe('زیرشیروانی (Dachgeschoss)');
    expect((await field('apartments-rent', 'DE', 'energy_class')).options.map((o) => o.value)).toEqual(['a_plus', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(await offered('apartments-rent', 'DE')).not.toContain('bathrooms');
    expect(await offered('apartments-rent', 'DE')).not.toContain('bills_included');
    expect(await offered('apartments-rent', 'DE')).toEqual(expect.arrayContaining(['energy_certificate', 'energy_value', 'energy_source', 'energy_issued']));
    // Optional, as on Kleinanzeigen: §87 GModG binds only commercial ads with a certificate
    for (const key of ['energy_class', 'energy_certificate', 'energy_value', 'energy_source', 'energy_issued']) {
      expect((await field('apartments-rent', 'DE', key)).isRequired).toBe(false);
    }
  });

  it('Anmeldung only where tenants register, under the local word', async () => {
    expect((await field('shared-rooms', 'AT', 'anmeldung')).labelFa).toBe('Meldezettel ممکن');
    expect((await field('shared-rooms', 'NL', 'anmeldung')).labelFa).toBe('inschrijving ممکن');
    for (const c of ['GB', 'FR', 'US', 'CA', 'AU', 'BE']) expect(await offered('shared-rooms', c)).not.toContain('anmeldung');
    // The chip's words are exactly the field's countries
    const anmeldung = await field('shared-rooms', null, 'anmeldung');
    expect([...(anmeldung.validation.countries ?? [])].sort()).toEqual(Object.keys(REGISTRATION_WORD).sort());
  });

  it("each country's rent block", async () => {
    const path = (slug: string) => [{ slug: 'real-estate' }, { slug }];
    expect(rentKind(path('apartments-rent'), 'DE')).toBe('cold');
    expect(rentKind(path('apartments-rent'), 'AT')).toBe('gross');
    expect(rentKind(path('houses-rent'), 'FR')).toBe('gross');
    expect(rentKind(path('apartments-rent'), 'NL')).toBe('net');
    expect(rentKind(path('apartments-rent'), 'AU')).toBe('weekly');
    expect(rentKind(path('apartments-rent'), 'GB')).toBe('plain');
    expect(rentKind(path('shared-rooms'), 'GB')).toBe('period');
    expect(rentKind(path('shared-rooms'), 'AT')).toBe('plain');
    // AT: the extra costs are part of the whole rent, optional; FR: required by law
    expect((await field('apartments-rent', 'AT', 'extra_costs')).labelFa).toContain('Betriebskosten');
    expect((await field('apartments-rent', 'AT', 'extra_costs')).isRequired).toBe(false);
    expect((await field('apartments-rent', 'FR', 'extra_costs')).isRequired).toBe(true);
    // One rent and "bills included?" where there are no extra costs
    for (const c of ['GB', 'US', 'AU', 'SE', 'BE']) {
      expect(await offered('apartments-rent', c)).not.toContain('extra_costs');
      expect(await offered('apartments-rent', c)).toContain('bills_included');
    }
    expect(await offered('apartments-rent', 'AT')).not.toContain('wbs_required');
    expect((await field('apartments-rent', 'AU', 'deposit')).labelFa).toBe('ودیعه (bond)');
    expect((await field('commercial-rent', 'AU', 'deposit')).helpFa).toBeNull();
    // A room in GB and AU: per week or month
    expect(await offered('shared-rooms', 'GB')).toContain('rent_period');
    expect(await offered('shared-rooms', 'DE')).not.toContain('rent_period');
    const catalog = await cachedCatalog(appDb);
    const flat = catalog.bySlug.get('apartments-rent')!.id;
    expect(rentUnit(catalog, flat, 110_000, 'AT', {})).toBe('کل، ماهانه');
    expect(rentUnit(catalog, flat, 45_000, 'AU', {})).toBe('هر هفته');
    expect(rentUnit(catalog, catalog.bySlug.get('shared-rooms')!.id, 20_000, 'GB', { rent_period: 'week' })).toBe('هر هفته');
  });

  it('UK, US, CA and AU count bedrooms and bathrooms; the area in square feet in UK, US and CA', async () => {
    expect(await offered('apartments-rent', 'GB')).toEqual(expect.arrayContaining(['bathrooms', 'council_tax_band']));
    expect(await offered('apartments-rent', 'US')).not.toContain('rooms');
    expect(await offered('apartments-rent', 'US')).not.toContain('council_tax_band');
    expect(await offered('apartments-sale', 'GB')).toContain('tenure');
    expect((await field('apartments-rent', 'US', 'area_m2')).unitFa).toBe('فوت مربع');
    expect((await field('apartments-rent', 'AU', 'area_m2')).unitFa).toBe('متر مربع');
    expect((await field('apartments-rent', 'FR', 'rooms')).labelFa).toContain('pièces');
    // Energy on each country's scale, none in the US
    expect((await field('apartments-rent', 'IT', 'energy_class')).options.map((o) => o.labelFa)).toEqual(['A4', 'A3', 'A2', 'A1', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect((await field('apartments-rent', 'BE', 'energy_class')).options.map((o) => o.value)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(await offered('apartments-rent', 'US')).not.toContain('energy_class');
    expect((await field('apartments-sale', 'US', 'owner_fee')).labelFa).toContain('HOA');
  });

  it('a whole flat by the night in Berlin needs its registration number', async () => {
    const u = await user();
    const id = await draftFor(u.id, 'short-term-rent');
    const save = (attributes: Record<string, unknown>) =>
      input({ title: 'آپارتمان برای چند شب', attributes, amount: '90' }).then((x) => saveListing(appDb, { userId: u.id, listingId: id, input: x, intent: 'publish' }));
    expect(await save({ area_m2: 50, rent_period: 'night', room_type: 'entire_place' })).toMatchObject({ errors: { 'attr.registration_number': 'required' } });
    // A room, or a whole flat by the month, doesn't
    expect(await save({ area_m2: 50, rent_period: 'month', room_type: 'entire_place' })).toMatchObject({ ok: true });
    expect(registrationNumberRequired({ countryCode: 'DE', citySlug: 'munich' }, { room_type: 'entire_place', rent_period: 'night' })).toBe(false);
    expect(registrationNumberRequired({ countryCode: 'IT', citySlug: 'milan' }, { room_type: 'entire_place', rent_period: 'week' })).toBe(true);
    expect(registrationNumberRequired({ countryCode: 'IT', citySlug: 'milan' }, { room_type: 'private_room', rent_period: 'week' })).toBe(false);
  });
});

// Field audit part B (approved by the owner on Nov 5, 2026; docs/research/field-audit.md §20)
describe('jobs and vehicles per country', () => {
  const field = async (slug: string, country: string | null, key: string) => {
    const catalog = await cachedCatalog(appDb);
    return effectiveAttributes(catalog, catalog.bySlug.get(slug)!.id, country).find((d) => d.key === key)!;
  };

  it("each country's contract types and language", async () => {
    const types = async (c: string) => (await field('hospitality', c, 'employment_type')).options;
    expect((await types('DE')).map((o) => o.value)).toEqual(['full_time', 'part_time', 'minijob', 'werkstudent', 'ausbildung', 'internship', 'freelance']);
    expect((await types('DE')).find((o) => o.value === 'ausbildung')!.labelFa).toBe('آوسبیلدونگ (Ausbildung)');
    expect((await types('AT')).find((o) => o.value === 'ausbildung')!.labelFa).toContain('Lehre');
    expect((await types('AT')).map((o) => o.value)).not.toContain('werkstudent');
    expect((await types('FR')).map((o) => o.labelFa)).toContain('قرارداد دائم (CDI)');
    expect((await types('BE')).map((o) => o.value)).toEqual(['full_time', 'part_time', 'internship', 'freelance']);
    expect((await field('hospitality', 'DE', 'german_level')).labelFa).toBe('سطح زبان آلمانی');
    expect((await field('hospitality', 'NL', 'german_level')).labelFa).toBe('سطح زبان هلندی');
    expect((await field('hospitality', 'GB', 'german_level')).labelFa).toBe('سطح زبان انگلیسی');
    expect((await field('hospitality', 'BE', 'german_level')).labelFa).toBe('سطح زبان محلی');
  });

  it('salary: a range, required in Austria only', async () => {
    expect((await field('hospitality', 'AT', 'salary')).isRequired).toBe(true);
    expect((await field('hospitality', 'DE', 'salary')).isRequired).toBe(false);
    expect((await field('hospitality', 'US', 'salary')).isRequired).toBe(false);
    expect((await field('hospitality', 'DE', 'salary')).helpFa).toBe('اختیاری. ناخالص (Brutto)');
    // Jobs are posted by a business
    const u = await user();
    const { org } = await business(u.id);
    const id = await draftFor(u.id, 'hospitality');
    const save = (attributes: Record<string, unknown>) =>
      input({ title: 'آشپز (m/w/d)', attributes, priceType: 'on_request', amount: '', organizationId: org.id }).then((x) => saveListing(appDb, { userId: u.id, listingId: id, input: x, intent: 'publish' }));
    expect(await save({ employment_type: 'full_time', salary: '3000', salary_ceiling: '2500' })).toMatchObject({ errors: { 'attr.salary_ceiling': 'too_small' } });
    expect(await save({ employment_type: 'full_time', salary: '3000', salary_ceiling: '3500', salary_period: 'month' })).toMatchObject({ ok: true });
    const catalog = await cachedCatalog(appDb);
    const facts = cardFacts(catalog, catalog.bySlug.get('hospitality')!.id, 'DE', (await listing(id)).attributes as Record<string, unknown>, catalog.currencies.get('EUR'));
    expect(facts.find((f) => f.key === 'salary')!.text).toBe('۳٬۰۰۰ تا ۳٬۵۰۰\u00a0€');
  });

  it('vehicles: inspection, miles and power the local way', async () => {
    expect((await field('cars', 'DE', 'inspection_until')).labelFa).toBe('معاینه فنی (TÜV/HU) تا');
    expect((await field('cars', 'GB', 'inspection_until')).labelFa).toContain('MOT');
    expect((await field('cars', 'AU', 'inspection_until')).labelFa).toContain('rego');
    expect((await field('cars', 'US', 'inspection_until')).isActive).toBe(false);
    expect((await field('cars', 'GB', 'mileage_km')).unitFa).toBe('مایل');
    expect((await field('cars', 'DE', 'mileage_km')).unitFa).toBe('کیلومتر');
    expect((await field('cars', 'AU', 'power_hp')).unitFa).toBe('کیلووات (kW)');
    expect((await field('cars', 'DE', 'power_hp')).unitFa).toBe('اسب بخار (PS)');
    expect((await field('cars', 'US', 'emission_class')).isActive).toBe(false);
    expect((await field('cars', 'GB', 'emission_class')).isActive).toBe(true);
    expect((await field('cars', 'DE', 'service_history')).labelFa).toBe('دفترچه سرویس کامل (Scheckheft)');
    expect((await field('cars', 'GB', 'service_history')).labelFa).toBe('دفترچه سرویس کامل');
    expect((await field('motorcycles', 'AU', 'licence_class')).isActive).toBe(false);
  });

  it("categories named the country's way, the address unchanged", async () => {
    const catalog = await cachedCatalog(appDb);
    const name = (slug: string, c: string) => countryCatalog(catalog, c).bySlug.get(slug)!.nameFa;
    expect(name('apprenticeships', 'DE')).toBe('آوسبیلدونگ (Ausbildung)');
    expect(name('apprenticeships', 'AT')).toBe('کارآموزی حرفه‌ای (Lehre)');
    expect(name('apprenticeships', 'BE')).toBe('کارآموزی حرفه‌ای');
    expect(name('shared-rooms', 'GB')).toBe('اتاق و خانه اشتراکی (flatshare)');
    expect(name('shared-rooms', 'DE')).toBe('اتاق و خانه اشتراکی (WG)');
    // Turkey's closed categories stay closed
    expect(countryCatalog(catalog, 'TR').bySlug.get('cars')!.isActive).toBe(false);
  });
});

// Field audit part C (approved by the owner on Nov 5, 2026; docs/research/field-audit.md §20)
describe('sizes, exams, languages and services per country', () => {
  const field = async (slug: string, country: string | null, key: string) => {
    const catalog = await cachedCatalog(appDb);
    return effectiveAttributes(catalog, catalog.bySlug.get(slug)!.id, country).find((d) => d.key === key)!;
  };
  const label = async (slug: string, country: string, key: string, value: string) => (await field(slug, country, key)).options.find((o) => o.value === value)?.labelFa;
  const values = async (slug: string, country: string, key: string) => (await field(slug, country, key)).options.map((o) => o.value);

  it("clothes, shoes and kids' sizes the country's way", async () => {
    expect(await label('women-clothing', 'DE', 'clothing_size', 'm')).toBe('M (38)');
    expect(await label('women-clothing', 'GB', 'clothing_size', 'm')).toBe('M (10)');
    expect(await label('women-clothing', 'US', 'clothing_size', 'm')).toBe('M (6)');
    expect(await label('men-clothing', 'AU', 'clothing_size', 'm')).toBe('M (38–40)');
    expect((await field('shoes', 'GB', 'shoe_size_eu')).labelFa).toBe('سایز (بریتانیا)');
    expect((await field('shoes', 'DE', 'shoe_size_eu')).labelFa).toBe('سایز (اروپایی)');
    expect((await field('kids-clothing', 'US', 'kids_size_cm')).isActive).toBe(false);
    expect((await field('kids-clothing', 'US', 'kids_age')).isActive).toBe(true);
    expect((await field('kids-clothing', 'DE', 'kids_age')).isActive).toBe(false);
    expect((await field('kids-clothing', 'DE', 'kids_size_cm')).helpFa).not.toContain('آلمانی');
    expect(await values('car-seats', 'DE', 'car_seat_group')).toContain('isize');
  });

  it("languages, exams and school subjects the country's way", async () => {
    expect((await values('books', 'NL', 'book_language')).slice(0, 3)).toEqual(['persian', 'dutch', 'german']);
    expect((await values('books', 'DE', 'book_language')).slice(0, 3)).toEqual(['persian', 'german', 'english']);
    expect(await values('language-courses', 'BE', 'language')).toEqual(expect.arrayContaining(['dutch', 'italian', 'swedish', 'spanish']));
    expect((await field('language-courses', 'DE', 'exam_prep')).labelFa).toContain('Goethe');
    expect((await field('language-courses', 'GB', 'exam_prep')).labelFa).toContain('IELTS');
    expect((await field('language-courses', 'BE', 'exam_prep')).labelFa).toBe('آمادگی آزمون زبان');
    expect(await label('tutoring', 'NL', 'subjects', 'german')).toBe('هلندی (درسی)');
    expect(await values('tutoring', 'GB', 'subjects')).not.toContain('german');
    expect(await label('tutoring', 'DE', 'school_levels', 'abitur')).toBe('آبیتور یا ماتورا');
    expect(await label('tutoring', 'AT', 'school_levels', 'abitur')).toBe('ماتورا (Matura)');
    expect(eventLanguagesIn('NL')).toEqual(['fa', 'nl', 'en', 'other']);
    expect(eventLanguagesIn('GB')).toEqual(['fa', 'en', 'other']);
    expect(eventLanguagesIn('DE')).toEqual(['fa', 'de', 'en', 'other']);
  });

  it('service words and price units by country and category', async () => {
    expect(await label('moving-transport', 'DE', 'moving_services', 'clearance')).toBe('تخلیه و دورریزی (Entrümpelung)');
    expect(await label('moving-transport', 'GB', 'moving_services', 'clearance')).toBe('تخلیه و دورریزی');
    expect((await field('translation', 'FR', 'certified')).labelFa).toBe('ترجمه رسمی (assermentée)');
    expect((await field('translation', 'DE', 'certified')).labelFa).toBe('ترجمه رسمی (beglaubigt)');
    expect(await values('cleaning', 'DE', 'price_unit')).toEqual(['hour', 'job', 'day', 'm2']);
    expect(await values('translation', 'DE', 'price_unit')).toEqual(['page', 'hour', 'job']);
    expect(await values('beauty-services', 'DE', 'price_unit')).toEqual(['hour', 'job', 'day']);
  });

  it('a ride has one price, its share of the costs per passenger', async () => {
    const catalog = await cachedCatalog(appDb);
    const types = categoryPriceTypes(catalog, catalog.bySlug.get('rideshare')!);
    expect(types).not.toContain('negotiable');
    expect(types).not.toContain('exchange');
    expect(types).toContain('fixed');
    expect(categoryPriceTypes(catalog, catalog.bySlug.get('mobile-phones')!)).toContain('negotiable');
    expect(await values('rideshare', 'DE', 'trip_type')).toEqual(['one_way', 'return']);
  });
});

