import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { listingPhone } from '../src/modules/listings/queries';
import { acceptInvitation, changeMember, invitationByToken, invite } from '../src/modules/organizations/members';
import { businessBySlug, createBusiness, setVerification, updateBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { telegramCopy, signedOutMail } from '../src/modules/moderation/notices';
import { maskEmail } from '../src/modules/users/phone';
import { purgeDeletedListings } from '../src/modules/listings/purge';
import { exportUserData } from '../src/modules/users/export';
import { HELD_PREFIX, imageUrlsOf, syncPhotoVisibility } from '../src/modules/media/hold';
import { memoryStorage } from '../src/modules/media/storage';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, publicToken, type Tx } from './db';
import { categoryBySlug, user } from './listings-fixtures';
import { business, seedCatalog, stripePriceId } from './payments-fixtures';

// Check B, package 1 (people and privacy, approved Oct 31, 2026): a person's number shows only
// by their own choice, banned members and moderators lose powers over their own cases, and what
// the privacy policy promises (export, purge, deletion) is what the code does.

const tx = db as unknown as Tx;

beforeAll(async () => {
  await seedCatalog();
});

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

async function tokenOf(listingId: string) {
  const [l] = await db.select({ token: schema.listings.publicToken }).from(schema.listings).where(eq(schema.listings.id, listingId));
  return l!.token;
}

describe('«نمایش شماره» is the poster’s own choice', () => {
  it('a former member’s listings stop showing a number when they pass to the owner', async () => {
    const { org, ownerId } = await business();
    const staff = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: staff.id, role: 'staff' });
    const l = await makeListing(tx, staff.id, { organizationId: org.id, allowPhoneContact: true });
    expect((await listingPhone(appDb, l.publicToken))?.sellerId).toBe(staff.id);
    expect((await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: staff.id, to: 'removed' })).ok).toBe(true);
    expect(await listingPhone(appDb, l.publicToken)).toBeNull();
  });

  it('a manager editing the owner’s listing can’t turn the owner’s number on', async () => {
    const { org, ownerId } = await business();
    const manager = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: manager.id, role: 'manager' });
    const draft = await createDraft(appDb, { userId: ownerId, categoryId: (await categoryBySlug('mobile-phones')).id });
    if (!draft.ok) throw new Error(draft.reason);
    expect((await saveListing(appDb, { userId: ownerId, listingId: draft.listingId, input: await input({ organizationId: org.id }), intent: 'publish' })).ok).toBe(true);
    expect((await saveListing(appDb, { userId: manager.id, listingId: draft.listingId, input: await input({ organizationId: org.id, allowPhoneContact: true }), intent: 'save' })).ok).toBe(true);
    expect(await listingPhone(appDb, await tokenOf(draft.listingId))).toBeNull();
    // The owner may
    expect((await saveListing(appDb, { userId: ownerId, listingId: draft.listingId, input: await input({ organizationId: org.id, allowPhoneContact: true }), intent: 'save' })).ok).toBe(true);
    expect((await listingPhone(appDb, await tokenOf(draft.listingId)))?.sellerId).toBe(ownerId);
  });
});

/** Pro Plus for a business, as the worker would have written it (as in business.test.ts) */
async function givePlan(organizationId: string) {
  const [price] = await db.select().from(schema.productPrices).where(eq(schema.productPrices.providerPriceId, stripePriceId('pro-plus', 'month')));
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, price!.productId));
  const now = Date.now();
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({ organizationId, productPriceId: price!.id, providerSubscriptionId: `sub_test_${publicToken()}`, status: 'active', currentPeriodStart: new Date(now - 86_400_000), currentPeriodEnd: new Date(now + 29 * 86_400_000) })
    .returning();
  await db.insert(schema.entitlements).values({ type: 'pro_plan', organizationId, subscriptionId: sub!.id, providerInvoiceId: `in_test_${publicToken()}`, startsAt: new Date(now - 86_400_000), endsAt: new Date(now + 36 * 86_400_000), features: product!.features });
}

async function ban(userId: string, type: 'banned' | 'suspended' = 'banned') {
  const [d] = await db
    .insert(schema.moderationDecisions)
    .values({ userId, decision: 'sanction', reasonCode: 'spam', policyGround: 'terms-spam', statementFa: 'هرزنامه', decidedBy: 'rule' })
    .returning();
  await db.insert(schema.userSanctions).values({ userId, type, moderationDecisionId: d!.id, ...(type === 'suspended' ? { endsAt: new Date(Date.now() + 7 * 86_400_000) } : {}) });
}

