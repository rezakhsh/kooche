import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { sendMessage } from '../src/modules/chat/conversations';
import { ownListing } from '../src/modules/listings/listings';
import { revealPhone } from '../src/modules/listings/phone-reveal';
import { sanctionUser, type Grounds } from '../src/modules/moderation/decide';
import { changeMember, invite } from '../src/modules/organizations/members';
import { updateBusiness, type BusinessInput } from '../src/modules/organizations/organizations';
import { blockUser } from '../src/modules/users/blocks';
import { eraseRequestedUser, finishStuckErasures, requestErasure, stuckErasures } from '../src/modules/users/erasure';
import { canSendMessage, loadActor } from '../src/modules/users/permissions';
import { acceptTelegramContact, bindTelegramLink, startTelegramVerification } from '../src/modules/users/phone';
import { purgeAccountData } from '../src/modules/users/retention';
import { smsAvailable } from '../src/modules/users/sms';
import { appDb, redis, workerDb, workerSql } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, makeListing, makeOrganization, rollback, setRole, type Tx } from './db';
import { user } from './listings-fixtures';

// People and privacy, fixed after the code check of Oct 30, 2026 (package 3): deletions finished
// by the worker, a business's listings when a member leaves, the phone number and blocks, banned
// owners, the verified badge, banned numbers, email accounts writing from Iran, and SMS.

const tx = db as unknown as Tx;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const TZ = 'Europe/Berlin';
const scam: Grounds = { reason: 'scam', section: '6.1', legalGround: null, facts: 'در توضیحات پیش‌پرداخت با کارت هدیه خواسته شده است.' };
let telegramIds = 8_100_000_000 + Math.floor(Math.random() * 1e6);

async function admin(): Promise<StaffContext> {
  const u = await user({ createdAt: new Date(Date.now() - 90 * DAY) });
  await db.update(schema.users).set({ staffRole: 'admin' }).where(eq(schema.users.id, u.id));
  return { userId: u.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}
const person = () => user({ createdAt: new Date(Date.now() - 60 * DAY) });
const ban = async (userId: string) => expect(await sanctionUser(appDb, await admin(), { userId, kind: 'banned', days: null, ...scam }, { timeZone: TZ })).toMatchObject({ ok: true });

/** A business with all its legal details, owned by `ownerId` */
async function business(ownerId: string) {
  const org = await makeOrganization(tx, ownerId);
  await db.update(schema.organizations).set({ legalName: 'Prüfladen GmbH', legalForm: 'GmbH', addressLine1: 'Teststraße 1', postalCode: '10115', placeName: 'Berlin', email: 'laden@example.test' }).where(eq(schema.organizations.id, org.id));
  return org;
}
/** The edit form's input, as tests/business.test.ts writes it */
const businessInput = (name: string, slug: string): BusinessInput => ({
  name, slug, businessType: 'food', tagline: '', instagram: '', telegram: '', legalName: 'Prüfladen GmbH', legalForm: 'GmbH',
  representativeName: '', addressLine1: 'Sonnenallee 1', addressLine2: '', place: '12045', placeValue: '', phone: '030 1234567',
  email: 'laden@example.test', website: '', registerCourt: '', registrationNumber: '', vatId: '', imprintExtra: '', description: '',
} as BusinessInput);

describe('a deletion whose job gave up', () => {
  it('is finished by the hourly sweep; one that still can’t be done shows after a day', async () => {
    const u = await person();
    expect(await requestErasure(appDb, u.id, u.email)).toEqual({ ok: true });
    // Not yet: the job itself gets the first hour
    expect((await finishStuckErasures(workerDb)).erased).toBe(0);
    expect((await finishStuckErasures(workerDb, new Date(Date.now() + 2 * HOUR))).erased).toBeGreaterThanOrEqual(1);
    expect((await db.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, u.id)))[0]!.status).toBe('deleted');

    // Became the only owner of a business after asking: erase_user refuses, the admin page shows it
    const v = await person();
    expect(await requestErasure(appDb, v.id, v.email)).toEqual({ ok: true });
    await makeOrganization(tx, v.id);
    expect((await finishStuckErasures(workerDb, new Date(Date.now() + 2 * HOUR))).failed).toBeGreaterThanOrEqual(1);
    expect(await stuckErasures(workerDb, new Date(Date.now() + 2 * HOUR))).toBe(0);
    expect(await stuckErasures(workerDb, new Date(Date.now() + 25 * HOUR))).toBeGreaterThanOrEqual(1);
  });
});

