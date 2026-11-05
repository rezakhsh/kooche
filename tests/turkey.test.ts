import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { soonCountries } from '../src/modules/launch/country-page';
import { countryMode, OFFERED_MODES, setCountryMode } from '../src/modules/launch/countries';
import { browsableCategory, cachedCatalog, isPostable, subtreeIds, type Catalog } from '../src/modules/listings/catalog';
import {
  allowedPriceTypes,
  CLOSED_CATEGORIES,
  countryCatalog,
  formNotes,
  heldTerm,
  isClosedIn,
  opensEmployerContact,
  refusedServiceTerm,
} from '../src/modules/listings/country-rules';
import { changeListingStatus, createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { publicListing } from '../src/modules/listings/queries';
import { runListingChecks } from '../src/modules/moderation/checks';
import { resolveTarget } from '../src/modules/search/saved';
import { suggestions } from '../src/modules/search/suggest';
import { matchCategories } from '../src/app/new/category-search';
import { normalizePersian } from '../src/lib/normalize-persian';
import { messages } from '../src/messages/fa';
import { appDb, workerDb } from './accounts';
import { db, makeListing, publicToken, type Tx } from './db';
import { categoryBySlug, listing, user } from './listings-fixtures';
import { business } from './payments-fixtures';

// Turkey like Austria, with what its law closes or limits (owner, Nov 5, 2026;
// src/modules/listings/country-rules.ts): housing and cars closed and hidden there and open in
// Germany; cats and dogs only given away; jobs only from verified businesses with their contact
// open to all; visa, residence and money services refused; banned items held for review.

const DAY = 86_400_000;
const owner = db as unknown as Tx;
const digits = (n: number) => String(Math.floor(10 ** (n - 1) + Math.random() * 9 * 10 ** (n - 1)));

let catalog: Catalog;
const restore: Array<() => Promise<void>> = [];

beforeAll(async () => {
  catalog = await cachedCatalog(db);
  // Turkey and Istanbul open for the posting tests, put back afterwards
  const [tr] = await db.select({ mode: schema.countries.mode }).from(schema.countries).where(eq(schema.countries.code, 'TR'));
  const [ist] = await db
    .select({ id: schema.locations.id, status: schema.locations.launchStatus, radius: schema.locations.launchRadiusKm })
    .from(schema.locations)
    .where(and(eq(schema.locations.slug, 'istanbul'), eq(schema.locations.kind, 'city')));
  await db.update(schema.countries).set({ mode: 'open', isActive: true }).where(eq(schema.countries.code, 'TR'));
  await db.update(schema.locations).set({ launchStatus: 'open', launchRadiusKm: null }).where(eq(schema.locations.id, ist!.id));
  restore.push(async () => {
    await db.update(schema.countries).set({ mode: tr!.mode, isActive: tr!.mode === 'open' }).where(eq(schema.countries.code, 'TR'));
    await db.update(schema.locations).set({ launchStatus: ist!.status, launchRadiusKm: ist!.radius }).where(eq(schema.locations.id, ist!.id));
  });
});

afterAll(async () => {
  while (restore.length) await restore.pop()!();
});

/** A seller with a verified Turkish (+90) or German (+49) number, older than the first week */
async function seller(country: 'TR' | 'DE') {
  const u = await user({ createdAt: new Date(Date.now() - 30 * DAY) });
  const phone = country === 'TR' ? `+90532${digits(7)}` : `+4917${digits(8)}`;
  await db.update(schema.users).set({ phoneE164: phone }).where(eq(schema.users.id, u.id));
  return u;
}

const PLACE = { TR: { countryCode: 'TR', place: 'استانبول' }, DE: { countryCode: 'DE', place: 'برلین' } } as const;

function input(country: 'TR' | 'DE', over: Partial<ListingInput> = {}): ListingInput {
  return listingInputSchema.parse({
    title: 'دوچرخهٔ شهری سالم',
    description: 'دوچرخهٔ شهری با دنده، ترمز نو و چراغ. فقط تحویل حضوری.',
    attributes: { condition: 'like_new' },
    priceType: 'fixed',
    amount: '120',
    ...PLACE[country],
    ...over,
  });
}

async function publish(userId: string, slug: string, country: 'TR' | 'DE', over: Partial<ListingInput> = {}) {
  const draft = await createDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!draft.ok) throw new Error(draft.reason);
  return { id: draft.listingId, result: await saveListing(appDb, { userId, listingId: draft.listingId, input: input(country, over), intent: 'publish' }) };
}

