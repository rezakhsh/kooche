import { createHash, randomBytes } from 'node:crypto';
import { and, asc, count, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { auditLog, conversations, listings, organizationInvitations, organizationMembers, organizations, outboxEvents, users } from '../../db/schema';
import { LISTING_OUTBOX } from '../listings/events';
import { businessPlan } from '../payments/plans';
import { canPostListing, loadActor } from '../users/permissions';
import { lockAs, type Role } from './organizations';

// Members of a business (docs/schema.md, section 7): owner (billing, members, everything),
// manager (all listings of the business), staff (their own listings). Seats besides the owner
// come from the plan: none without Pro, 1 on Pro, 5 on Pro Plus. "At least one owner" is kept
// by locking the business row and counting the owners first.

const INVITATION_DAYS = 7;
const DAY_MS = 86_400_000;

export type MemberError = 'not_found' | 'last_owner' | 'no_seats' | 'already_member' | 'invalid' | 'expired' | 'wrong_account' | 'restricted';

export const tokenHash = (token: string) => createHash('sha256').update(token).digest();

/** Members and pending invitations count against the plan's seats (the first owner doesn't) */
async function seatsUsed(tx: Queryable, organizationId: string, now: Date): Promise<number> {
  const [members] = await tx.select({ n: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, organizationId));
  const [pending] = await tx
    .select({ n: count() })
    .from(organizationInvitations)
    .where(and(eq(organizationInvitations.organizationId, organizationId), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt), gt(organizationInvitations.expiresAt, now)));
  return (members?.n ?? 1) - 1 + (pending?.n ?? 0);
}

export async function members(db: Queryable, organizationId: string) {
  return db
    .select({ userId: users.id, name: users.displayName, email: users.email, role: organizationMembers.role, since: organizationMembers.createdAt })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(organizationMembers.createdAt);
}

export async function pendingInvitations(db: Queryable, organizationId: string, now: Date = new Date()) {
  return db
    .select({ id: organizationInvitations.id, email: organizationInvitations.email, role: organizationInvitations.role, expiresAt: organizationInvitations.expiresAt })
    .from(organizationInvitations)
    .where(and(eq(organizationInvitations.organizationId, organizationId), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt), gt(organizationInvitations.expiresAt, now)))
    .orderBy(organizationInvitations.createdAt);
}

/**
 * The owner invites someone by email as manager or staff. Returns the one-time token for the link
 * (only its SHA-256 is stored); the caller emails it. Refused when the plan has no seat left.
 */
export async function invite(
  db: Db,
  opts: { userId: string; organizationId: string; email: string; role: 'manager' | 'staff'; now?: Date },
): Promise<{ ok: true; token: string; orgName: string } | { ok: false; reason: MemberError }> {
  const now = opts.now ?? new Date();
  const email = opts.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { ok: false, reason: 'invalid' };
  return db.transaction(async (tx) => {
    const org = await lockAs(tx, opts.userId, opts.organizationId, ['owner']);
    if (!org) return { ok: false, reason: 'not_found' };
    if (!canPostListing(await loadActor(tx, opts.userId)).ok) return { ok: false, reason: 'restricted' };
    const [existing] = await tx
      .select({ id: users.id })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(and(eq(organizationMembers.organizationId, org.id), eq(users.email, email)));
    if (existing) return { ok: false, reason: 'already_member' };
    const plan = await businessPlan(tx, org.id, now);
    if ((await seatsUsed(tx, org.id, now)) >= plan.features.staffSeats) return { ok: false, reason: 'no_seats' };
    // A new invitation to the same address replaces the old one
    await tx
      .update(organizationInvitations)
      .set({ revokedAt: now })
      .where(and(eq(organizationInvitations.organizationId, org.id), eq(organizationInvitations.email, email), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt)));
    const token = randomBytes(24).toString('base64url');
    await tx.insert(organizationInvitations).values({
      organizationId: org.id,
      email,
      role: opts.role,
      tokenHash: tokenHash(token),
      invitedByUserId: opts.userId,
      expiresAt: new Date(now.getTime() + INVITATION_DAYS * DAY_MS),
    });
    return { ok: true, token, orgName: org.name };
  });
}

/** What an invitation link leads to, before accepting it */
export async function invitationByToken(db: Queryable, token: string, now: Date = new Date()) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select({ id: organizationInvitations.id, email: organizationInvitations.email, role: organizationInvitations.role, expiresAt: organizationInvitations.expiresAt, acceptedAt: organizationInvitations.acceptedAt, revokedAt: organizationInvitations.revokedAt, orgName: organizations.name, slug: organizations.slug, organizationId: organizations.id })
    .from(organizationInvitations)
    .innerJoin(organizations, and(eq(organizations.id, organizationInvitations.organizationId), eq(organizations.status, 'active')))
    .where(eq(organizationInvitations.tokenHash, tokenHash(token)));
  if (!row) return null;
  return { ...row, usable: !row.acceptedAt && !row.revokedAt && row.expiresAt > now };
}

/**
 * The invited person accepts while signed in with the invited email address. Seats are checked
 * again: the plan may have changed since the invitation.
 */
