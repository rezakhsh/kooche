import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { memoryStorage } from '../src/modules/media/storage';
import { hoursFromForm, openState, validHours } from '../src/modules/organizations/hours';
import { LOGO_OUTBOX, ownLogoUpload, processLogo, requestLogoUpload } from '../src/modules/organizations/logo';
import { businessBySlug, createBusiness, legalComplete, updateBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { suggestSlug } from '../src/modules/organizations/slug';
import { startPlanCheckout } from '../src/modules/payments/checkout';
import { appDb } from './accounts';
import { db, publicToken } from './db';
import { user } from './listings-fixtures';
import { FakeGateway, seedCatalog } from './payments-fixtures';

// Wave 1, part 7 (mockups final/business-new, business-legal, business-page): a business made in
// three steps whose legal details can wait (all or none; needed before paying), its profile
// (what it does, languages, hours, Instagram and Telegram), the logo, and the page address.

beforeAll(async () => {
  await seedCatalog();
});

/** Steps 1 and 2 only: no legal details yet */
function basics(over: Partial<BusinessInput> = {}): BusinessInput {
  return {
    name: 'دارالترجمه پارسیان',
    slug: `parsian-${publicToken()}`,
    businessType: 'translation',
    tagline: '',
    place: '10623',
    placeValue: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    instagram: '',
    telegram: '',
    legalName: '',
    legalForm: '',
    representativeName: '',
    addressLine1: '',
    addressLine2: '',
    registerCourt: '',
    registrationNumber: '',
    vatId: '',
    imprintExtra: '',
    ...over,
  };
}

const legal = { legalForm: 'Einzelunternehmen', legalName: 'Nasrin Example', addressLine1: 'Kantstraße 1', email: 'info@parsian.example' } satisfies Partial<BusinessInput>;

async function create(over: Partial<BusinessInput> = {}, userId?: string) {
  const owner = userId ?? (await user()).id;
  const r = await createBusiness(appDb, { userId: owner, countryCode: 'DE', input: basics(over) });
  return { r, owner, org: r.ok ? (await businessBySlug(db, r.slug))!.org : null };
}

describe('a new business in three steps', () => {
  it('can be made without legal details; then it can’t pay yet', async () => {
    const { r, owner, org } = await create();
    expect(r).toMatchObject({ ok: true });
    expect(org).toMatchObject({ businessType: 'translation', legalName: null, addressLine1: null, email: null, postalCode: '10623' });
    expect(legalComplete(org!)).toBe(false);
    const gateway = new FakeGateway();
    const pay = () => startPlanCheckout(appDb, gateway, { userId: owner, organizationId: org!.id, plan: 'pro', interval: 'month', appUrl: 'https://peydoo.test', business: true });
    expect(await pay()).toEqual({ ok: false, reason: 'legal_missing' });
    expect(gateway.checkouts).toHaveLength(0);

    // Completing them later makes paying possible
    expect(await updateBusiness(appDb, { userId: owner, organizationId: org!.id, input: basics({ ...legal, slug: org!.slug, legalPostal: '10623' }) })).toEqual({ ok: true });
    expect(legalComplete((await businessBySlug(db, org!.slug))!.org)).toBe(true);
    expect(await pay()).toMatchObject({ ok: true });
  });

  it('takes the legal details all or none', async () => {
    expect((await create({ vatId: 'DE123456789' })).r).toMatchObject({ ok: false, reason: 'legal_incomplete', fields: { legalForm: 'required', legalName: 'required', addressLine1: 'required' } });
    expect((await create({ ...legal, email: '' })).r).toMatchObject({ ok: false, reason: 'legal_incomplete', fields: { email: 'required' } });
    // A town without a postal code isn't enough for an Impressum; step 3's postal code is
    expect((await create({ ...legal, place: 'برلین' })).r).toMatchObject({ ok: false, reason: 'postal_required', fields: { legalPostal: 'required' } });
    const { org } = await create({ ...legal, place: 'برلین', legalPostal: '10115' });
    expect(org).toMatchObject({ postalCode: '10115', placeName: 'Berlin', legalName: 'Nasrin Example' });
    expect(legalComplete(org!)).toBe(true);
    // «بعداً تکمیل می‌کنم» drops whatever was typed in step 3
    const { org: later } = await create({ vatId: 'DE987654321', legalName: 'Half', legalLater: true });
    expect(later).toMatchObject({ vatId: null, legalName: null });
  });

  it('stores what it does, languages, hours and the handles, cleaned up', async () => {
    const hours = hoursFromForm((k) => ({ 'hours.1.open': 'on', 'hours.1.from': '09:00', 'hours.1.to': '18:00', 'hours.5.open': 'on', 'hours.5.from': '18:00', 'hours.5.to': '02:00' })[k] ?? '');
    expect(hours).toEqual({ ok: true, hours: { '1': [['09:00', '18:00']], '5': [['18:00', '02:00']] } });
    const { org } = await create({
      tagline: '  ترجمهٔ رسمی   فارسی و آلمانی ',
      languages: ['en', 'fa', 'de', 'fa'],
      servesOnline: true,
      hours: hours.ok ? hours.hours : null,
      instagram: 'https://www.instagram.com/parsian.tr/',
      telegram: '@parsian_tr',
    });
    expect(org).toMatchObject({ tagline: 'ترجمهٔ رسمی فارسی و آلمانی', languages: ['fa', 'de', 'en'], servesOnline: true, instagram: 'parsian.tr', telegram: 'parsian_tr', openingHours: { '1': [['09:00', '18:00']] } });
    expect((await create({ instagram: 'not a handle!' })).r).toMatchObject({ ok: false, fields: { instagram: 'invalid' } });
    expect((await create({ telegram: 't.me/ab' })).r).toMatchObject({ ok: false, fields: { telegram: 'invalid' } });
    expect((await create({ hours: { '8': [['09:00', '10:00']] } as never })).r).toMatchObject({ ok: false, fields: { hours: 'invalid' } });
    expect((await create({ businessType: 'casino' as never })).r).toMatchObject({ ok: false, fields: { businessType: 'invalid' } });
  });
});

describe('opening hours', () => {
  const tz = 'Europe/Berlin';
  // Monday 2 November 2026: Berlin is on UTC+1
  const at = (iso: string) => new Date(iso);
  const hours = { '1': [['09:00', '18:00']], '5': [['18:00', '02:00']], '6': [['10:00', '14:00'], ['15:00', '24:00']] } as const;
  const h = hours as unknown as Parameters<typeof openState>[0];

  it('refuses times that make no sense', () => {
    expect(hoursFromForm((k) => ({ 'hours.2.open': 'on', 'hours.2.from': '10:00', 'hours.2.to': '10:00' })[k] ?? '')).toEqual({ ok: false, day: '2' });
    expect(hoursFromForm((k) => ({ 'hours.3.open': 'on', 'hours.3.from': '9:00', 'hours.3.to': '17:00' })[k] ?? '')).toEqual({ ok: false, day: '3' });
    expect(hoursFromForm(() => '')).toEqual({ ok: true, hours: null });
    expect(validHours(h)).toBe(true);
    expect(validHours({ '1': [] })).toBe(false);
    expect(validHours([])).toBe(false);
  });

  it('says open until when, or when it opens next, in the city’s time', () => {
    expect(openState(h, tz, at('2026-11-02T10:00:00Z'))).toEqual({ open: true, until: '18:00' }); // Monday 11:00
    expect(openState(h, tz, at('2026-11-02T07:00:00Z'))).toEqual({ open: false, next: { day: '1', at: '09:00', today: true } }); // Monday 08:00
    expect(openState(h, tz, at('2026-11-02T18:00:00Z'))).toEqual({ open: false, next: { day: '5', at: '18:00', today: false } }); // Monday 19:00
    // Friday 18:00–02:00 runs into Saturday night
    expect(openState(h, tz, at('2026-11-07T00:30:00Z'))).toEqual({ open: true, until: '02:00' }); // Saturday 01:30
    expect(openState(h, tz, at('2026-11-07T13:30:00Z'))).toEqual({ open: false, next: { day: '6', at: '15:00', today: true } }); // Saturday 14:30
    expect(openState(h, tz, at('2026-11-07T22:30:00Z'))).toEqual({ open: true, until: '00:00' }); // Saturday 23:30
    expect(openState({}, tz, at('2026-11-07T22:30:00Z'))).toEqual({ open: false, next: null });
  });
});

describe('the logo', () => {
  it('uses only the uploader’s own key, and the worker makes a square WebP', async () => {
    const storage = memoryStorage();
    const me = await user();
    const other = await user();
    const ticket = await requestLogoUpload(storage, { userId: me.id, contentType: 'image/png', size: 2000 });
    expect(ticket.ok).toBe(true);
    const key = ticket.ok ? ticket.key : '';
    expect(ownLogoUpload(me.id, key)).toBe(true);
    expect(ownLogoUpload(other.id, key)).toBe(false);
    expect(await requestLogoUpload(storage, { userId: me.id, contentType: 'image/gif', size: 2000 })).toEqual({ ok: false, reason: 'bad_type' });

    // Someone else's key is ignored; one's own is handed to the worker
    const { org: theirs } = await create({ logoUpload: key }, other.id);
    const { org } = await create({ logoUpload: key }, me.id);
    const events = (id: string) => db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.aggregateId, id), eq(schema.outboxEvents.eventType, LOGO_OUTBOX.uploaded)));
    expect(await events(theirs!.id)).toHaveLength(0);
    expect((await events(org!.id))[0]?.payload).toEqual({ uploadKey: key });

    const png = await sharp({ create: { width: 900, height: 600, channels: 4, background: '#0b6e77' } }).png().toBuffer();
    await storage.put(key, png, 'image/png');
    const done = await processLogo(db as never, storage, org!.id, key);
    expect(done.status).toBe('ready');
    const logoKey = done.status === 'ready' ? done.key : '';
    expect(logoKey).toMatch(new RegExp(`^logos/[0-9a-f]{2}/${org!.id}-[0-9a-f]{12}\\.webp$`));
    expect(storage.objects.has(key)).toBe(false);
    const meta = await sharp(storage.objects.get(logoKey)!.body).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect((await businessBySlug(db, org!.slug))?.org.logoKey).toBe(logoKey);

    // A file that isn't an image is dropped
    const bad = `uploads/logos/${me.id}/${crypto.randomUUID()}`;
    await storage.put(bad, Buffer.from('<svg/>'), 'image/png');
    expect(await processLogo(db as never, storage, org!.id, bad)).toEqual({ status: 'rejected', reason: 'not_an_image' });
    expect(storage.objects.has(bad)).toBe(false);

    // Removing it clears the column and sends the file to be deleted
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: org!.id, input: basics({ slug: org!.slug, removeLogo: true }) })).toEqual({ ok: true });
    expect((await businessBySlug(db, org!.slug))?.org.logoKey).toBeNull();
    const [deleted] = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.aggregateId, org!.id), eq(schema.outboxEvents.eventType, LOGO_OUTBOX.deleted)));
    expect(deleted?.payload).toEqual({ storageKey: logoKey });
  });
});

describe('the page address', () => {
  it('is suggested from the name', () => {
    expect(suggestSlug('دارالترجمه پارسیان')).toBe('daraltrjmh-parsian');
    expect(suggestSlug('Café Müller & Söhne')).toBe('cafe-muller-sohne');
    expect(suggestSlug('کسب‌وکار ۲۴')).toBe('ksbvkar-24');
    expect(suggestSlug('!!!')).toBe('');
    expect(suggestSlug('a'.repeat(60))).toHaveLength(40);
  });
});
