import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import { normalizePersian } from '../src/lib/normalize-persian';
import { cachedCatalog } from '../src/modules/listings/catalog';
import { postingRefusal } from '../src/modules/organizations/limits';
import { closeSwitched, decideSuspicion, findSuspicions, restrictedRoots, suspicionQueue, suspicionsWaiting } from '../src/modules/organizations/suspicions';
import { db, makeListing, publicToken, type Tx } from './db';
import { categoryBySlug, user } from './listings-fixtures';
import { business } from './payments-fixtures';

// «احتمالاً کسب‌وکار» (wave 2 part 4): found by rules, never for volume alone; asked with 14 days;
// restricted only after the deadline; closed by itself when the person opens a business.

const owner = db as unknown as Tx;
const DAY = 86_400_000;

async function staff(): Promise<StaffContext> {
  const [u] = await db.insert(schema.users).values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'ناظر', displayNameNormalized: 'ناظر', staffRole: 'admin' }).returning();
  return { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
}

const titled = (title: string) => ({ title, titleNormalized: normalizePersian(title) });
const caseOf = async (userId: string) => (await db.select().from(schema.businessSuspicions).where(eq(schema.businessSuspicions.userId, userId)))[0];

describe('finding cases', () => {
  it('the same thing listed again and again, or business words, are found; many listings alone never', async () => {
    const catalog = await cachedCatalog(db);
    const phones = await categoryBySlug('mobile-phones');
    const repeater = await user();
    for (let i = 0; i < 4; i++) await makeListing(owner, repeater.id, { categoryId: phones.id, ...titled(`آیفون ۱۳ نو مدل ${i}`) });
    const wordy = await user();
    await makeListing(owner, wordy.id, { categoryId: phones.id, ...titled('گوشی سامسونگ از فروشگاه ما') });
    await makeListing(owner, wordy.id, { categoryId: phones.id, ...titled('شارژر عمده با قیمت خوب') });
    // A big clear-out: 25 different things, nothing else
    const mover = await user();
    for (let i = 0; i < 25; i++) await makeListing(owner, mover.id, { categoryId: phones.id, ...titled(`وسیله ${i} ${randomUUID().slice(0, 4)} خانه`) });
    // Members of a business are left alone
    const shopOwner = await user();
    await business(shopOwner.id);
    for (let i = 0; i < 4; i++) await makeListing(owner, shopOwner.id, { categoryId: phones.id, ...titled(`آیفون ۱۳ نو شماره ${i}`) });

    const found = await findSuspicions(db, catalog);
    const of = (id: string) => found.find((c) => c.userId === id);
    expect(of(repeater.id)).toMatchObject({ reasons: [{ code: 'similar_titles', n: 4 }], rootSlugs: ['electronics'] });
    expect(of(wordy.id)?.reasons).toEqual([{ code: 'business_words', n: 2 }]);
    expect(of(mover.id)).toBeUndefined();
    expect(of(shopOwner.id)).toBeUndefined();
    expect(await caseOf(repeater.id)).toMatchObject({ status: 'open' });
    // Found once: running again adds nothing for them
    await findSuspicions(db, catalog);
    expect(await db.select().from(schema.businessSuspicions).where(eq(schema.businessSuspicions.userId, repeater.id))).toHaveLength(1);
    expect((await suspicionQueue(db)).some((c) => c.user.id === repeater.id)).toBe(true);
    expect(await suspicionsWaiting(db)).toBeGreaterThan(0);
  });
});

describe('deciding', () => {
  it('ask gives 14 days and an email; restrict only after the deadline; then private offers in those categories are refused', async () => {
    const catalog = await cachedCatalog(db);
    const ctx = await staff();
    const [phones, furniture] = await Promise.all([categoryBySlug('mobile-phones'), categoryBySlug('living-room')]);
    const u = await user();
    for (let i = 0; i < 4; i++) await makeListing(owner, u.id, { categoryId: phones.id, ...titled(`هدفون بی‌سیم نو سری ${i}`) });
    await findSuspicions(db, catalog);
    const c = (await caseOf(u.id))!;
    const now = new Date();

    expect(await db.transaction((tx) => decideSuspicion(tx, ctx, c.id, 'restrict', now))).toBe(false);
    expect(await db.transaction((tx) => decideSuspicion(tx, ctx, c.id, 'ask', now))).toBe(true);
    expect(await caseOf(u.id)).toMatchObject({ status: 'asked', deadlineAt: new Date(now.getTime() + 14 * DAY) });
    const [mail] = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.aggregateId, u.id), eq(schema.outboxEvents.eventType, 'user.business_asked')));
    expect(mail).toBeDefined();
    // Not before the deadline
    expect(await db.transaction((tx) => decideSuspicion(tx, ctx, c.id, 'restrict', new Date(now.getTime() + 13 * DAY)))).toBe(false);
    expect(await db.transaction((tx) => decideSuspicion(tx, ctx, c.id, 'restrict', new Date(now.getTime() + 15 * DAY)))).toBe(true);
    expect(await restrictedRoots(db, u.id)).toEqual(['electronics']);
    const audit = await db.select({ action: schema.auditLog.action }).from(schema.auditLog).where(eq(schema.auditLog.actorUserId, ctx.userId)).orderBy(schema.auditLog.id);
    expect(audit.map((a) => a.action)).toEqual(['business_suspicion.ask', 'business_suspicion.restrict']);

    const another = await makeListing(owner, u.id, { categoryId: phones.id, status: 'draft', publishedAt: null });
    expect(await postingRefusal(db, catalog, another)).toBe('business_required');
    expect(await postingRefusal(db, catalog, { ...another, kind: 'wanted' })).toBeNull();
    expect(await postingRefusal(db, catalog, { ...another, categoryId: furniture.id })).toBeNull();
    // Opening a business lifts it
    const { org } = await business(u.id);
    expect(await postingRefusal(db, catalog, { ...another, organizationId: org.id })).toBeNull();
    expect(await closeSwitched(db)).toBeGreaterThan(0);
    expect(await caseOf(u.id)).toMatchObject({ status: 'switched' });
    expect(await restrictedRoots(db, u.id)).toEqual([]);
  });

  it('«کسب‌وکار نیست» closes it, tells only someone who was asked, and keeps them out of the queue for 180 days', async () => {
    const catalog = await cachedCatalog(db);
    const ctx = await staff();
    const phones = await categoryBySlug('mobile-phones');
    const u = await user();
    for (let i = 0; i < 4; i++) await makeListing(owner, u.id, { categoryId: phones.id, ...titled(`کیف گوشی چرمی رنگ ${i}`) });
    await findSuspicions(db, catalog);
    const c = (await caseOf(u.id))!;
    await db.transaction((tx) => decideSuspicion(tx, ctx, c.id, 'ask'));
    expect(await db.transaction((tx) => decideSuspicion(tx, ctx, c.id, 'dismiss'))).toBe(true);
    expect(await caseOf(u.id)).toMatchObject({ status: 'dismissed', decidedByUserId: ctx.userId });
    const [cleared] = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.aggregateId, u.id), eq(schema.outboxEvents.eventType, 'user.business_cleared')));
    expect(cleared).toBeDefined();
    expect((await findSuspicions(db, catalog)).some((f) => f.userId === u.id)).toBe(false);
    expect((await findSuspicions(db, catalog, new Date(Date.now() + 181 * DAY))).some((f) => f.userId === u.id)).toBe(true);
  });
});