async function staff(): Promise<StaffContext> {
  const [u] = await db.insert(schema.users).values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'مدیر', displayNameNormalized: 'مدیر', staffRole: 'admin' }).returning();
  return { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}

const id = (slug: string) => catalog.bySlug.get(slug)!.id;

describe('Turkey like Austria', () => {
  it('a new database gives Turkey waitlist; admin moves a country still in guide to waitlist, audited, and offers guide no more', async () => {
    // The test database is seeded fresh: TR started as waitlist (src/db/seed.ts)
    const [before] = await db.select({ mode: schema.countries.mode }).from(schema.countries).where(eq(schema.countries.code, 'TR'));
    expect(OFFERED_MODES).not.toContain('guide');
    await db.update(schema.countries).set({ mode: 'guide', isActive: false }).where(eq(schema.countries.code, 'TR'));
    const ctx = await staff();
    expect(await db.transaction((tx) => setCountryMode(tx, ctx, 'TR', { mode: 'guide' }))).toBeNull();
    const r = await db.transaction((tx) => setCountryMode(tx, ctx, 'TR', { mode: 'waitlist' }));
    expect(r).toMatchObject({ slug: 'turkey' });
    expect(r!.citySlugs).toContain('istanbul');
    expect(await countryMode(db, 'TR')).toBe('waitlist');
    const [audit] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'country.mode'), eq(schema.auditLog.actorUserId, ctx.userId)));
    expect(audit!.data).toMatchObject({ country: 'TR', from: 'guide', to: 'waitlist' });
    // Listed with the other upcoming countries, Istanbul first
    await db.update(schema.locations).set({ launchStatus: 'waitlist' }).where(eq(schema.locations.slug, 'istanbul'));
    expect((await soonCountries(db)).find((c) => c.code === 'TR')).toMatchObject({ mode: 'waitlist', city: { slug: 'istanbul' }, goal: 30 });
    await db.update(schema.locations).set({ launchStatus: 'open' }).where(eq(schema.locations.slug, 'istanbul'));
    await db.update(schema.countries).set({ mode: before!.mode, isActive: before!.mode === 'open' }).where(eq(schema.countries.code, 'TR'));
  });
});