export async function acceptInvitation(db: Db, opts: { userId: string; token: string; now?: Date }): Promise<{ ok: true; slug: string } | { ok: false; reason: MemberError }> {
  const now = opts.now ?? new Date();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(opts.token)) return { ok: false, reason: 'not_found' };
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(organizationInvitations).where(eq(organizationInvitations.tokenHash, tokenHash(opts.token))).for('update');
    if (!inv || inv.revokedAt || inv.acceptedAt) return { ok: false, reason: 'not_found' };
    if (inv.expiresAt <= now) return { ok: false, reason: 'expired' };
    const [org] = await tx.select().from(organizations).where(and(eq(organizations.id, inv.organizationId), eq(organizations.status, 'active'))).for('update');
    if (!org) return { ok: false, reason: 'not_found' };
    const [me] = await tx.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, opts.userId));
    if (!me || me.status !== 'active' || me.email.toLowerCase() !== inv.email) return { ok: false, reason: 'wrong_account' };
    const [already] = await tx.select({ role: organizationMembers.role }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, opts.userId)));
    if (already) return { ok: false, reason: 'already_member' };
    const plan = await businessPlan(tx, org.id, now);
    // This invitation is one of the pending ones counted, so the members alone must leave it a seat
    const [membersNow] = await tx.select({ n: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, org.id));
    if ((membersNow?.n ?? 1) - 1 >= plan.features.staffSeats) return { ok: false, reason: 'no_seats' };
    await tx.insert(organizationMembers).values({ organizationId: org.id, userId: opts.userId, role: inv.role, invitedByUserId: inv.invitedByUserId });
    await tx.update(organizationInvitations).set({ acceptedAt: now, acceptedByUserId: opts.userId }).where(eq(organizationInvitations.id, inv.id));
    await tx.insert(auditLog).values({ actorType: 'user', actorUserId: opts.userId, action: 'organization.member_joined', targetType: 'organization', targetId: org.id, data: { role: inv.role } });
    return { ok: true, slug: org.slug };
  });
}

export async function revokeInvitation(db: Db, opts: { userId: string; organizationId: string; invitationId: string }): Promise<boolean> {
  return db.transaction(async (tx) => {
    const org = await lockAs(tx, opts.userId, opts.organizationId, ['owner']);
    if (!org) return false;
    const rows = await tx
      .update(organizationInvitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(organizationInvitations.id, opts.invitationId), eq(organizationInvitations.organizationId, org.id), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt)))
      .returning({ id: organizationInvitations.id });
    return rows.length > 0;
  });
}

/**
 * The owner changes a member's role or removes them; anyone may leave. The last owner can do
 * neither to themselves: hand ownership on first. Listings and events a member posted stay with
 * the business: when they leave, they pass to an owner (the one removing them, else the longest
 * standing), with their buyer chats, so a former member keeps no hold on them (code check,
 * Oct 30, 2026). The history still names who posted them.
 */
export async function changeMember(
  db: Db,
  opts: { userId: string; organizationId: string; memberId: string; to: Role | 'removed' },
): Promise<{ ok: true } | { ok: false; reason: MemberError }> {
  return db.transaction(async (tx) => {
    const self = opts.userId === opts.memberId;
    // Leaving needs only membership; changing someone else needs ownership
    const org = await lockAs(tx, opts.userId, opts.organizationId, self && opts.to === 'removed' ? ['owner', 'manager', 'staff'] : ['owner']);
    if (!org) return { ok: false, reason: 'not_found' };
    const [member] = await tx.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, opts.memberId)));
    if (!member) return { ok: false, reason: 'not_found' };
    if (member.role === 'owner' && opts.to !== 'owner') {
      const [owners] = await tx.select({ n: count() }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.role, 'owner')));
      if ((owners?.n ?? 0) <= 1) return { ok: false, reason: 'last_owner' };
    }
    if (opts.to === 'removed') {
      await tx.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, opts.memberId)));
      const [heir] = self
        ? await tx.select({ id: organizationMembers.userId }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.role, 'owner'))).orderBy(asc(organizationMembers.createdAt)).limit(1)
        : [{ id: opts.userId }];
      if (heir) await handOver(tx, org.id, opts.memberId, heir.id);
    } else {
      await tx.update(organizationMembers).set({ role: opts.to }).where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, opts.memberId)));
    }
    await tx.insert(auditLog).values({ actorType: 'user', actorUserId: opts.userId, action: 'organization.member_changed', targetType: 'organization', targetId: org.id, data: { member: opts.memberId, from: member.role, to: opts.to } });
    return { ok: true };
  });
}

/** The business's listings and events a former member posted, and their buyer chats, pass to `heir` */
async function handOver(tx: Queryable, organizationId: string, from: string, heir: string): Promise<void> {
  const moved = await tx
    .update(listings)
    .set({ userId: heir })
    .where(and(eq(listings.organizationId, organizationId), eq(listings.userId, from), ne(listings.status, 'deleted')))
    .returning({ id: listings.id });
  if (!moved.length) return;
  const ids = moved.map((l) => l.id);
  // A chat the heir started as a buyer stays as it is (one person can't be both sides)
  await tx
    .update(conversations)
    .set({ sellerUserId: heir })
    .where(and(inArray(conversations.listingId, ids), eq(conversations.sellerUserId, from), ne(conversations.buyerUserId, heir)));
  await tx.insert(outboxEvents).values(moved.map((l) => ({ eventType: LISTING_OUTBOX.updated, aggregateType: 'listing', aggregateId: l.id })));
  await tx.insert(auditLog).values({ actorType: 'system', action: 'organization.listings_handed_over', targetType: 'organization', targetId: organizationId, data: { from, to: heir, listings: ids.length } });
}
