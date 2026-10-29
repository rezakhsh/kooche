import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { listingInputSchema, saveListing, changeListingStatus, createDraft, ownListing, type ListingInput } from '../src/modules/listings/listings';
import { cachedCatalog } from '../src/modules/listings/catalog';
import { acceptInvitation, changeMember, invitationByToken, invite, revokeInvitation } from '../src/modules/organizations/members';
import { businessUsage, postingRefusal } from '../src/modules/organizations/limits';
import { businessBySlug, createBusiness, myBusinesses, setVerification, updateBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { managedListings } from '../src/modules/organizations/queries';
import { createEventDraft, saveEvent } from '../src/modules/events/events';
import { eventInputSchema } from '../src/modules/events/input';
import { publicListing } from '../src/modules/listings/queries';
import { appDb } from './accounts';
import { db, makeListing, publicToken, type Tx } from './db';
import { categoryBySlug, user } from './listings-fixtures';
import { business, seedCatalog, stripePriceId } from './payments-fixtures';

// Businesses (roadmap step 6, approved Oct 22, 2026): creating and editing one, members and
// invitations within the plan's seats, posting as a business within its listing limit, and the
// private limits (two service offers; job offers and regulated professions only as a business).

const DAY = 86_400_000;
const owner = db as unknown as Tx;

beforeAll(async () => {
  await seedCatalog();
});

function details(over: Partial<BusinessInput> = {}): BusinessInput {
  return {
    name: 'نان‌وایی بربری',
    slug: `barbari-${publicToken()}`,
    businessType: 'food',
    tagline: '',
    instagram: '',
    telegram: '',
    legalName: 'Barbari Bäckerei',
    legalForm: 'Einzelunternehmen',
    representativeName: '',
    addressLine1: 'Sonnenallee 1',
    addressLine2: '',
    place: '12045',
    placeValue: '',
    phone: '030 1234567',
    email: 'Kontakt@Barbari.example',
    website: 'https://barbari.example',
    registerCourt: '',
    registrationNumber: '',
    vatId: '',
    imprintExtra: '',
    description: 'نان تازه هر روز',
    ...over,
  };
}

/** A paid Pro (or Pro Plus) period for a business, as the worker would have written it */
async function givePlan(organizationId: string, code: 'pro' | 'pro-plus') {
  const [price] = await db.select().from(schema.productPrices).where(eq(schema.productPrices.providerPriceId, stripePriceId(code, 'month')));
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, price!.productId));
  const now = Date.now();
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({ organizationId, productPriceId: price!.id, providerSubscriptionId: `sub_test_${publicToken()}`, status: 'active', currentPeriodStart: new Date(now - DAY), currentPeriodEnd: new Date(now + 29 * DAY) })
    .returning();
  await db.insert(schema.entitlements).values({ type: 'pro_plan', organizationId, subscriptionId: sub!.id, providerInvoiceId: `in_test_${publicToken()}`, startsAt: new Date(now - DAY), endsAt: new Date(now + 36 * DAY), features: product!.features });
}