describe('banned members and old invitations', () => {
  it('a banned co-owner can’t remove or demote the other owner, but may leave', async () => {
    const { org, ownerId } = await business();
    const other = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: other.id, role: 'owner' });
    await ban(ownerId);
    expect(await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: other.id, to: 'removed' })).toEqual({ ok: false, reason: 'restricted' });
    expect(await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: other.id, to: 'staff' })).toEqual({ ok: false, reason: 'restricted' });
    expect(await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: ownerId, to: 'removed' })).toEqual({ ok: true });
  });

  it('an invitation stops working when its sender is no longer an owner, and a banned person can’t accept one', async () => {
    const { org, ownerId } = await business();
    const second = await user();
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: second.id, role: 'owner' });
    await givePlan(org.id);
    const guest = await user();
    const sent = await invite(appDb, { userId: second.id, organizationId: org.id, email: guest.email, role: 'staff' });
    if (!sent.ok) throw new Error(sent.reason);
    // The sender is demoted: the link no longer works
    expect((await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: second.id, to: 'staff' })).ok).toBe(true);
    expect((await invitationByToken(db, sent.token))?.usable).toBe(false);
    expect(await acceptInvitation(appDb, { userId: guest.id, token: sent.token })).toEqual({ ok: false, reason: 'expired' });
    // A banned person can't join
    const banned = await user();
    const again = await invite(appDb, { userId: ownerId, organizationId: org.id, email: banned.email, role: 'staff' });
    if (!again.ok) throw new Error(again.reason);
    await ban(banned.id);
    expect(await acceptInvitation(appDb, { userId: banned.id, token: again.token })).toEqual({ ok: false, reason: 'restricted' });
  });
});

describe('account notices from staff go by Telegram too', () => {
  it('a linked Telegram gets the same text as the email; no Telegram, no copy', async () => {
    const u = await user();
    const mail = await signedOutMail(db, u.id, 'https://peydoo.example');
    expect(await telegramCopy(db, redis, u.id, mail!)).toBeNull();
    await db.update(schema.users).set({ telegramUserId: 900_000_000 + Math.floor(Math.random() * 1_000_000) }).where(eq(schema.users.id, u.id));
    const tg = await telegramCopy(db, redis, u.id, mail!);
    expect(tg?.text).toContain(mail!.subject);
    expect(tg?.text).toContain('https://peydoo.example/login');
  });
});

describe('a suspended business publishes nothing', () => {
  it('a member’s draft for it stays a draft', async () => {
    const { org, ownerId } = await business();
    const draft = await createDraft(appDb, { userId: ownerId, categoryId: (await categoryBySlug('mobile-phones')).id });
    if (!draft.ok) throw new Error(draft.reason);
    expect((await saveListing(appDb, { userId: ownerId, listingId: draft.listingId, input: await input({ organizationId: org.id }), intent: 'save' })).ok).toBe(true);
    await db.update(schema.organizations).set({ status: 'suspended' }).where(eq(schema.organizations.id, org.id));
    expect(await saveListing(appDb, { userId: ownerId, listingId: draft.listingId, input: await input({ organizationId: org.id }), intent: 'publish' })).toEqual({ ok: false, reason: 'not_allowed' });
  });
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

describe('the verified badge', () => {
  it('goes back to staff after an address or legal change, not after a phone change (owner, Oct 31, 2026)', async () => {
    const me = await user();
    const made = await createBusiness(appDb, { userId: me.id, countryCode: 'DE', input: details() });
    if (!made.ok) throw new Error(made.reason);
    const verify = () => setVerification(db, { slug: made.slug, status: 'verified', byUserId: null });
    const status = async () => (await businessBySlug(db, made.slug))?.org.verificationStatus;
    await verify();
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: made.id, input: details({ slug: made.slug, phone: '030 7654321' }) })).toEqual({ ok: true });
    expect(await status()).toBe('verified');
    expect(await updateBusiness(appDb, { userId: me.id, organizationId: made.id, input: details({ slug: made.slug, phone: '030 7654321', addressLine1: 'Sonnenallee 99' }) })).toEqual({ ok: true });
    expect(await status()).toBe('unverified');
  });
});

describe('the Telegram bot names the account', () => {
  it('half hidden: enough to recognise one’s own', () => {
    expect(maskEmail('sara.k@gmail.com')).toBe('s•••@gmail.com');
  });
});