describe('a member leaving a business', () => {
  it('leaves the listings and chats they posted for it with an owner', async () => {
    const owner = await person();
    const staffer = await person();
    const buyer = await person();
    const org = await business(owner.id);
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: staffer.id, role: 'staff' });
    const l = await makeListing(tx, staffer.id, { organizationId: org.id });
    const own = await makeListing(tx, staffer.id);
    const [chat] = await db.insert(schema.conversations).values({ listingId: l.id, buyerUserId: buyer.id, sellerUserId: staffer.id }).returning();
    expect(await changeMember(appDb, { userId: owner.id, organizationId: org.id, memberId: staffer.id, to: 'removed' })).toEqual({ ok: true });
    expect(await ownListing(appDb, staffer.id, l.id)).toBeNull();
    expect(await ownListing(appDb, owner.id, l.id)).not.toBeNull();
    expect((await db.select().from(schema.conversations).where(eq(schema.conversations.id, chat!.id)))[0]!.sellerUserId).toBe(owner.id);
    // Their own private listing stays theirs
    expect(await ownListing(appDb, staffer.id, own.id)).not.toBeNull();
  });

  it('who leaves by themselves hands them to the longest-standing owner', async () => {
    const owner = await person();
    const manager = await person();
    const org = await business(owner.id);
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: manager.id, role: 'manager' });
    const l = await makeListing(tx, manager.id, { organizationId: org.id });
    expect(await changeMember(appDb, { userId: manager.id, organizationId: org.id, memberId: manager.id, to: 'removed' })).toEqual({ ok: true });
    expect((await db.select().from(schema.listings).where(eq(schema.listings.id, l.id)))[0]!.userId).toBe(owner.id);
  });
});

describe('«نمایش شماره»', () => {
  it('isn’t shown to someone the seller blocked, nor between test accounts and real people', async () => {
    await redis.flushdb();
    const seller = await person();
    const harasser = await person();
    const other = await person();
    const l = await makeListing(tx, seller.id, { allowPhoneContact: true });
    const reveal = (userId: string) => revealPhone(appDb, redis, { userId, token: l.publicToken, ip: null, userAgent: null });
    expect((await reveal(other.id)).ok).toBe(true);
    await blockUser(appDb, seller.id, harasser.id);
    expect(await reveal(harasser.id)).toEqual({ ok: false, reason: 'hidden' });
    const tester = await person();
    await db.update(schema.users).set({ testAccount: 'personal' }).where(eq(schema.users.id, tester.id));
    expect(await reveal(tester.id)).toEqual({ ok: false, reason: 'hidden' });
  });
});

describe('a banned owner', () => {
  it('can’t rewrite the business page or invite anyone; a ban suspends the business they own alone', async () => {
    const owner = await person();
    const org = await business(owner.id);
    const shared = await business(owner.id);
    await db.insert(schema.organizationMembers).values({ organizationId: shared.id, userId: (await person()).id, role: 'owner' });
    await ban(owner.id);
    const status = async (id: string) => (await db.select({ s: schema.organizations.status }).from(schema.organizations).where(eq(schema.organizations.id, id)))[0]!.s;
    expect(await status(org.id)).toBe('suspended');
    expect(await status(shared.id)).toBe('active');
    expect(await updateBusiness(appDb, { userId: owner.id, organizationId: shared.id, input: businessInput('نام تازه', shared.slug) })).toMatchObject({ ok: false, reason: 'restricted' });
    expect(await invite(appDb, { userId: owner.id, organizationId: shared.id, email: 'helper@example.test', role: 'staff' })).toEqual({ ok: false, reason: 'restricted' });
  });
});

describe('the verified badge', () => {
  it('goes when the business’s public name changes', async () => {
    const owner = await person();
    const org = await business(owner.id);
    await db.update(schema.organizations).set({ verificationStatus: 'verified', verifiedAt: new Date() }).where(eq(schema.organizations.id, org.id));
    const r = await updateBusiness(appDb, { userId: owner.id, organizationId: org.id, input: businessInput('بانک ملی', org.slug) });
    expect(r).toMatchObject({ ok: true });
    expect((await db.select().from(schema.organizations).where(eq(schema.organizations.id, org.id)))[0]).toMatchObject({ name: 'بانک ملی', verificationStatus: 'unverified', verifiedAt: null });
  });
});