async function input(over: Partial<ListingInput> = {}): Promise<ListingInput> {
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

async function publishAs(userId: string, organizationId: string | null) {
  const draft = await createDraft(appDb, { userId, categoryId: (await categoryBySlug('mobile-phones')).id });
  if (!draft.ok) throw new Error(draft.reason);
  return { id: draft.listingId, result: await saveListing(appDb, { userId, listingId: draft.listingId, input: await input({ organizationId }), intent: 'publish' }) };
}

describe('creating and editing a business', () => {
  it('needs a verified phone, makes the creator its owner, stores normalized details', async () => {
    const unverified = await user({ verified: false });
    expect(await createBusiness(appDb, { userId: unverified.id, countryCode: 'DE', input: details() })).toEqual({ ok: false, reason: 'phone_required' });
    const me = await user();
    const r = await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details() });
    expect(r).toMatchObject({ ok: true });
    const found = await businessBySlug(db, r.ok ? r.slug : '');
    expect(found?.org).toMatchObject({ email: 'kontakt@barbari.example', phoneE164: '+49301234567', postalCode: '12045', placeName: 'Berlin', countryCode: 'DE', verificationStatus: 'unverified' });
    expect(found?.cityLocal).toBe('Berlin');
    expect((await myBusinesses(db, me.id))[0]).toMatchObject({ role: 'owner' });
  });

  it('refuses bad, reserved and taken addresses, a lone register number and a second account for one VAT id', async () => {
    const me = await user();
    const bad = (over: Partial<BusinessInput>) => createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details(over) });
    expect(await bad({ slug: 'Bad Slug' })).toMatchObject({ ok: false, reason: 'invalid', fields: { slug: 'invalid' } });
    expect(await bad({ slug: 'pro' })).toMatchObject({ ok: false, reason: 'slug_reserved' });
    expect(await bad({ website: 'http://insecure.example' })).toMatchObject({ ok: false, fields: { website: 'invalid' } });
    expect(await bad({ place: 'Atlantis 99999' })).toMatchObject({ ok: false, reason: 'place_not_found' });
    expect(await bad({ phone: '123' })).toMatchObject({ ok: false, reason: 'phone_invalid' });
    expect(await bad({ registrationNumber: 'HRB 1234' })).toMatchObject({ ok: false, reason: 'register_incomplete' });
    const taken = details();
    expect((await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: { ...taken, vatId: 'DE123456789' } })).ok).toBe(true);
    expect(await bad({ slug: taken.slug })).toMatchObject({ ok: false, reason: 'slug_taken' });
    expect(await bad({ vatId: 'de 123 456 789' })).toMatchObject({ ok: false, reason: 'vat_taken' });
  });

  it('allows at most three businesses per person', async () => {
    const me = await user();
    for (let i = 0; i < 3; i++) expect((await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details() })).ok).toBe(true);
    expect(await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details() })).toEqual({ ok: false, reason: 'too_many' });
  });

  it('only the owner edits; changing the legal details clears the verified badge', async () => {
    const { org, ownerId } = await business();
    const manager = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: manager.id, role: 'manager' });
    expect(await updateBusiness(appDb, { userId: manager.id, organizationId: org.id, input: details({ slug: org.slug }) })).toEqual({ ok: false, reason: 'not_found' });
    await setVerification(db, { slug: org.slug, status: 'verified', byUserId: null });
    expect((await updateBusiness(appDb, { userId: ownerId, organizationId: org.id, input: details({ slug: org.slug }) })).ok).toBe(true);
    const after = await businessBySlug(db, org.slug);
    expect(after?.org.verificationStatus).toBe('unverified');
    expect(after?.org.slug).toBe(org.slug);
  });

  it('may mark the shop’s exact spot on the street map, near its postal code only', async () => {
    const me = await user();
    // 12045 Neukölln; a pin on Sonnenallee
    const r = await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details({ pin: '52.48601,13.43521' }) });
    expect(r).toMatchObject({ ok: true });
    const found = await businessBySlug(db, r.ok ? r.slug : '');
    expect(found?.org.pin).toEqual({ lat: 52.48601, lng: 13.43521 });
    // Hamburg is no place for a Neukölln shop's pin; nonsense isn't a pin at all
    expect(await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details({ pin: '53.5511,9.9937' }) })).toMatchObject({ ok: false, reason: 'pin_far', fields: { pin: 'pin_far' } });
    expect(await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details({ pin: 'here' }) })).toMatchObject({ ok: false, reason: 'invalid', fields: { pin: 'invalid' } });
    // Editing without a pin removes it
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: r.ok ? r.id : '', input: details({ slug: found!.org.slug }) })).toEqual({ ok: true });
    expect((await businessBySlug(db, found!.org.slug))?.org.pin).toBeNull();
  });

  it('suspended businesses have no page', async () => {
    const { org } = await business();
    await db.update(schema.organizations).set({ status: 'suspended' }).where(eq(schema.organizations.id, org.id));
    expect(await businessBySlug(db, org.slug)).toBeNull();
    expect(await businessBySlug(db, '../etc')).toBeNull();
  });
});

