import { createHmac, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { auditLog, listingEvents, listings, messages as chatMessages, moderationAppeals, moderationDecisions, organizations, outboxEvents, reports, userSanctions } from '../src/db/schema';
import { alertPayload, signature, SIGNATURE_HEADER } from '../src/modules/admin/alert';
import { listingBrowseUrls } from '../src/modules/admin/purge';
import { freshListings, moderationQueue } from '../src/modules/admin/queue';
import { cachedCatalog, type Catalog } from '../src/modules/listings/catalog';
import { appealDecision, decisionsAbout } from '../src/modules/moderation/appeals';
import { runListingChecks } from '../src/modules/moderation/checks';
import {
  approveListing,
  hideMessage,
  keepDecision,
  liftBusinessSuspension,
  liftSanction,
  noViolation,
  restoreAfterSuspensions,
  restoreListing,
  sanctionUser,
  suspendBusiness,
  takeDownListing,
  validGrounds,
  type Grounds,
} from '../src/modules/moderation/decide';
import { decisionNotices, reportReceipt } from '../src/modules/moderation/notices';
import { createReport } from '../src/modules/moderation/public-reports';
import { browseListings, cardsByIds, type SearchFilters } from '../src/modules/search/browse';
import { buildSitemaps } from '../src/modules/search/sitemap';
import { syncListings } from '../src/modules/search/sync';
import { canPostListing, canSendMessage, loadActor } from '../src/modules/users/permissions';
import { startModerationJobs } from '../src/worker/moderation';
import type { OutboxJobData } from '../src/worker/outbox';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, makeOrganization, type Tx } from './db';
import { user } from './listings-fixtures';
import { meili, testIndex } from './meili';

// Decisions by staff (roadmap step 8): each one writes its decision with a statement of reasons
// naming the terms section, its audit row, closes the reports, and tells the people concerned; a
// taken-down listing leaves browse, keyword search, the sitemap and the edge cache, and comes back
// when restored. Runs as classifieds_app (the admin page) and classifieds_worker.

const tx = db as unknown as Tx;
const TZ = 'Europe/Berlin';
const APP = 'https://app.example.test';
const DAY = 86_400_000;
let catalog: Catalog;
let index: string;

beforeAll(async () => {
  catalog = await cachedCatalog(workerDb);
  index = await testIndex('moderation');
});

async function staffMember(role: 'moderator' | 'admin' = 'moderator') {
  const u = await user({ createdAt: new Date(Date.now() - 90 * DAY) });
  await db.update(schema.users).set({ staffRole: role }).where(eq(schema.users.id, u.id));
  return { userId: u.id, role, sessionId: randomUUID(), ip: '203.0.113.7', userAgent: 'test' } as const;
}

const seller = () => user({ createdAt: new Date(Date.now() - 60 * DAY) });
const scam: Grounds = { reason: 'scam', section: '6.1', legalGround: null, facts: 'در توضیحات پیش‌پرداخت با کارت هدیه خواسته شده است.' };

async function decisionsOf(listingId: string) {
  return db.select().from(moderationDecisions).where(eq(moderationDecisions.listingId, listingId)).orderBy(desc(moderationDecisions.createdAt));
}

async function outboxTypes(aggregateId: string) {
  return (await db.select({ t: outboxEvents.eventType }).from(outboxEvents).where(eq(outboxEvents.aggregateId, aggregateId))).map((r) => r.t);
}

