import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  auditLog,
  authAccounts,
  conversations,
  favorites,
  listingEvents,
  listings,
  moderationDecisions,
  organizationMembers,
  outboxEvents,
  phoneVerifications,
  reports,
  sessions,
  userSanctions,
  users,
  verifications,
} from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import {
  RAISE_EXCEPTION,
  RESTRICT_VIOLATION,
  expectError,
  makeListing,
  makeOrganization,
  makeUser,
  rollback,
  setRole,
  type Tx,
} from './db';

// SECURITY DEFINER retention functions and account deletion (docs/schema.md, sections 13–14;
// migration 0004). Called as classifieds_worker, the only role allowed to.

const yearsAgo = (n: number) => new Date(Date.now() - n * 365.25 * 86_400_000);

async function listingDecision(tx: Tx, listingId: string, createdAt: Date) {
  const [decision] = await tx
    .insert(moderationDecisions)
    .values({ listingId, listingRevision: 1, decision: 'approve', decidedBy: 'rule', createdAt })
    .returning();
  return decision!;
}

describe('erase_user', () => {
  it('turns the user into a tombstone and removes their personal data', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx, {
        avatarKey: 'avatars/ab/user.webp',
        phoneE164: '+491701234567',
        phoneVerifiedAt: new Date(),
        phoneVerificationMethod: 'telegram',
        telegramUserId: 123456789,
      });
      const buyer = await makeUser(tx);
      const coOwner = await makeUser(tx);
      const privateListing = await makeListing(tx, user.id);
      const org = await makeOrganization(tx, coOwner.id);
      await tx
        .insert(organizationMembers)
        .values({ organizationId: org.id, userId: user.id, role: 'owner' });
      const businessListing = await makeListing(tx, user.id, { organizationId: org.id });

      await tx.insert(sessions).values({ userId: user.id, token: `s-${user.id}`, expiresAt: new Date() });
      await tx.insert(authAccounts).values({ userId: user.id, providerId: 'google', accountId: user.id });
      await tx.insert(verifications).values({ identifier: user.email, value: '123456', expiresAt: new Date() });
      await tx.insert(favorites).values({ listingId: businessListing.id, userId: user.id });
      await tx.insert(phoneVerifications).values({
        userId: user.id,
        method: 'sms',
        phoneE164: '+491701234567',
        codeHash: Buffer.from('hash'),
        expiresAt: new Date(),
      });
      const [conversation] = await tx
        .insert(conversations)
        .values({ listingId: privateListing.id, buyerUserId: buyer.id, sellerUserId: user.id })
        .returning();

      await setRole(tx, 'classifieds_worker');
      await tx.execute(sql`SELECT erase_user(${user.id})`);
      await tx.execute(sql`RESET ROLE`);

      const [tombstone] = await tx.select().from(users).where(eq(users.id, user.id));
      expect(tombstone).toMatchObject({
        email: `deleted-${user.id}@deleted.invalid`,
        displayName: 'کاربر حذف‌شده',
        displayNameNormalized: normalizePersian('کاربر حذف‌شده'),
        avatarKey: null,
        phoneE164: null,
        phoneVerifiedAt: null,
        phoneVerificationMethod: null,
        telegramUserId: null,
        status: 'deleted',
      });
      expect(tombstone!.deletedAt).toBeInstanceOf(Date);

      for (const [table, column] of [
        [sessions, sessions.userId],
        [authAccounts, authAccounts.userId],
        [favorites, favorites.userId],
        [phoneVerifications, phoneVerifications.userId],
        [organizationMembers, organizationMembers.userId],
      ] as const) {
        expect(await tx.select().from(table).where(eq(column, user.id))).toEqual([]);
      }
      expect(await tx.select().from(verifications).where(eq(verifications.identifier, user.email))).toEqual(
        [],
      );

      // Private listings are deleted with history and an outbox event; business listings stay
      const [gone] = await tx.select().from(listings).where(eq(listings.id, privateListing.id));
      expect(gone!.status).toBe('deleted');
      const [kept] = await tx.select().from(listings).where(eq(listings.id, businessListing.id));
      expect(kept!.status).toBe('active');
      const events = await tx
        .select()
        .from(listingEvents)
        .where(eq(listingEvents.listingId, privateListing.id));
      expect(events).toMatchObject([
        { eventType: 'deleted', actorType: 'system', fromStatus: 'active', toStatus: 'deleted' },
      ]);

      const [closed] = await tx.select().from(conversations).where(eq(conversations.id, conversation!.id));
      expect(closed!.status).toBe('closed');

      const outbox = await tx
        .select({ eventType: outboxEvents.eventType, payload: outboxEvents.payload })
        .from(outboxEvents)
        .where(sql`aggregate_id IN (${user.id}, ${privateListing.id})`)
        .orderBy(outboxEvents.eventType);
      expect(outbox).toEqual([
        { eventType: 'listing.deleted', payload: {} },
        { eventType: 'user.erased', payload: { avatar_key: 'avatars/ab/user.webp' } },
      ]);
      const audit = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.targetId, user.id), eq(auditLog.action, 'user.erased')));
      expect(audit).toHaveLength(1);

      // A second call is a no-op
      await setRole(tx, 'classifieds_worker');
      await tx.execute(sql`SELECT erase_user(${user.id})`);
    });
  });

  it("is refused while the user is an organization's only owner", async () => {
    await rollback(async (tx) => {
      const owner = await makeUser(tx);
      await makeOrganization(tx, owner.id);
      await setRole(tx, 'classifieds_worker');
      await expectError(tx.execute(sql`SELECT erase_user(${owner.id})`), RESTRICT_VIOLATION);
    });
  });
});