describe('members and invitations', () => {
  it('without Pro there are no seats; Pro has one, checked again on accepting', async () => {
    const { org, ownerId } = await business();
    const guest = await user();
    expect(await invite(appDb, { userId: ownerId, organizationId: org.id, email: guest.email, role: 'staff' })).toEqual({ ok: false, reason: 'no_seats' });
    await givePlan(org.id, 'pro');
    const first = await invite(appDb, { userId: ownerId, organizationId: org.id, email: guest.email, role: 'staff' });
    expect(first).toMatchObject({ ok: true });
    // The pending invitation takes the only seat
    expect(await invite(appDb, { userId: ownerId, organizationId: org.id, email: 'someone@example.test', role: 'staff' })).toEqual({ ok: false, reason: 'no_seats' });
    expect(await acceptInvitation(appDb, { userId: guest.id, token: first.ok ? first.token : '' })).toMatchObject({ ok: true, slug: org.slug });
    const [m] = await db.select().from(schema.organizationMembers).where(and(eq(schema.organizationMembers.organizationId, org.id), eq(schema.organizationMembers.userId, guest.id)));
    expect(m?.role).toBe('staff');
  });

  it('only the invited account accepts, once, and not after expiry or revocation', async () => {
    const { org, ownerId } = await business();
    await givePlan(org.id, 'pro-plus');
    const [guest, other] = await Promise.all([user(), user()]);
    const a = await invite(appDb, { userId: ownerId, organizationId: org.id, email: guest.email.toUpperCase(), role: 'manager' });
    const token = a.ok ? a.token : '';
    expect((await invitationByToken(db, token))?.usable).toBe(true);
    expect(await acceptInvitation(appDb, { userId: other.id, token })).toEqual({ ok: false, reason: 'wrong_account' });
    expect(await acceptInvitation(appDb, { userId: guest.id, token: 'x'.repeat(32) })).toEqual({ ok: false, reason: 'not_found' });
    expect(await acceptInvitation(appDb, { userId: guest.id, token, now: new Date(Date.now() + 8 * DAY) })).toEqual({ ok: false, reason: 'expired' });
    expect((await acceptInvitation(appDb, { userId: guest.id, token })).ok).toBe(true);
    expect(await acceptInvitation(appDb, { userId: guest.id, token })).toEqual({ ok: false, reason: 'not_found' });

    const b = await invite(appDb, { userId: ownerId, organizationId: org.id, email: other.email, role: 'staff' });
    const [pending] = await db.select().from(schema.organizationInvitations).where(and(eq(schema.organizationInvitations.organizationId, org.id), eq(schema.organizationInvitations.email, other.email)));
    expect(await revokeInvitation(appDb, { userId: guest.id, organizationId: org.id, invitationId: pending!.id })).toBe(false); // managers can't
    expect(await revokeInvitation(appDb, { userId: ownerId, organizationId: org.id, invitationId: pending!.id })).toBe(true);
    expect(await acceptInvitation(appDb, { userId: other.id, token: b.ok ? b.token : '' })).toEqual({ ok: false, reason: 'not_found' });
    // Only a hash is stored
    expect(pending!.tokenHash.toString('base64url')).not.toBe(b.ok ? b.token : '');
  });

  it('managers can’t invite; the last owner can’t leave or step down; others can leave', async () => {
    const { org, ownerId } = await business();
    await givePlan(org.id, 'pro-plus');
    const manager = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: manager.id, role: 'manager' });
    expect(await invite(appDb, { userId: manager.id, organizationId: org.id, email: 'x@example.test', role: 'staff' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: ownerId, to: 'removed' })).toEqual({ ok: false, reason: 'last_owner' });
    expect(await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: ownerId, to: 'manager' })).toEqual({ ok: false, reason: 'last_owner' });
    expect(await changeMember(appDb, { userId: manager.id, organizationId: org.id, memberId: ownerId, to: 'staff' })).toEqual({ ok: false, reason: 'not_found' });
    expect((await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: manager.id, to: 'owner' })).ok).toBe(true);
    // Now there are two owners: the first may step down
    expect((await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: ownerId, to: 'staff' })).ok).toBe(true);
    expect((await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: ownerId, to: 'removed' })).ok).toBe(true);
  });
});

