import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import {
  conversations,
  listingImages,
  listings,
  locations,
  messages,
  moderationAppeals,
  moderationDecisions,
  organizationMembers,
  organizations,
  reports,
  userSanctions,
  users,
} from '../../db/schema';

// What a moderator sees about one thing in the queue (roadmap step 8): the content as it is now,
// every report, the decisions so far, open appeals, and the history of the person behind it.
// Personal contact data (email, phone) only for admins: the pages ask for user.contact.

export type ReportRow = Awaited<ReturnType<typeof reportsOn>>[number];

export function reportsOn(db: Queryable, where: { listingId?: string; userId?: string; organizationId?: string; messageId?: string }) {
  const cond = where.listingId
    ? eq(reports.listingId, where.listingId)
    : where.userId
      ? eq(reports.reportedUserId, where.userId)
      : where.organizationId
        ? eq(reports.organizationId, where.organizationId)
        : eq(reports.messageId, where.messageId!);
  return db
    .select({
      id: reports.id,
      reason: reports.reasonCode,
      details: reports.details,
      illegal: reports.isIllegalContentNotice,
      legalReference: reports.legalReference,
      status: reports.status,
      createdAt: reports.createdAt,
      reporterUserId: reports.reporterUserId,
      reporterName: sql<string | null>`coalesce(${reports.reporterName}, ${users.displayName})`,
      reporterEmail: sql<string | null>`coalesce(${reports.reporterEmail}, ${users.email})`,
      anonymous: sql<boolean>`${reports.reporterUserId} IS NULL`,
      // The reporter's earlier reports that staff found baseless (wave 1, mockup admin-item)
      reporterDismissed: sql<number>`(SELECT count(*)::int FROM reports r2 WHERE r2.status = 'dismissed' AND r2.id <> ${reports.id}
        AND (r2.reporter_user_id = ${reports.reporterUserId} OR (${reports.reporterUserId} IS NULL AND r2.reporter_email = ${reports.reporterEmail})))`,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterUserId))
    .where(cond)
    .orderBy(desc(reports.createdAt))
    .limit(200);
}

export type DecisionRow = Awaited<ReturnType<typeof decisionsOn>>[number];

export function decisionsOn(db: Queryable, where: { listingId?: string; userId?: string; organizationId?: string; messageId?: string }) {
  const cond = where.listingId
    ? eq(moderationDecisions.listingId, where.listingId)
    : where.userId
      ? eq(moderationDecisions.userId, where.userId)
      : where.organizationId
        ? eq(moderationDecisions.organizationId, where.organizationId)
        : eq(moderationDecisions.messageId, where.messageId!);
  return db
    .select({
      id: moderationDecisions.id,
      decision: moderationDecisions.decision,
      reason: moderationDecisions.reasonCode,
      policyGround: moderationDecisions.policyGround,
      legalGround: moderationDecisions.legalGround,
      statement: moderationDecisions.statementFa,
      decidedBy: moderationDecisions.decidedBy,
      moderator: users.displayName,
      aiOutput: moderationDecisions.aiOutput,
      revision: moderationDecisions.listingRevision,
      appealOf: moderationDecisions.appealOfDecisionId,
      createdAt: moderationDecisions.createdAt,
      appealId: moderationAppeals.id,
      appealBody: moderationAppeals.body,
      appealStatus: moderationAppeals.status,
      appealAt: moderationAppeals.createdAt,
    })
    .from(moderationDecisions)
    .leftJoin(users, eq(users.id, moderationDecisions.moderatorUserId))
    .leftJoin(moderationAppeals, eq(moderationAppeals.decisionId, moderationDecisions.id))
    .where(cond)
    .orderBy(desc(moderationDecisions.createdAt))
    .limit(100);
}