describe('banned people coming back', () => {
  async function verifyWith(phone: string, tgId = ++telegramIds) {
    const u = await person();
    await db.update(schema.users).set({ phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null }).where(eq(schema.users.id, u.id));
    const { token } = await startTelegramVerification(appDb, { userId: u.id, ip: '203.0.113.9' });
    await bindTelegramLink(workerDb, { token, telegramUserId: tgId });
    return { u, result: await acceptTelegramContact(workerDb, { fromId: tgId, contactUserId: tgId, phoneE164: phone }) };
  }

  it('a banned person who deletes their account can’t verify a new one with the same number or Telegram', async () => {
    await redis.flushdb();
    const banned = await person();
    const tg = ++telegramIds;
    await db.update(schema.users).set({ telegramUserId: tg }).where(eq(schema.users.id, banned.id));
    await ban(banned.id);
    const before = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.bannedIdentifiers))[0]!.n;
    expect(await requestErasure(appDb, banned.id, banned.email)).toEqual({ ok: true });
    expect((await db.select({ n: sql<number>`count(*)::int` }).from(schema.bannedIdentifiers))[0]!.n).toBe(before + 2);
    expect(await eraseRequestedUser(workerDb, banned.id)).toBe('erased');

    const again = await verifyWith(banned.phoneE164!);
    expect(again.result).toMatchObject({ ok: false, reason: 'phone_in_use' });
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'phone.banned_number_refused'), eq(schema.auditLog.targetId, again.u.id)))).toHaveLength(1);
    expect((await verifyWith(`+49151${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, tg)).result).toMatchObject({ ok: false, reason: 'telegram_in_use' });
  });

  it('someone not banned leaves nothing behind', async () => {
    const u = await person();
    const before = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.bannedIdentifiers))[0]!.n;
    await requestErasure(appDb, u.id, u.email);
    expect((await db.select({ n: sql<number>`count(*)::int` }).from(schema.bannedIdentifiers))[0]!.n).toBe(before);
  });

  it('the key is out of reach of running code, and fingerprints go after 2 years', async () => {
    await rollback(async (t) => {
      await setRole(t, 'classifieds_app');
      await expectError(t.execute(sql`SELECT key FROM fingerprint_keys`), INSUFFICIENT_PRIVILEGE);
    });
    await rollback(async (t) => {
      await setRole(t, 'classifieds_worker');
      await expectError(t.execute(sql`SELECT key FROM fingerprint_keys`), INSUFFICIENT_PRIVILEGE);
    });
    await db.insert(schema.bannedIdentifiers).values({ kind: 'phone', hash: Buffer.from(randomUUID()), expiresAt: new Date(Date.now() - DAY) });
    expect((await purgeAccountData(workerSql)).bannedIdentifiers).toBeGreaterThanOrEqual(1);
  });
});

describe('writing from Iran', () => {
  it('an email account may send messages; seeing a number still needs a verified phone', async () => {
    await redis.flushdb();
    const seller = await person();
    const l = await makeListing(tx, seller.id, { allowPhoneContact: true });
    const buyer = await user({ verified: false, createdAt: new Date(Date.now() - 30 * DAY) });
    const actor = await loadActor(appDb, buyer.id);
    expect(canSendMessage(actor)).toEqual({ ok: false, reason: 'phone_required' });
    expect(canSendMessage(actor, { fromIran: true })).toEqual({ ok: true });
    expect(await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: l.publicToken }, body: 'سلام، هنوز موجود است؟' })).toMatchObject({ ok: false, reason: 'phone_required' });
    expect(await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: l.publicToken }, body: 'سلام، هنوز موجود است؟', fromIran: true })).toMatchObject({ ok: true });
    expect(await revealPhone(appDb, redis, { userId: buyer.id, token: l.publicToken, ip: null, userAgent: null })).toMatchObject({ ok: false, reason: 'phone_required' });
  });
});

describe('SMS', () => {
  it('is offered only with a real provider', () => {
    expect(smsAvailable('log')).toBe(false);
  });
});