describe('posting as a business', () => {
  it('a business has 3 active listings without Pro, 25 with it; renewing counts like publishing', async () => {
    const { org, ownerId } = await business();
    // An account older than 7 days, so the new-account limit (3 a day) doesn't get in the way
    await db.update(schema.users).set({ createdAt: new Date(Date.now() - 30 * DAY) }).where(eq(schema.users.id, ownerId));
    for (let i = 0; i < 3; i++) expect((await publishAs(ownerId, org.id)).result).toMatchObject({ ok: true, status: 'active' });
    const fourth = await publishAs(ownerId, org.id);
    expect(fourth.result).toEqual({ ok: false, reason: 'business_limit' });
    expect((await businessUsage(db, org.id)).active).toBe(3);
    // Privately the same person may still post
    expect((await publishAs(ownerId, null)).result).toMatchObject({ ok: true });

    await givePlan(org.id, 'pro');
    expect((await saveListing(appDb, { userId: ownerId, listingId: fourth.id, input: await input({ organizationId: org.id }), intent: 'publish' })).ok).toBe(true);
    expect(await businessUsage(db, org.id)).toMatchObject({ active: 4, limit: 25 });

    // An expired business listing renewed when the plan is full again
    const expired = await makeListing(owner, ownerId, { organizationId: org.id, status: 'expired' });
    await db.update(schema.entitlements).set({ revokedAt: new Date(), revokeReason: 'test' }).where(eq(schema.entitlements.organizationId, org.id));
    expect(await changeListingStatus(appDb, { userId: ownerId, listingId: expired.id, action: 'renew' })).toEqual({ ok: false, reason: 'business_limit' });
  });

  it('a business’s listings and events go live only with its legal details complete (owner, Oct 28, 2026)', async () => {
    const me = await user();
    await db.update(schema.users).set({ createdAt: new Date(Date.now() - 30 * DAY) }).where(eq(schema.users.id, me.id));
    const blank = { legalName: '', legalForm: '', addressLine1: '', email: '' } as const;
    const made = await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details(blank) });
    if (!made.ok) throw new Error(made.reason);
    expect((await myBusinesses(db, me.id))[0]).toMatchObject({ id: made.id, legal: false });

    // A listing as the business stays a draft and says why; privately the person still posts
    const first = await publishAs(me.id, made.id);
    expect(first.result).toEqual({ ok: false, reason: 'legal_missing' });
    expect((await ownListing(db, me.id, first.id))?.listing.status).toBe('draft');
    expect((await publishAs(me.id, null)).result).toMatchObject({ ok: true, status: 'active' });

    // So does an event
    const event = await createEventDraft(appDb, { userId: me.id, categoryId: (await categoryBySlug('event-parties')).id });
    if (!event.ok) throw new Error(event.reason);
    const eventInput = await input({ organizationId: made.id, place: '12045', attributes: {} });
    const eventDetails = eventInputSchema.parse({ startDate: '2026-12-19', startTime: '20:00', endTime: '23:30', venueName: 'Kulturhaus Neukölln', streetAddress: 'Karl-Marx-Straße 141', organizerName: 'نان‌وایی بربری', languages: ['fa'] });
    expect(await saveEvent(appDb, { userId: me.id, listingId: event.listingId, input: eventInput, event: eventDetails, intent: 'publish' })).toEqual({ ok: false, reason: 'legal_missing' });

    // With the Impressum complete both go live, and it can't be emptied again
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: made.id, input: details() })).toEqual({ ok: true });
    expect((await myBusinesses(db, me.id))[0]).toMatchObject({ legal: true });
    expect((await saveListing(appDb, { userId: me.id, listingId: first.id, input: await input({ organizationId: made.id }), intent: 'publish' })).ok).toBe(true);
    expect(await saveEvent(appDb, { userId: me.id, listingId: event.listingId, input: eventInput, event: eventDetails, intent: 'publish' })).toMatchObject({ ok: true, status: 'active' });
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: made.id, input: details(blank) })).toMatchObject({ ok: false, reason: 'legal_incomplete' });

    // Renewing waits for it too (a business whose details went missing another way)
    const expired = await makeListing(owner, me.id, { organizationId: made.id, status: 'expired' });
    await db.update(schema.organizations).set({ legalName: null }).where(eq(schema.organizations.id, made.id));
    expect(await changeListingStatus(appDb, { userId: me.id, listingId: expired.id, action: 'renew' })).toEqual({ ok: false, reason: 'legal_missing' });
  });

  it('only members post as the business; the choice is fixed once the listing is out', async () => {
    const { org, ownerId } = await business();
    const stranger = await user();
    expect((await publishAs(stranger.id, org.id)).result).toEqual({ ok: false, reason: 'not_member' });
    const { id } = await publishAs(ownerId, org.id);
    // A later edit can't move it to private
    expect((await saveListing(appDb, { userId: ownerId, listingId: id, input: await input({ organizationId: null, title: 'ویرایش شد' }), intent: 'save' })).ok).toBe(true);
    const row = await ownListing(db, ownerId, id);
    expect(row?.listing.organizationId).toBe(org.id);
    expect((await publicListing(db, row!.listing.publicToken))?.business).toMatchObject({ slug: org.slug });
  });

  it('managers manage every listing of the business, staff only their own, outsiders none', async () => {
    const { org, ownerId } = await business();
    await givePlan(org.id, 'pro-plus');
    const [manager, staff, stranger] = await Promise.all([user(), user(), user()]);
    await db.insert(schema.organizationMembers).values([
      { organizationId: org.id, userId: manager.id, role: 'manager' },
      { organizationId: org.id, userId: staff.id, role: 'staff' },
    ]);
    const { id: ownersListing } = await publishAs(ownerId, org.id);
    const { id: staffListing } = await publishAs(staff.id, org.id);
    expect(await ownListing(appDb, manager.id, staffListing)).not.toBeNull();
    expect(await ownListing(appDb, staff.id, ownersListing)).toBeNull();
    expect(await ownListing(appDb, stranger.id, ownersListing)).toBeNull();
    expect((await changeListingStatus(appDb, { userId: manager.id, listingId: staffListing, action: 'pause' })).ok).toBe(true);
    expect(await changeListingStatus(appDb, { userId: staff.id, listingId: ownersListing, action: 'pause' })).toEqual({ ok: false, reason: 'not_found' });
    expect((await managedListings(db, org.id, { onlyPostedBy: staff.id })).map((l) => l.id)).toEqual([staffListing]);
    expect((await managedListings(db, org.id)).length).toBe(2);
  });
});