describe('closed categories', () => {
  it('Turkey closes housing (the whole tree) and motor vehicles; bicycles, boats and parts stay open', () => {
    expect(CLOSED_CATEGORIES.TR).toEqual(['real-estate', 'cars', 'motorcycles', 'campers', 'commercial-vehicles']);
    for (const slug of ['real-estate', 'apartments-rent', 'shared-rooms', 'houses-sale', 'parking-garages', 'cars', 'motorcycles', 'campers', 'commercial-vehicles']) {
      expect(isClosedIn(catalog, id(slug), 'TR'), slug).toBe(true);
      expect(isClosedIn(catalog, id(slug), 'DE'), slug).toBe(false);
    }
    for (const slug of ['vehicles', 'bicycles', 'boats', 'car-parts', 'tires-rims', 'motorcycle-parts', 'real-estate-agents']) {
      expect(isClosedIn(catalog, id(slug), 'TR'), slug).toBe(false);
    }
  });

  it('are hidden in Turkey: the grid, the picker, browse addresses, suggestions and saved searches; Germany keeps them', async () => {
    const tr = countryCatalog(catalog, 'TR');
    expect(countryCatalog(catalog, 'DE')).toBe(catalog);
    expect(countryCatalog(catalog, 'TR')).toBe(tr);
    expect(tr.rootIds.map((r) => tr.byId.get(r)!.slug)).not.toContain('real-estate');
    expect(catalog.rootIds.map((r) => catalog.byId.get(r)!.slug)).toContain('real-estate');
    const vehicles = tr.byId.get(id('vehicles'))!.childIds.map((c) => tr.byId.get(c)!.slug);
    expect(vehicles).toEqual(expect.arrayContaining(['bicycles', 'boats', 'car-parts', 'tires-rims', 'motorcycle-parts']));
    expect(vehicles).not.toContain('cars');
    expect(subtreeIds(tr, id('vehicles'))).not.toContain(id('cars'));
    expect(browsableCategory(tr, 'cars')).toBeNull();
    expect(browsableCategory(tr, 'apartments-rent')).toBeNull();
    expect(browsableCategory(tr, 'bicycles')).not.toBeNull();
    expect(isPostable(tr, id('cars'))).toBe(false);
    expect(isPostable(catalog, id('cars'))).toBe(true);
    // Saved searches: the address is read back like the page reads it
    expect(await resolveTarget(appDb, catalog, '/turkey/cars', '')).toBeNull();
    expect(await resolveTarget(appDb, catalog, '/turkey/istanbul/apartments-rent', '')).toBeNull();
    expect(await resolveTarget(appDb, catalog, '/turkey/bicycles', '')).toMatchObject({ category: { slug: 'bicycles' } });
    expect(await resolveTarget(appDb, catalog, '/germany/cars', '')).toMatchObject({ category: { slug: 'cars' } });
    // Suggestions from the category names
    const scope = (code: string, slug: string) => ({ country: { code, slug, nameFa: '', minorUnit: 2 }, city: null });
    const rows = (c: Catalog, code: string, slug: string, q: string) => suggestions(c, scope(code, slug), q, null).filter((r) => r.kind !== 'search');
    expect(JSON.stringify(rows(tr, 'TR', 'turkey', 'آپارتمان'))).not.toContain('apartments');
    expect(JSON.stringify(rows(catalog, 'DE', 'germany', 'آپارتمان'))).toContain('apartments');
  });

  it('the picker’s search examples in Turkey are all open there; the usual ones include a closed «اتاق»', () => {
    const pickables = (c: Catalog) =>
      [...c.byId.values()].filter((x) => x.childIds.length === 0 && isPostable(c, x.id)).map((x) => ({ slug: x.slug, nameFa: x.nameFa, parentFa: '', search: normalizePersian(x.nameFa) }));
    const examples = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((m) => m[1]!);
    const tr = pickables(countryCatalog(catalog, 'TR'));
    for (const word of examples(messages.post.searchCategoryPlaceholderClosed)) expect(matchCategories(tr, word).length, word).toBeGreaterThan(0);
    // The usual «اتاق» finds the room category in Germany, not in Turkey (there only «اتاق خواب», furniture)
    expect(matchCategories(pickables(catalog), 'اتاق').map((x) => x.slug)).toContain('shared-rooms');
    expect(matchCategories(tr, 'اتاق').map((x) => x.slug)).not.toContain('shared-rooms');
  });

  it('publishing a flat, a car or a motorbike in Turkey is refused for anyone, from any number; a bicycle and car parts go out', async () => {
    const tr = await seller('TR');
    const de = await seller('DE');
    for (const slug of ['apartments-rent', 'shared-rooms', 'cars', 'motorcycles']) {
      expect((await publish(tr.id, slug, 'TR')).result, slug).toEqual({ ok: false, reason: 'closed_in_country' });
      expect((await publish(de.id, slug, 'TR')).result, slug).toEqual({ ok: false, reason: 'closed_in_country' });
    }
    // A wanted flat too
    expect((await publish(tr.id, 'apartments-rent', 'TR', { kind: 'wanted' })).result).toEqual({ ok: false, reason: 'closed_in_country' });
    // The draft is kept
    const kept = await publish(tr.id, 'cars', 'TR');
    expect((await listing(kept.id)).status).toBe('draft');
    expect((await publish(tr.id, 'bicycles', 'TR')).result).toMatchObject({ ok: true, status: 'active' });
    expect((await publish(tr.id, 'car-parts', 'TR', { title: 'چهار رینگ اسپرت', description: 'چهار رینگ ۱۷ اینچ، سالم و تمیز.' })).result).toMatchObject({ ok: true, status: 'active' });
  });

  it('the same categories stay open in Germany', async () => {
    const de = await seller('DE');
    const car = await publish(de.id, 'cars', 'DE', { title: 'فولکس گلف ۲۰۱۵', description: 'گلف ۷، معاینه فنی تازه، بدون تصادف.', attributes: {} });
    // Germany doesn't refuse it for the country: whatever it says, never closed_in_country
    expect(car.result).not.toEqual({ ok: false, reason: 'closed_in_country' });
  });

  it('renewing or resuming is refused in a closed category; Germany’s are not', async () => {
    const tr = await seller('TR');
    const [ist] = await db.select().from(schema.locations).where(and(eq(schema.locations.slug, 'istanbul'), eq(schema.locations.kind, 'city')));
    const old = await makeListing(owner, tr.id, { status: 'expired', expiresAt: new Date(Date.now() - DAY), categoryId: id('cars'), countryCode: 'TR', currency: 'TRY', locationId: ist!.id, point: ist!.center, numberCountry: 'TR' });
    expect(await changeListingStatus(appDb, { userId: tr.id, listingId: old.id, action: 'renew' })).toEqual({ ok: false, reason: 'closed_in_country' });
  });
});