/** Where a visitor could find the listing: the city's category page, keyword search, the sitemap */
async function visible(id: string) {
  const l = (await db.select().from(listings).where(eq(listings.id, id)))[0]!;
  const f: SearchFilters = { countryCode: 'DE', keyword: null, categoryIds: [l.categoryId!], locationId: l.locationId, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest' };
  const page = await browseListings(appDb, f, null);
  const sync = await syncListings(workerDb, meili, index, catalog, [id]);
  for (const t of sync.tasks) await meili.wait(t);
  const doc = await meili.fetchDocuments(index, { filter: `id = "${id}"`, limit: 1 });
  const sitemap = (await buildSitemaps(workerDb, APP)).map((f) => f.body).join('\n');
  return {
    browse: page.items.some((i) => i.id === id),
    cards: (await cardsByIds(appDb, [id], null)).length === 1,
    search: doc.results.length === 1,
    sitemap: sitemap.includes(l.publicToken),
  };
}

describe('taking a listing down and back', () => {
  it('writes the decision, statement, audit row and outbox, closes the reports, and the listing leaves everywhere', async () => {
    const mod = await staffMember();
    const s = await seller();
    const l = await makeListing(tx, s.id, { title: 'آیفون ارزان' });
    const reporter = await seller();
    await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'scam' });
    expect(await visible(l.id)).toEqual({ browse: true, cards: true, search: true, sitemap: true });

    const r = await takeDownListing(appDb, mod, l.id, scam, { timeZone: TZ });
    expect(r.ok).toBe(true);
    const [d] = await decisionsOf(l.id);
    expect(d).toMatchObject({ decision: 'remove', decidedBy: 'staff', moderatorUserId: mod.userId, reasonCode: 'scam', policyGround: 'terms-6.1', listingRevision: l.revision });
    expect(d!.statementFa).toContain('آیفون ارزان');
    expect(d!.statementFa).toContain('بند ۶.۱');
    expect(d!.statementFa).toContain('کارت هدیه');
    expect(d!.statementFa).toContain('پس از گزارش');
    expect(d!.statementFa).toContain('نه بررسی خودکار');
    expect(d!.statementFa).toContain('اعتراض');
    expect((d!.contentSnapshot as { title: string }).title).toBe('آیفون ارزان');

    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('rejected');
    const [ev] = await db.select().from(listingEvents).where(eq(listingEvents.listingId, l.id)).orderBy(desc(listingEvents.createdAt)).limit(1);
    expect(ev).toMatchObject({ eventType: 'rejected', actorType: 'staff', actorUserId: mod.userId, fromStatus: 'active', toStatus: 'rejected', moderationDecisionId: d!.id });
    const [rep] = await db.select().from(reports).where(eq(reports.listingId, l.id));
    expect(rep).toMatchObject({ status: 'resolved', moderationDecisionId: d!.id });
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.targetId, l.id), eq(auditLog.action, 'listing.taken_down')));
    expect(audit).toMatchObject({ actorType: 'staff', actorUserId: mod.userId, sessionId: mod.sessionId, data: { decisionId: d!.id, reason: 'scam', section: '6.1', reports: 1, role: 'moderator' } });
    expect(await outboxTypes(l.id)).toContain('listing.rejected');
    expect(await outboxTypes(d!.id)).toEqual(['moderation.decided']);
    expect(await visible(l.id)).toEqual({ browse: false, cards: false, search: false, sitemap: false });

    const back = await restoreListing(appDb, mod, l.id, '', { timeZone: TZ });
    expect(back.ok).toBe(true);
    const [restored] = await decisionsOf(l.id);
    expect(restored).toMatchObject({ decision: 'restore', decidedBy: 'staff' });
    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('active');
    expect(await outboxTypes(l.id)).toContain('listing.restored');
    expect(await db.select().from(auditLog).where(and(eq(auditLog.targetId, l.id), eq(auditLog.action, 'listing.restored')))).toHaveLength(1);
    expect(await visible(l.id)).toEqual({ browse: true, cards: true, search: true, sitemap: true });
  });

  it('the plain browse pages it was on are what the worker purges from the edge cache', async () => {
    const s = await seller();
    const l = await makeListing(tx, s.id);
    const urls = await listingBrowseUrls(workerDb, l.id, APP);
    expect(urls).toEqual(expect.arrayContaining([`${APP}/germany`, `${APP}/germany/berlin`, `${APP}/germany/mobile-phones`, `${APP}/germany/berlin/mobile-phones`]));
    const parent = catalog.byId.get(catalog.byId.get(l.categoryId!)!.parentId!)!;
    expect(urls).toContain(`${APP}/germany/berlin/${parent.slug}`);
    expect(urls.every((u) => !u.includes('?'))).toBe(true);
  });

  it('a restore goes back to where the listing was', async () => {
    const mod = await staffMember();
    const s = await seller();
    const paused = await makeListing(tx, s.id, { status: 'paused' });
    await takeDownListing(appDb, mod, paused.id, scam, { timeZone: TZ });
    await restoreListing(appDb, mod, paused.id, '', { timeZone: TZ });
    expect((await db.select().from(listings).where(eq(listings.id, paused.id)))[0]!.status).toBe('paused');

    const ending = await makeListing(tx, s.id, { expiresAt: new Date(Date.now() + 1_000) });
    await takeDownListing(appDb, mod, ending.id, scam, { timeZone: TZ });
    await restoreListing(appDb, mod, ending.id, '', { timeZone: TZ, now: new Date(Date.now() + 60_000) });
    expect((await db.select().from(listings).where(eq(listings.id, ending.id)))[0]!.status).toBe('expired');
  });

  it('refuses statements without facts or with a section that does not fit', async () => {
    expect(validGrounds({ ...scam, facts: 'کوتاه' })).toBe(false);
    expect(validGrounds({ ...scam, section: '5.2' })).toBe(false);
    expect(validGrounds({ ...scam, section: null })).toBe(false);
    expect(validGrounds({ ...scam, reason: 'illegal', section: null, legalGround: '§ 263 StGB' })).toBe(true);
    const mod = await staffMember();
    const l = await makeListing(tx, (await seller()).id);
    expect(await takeDownListing(appDb, mod, l.id, { ...scam, facts: 'بد' }, { timeZone: TZ })).toEqual({ ok: false, reason: 'invalid' });
    expect(await decisionsOf(l.id)).toHaveLength(0);
    // Not what a moderator can act on
    const draft = await makeListing(tx, (await seller()).id, { status: 'draft', publishedAt: null, rankedAt: null, expiresAt: null });
    expect(await takeDownListing(appDb, mod, draft.id, scam, { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await restoreListing(appDb, mod, l.id, '', { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('a resubmission after a take-down by staff waits for a person; after a rule it goes live by itself', async () => {
    const mod = await staffMember();
    const s = await seller();
    const l = await makeListing(tx, s.id);
    await takeDownListing(appDb, mod, l.id, scam, { timeZone: TZ });
    await db.update(listings).set({ status: 'pending_review' }).where(eq(listings.id, l.id));
    expect(await runListingChecks(workerDb, l.id)).toBe('held');
    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('pending_review');
    expect((await moderationQueue(appDb, { limit: 1_000 })).find((i) => i.id === l.id)).toMatchObject({ kind: 'listing', resubmitted: true });

    expect((await restoreListing(appDb, mod, l.id, '', { timeZone: TZ })).ok).toBe(true);
    const after = (await db.select().from(listings).where(eq(listings.id, l.id)))[0]!;
    expect(after.status).toBe('active');
    expect(after.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 20 * DAY);
    expect((await moderationQueue(appDb, { limit: 1_000 })).find((i) => i.id === l.id)).toBeUndefined();
  });
});

describe('accounts', () => {
  it('a suspension takes every listing down and stops posting and messaging; lifting it brings them back', async () => {
    const admin = await staffMember('admin');
    const s = await seller();
    const a = await makeListing(tx, s.id);
    const b = await makeListing(tx, s.id, { status: 'paused' });
    const r = await sanctionUser(appDb, admin, { userId: s.id, kind: 'suspended', days: 7, ...scam }, { timeZone: TZ });
    expect(r.ok).toBe(true);
    const [d] = await db.select().from(moderationDecisions).where(eq(moderationDecisions.userId, s.id)).orderBy(desc(moderationDecisions.createdAt));
    expect(d).toMatchObject({ decision: 'sanction', policyGround: 'terms-6.1' });
    expect(d!.statementFa).toContain('مسدود');
    const [sanction] = await db.select().from(userSanctions).where(eq(userSanctions.userId, s.id));
    expect(sanction).toMatchObject({ type: 'suspended', moderationDecisionId: d!.id, createdByUserId: admin.userId });
    expect(sanction!.endsAt!.getTime() - sanction!.startsAt.getTime()).toBe(7 * DAY);
    for (const id of [a.id, b.id]) expect((await db.select().from(listings).where(eq(listings.id, id)))[0]!.status).toBe('rejected');
    const actor = await loadActor(appDb, s.id);
    expect(canPostListing(actor)).toEqual({ ok: false, reason: 'restricted' });
    expect(canSendMessage(actor)).toEqual({ ok: false, reason: 'restricted' });
    // Nobody restores one listing of a suspended seller
    expect(await restoreListing(appDb, admin, a.id, '', { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });

    expect((await liftSanction(appDb, admin, sanction!.id, 'اشتباه بود', { timeZone: TZ })).ok).toBe(true);
    expect((await db.select().from(listings).where(eq(listings.id, a.id)))[0]!.status).toBe('active');
    expect((await db.select().from(listings).where(eq(listings.id, b.id)))[0]!.status).toBe('paused');
    expect(canPostListing(await loadActor(appDb, s.id))).toEqual({ ok: true });
    expect(await db.select().from(auditLog).where(and(eq(auditLog.targetId, s.id), eq(auditLog.action, 'user.sanction_lifted')))).toHaveLength(1);
  });

  it('a suspension that ran out brings the listings back by itself, once', async () => {
    const mod = await staffMember();
    const s = await seller();
    const l = await makeListing(tx, s.id);
    await sanctionUser(appDb, mod, { userId: s.id, kind: 'suspended', days: 7, ...scam }, { timeZone: TZ });
    expect(await restoreAfterSuspensions(workerDb)).toBe(0);
    const later = new Date(Date.now() + 8 * DAY);
    expect(await restoreAfterSuspensions(workerDb, later)).toBeGreaterThanOrEqual(1);
    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('active');
    const [d] = await db.select().from(moderationDecisions).where(eq(moderationDecisions.userId, s.id)).orderBy(desc(moderationDecisions.createdAt));
    expect(d).toMatchObject({ decision: 'restore', decidedBy: 'rule' });
    expect(await restoreAfterSuspensions(workerDb, later)).toBe(0);
  });

  it('warning, posting and messaging restrictions', async () => {
    const mod = await staffMember();
    const s = await seller();
    expect((await sanctionUser(appDb, mod, { userId: s.id, kind: 'warning', days: null, ...scam }, { timeZone: TZ })).ok).toBe(true);
    expect(canPostListing(await loadActor(appDb, s.id))).toEqual({ ok: true });
    expect((await db.select().from(moderationDecisions).where(eq(moderationDecisions.userId, s.id)))[0]).toMatchObject({ decision: 'warn' });
    expect(await sanctionUser(appDb, mod, { userId: s.id, kind: 'warning', days: 7, ...scam }, { timeZone: TZ })).toEqual({ ok: false, reason: 'invalid' });
    expect(await sanctionUser(appDb, mod, { userId: s.id, kind: 'suspended', days: null, ...scam }, { timeZone: TZ })).toEqual({ ok: false, reason: 'invalid' });

    await sanctionUser(appDb, mod, { userId: s.id, kind: 'posting_restricted', days: 30, ...scam }, { timeZone: TZ });
    const actor = await loadActor(appDb, s.id);
    expect(canPostListing(actor)).toEqual({ ok: false, reason: 'restricted' });
    expect(canSendMessage(actor)).toEqual({ ok: true });
    // Staff can't sanction themselves
    expect(await sanctionUser(appDb, mod, { userId: mod.userId, kind: 'warning', days: null, ...scam }, { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });
  });
});

describe('messages, businesses, no violation', () => {
  it('hides a reported message from the other side', async () => {
    const mod = await staffMember();
    const s = await seller();
    const buyer = await seller();
    const l = await makeListing(tx, s.id);
    const [c] = await db.insert(schema.conversations).values({ listingId: l.id, buyerUserId: buyer.id, sellerUserId: s.id }).returning();
    const [m] = await db.insert(chatMessages).values({ conversationId: c!.id, senderUserId: buyer.id, body: 'اول پول را کارت به کارت کن' }).returning();
    await db.insert(reports).values({ reporterUserId: s.id, messageId: m!.id, reasonCode: 'scam' });
    const r = await hideMessage(appDb, mod, m!.id, scam, { timeZone: TZ });
    expect(r.ok).toBe(true);
    expect((await db.select().from(chatMessages).where(eq(chatMessages.id, m!.id)))[0]!.hiddenAt).not.toBeNull();
    expect((await db.select().from(reports).where(eq(reports.messageId, m!.id)))[0]!.status).toBe('resolved');
    expect(await hideMessage(appDb, mod, m!.id, scam, { timeZone: TZ })).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('suspends a business with its listings, and lifts it', async () => {
    const admin = await staffMember('admin');
    const owner = await seller();
    const org = await makeOrganization(tx, owner.id);
    const l = await makeListing(tx, owner.id, { organizationId: org.id });
    expect((await suspendBusiness(appDb, admin, org.id, { ...scam, reason: 'misleading', section: '4.1' }, { timeZone: TZ })).ok).toBe(true);
    expect((await db.select().from(organizations).where(eq(organizations.id, org.id)))[0]!.status).toBe('suspended');
    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('rejected');
    expect((await liftBusinessSuspension(appDb, admin, org.id, '', { timeZone: TZ })).ok).toBe(true);
    expect((await db.select().from(organizations).where(eq(organizations.id, org.id)))[0]!.status).toBe('active');
    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('active');
  });

  it('no violation dismisses the reports and tells only the reporters', async () => {
    const mod = await staffMember();
    const l = await makeListing(tx, (await seller()).id);
    await createReport(appDb, redis, { userId: null, ip: '192.0.2.44' }, { kind: 'listing', ref: l.publicToken, reason: 'misleading', name: 'Max', email: 'max@example.test', goodFaith: true });
    const r = await noViolation(appDb, mod, { listingId: l.id }, 'قیمت واقعی است', { timeZone: TZ });
    if (!r.ok) throw new Error(r.reason);
    expect((await db.select().from(reports).where(eq(reports.listingId, l.id)))[0]!.status).toBe('dismissed');
    expect((await db.select().from(listings).where(eq(listings.id, l.id)))[0]!.status).toBe('active');
    const n = await decisionNotices(workerDb, redis, r.decisionId, APP, false);
    expect(n.user).toBeNull();
    expect(n.reporters).toHaveLength(1);
    expect(n.reporters[0]!.to).toBe('max@example.test');
    expect(n.reporters[0]!.text).toContain('خلافی');
    expect(n.reporters[0]!.text).toContain('keinen Verstoß');
  });

  it('an approval from the review of new listings takes it off that list', async () => {
    const mod = await staffMember();
    const fresh = await user({ createdAt: new Date() });
    const l = await makeListing(tx, fresh.id);
    expect((await freshListings(appDb, 1_000)).some((r) => r.id === l.id)).toBe(true);
    await approveListing(appDb, mod, l.id);
    expect((await freshListings(appDb, 1_000)).some((r) => r.id === l.id)).toBe(false);
  });
});

describe('what people are told', () => {
  it('the seller gets the statement by email (and Telegram when linked); the reporter the outcome in Persian and German', async () => {
    const mod = await staffMember();
    const s = await seller();
    await db.update(schema.users).set({ telegramUserId: 777_000 + Math.floor(Math.random() * 1_000) }).where(eq(schema.users.id, s.id));
    const l = await makeListing(tx, s.id, { title: 'ساعت رولکس' });
    const reporter = await seller();
    const created = await createReport(appDb, redis, { userId: reporter.id }, { kind: 'listing', ref: l.publicToken, reason: 'counterfeit' });
    if (!created.ok || !created.reportId) throw new Error('report');
    const receipt = (await reportReceipt(workerDb, created.reportId))!;
    expect(receipt.to).toBe(reporter.email);
    expect(receipt.text).toContain('ساعت رولکس');
    expect(receipt.text).toContain('Art. 16');

    const r = await takeDownListing(appDb, mod, l.id, { reason: 'counterfeit', section: '5.6', legalGround: null, facts: 'نام برند روی کالای تقلبی.' }, { timeZone: TZ });
    if (!r.ok) throw new Error(r.reason);
    const n = await decisionNotices(workerDb, redis, r.decisionId, APP, true);
    expect(n.user!.mail.to).toBe(s.email);
    expect(n.user!.mail.text).toContain('بند ۵.۶');
    expect(n.user!.mail.text).toContain(String(l.refNumber).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!));
    expect(n.user!.mail.text).toContain(`${APP}/account/notices`);
    expect(n.user!.telegram).toMatchObject({ replyMarkup: { inline_keyboard: [[{ url: `${APP}/account/notices` }]] } });
    expect(n.user!.telegram!.text).not.toContain('نام برند');
    expect(n.reporters.map((m) => m.to)).toEqual([reporter.email]);
    expect(n.reporters[0]!.text).toContain('entfernt');
  });
});

describe('appeals', () => {
  it('the person concerned appeals once; staff grant it or keep the decision', async () => {
    const mod = await staffMember();
    const s = await seller();
    const l = await makeListing(tx, s.id);
    const r = await takeDownListing(appDb, mod, l.id, scam, { timeZone: TZ });
    if (!r.ok) throw new Error(r.reason);
    const notices = await decisionsAbout(appDb, s.id);
    expect(notices.find((x) => x.id === r.decisionId)).toMatchObject({ kind: 'listing', decision: 'remove', appeal: null });

    const stranger = await seller();
    expect(await appealDecision(appDb, redis, stranger.id, r.decisionId, 'این آگهی من نیست ولی …')).toEqual({ ok: false, reason: 'not_found' });
    expect(await appealDecision(appDb, redis, s.id, r.decisionId, 'کوتاه')).toEqual({ ok: false, reason: 'invalid' });
    expect(await appealDecision(appDb, redis, s.id, r.decisionId, 'من هرگز پیش‌پرداخت نخواستم، اشتباه شده است.')).toEqual({ ok: true });
    expect(await appealDecision(appDb, redis, s.id, r.decisionId, 'دوباره اعتراض می‌کنم به این تصمیم.')).toEqual({ ok: false, reason: 'already' });
    const [appeal] = await db.select().from(moderationAppeals).where(eq(moderationAppeals.decisionId, r.decisionId));
    expect(await outboxTypes(appeal!.id)).toEqual(['appeal.created']);
    expect((await moderationQueue(appDb, { limit: 1_000 })).find((i) => i.id === l.id)).toMatchObject({ appeals: 1 });

    const granted = await restoreListing(appDb, mod, l.id, '', { timeZone: TZ, appealId: appeal!.id });
    if (!granted.ok) throw new Error(granted.reason);
    const [answer] = await decisionsOf(l.id);
    expect(answer).toMatchObject({ decision: 'restore', appealOfDecisionId: r.decisionId });
    expect((await db.select().from(moderationAppeals).where(eq(moderationAppeals.id, appeal!.id)))[0]).toMatchObject({ status: 'decided' });

    // The other way: kept, with a reason
    const l2 = await makeListing(tx, s.id);
    const r2 = await takeDownListing(appDb, mod, l2.id, scam, { timeZone: TZ });
    if (!r2.ok) throw new Error(r2.reason);
    await appealDecision(appDb, redis, s.id, r2.decisionId, 'لطفاً دوباره نگاه کنید، اشتباه است.');
    const [a2] = await db.select().from(moderationAppeals).where(eq(moderationAppeals.decisionId, r2.decisionId));
    expect(await keepDecision(appDb, mod, a2!.id, 'کوتاه', { timeZone: TZ })).toEqual({ ok: false, reason: 'invalid' });
    const kept = await keepDecision(appDb, mod, a2!.id, 'در عکس دوم هم شماره کارت دیده می‌شود.', { timeZone: TZ });
    if (!kept.ok) throw new Error(kept.reason);
    const [k] = await decisionsOf(l2.id);
    expect(k).toMatchObject({ decision: 'no_action', appealOfDecisionId: r2.decisionId });
    expect(k!.statementFa).toContain('پابرجاست');
    expect((await db.select().from(listings).where(eq(listings.id, l2.id)))[0]!.status).toBe('rejected');
    expect(await keepDecision(appDb, mod, a2!.id, 'دوباره همان تصمیم را نگه می‌داریم.', { timeZone: TZ })).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('the worker', () => {
  const prefix = `test-mod-${randomUUID().slice(0, 8)}`;
  const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), headers: init.headers as Record<string, string>, body: String(init.body) });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as unknown as typeof fetch;
  let jobs: Awaited<ReturnType<typeof startModerationJobs>>;
  let email: Queue;
  let telegram: Queue;
  let seo: Queue;
  let events: QueueEvents;

  const bull = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });

  beforeAll(async () => {
    email = new Queue('email-send', { connection: redis, prefix });
    telegram = new Queue('telegram-send', { connection: redis, prefix });
    seo = new Queue('seo', { connection: redis, prefix });
    jobs = await startModerationJobs(workerDb, bull, {
      appUrl: APP,
      adminPath: 'secretadminpath0123',
      send: { email, telegram },
      alert: { url: 'https://n8n.example.test/webhook/admin', secret: 'a'.repeat(40) },
      purge: { zoneId: 'f'.repeat(32), token: 'token' },
      seo,
      fetchFn: fakeFetch,
      prefix,
      gatherMs: 50,
    });
    events = new QueueEvents('moderation', { connection: bull.duplicate(), prefix });
    await events.waitUntilReady();
  });
  afterAll(async () => {
    await jobs.close();
    await Promise.all([email.close(), telegram.close(), seo.close(), events.close()]);
    await bull.quit();
  });

  const run = async (name: string, data: OutboxJobData) => {
    const job = await jobs.queue.add(name, data);
    return job.waitUntilFinished(events, 20_000);
  };

  it('purges the browse pages and queues a sitemap rebuild after a take-down', async () => {
    const l = await makeListing(tx, (await seller()).id);
    const out = await run('listing_changed', { outboxId: randomUUID(), eventType: 'listing.rejected', aggregateId: l.id, payload: {} });
    expect(out).toMatch(/^purged \d+$/);
    const purge = calls.find((c) => c.url.includes('/purge_cache'))!;
    expect(JSON.parse(purge.body).files).toContain(`${APP}/germany/berlin`);
    expect(purge.headers.Authorization).toBe('Bearer token');
    expect((await seo.getJobs(['delayed'])).some((j) => j.name === 'sitemaps')).toBe(true);
  });

  it('a report sends the receipt and one signed alert for a burst', async () => {
    const l = await makeListing(tx, (await seller()).id);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await createReport(appDb, redis, { userId: null, ip: `192.0.2.${100 + i}` }, { kind: 'listing', ref: l.publicToken, reason: 'spam', name: 'Ana', email: `ana${i}-${randomUUID().slice(0, 6)}@example.test`, goodFaith: true });
      if (r.ok && r.reportId) ids.push(r.reportId);
    }
    for (const id of ids) await run('report_received', { outboxId: randomUUID(), eventType: 'report.created', aggregateId: id, payload: {} });
    expect((await email.getJobs(['waiting', 'delayed'])).filter((j) => j.name === 'plain_email' && String(j.id).startsWith('mail_report_'))).toHaveLength(3);
    // The gathered alert job runs once
    const alertJobs = (await jobs.queue.getJobs(['delayed', 'waiting', 'active', 'completed'])).filter((j) => j.name === 'admin_alert');
    expect(alertJobs).toHaveLength(1);
    await alertJobs[0]!.waitUntilFinished(events, 20_000).catch(() => undefined);
    const sent = calls.filter((c) => c.url === 'https://n8n.example.test/webhook/admin');
    expect(sent).toHaveLength(1);
    const body = sent[0]!.body;
    const sig = sent[0]!.headers[SIGNATURE_HEADER]!;
    const t = sig.match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
    expect(t[2]).toBe(createHmac('sha256', 'a'.repeat(40)).update(`${t[1]}.${body}`).digest('hex'));
    const payload = JSON.parse(body);
    expect(payload.newReports).toBeGreaterThanOrEqual(3);
    expect(payload.url).toBe(`${APP}/secretadminpath0123/queue`);
    // No names, emails or report text
    expect(body).not.toContain('@');
    expect(body).not.toContain('Ana');
  });

  it('signature matches a fixed vector', () => {
    expect(signature('secret', '{"a":1}', 1_700_000_000)).toBe(`t=1700000000,v1=${createHmac('sha256', 'secret').update('1700000000.{"a":1}').digest('hex')}`);
    expect(alertPayload({ newReports: 2, newAppeals: 0, illegal: 1, open: 5, oldestMinutes: 180 }, APP, undefined)).toMatchObject({ url: null, kind: 'admin_queue' });
  });
});