describe('private and business limits', () => {
  it('private people have 2 live and 4 new service or lesson offers; requests are free; a business has none of that limit', async () => {
    const catalog = await cachedCatalog(db);
    const me = await user();
    const [translation, beauty, paperwork] = await Promise.all([categoryBySlug('translation'), categoryBySlug('beauty-services'), categoryBySlug('paperwork-help')]);
    await makeListing(owner, me.id, { categoryId: translation.id });
    await makeListing(owner, me.id, { categoryId: beauty.id });
    const third = await makeListing(owner, me.id, { categoryId: paperwork.id, status: 'expired' });
    expect(await postingRefusal(db, catalog, third)).toBe('private_service_limit');
    expect(await changeListingStatus(appDb, { userId: me.id, listingId: third.id, action: 'renew' })).toEqual({ ok: false, reason: 'private_service_limit' });
    expect(await postingRefusal(db, catalog, { ...third, kind: 'wanted' })).toBeNull();
    // Other categories aren't counted
    const phone = await makeListing(owner, me.id, { status: 'expired' });
    expect(await postingRefusal(db, catalog, phone)).toBeNull();
    const { org } = await business(me.id);
    expect(await postingRefusal(db, catalog, { ...third, organizationId: org.id })).toBeNull();
  });

  it('services open to everyone have no limit: tutoring, childcare, cleaning, pet care, help with moving', async () => {
    const catalog = await cachedCatalog(db);
    const me = await user();
    const slugs = ['tutoring', 'childcare', 'cleaning', 'pet-care', 'moving-transport'];
    for (const slug of slugs) await makeListing(owner, me.id, { categoryId: (await categoryBySlug(slug)).id });
    const sixth = await makeListing(owner, me.id, { categoryId: (await categoryBySlug('tutoring')).id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, sixth)).toBeNull();
    // …and don't count towards the others
    const photo = await makeListing(owner, me.id, { categoryId: (await categoryBySlug('photography')).id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, photo)).toBeNull();
  });

  it('new ones count for 30 days whatever happened to them, so deleting and posting again doesn’t reset the limit', async () => {
    const catalog = await cachedCatalog(db);
    const me = await user();
    const beauty = await categoryBySlug('beauty-services');
    const day = 86_400_000;
    for (let i = 0; i < 4; i++) await makeListing(owner, me.id, { categoryId: beauty.id, status: 'deleted', deletedAt: new Date(), publishedAt: new Date(Date.now() - (i + 1) * day) });
    const fifth = await makeListing(owner, me.id, { categoryId: beauty.id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, fifth)).toBe('private_service_limit');
    // One of them 31 days ago: room again
    await db.update(schema.listings).set({ publishedAt: new Date(Date.now() - 31 * day) }).where(and(eq(schema.listings.userId, me.id), eq(schema.listings.status, 'deleted'))).returning();
    expect(await postingRefusal(db, catalog, fifth)).toBeNull();
  });

  it('property 2 live, cars 2 in 12 months, goods 30 live and 40 new in 30 days', async () => {
    const catalog = await cachedCatalog(db);
    const me = await user();
    const [flat, room, cars, phones] = await Promise.all([categoryBySlug('apartments-rent'), categoryBySlug('shared-rooms'), categoryBySlug('cars'), categoryBySlug('mobile-phones')]);
    await makeListing(owner, me.id, { categoryId: flat.id });
    await makeListing(owner, me.id, { categoryId: room.id });
    const thirdHome = await makeListing(owner, me.id, { categoryId: room.id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, thirdHome)).toBe('private_property_limit');
    // Cars: two published this year, even if sold since
    await makeListing(owner, me.id, { categoryId: cars.id, status: 'sold', publishedAt: new Date(Date.now() - 200 * 86_400_000) });
    await makeListing(owner, me.id, { categoryId: cars.id, status: 'sold' });
    const thirdCar = await makeListing(owner, me.id, { categoryId: cars.id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, thirdCar)).toBe('private_car_limit');
    // Goods: 30 live
    const other = await user();
    for (let i = 0; i < 30; i++) await makeListing(owner, other.id, { categoryId: phones.id, publishedAt: new Date(Date.now() - 40 * 86_400_000) });
    const more = await makeListing(owner, other.id, { categoryId: phones.id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, more)).toBe('private_goods_limit');
    expect(await postingRefusal(db, catalog, { ...more, kind: 'wanted' })).toBeNull();
  });

  it('job offers and licensed services only as a business; licensed ones only once it is verified; job seekers privately', async () => {
    const catalog = await cachedCatalog(db);
    const me = await user();
    const [jobs, tax, legal, translation] = await Promise.all([categoryBySlug('it-jobs'), categoryBySlug('tax-accounting'), categoryBySlug('legal-immigration'), categoryBySlug('translation')]);
    const offer = { id: '00000000-0000-7000-8000-000000000001', userId: me.id, organizationId: null, categoryId: jobs.id, kind: 'offer' as const };
    expect(await postingRefusal(db, catalog, offer)).toBe('business_only');
    expect(await postingRefusal(db, catalog, { ...offer, kind: 'wanted' })).toBeNull();
    expect(await postingRefusal(db, catalog, { ...offer, categoryId: tax.id })).toBe('business_only');
    expect(await postingRefusal(db, catalog, { ...offer, categoryId: legal.id })).toBe('business_only');
    // Sworn translation is licensed; plain translation isn't
    expect(await postingRefusal(db, catalog, { ...offer, categoryId: translation.id, attributes: { certified: true } })).toBe('business_only');
    expect(await postingRefusal(db, catalog, { ...offer, categoryId: translation.id, attributes: { certified: false } })).toBeNull();
    const { org } = await business(me.id);
    expect(await postingRefusal(db, catalog, { ...offer, organizationId: org.id })).toBeNull();
    expect(await postingRefusal(db, catalog, { ...offer, organizationId: org.id, categoryId: tax.id })).toBe('licence_required');
    await db.update(schema.organizations).set({ verificationStatus: 'verified', verifiedAt: new Date() }).where(eq(schema.organizations.id, org.id));
    expect(await postingRefusal(db, catalog, { ...offer, organizationId: org.id, categoryId: tax.id })).toBeNull();
    // Members of a business may open the business-only category
    expect((await createDraft(appDb, { userId: me.id, categoryId: tax.id })).ok).toBe(true);
    const loner = await user();
    expect(await createDraft(appDb, { userId: loner.id, categoryId: tax.id })).toEqual({ ok: false, reason: 'business_only' });
  });
});