describe('retention functions', () => {
  it('refuse to purge or scrub recent history', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_worker');
      for (const call of [
        sql`SELECT purge_audit_log(interval '1 year')`,
        sql`SELECT scrub_audit_ip(interval '30 days')`,
        sql`SELECT * FROM purge_moderation_records(interval '1 year')`,
      ]) {
        await expectError(tx.transaction((sp) => sp.execute(call)), RAISE_EXCEPTION);
      }
    });
  });

  it('purge old audit rows and scrub old IP addresses only', async () => {
    await rollback(async (tx) => {
      const rows = await tx
        .insert(auditLog)
        .values([
          { actorType: 'system', action: 'test.old', ipAddress: '192.0.2.1', createdAt: yearsAgo(3) },
          { actorType: 'system', action: 'test.half_year', ipAddress: '192.0.2.2', userAgent: 'x', createdAt: yearsAgo(0.5) },
          { actorType: 'system', action: 'test.recent', ipAddress: '192.0.2.3' },
        ])
        .returning({ id: auditLog.id });
      await setRole(tx, 'classifieds_worker');
      const scrubbed = await tx.execute(sql`SELECT scrub_audit_ip(interval '90 days') AS n`);
      const purged = await tx.execute(sql`SELECT purge_audit_log(interval '2 years') AS n`);
      expect(Number((scrubbed[0] as { n: string }).n)).toBeGreaterThanOrEqual(2);
      expect(Number((purged[0] as { n: string }).n)).toBeGreaterThanOrEqual(1);

      const left = await tx
        .select({ action: auditLog.action, ip: auditLog.ipAddress, ua: auditLog.userAgent })
        .from(auditLog)
        .where(sql`id IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`)
        .orderBy(auditLog.action);
      expect(left).toEqual([
        { action: 'test.half_year', ip: null, ua: null },
        { action: 'test.recent', ip: '192.0.2.3', ua: null },
      ]);
    });
  });

  it('purge old moderation records unless something still references them', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const listing = await makeListing(tx, user.id);
      const unreferenced = await listingDecision(tx, listing.id, yearsAgo(3));
      const [oldReport] = await tx
        .insert(reports)
        .values({
          reporterUserId: user.id,
          listingId: listing.id,
          reasonCode: 'spam',
          status: 'resolved',
          moderationDecisionId: unreferenced.id,
          resolvedAt: yearsAgo(3),
        })
        .returning();
      const [sanctionDecision] = await tx
        .insert(moderationDecisions)
        .values({
          userId: user.id,
          decision: 'sanction',
          reasonCode: 'spam',
          statementFa: 'ارسال پیام‌های تبلیغاتی',
          policyGround: 'terms-4.2',
          decidedBy: 'rule',
          createdAt: yearsAgo(3),
        })
        .returning();
      await tx.insert(userSanctions).values({
        userId: user.id,
        type: 'warning',
        moderationDecisionId: sanctionDecision!.id,
        startsAt: yearsAgo(3),
      });
      const recent = await listingDecision(tx, listing.id, new Date());

      await setRole(tx, 'classifieds_worker');
      await tx.execute(sql`SELECT * FROM purge_moderation_records(interval '2 years')`);
      await tx.execute(sql`RESET ROLE`);

      const ids = (await tx.select({ id: moderationDecisions.id }).from(moderationDecisions)).map((r) => r.id);
      expect(ids).not.toContain(unreferenced.id);
      expect(ids).toContain(sanctionDecision!.id);
      expect(ids).toContain(recent.id);
      expect(await tx.select().from(reports).where(eq(reports.id, oldReport!.id))).toEqual([]);
    });
  });
});