describe('photos of a taken-down or deleted listing', () => {
  it('move where no published address reaches them, and back when the listing is live again', async () => {
    const storage = memoryStorage();
    const seller = await user();
    const l = await makeListing(tx, seller.id);
    const key = `listings/ab/${publicToken()}.webp`;
    await storage.put(key, Buffer.from('photo'), 'image/webp');
    await db.insert(schema.listingImages).values({
      listingId: l.id, uploaderUserId: seller.id, position: 0, storageKey: key, status: 'ready', mimeType: 'image/webp', width: 10, height: 10, byteSize: 5,
      blurPlaceholder: 'x', phash: 1n, sha256: Buffer.alloc(32, 1), processedAt: new Date(),
    } as never);
    const keyNow = async () => (await db.select({ k: schema.listingImages.storageKey }).from(schema.listingImages).where(eq(schema.listingImages.listingId, l.id)))[0]!.k;

    // Live: nothing moves
    expect(await syncPhotoVisibility(workerDb, storage, l.id)).toEqual([]);
    // Taken down: the master moves, the old key (to purge) comes back, the old object is gone
    await db.update(schema.listings).set({ status: 'rejected' }).where(eq(schema.listings.id, l.id));
    expect(await syncPhotoVisibility(workerDb, storage, l.id)).toEqual([key]);
    expect(await keyNow()).toBe(`${HELD_PREFIX}${key}`);
    expect(storage.objects.has(key)).toBe(false);
    expect(storage.objects.has(`${HELD_PREFIX}${key}`)).toBe(true);
    // Back again
    await db.update(schema.listings).set({ status: 'active' }).where(eq(schema.listings.id, l.id));
    // Its public addresses are purged again: Cloudflare kept the 404s of the held time
    expect(await syncPhotoVisibility(workerDb, storage, l.id)).toEqual([key]);
    expect(await keyNow()).toBe(key);
    expect(storage.objects.has(key)).toBe(true);
    expect(storage.objects.has(`${HELD_PREFIX}${key}`)).toBe(false);
  });

  it('every size and format of a photo is purged', () => {
    const urls = imageUrlsOf({ baseUrl: 'https://img.example', key: 'aa'.repeat(16), salt: 'bb'.repeat(16) }, 'listings/ab/x.webp');
    // 8 sizes (thumb, card, poster, full, phone and the event cover's three crops), AVIF and WebP
    expect(urls).toHaveLength(16);
    expect(new Set(urls).size).toBe(16);
  });
});

describe('the data export holds everything we keep', () => {
  it('businesses, follows, sanctions, «احتمالاً کسب‌وکار», sign-up source', async () => {
    const { org, ownerId } = await business();
    const other = await business();
    await db.insert(schema.organizationFollows).values({ organizationId: other.org.id, userId: ownerId });
    await ban(ownerId, 'suspended');
    await db.insert(schema.businessSuspicions).values({ userId: ownerId, reasons: [{ code: 'company_name' }], rootSlugs: ['electronics'] });
    await db.update(schema.users).set({ signupSource: 'instagram', signupAnswer: 'instagram' } as never).where(eq(schema.users.id, ownerId));
    const data = await exportUserData(appDb, ownerId, 'https://app.example.test');
    expect(data.businesses).toMatchObject([{ slug: org.slug, role: 'owner' }]);
    expect(data.followedBusinesses).toMatchObject([{ slug: other.org.slug }]);
    expect(data.sanctions).toMatchObject([{ type: 'suspended' }]);
    expect(data.decisions.length).toBeGreaterThan(0);
    expect(data.businessCases).toHaveLength(1);
    expect(data.account).toMatchObject({ signup_source: 'instagram' });
    expect(() => JSON.stringify(data)).not.toThrow();
  });
});

describe('deleted listings are purged after 12 months', () => {
  it('also with a chat, and with a decision past its 2 years; not while a decision is younger', async () => {
    const seller = await user();
    const buyer = await user();
    const long = new Date(Date.now() - 3 * 365 * 86_400_000);
    const gone = (status = 'deleted') => makeListing(tx, seller.id, { status: status as never, deletedAt: long, publishedAt: long, expiresAt: long });
    const left = async (id: string) => (await db.select({ id: schema.listings.id }).from(schema.listings).where(eq(schema.listings.id, id))).length;
    const withChat = await gone();
    const [c] = await db.insert(schema.conversations).values({ listingId: withChat.id, buyerUserId: buyer.id, sellerUserId: seller.id }).returning();
    await db.insert(schema.messages).values({ conversationId: c!.id, senderUserId: buyer.id, body: 'هنوز هست؟' });
    // A take-down 3 years ago, recorded in its history: the decision and the listing used to keep each other
    const oldDecision = await gone();
    const [d] = await db.insert(schema.moderationDecisions).values({ listingId: oldDecision.id, listingRevision: 1, decision: 'reject', reasonCode: 'spam', policyGround: 'terms-spam', statementFa: 'هرزنامه', decidedBy: 'rule', contentSnapshot: {}, createdAt: long }).returning();
    await db.insert(schema.listingEvents).values({ listingId: oldDecision.id, eventType: 'rejected', actorType: 'system', fromStatus: 'pending_review', toStatus: 'rejected', revision: 1, moderationDecisionId: d!.id, createdAt: long } as never);
    // A decision of last year: kept with its listing until it is 2 years old
    const recentDecision = await gone();
    await db.insert(schema.moderationDecisions).values({ listingId: recentDecision.id, listingRevision: 1, decision: 'reject', reasonCode: 'spam', policyGround: 'terms-spam', statementFa: 'هرزنامه', decidedBy: 'rule', contentSnapshot: {} });
    await purgeDeletedListings(workerDb, null);
    expect(await left(withChat.id)).toBe(0);
    expect(await db.select().from(schema.conversations).where(eq(schema.conversations.id, c!.id))).toHaveLength(0);
    expect(await left(oldDecision.id)).toBe(0);
    expect(await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.id, d!.id))).toHaveLength(0);
    expect(await left(recentDecision.id)).toBe(1);
  });
});