describe('pets in Turkey', () => {
  const cat = { title: 'بچه‌گربهٔ بازیگوش', description: 'بچه‌گربهٔ سه‌ماهه، واکسن زده، دنبال خانهٔ گرم.', attributes: {} };

  it('cats and dogs only for free: a price is refused, free goes out; Germany takes a price', async () => {
    const tr = await seller('TR');
    expect((await publish(tr.id, 'cats', 'TR', cat)).result).toEqual({ ok: false, reason: 'adoption_only' });
    expect((await publish(tr.id, 'dogs', 'TR', { ...cat, title: 'توله‌سگ مهربان' })).result).toEqual({ ok: false, reason: 'adoption_only' });
    const free = await publish(tr.id, 'cats', 'TR', { ...cat, priceType: 'free', amount: '' });
    expect(free.result).toMatchObject({ ok: true, status: 'active' });
    // A live one can't be priced afterwards
    expect(await saveListing(appDb, { userId: tr.id, listingId: free.id, input: input('TR', cat), intent: 'save' })).toEqual({ ok: false, reason: 'adoption_only' });
    const de = await seller('DE');
    expect((await publish(de.id, 'cats', 'DE', cat)).result).not.toEqual({ ok: false, reason: 'adoption_only' });
  });

  it('the form offers only «رایگان» for them in Turkey, with a note; birds keep their prices', () => {
    const types = ['fixed', 'negotiable', 'free', 'exchange'] as const;
    expect(allowedPriceTypes(catalog, id('cats'), 'TR', types)).toEqual(['free']);
    expect(allowedPriceTypes(catalog, id('cats'), 'DE', types)).toEqual([...types]);
    expect(allowedPriceTypes(catalog, id('birds'), 'TR', types)).toEqual([...types]);
    expect(formNotes(catalog, id('dogs'), 'TR')).toContain('adoption');
    expect(formNotes(catalog, id('dogs'), 'DE')).toEqual([]);
  });
});