/** A person's standing: age, verified phone, listings by status, decisions, sanctions, reports against them */
export async function personHistory(db: Queryable, userId: string) {
  const [u] = await db
    .select({
      id: users.id,
      name: users.displayName,
      publicToken: users.publicToken,
      email: users.email,
      phone: users.phoneE164,
      phoneVerifiedAt: users.phoneVerifiedAt,
      phoneMethod: users.phoneVerificationMethod,
      telegramLinked: sql<boolean>`${users.telegramUserId} IS NOT NULL`,
      status: users.status,
      staffRole: users.staffRole,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      trustScore: users.trustScore,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!u) return null;
  const [byStatus, sanctions, counts] = await Promise.all([
    db.select({ status: listings.status, n: sql<number>`count(*)::int` }).from(listings).where(eq(listings.userId, userId)).groupBy(listings.status),
    db
      .select({ id: userSanctions.id, type: userSanctions.type, startsAt: userSanctions.startsAt, endsAt: userSanctions.endsAt, revokedAt: userSanctions.revokedAt, decisionId: userSanctions.moderationDecisionId })
      .from(userSanctions)
      .where(eq(userSanctions.userId, userId))
      .orderBy(desc(userSanctions.startsAt)),
    db.execute<{ reports_against: number; decisions_against: number; reports_filed: number; reports_filed_dismissed: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM reports r LEFT JOIN listings l ON l.id = r.listing_id LEFT JOIN messages m ON m.id = r.message_id
          WHERE r.reported_user_id = ${userId} OR l.user_id = ${userId} OR m.sender_user_id = ${userId}) AS reports_against,
        (SELECT count(*)::int FROM moderation_decisions d LEFT JOIN listings l ON l.id = d.listing_id LEFT JOIN messages m ON m.id = d.message_id
          WHERE d.decision IN ('reject', 'remove', 'hide', 'warn', 'sanction') AND (d.user_id = ${userId} OR l.user_id = ${userId} OR m.sender_user_id = ${userId})) AS decisions_against,
        (SELECT count(*)::int FROM reports WHERE reporter_user_id = ${userId}) AS reports_filed,
        (SELECT count(*)::int FROM reports WHERE reporter_user_id = ${userId} AND status = 'dismissed') AS reports_filed_dismissed
    `),
  ]);
  const now = new Date();
  return {
    ...u,
    listings: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>,
    sanctions: sanctions.map((s) => ({ ...s, active: !s.revokedAt && s.startsAt <= now && (!s.endsAt || s.endsAt > now) })),
    ...counts[0]!,
  };
}

/** One listing or event as moderators see it, with its photos (storage keys) */
export async function listingForReview(db: Queryable, id: string) {
  const [row] = await db
    .select({ listing: listings, city: locations.nameFa, isEvent: sql<boolean>`EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})` })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(eq(listings.id, id));
  if (!row) return null;
  const images = await db
    .select({ id: listingImages.id, key: listingImages.storageKey, status: listingImages.status })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, id), eq(listingImages.status, 'ready')))
    .orderBy(asc(listingImages.position));
  return { ...row, images };
}

/** How many of the seller's other listings carry exactly this description (wave 1: «متن مشابه») */
export async function sameTextCount(db: Queryable, listingId: string): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM listings o JOIN listings l ON l.id = ${listingId}
    WHERE o.user_id = l.user_id AND o.id <> l.id AND o.status <> 'deleted' AND length(l.description) >= 40 AND o.description = l.description`);
  return r?.n ?? 0;
}

/** The listing an escalation's near-duplicate photo came from, with that photo */
export async function duplicateOf(db: Queryable, aiOutput: unknown) {
  const detail = (aiOutput as { detail?: { otherListingId?: string; imageId?: string } } | null)?.detail;
  if (!detail?.otherListingId) return null;
  const [other] = await db
    .select({ id: listings.id, title: listings.title, token: listings.publicToken, status: listings.status, seller: users.displayName, sellerId: users.id })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(listings.id, detail.otherListingId));
  const covers = other
    ? await db.select({ key: listingImages.storageKey }).from(listingImages).where(and(eq(listingImages.listingId, other.id), eq(listingImages.status, 'ready'))).orderBy(asc(listingImages.position)).limit(4)
    : [];
  return other ? { ...other, images: covers.map((c) => c.key) } : null;
}

/**
 * A reported message with up to `around` messages before and after it in the same conversation
 * (the privacy policy says so). The caller writes staff.chat_viewed to audit_log.
 */
export async function messageInContext(db: Queryable, messageId: string, around = 5) {
  const [m] = await db
    .select({ id: messages.id, conversationId: messages.conversationId, senderId: messages.senderUserId, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.id, messageId));
  if (!m) return null;
  const [c] = await db
    .select({ id: conversations.id, buyerId: conversations.buyerUserId, sellerId: conversations.sellerUserId, listingId: conversations.listingId, title: listings.title, status: conversations.status })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(eq(conversations.id, m.conversationId));
  const rows = await db.execute<{ id: string; sender_user_id: string | null; kind: string; body: string; risk_flags: string[]; hidden_at: string | null; withheld: boolean; created_at: string | Date }>(sql`
    (SELECT id, sender_user_id, kind, body, risk_flags, hidden_at, withheld, created_at FROM messages
      WHERE conversation_id = ${m.conversationId} AND (created_at, id) < (${m.createdAt.toISOString()}::timestamptz, ${m.id}::uuid)
      ORDER BY created_at DESC, id DESC LIMIT ${around})
    UNION ALL
    (SELECT id, sender_user_id, kind, body, risk_flags, hidden_at, withheld, created_at FROM messages WHERE id = ${m.id})
    UNION ALL
    (SELECT id, sender_user_id, kind, body, risk_flags, hidden_at, withheld, created_at FROM messages
      WHERE conversation_id = ${m.conversationId} AND (created_at, id) > (${m.createdAt.toISOString()}::timestamptz, ${m.id}::uuid)
      ORDER BY created_at, id LIMIT ${around})
    ORDER BY created_at, id
  `);
  const names = await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, [c!.buyerId, c!.sellerId]));
  return {
    messageId: m.id,
    senderId: m.senderId,
    conversation: c!,
    names: Object.fromEntries(names.map((n) => [n.id, n.name])) as Record<string, string>,
    messages: rows.map((r) => ({ ...r, created_at: new Date(r.created_at), reported: r.id === m.id })),
  };
}

export async function businessForReview(db: Queryable, id: string) {
  const [o] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!o) return null;
  const members = await db
    .select({ userId: organizationMembers.userId, role: organizationMembers.role, name: users.displayName })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, id));
  const live = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.organizationId, id), or(eq(listings.status, 'active'), eq(listings.status, 'paused'))));
  return { org: o, members, liveListings: live[0]?.n ?? 0 };
}