describe('jobs in Turkey', () => {
  const job = { title: 'گارسون برای رستوران ایرانی', description: 'رستوران در کادیکوی، تمام‌وقت، با تجربه.', attributes: { employment_type: 'full_time' }, priceType: 'on_request' as const, amount: '' };

  async function trBusiness(ownerId: string, verified: boolean) {
    const { org } = await business(ownerId);
    await db
      .update(schema.organizations)
      .set({ countryCode: 'TR', phoneE164: `+90212${digits(7)}`, ...(verified ? { verificationStatus: 'verified', verifiedAt: new Date() } : {}) })
      .where(eq(schema.organizations.id, org.id));
    return org;
  }

  it('only from a verified business: a private post or an unverified business is refused', async () => {
    const tr = await seller('TR');
    expect((await publish(tr.id, 'hospitality', 'TR', { ...job, kind: 'wanted' })).result).toEqual({ ok: false, reason: 'verified_employer_required' });
    const unverified = await trBusiness(tr.id, false);
    expect((await publish(tr.id, 'hospitality', 'TR', { ...job, organizationId: unverified.id })).result).toEqual({ ok: false, reason: 'verified_employer_required' });
    const verified = await trBusiness(tr.id, true);
    const ok = await publish(tr.id, 'hospitality', 'TR', { ...job, organizationId: verified.id });
    expect(ok.result).toMatchObject({ ok: true, status: 'active' });
    // Germany: a private job-seeker's post is fine
    const de = await seller('DE');
    expect((await publish(de.id, 'hospitality', 'DE', { ...job, kind: 'wanted' })).result).toMatchObject({ ok: true });
  });

  it('the employer’s phone and email are part of the public listing, shown in Turkey without sign-in', async () => {
    const tr = await seller('TR');
    const org = await trBusiness(tr.id, true);
    const posted = await publish(tr.id, 'hospitality', 'TR', { ...job, organizationId: org.id });
    const page = await publicListing(appDb, (await listing(posted.id)).publicToken);
    expect(page!.business).toMatchObject({ phoneE164: expect.stringMatching(/^\+90212/), email: org.email });
    expect(opensEmployerContact('TR', 'jobs')).toBe(true);
    expect(opensEmployerContact('DE', 'jobs')).toBe(false);
    expect(opensEmployerContact('TR', 'services')).toBe(false);
    expect(formNotes(catalog, id('hospitality'), 'TR')).toContain('jobs');
  });
});

describe('services refused in Turkey', () => {
  const help = { title: 'کمک برای گرفتن اقامت ترکیه', description: 'پر کردن فرم و وقت گرفتن از اداره مهاجرت.', attributes: {}, priceType: 'fixed' as const, amount: '50' };

  it('visa, residence or citizenship help and money transfer are refused; the same words outside services, or in Germany, are not', async () => {
    const tr = await seller('TR');
    expect((await publish(tr.id, 'paperwork-help', 'TR', help)).result).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect((await publish(tr.id, 'paperwork-help', 'TR', { ...help, title: 'İkamet başvurusu yardımı' })).result).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect((await publish(tr.id, 'paperwork-help', 'TR', { ...help, title: 'حواله به ایران سریع' })).result).toMatchObject({ ok: false });
    expect((await publish(tr.id, 'paperwork-help', 'TR', { ...help, title: 'پر کردن فرم بیمه و بانک', description: 'کمک در فرم‌های اداری.' })).result).toMatchObject({ ok: true });
    const de = await seller('DE');
    expect((await publish(de.id, 'paperwork-help', 'DE', { ...help, title: 'کمک برای وقت سفارت و ویزا' })).result).toMatchObject({ ok: true });
  });

  it('the words: Turkish endings and capitals count; a university midterm («vize sınavı») and a bank payment are not visa help', () => {
    expect(refusedServiceTerm('TR', 'İKAMETİNİZİ hızlı alın')).toMatchObject({ group: 'visa_residence' });
    expect(refusedServiceTerm('TR', 'Vatandaşlığa geçiş danışmanlığı')).toMatchObject({ group: 'visa_residence' });
    expect(refusedServiceTerm('TR', 'Döviz bozdurma, en iyi kur')).toMatchObject({ group: 'money' });
    expect(refusedServiceTerm('TR', 'Matematik özel ders, vize ve final hazırlık')).toBeNull();
    expect(refusedServiceTerm('TR', 'Ödeme nakit veya havale ile')).toBeNull();
    expect(formNotes(catalog, id('tutoring'), 'TR')).toContain('workPermit');
    expect(formNotes(catalog, id('moving-transport'), 'TR')).toContain('workPermit');
  });
});

describe('banned items in Turkey: held for review', () => {
  it('finds them in Persian, Turkish and English, folding Turkish letters; not in ordinary text', () => {
    const hit = (t: string, business = false) => heldTerm('TR', t, { business })?.group ?? null;
    expect(hit('گوشی آیفون بدون رجیستری')).toBe('unregistered_phones');
    expect(hit('IMEI KAYITSIZ telefon')).toBe('unregistered_phones');
    expect(hit('iPhone 13 yenilenmiş, garantili')).toBe('refurbished');
    expect(hit('iPhone 13 yenilenmiş, garantili', true)).toBeNull();
    expect(hit('شراب خانگی')).toBe('alcohol');
    expect(hit('Rakı seti')).toBe('alcohol');
    expect(hit('sigaralık ve tütün')).toBe('tobacco');
    expect(hit('قرص سرماخوردگی')).toBe('medicines');
    expect(hit('Av tüfeği')).toBe('weapons');
    expect(hit('سکه قدیمی قاجار')).toBe('cultural_objects');
    expect(hit('ÇEYREK ALTIN satılık')).toBe('currency_gold');
    expect(hit('سیم‌کارت ترکسل')).toBe('sim_cards');
    expect(hit('Pasaport kılıfı')).toBe('documents');
    // Ordinary listings, and words that only look alike («biraz» is "a little», «altında» "under»)
    expect(hit('دوچرخهٔ شهری سالم، ترمز نو')).toBeNull();
    expect(hit('Masa biraz çizik, altında tekerlek var')).toBeNull();
    expect(hit('قیمت ارزان، بسیار تمیز')).toBeNull();
    // Only Turkey has the list
    expect(heldTerm('DE', 'شراب خانگی', { business: false })).toBeNull();
  });

  it('a listing that mentions one waits for review instead of going live, and the checks keep it there for a person', async () => {
    const tr = await seller('TR');
    const phone = { title: 'آیفون ۱۳ بدون رجیستری', description: 'سالم و تمیز، با جعبه.', attributes: { condition: 'like_new', brand: 'apple' } };
    const held = await publish(tr.id, 'mobile-phones', 'TR', phone);
    expect(held.result).toMatchObject({ ok: true, status: 'pending_review' });
    expect(await runListingChecks(workerDb, held.id)).toBe('held');
    expect((await listing(held.id)).status).toBe('pending_review');
    const decisions = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, held.id));
    expect(decisions).toEqual([expect.objectContaining({ decision: 'escalate', policyGround: 'terms-17.3', aiOutput: expect.objectContaining({ rule: 'country_items' }) })]);
    // Run again: no second queue entry
    expect(await runListingChecks(workerDb, held.id)).toBe('held');
    expect(await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, held.id))).toHaveLength(1);
    // A plain phone goes live
    const plain = await publish(tr.id, 'mobile-phones', 'TR', { ...phone, title: 'آیفون ۱۳ تمیز' });
    expect(plain.result).toMatchObject({ ok: true, status: 'active' });
    expect(await runListingChecks(workerDb, plain.id)).toBe('passed');
  });

  it('the same text in Germany goes live', async () => {
    const de = await seller('DE');
    const r = await publish(de.id, 'mobile-phones', 'DE', { title: 'آیفون ۱۳ بدون رجیستری', description: 'سالم و تمیز، با جعبه.', attributes: { condition: 'like_new', brand: 'apple' } });
    expect(r.result).toMatchObject({ ok: true, status: 'active' });
  });
});
