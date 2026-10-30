import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { listings, messages, moderationAppeals, moderationDecisions, organizations, outboxEvents, reports, userSanctions, users } from '../../db/schema';
import { messages as messages_ } from '../../messages/fa';
import { staffAudit, type StaffContext } from '../admin/audit';
import { cachedCatalog } from '../listings/catalog';
import { LISTING_OUTBOX, recordChange } from '../listings/events';
import { snapshot } from './checks';
import { lastTakeDown } from './history';
import { REASON_SECTIONS, type ReasonCode } from './reasons';
import { composeStatement, type StatementWhat } from './statement';
import { policyGround } from './terms';

// Decisions by staff (roadmap step 8; docs/setup.md, "Admin page"). Each runs in one transaction:
// the moderation_decisions row with its statement of reasons (DSA art. 17), the change itself,
// the open reports on the thing resolved or dismissed with the decision, audit_log, and
// `moderation.decided` in the outbox, from which the worker tells the person concerned (email and
// Telegram) and the reporters (email). The permission checks are the caller's (requireStaffAction).

type Listing = typeof listings.$inferSelect;

export type Grounds = {
  reason: ReasonCode;
  /** A section of the terms (REASON_SECTIONS[reason]); null only with a legal ground */
  section: string | null;
  /** The law, when the content is judged illegal rather than against the terms */
  legalGround: string | null;
  /** The facts in the moderator's words, at least a sentence */
  facts: string;
};

export type DecideResult = { ok: true; decisionId: string } | { ok: false; reason: 'not_found' | 'not_allowed' | 'invalid' };

export type DecideOptions = { timeZone: string; now?: Date; appealId?: string };

/** Sanction lengths a moderator may pick; null is "until further notice" (admins only for suspensions) */
export const SANCTION_DAYS = [7, 30, null] as const;

/** Statuses a visitor can see; a take-down removes any of them */
const VISIBLE = ['active', 'paused', 'sold', 'expired'] as const;

export function validGrounds(g: Grounds): boolean {
  if (g.facts.trim().length < 10 || g.facts.length > 1000) return false;
  if (g.legalGround !== null && (g.legalGround.trim().length < 3 || g.legalGround.length > 200)) return false;
  if (g.section === null) return g.legalGround !== null;
  return REASON_SECTIONS[g.reason].includes(g.section);
}

type Target = { listingId?: string; reportedUserId?: string; organizationId?: string; messageId?: string };

function reportsOf(t: Target) {
  return t.listingId
    ? eq(reports.listingId, t.listingId)
    : t.reportedUserId
      ? eq(reports.reportedUserId, t.reportedUserId)
      : t.organizationId
        ? eq(reports.organizationId, t.organizationId)
        : eq(reports.messageId, t.messageId!);
}

/** Closes the open reports on these things with the decision; returns how many */
async function closeReports(tx: Queryable, targets: Target[], decisionId: string, status: 'resolved' | 'dismissed', now: Date): Promise<number> {
  let n = 0;
  for (const t of targets) {
    const rows = await tx
      .update(reports)
      .set({ status, moderationDecisionId: decisionId, resolvedAt: now })
      .where(and(reportsOf(t), inArray(reports.status, ['open', 'in_review'])))
      .returning({ id: reports.id });
    n += rows.length;
  }
  return n;
}

async function hasOpenReports(tx: Queryable, targets: Target[]): Promise<boolean> {
  for (const t of targets) {
    const [r] = await tx.select({ id: reports.id }).from(reports).where(and(reportsOf(t), inArray(reports.status, ['open', 'in_review']))).limit(1);
    if (r) return true;
  }
  return false;
}

async function decided(tx: Queryable, decisionId: string, notifyUser: boolean): Promise<void> {
  await tx.insert(outboxEvents).values({ eventType: 'moderation.decided', aggregateType: 'moderation_decision', aggregateId: decisionId, payload: { notifyUser } });
}

/** An appeal answered by this decision: marked decided, and the decision points at the appealed one */
async function answerAppeal(tx: Queryable, appealId: string | undefined, now: Date): Promise<string | null> {
  if (!appealId) return null;
  const [a] = await tx
    .update(moderationAppeals)
    .set({ status: 'decided', decidedAt: now })
    .where(and(eq(moderationAppeals.id, appealId), eq(moderationAppeals.status, 'open')))
    .returning({ decisionId: moderationAppeals.decisionId });
  return a?.decisionId ?? null;
}

async function lockListing(tx: Queryable, listingId: string): Promise<Listing | null> {
  const [l] = await tx.select().from(listings).where(eq(listings.id, listingId)).for('update');
  return l ?? null;
}

const isEvent = async (tx: Queryable, listingId: string) =>
  (await tx.execute(sql`SELECT 1 FROM event_details WHERE listing_id = ${listingId}`)).length > 0;

/** Takes one listing down under a decision (its own, or a suspension's) */
async function takeDownRow(tx: Queryable, l: Listing, decisionId: string, staff: StaffContext, now: Date, data: Record<string, unknown>) {
  await tx.update(listings).set({ status: 'rejected', statusChangedAt: now }).where(eq(listings.id, l.id));
  await recordChange(tx, {
    listingId: l.id,
    event: 'rejected',
    outbox: LISTING_OUTBOX.rejected,
    actorType: 'staff',
    actorUserId: staff.userId,
    from: l.status,
    to: 'rejected',
    revision: l.revision,
    data,
    moderationDecisionId: decisionId,
  });
}

/**
 * Brings a taken-down listing back to where it was: active (or expired, if its time ran out
 * meanwhile), paused, sold or expired. A resubmission waiting for review goes live for a new
 * period, like a passed automatic check.
 */
async function restoreRow(tx: Queryable, l: Listing, decisionId: string, actor: { type: 'staff' | 'system'; userId: string | null }, now: Date) {
  let to: Listing['status'];
  const set: Partial<typeof listings.$inferInsert> = { statusChangedAt: now };
  if (l.status === 'pending_review') {
    const catalog = await cachedCatalog(tx);
    const days = catalog.byId.get(l.categoryId ?? '')?.listingDurationDays ?? 30;
    to = 'active';
    Object.assign(set, { publishedAt: l.publishedAt ?? now, rankedAt: l.rankedAt ?? now, expiresAt: new Date(now.getTime() + days * 86_400_000) });
  } else {
    const before = (await lastTakeDown(tx, l.id))?.fromStatus as Listing['status'] | undefined;
    to = before && (VISIBLE as readonly string[]).includes(before) ? before : 'active';
    if (to === 'active' && l.expiresAt && l.expiresAt <= now) to = 'expired';
  }
  set.status = to;
  await tx.update(listings).set(set).where(eq(listings.id, l.id));
  await recordChange(tx, {
    listingId: l.id,
    event: 'restored',
    outbox: LISTING_OUTBOX.restored,
    actorType: actor.type,
    actorUserId: actor.userId,
    from: l.status,
    to,
    revision: l.revision,
    moderationDecisionId: decisionId,
  });
}

// ---------------------------------------------------------------------------------------------
// Listings and events
// ---------------------------------------------------------------------------------------------

/** Takes a listing or event down (or refuses a resubmission) with its statement */
export async function takeDownListing(db: Db, staff: StaffContext, listingId: string, g: Grounds, opts: DecideOptions): Promise<DecideResult> {
  if (!validGrounds(g)) return { ok: false, reason: 'invalid' };
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const l = await lockListing(tx, listingId);
    if (!l) return { ok: false, reason: 'not_found' };
    if (![...VISIBLE, 'pending_review'].includes(l.status)) return { ok: false, reason: 'not_allowed' };
    const resubmission = l.status === 'pending_review';
    const event = await isEvent(tx, l.id);
    const onReport = await hasOpenReports(tx, [{ listingId: l.id }]);
    const what: StatementWhat = { kind: resubmission ? 'listing_rejected' : event ? 'event_removed' : 'listing_removed', title: l.title };
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        listingId: l.id,
        listingRevision: l.revision,
        decision: resubmission ? 'reject' : 'remove',
        reasonCode: g.reason,
        policyGround: g.section ? policyGround(g.section) : null,
        legalGround: g.legalGround,
        statementFa: composeStatement({ what, facts: g.facts, section: g.section, legalGround: g.legalGround, onReport, timeZone: opts.timeZone }),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
        contentSnapshot: await snapshot(tx, l),
      })
      .returning({ id: moderationDecisions.id });
    await takeDownRow(tx, l, d!.id, staff, now, { reason: g.reason });
    const closed = await closeReports(tx, [{ listingId: l.id }], d!.id, 'resolved', now);
    await staffAudit(tx, staff, 'listing.taken_down', { type: 'listing', id: l.id }, { decisionId: d!.id, reason: g.reason, section: g.section, reports: closed });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/** Puts a taken-down listing back, or lets a resubmission go live */
export async function restoreListing(db: Db, staff: StaffContext, listingId: string, note: string, opts: DecideOptions): Promise<DecideResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const l = await lockListing(tx, listingId);
    if (!l) return { ok: false, reason: 'not_found' };
    // Never one's own listing
    if (l.userId === staff.userId) return { ok: false, reason: 'not_allowed' };
    if (l.status !== 'rejected' && l.status !== 'pending_review') return { ok: false, reason: 'not_allowed' };
    // A listing of a suspended seller or business stays down until the suspension ends
    const [owner] = await tx.execute<{ blocked: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM user_sanctions s WHERE s.user_id = ${l.userId} AND s.revoked_at IS NULL
          AND s.type IN ('suspended', 'banned') AND s.starts_at <= now() AND (s.ends_at IS NULL OR s.ends_at > now()))
        OR EXISTS (SELECT 1 FROM organizations o WHERE o.id = ${l.organizationId} AND o.status = 'suspended') AS blocked
    `);
    if (owner?.blocked) return { ok: false, reason: 'not_allowed' };
    const t = messages_.moderation.staff;
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        listingId: l.id,
        listingRevision: l.revision,
        decision: 'restore',
        statementFa: [opts.appealId ? t.appealGranted : null, t.restored.listing(l.title), note.trim() || null].filter(Boolean).join(' '),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
        contentSnapshot: await snapshot(tx, l),
      })
      .returning({ id: moderationDecisions.id });
    await restoreRow(tx, l, d!.id, { type: 'staff', userId: staff.userId }, now);
    const closed = await closeReports(tx, [{ listingId: l.id }], d!.id, 'dismissed', now);
    await staffAudit(tx, staff, 'listing.restored', { type: 'listing', id: l.id }, { decisionId: d!.id, from: l.status, reports: closed });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/** Staff looked and found nothing wrong: the open reports are dismissed (reporters are told) */
export async function noViolation(db: Db, staff: StaffContext, target: Target, note: string, opts: DecideOptions): Promise<DecideResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    let values: Partial<typeof moderationDecisions.$inferInsert> = {};
    if (target.listingId) {
      const l = await lockListing(tx, target.listingId);
      if (!l) return { ok: false, reason: 'not_found' };
      values = { listingId: l.id, listingRevision: l.revision, contentSnapshot: await snapshot(tx, l) };
    } else if (target.reportedUserId) values = { userId: target.reportedUserId };
    else if (target.organizationId) values = { organizationId: target.organizationId };
    else if (target.messageId) values = { messageId: target.messageId };
    else return { ok: false, reason: 'invalid' };
    const [d] = await tx
      .insert(moderationDecisions)
      .values({ ...values, decision: 'no_action', statementFa: note.trim() || null, decidedBy: 'staff', moderatorUserId: staff.userId })
      .returning({ id: moderationDecisions.id });
    const closed = await closeReports(tx, [target], d!.id, 'dismissed', now);
    const id = target.listingId ?? target.reportedUserId ?? target.organizationId ?? target.messageId!;
    const type = target.listingId ? 'listing' : target.reportedUserId ? 'user' : target.organizationId ? 'organization' : 'message';
    await staffAudit(tx, staff, 'moderation.no_violation', { type, id }, { decisionId: d!.id, reports: closed });
    // Nothing changed for the person concerned; the reporters hear the outcome
    await decided(tx, d!.id, false);
    return { ok: true, decisionId: d!.id };
  });
}

/** «بررسی شد، مشکلی ندارد» in the review of new listings: an approval, nobody is told */
export async function approveListing(db: Db, staff: StaffContext, listingId: string): Promise<DecideResult> {
  return db.transaction(async (tx) => {
    const l = await lockListing(tx, listingId);
    if (!l) return { ok: false, reason: 'not_found' };
    if (l.userId === staff.userId) return { ok: false, reason: 'not_allowed' };
    const [d] = await tx
      .insert(moderationDecisions)
      .values({ listingId: l.id, listingRevision: l.revision, decision: 'approve', decidedBy: 'staff', moderatorUserId: staff.userId, contentSnapshot: await snapshot(tx, l) })
      .returning({ id: moderationDecisions.id });
    await staffAudit(tx, staff, 'listing.reviewed', { type: 'listing', id: l.id }, { decisionId: d!.id, revision: l.revision });
    return { ok: true, decisionId: d!.id };
  });
}

// ---------------------------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------------------------

export type SanctionKind = 'warning' | 'posting_restricted' | 'messaging_restricted' | 'suspended' | 'banned';

/**
 * Warns, restricts or suspends an account. A suspension or ban also takes down every listing the
 * account has up, under the same decision, and they come back when it ends or is lifted.
 * `alsoListingId`: the listing the decision was made from (its reports are resolved with it).
 */
export async function sanctionUser(
  db: Db,
  staff: StaffContext,
  input: { userId: string; kind: SanctionKind; days: 7 | 30 | null; alsoListingId?: string | null } & Grounds,
  opts: DecideOptions,
): Promise<DecideResult> {
  if (!validGrounds(input)) return { ok: false, reason: 'invalid' };
  // Warnings and bans have no end; a suspension 7 or 30 days; restrictions also until further notice
  const fixed = input.kind === 'warning' || input.kind === 'banned';
  if (fixed ? input.days !== null : input.kind === 'suspended' && input.days === null) return { ok: false, reason: 'invalid' };
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ id: users.id, status: users.status, staffRole: users.staffRole }).from(users).where(eq(users.id, input.userId)).for('update');
    if (!u || u.status === 'deleted') return { ok: false, reason: 'not_found' };
    if (u.id === staff.userId) return { ok: false, reason: 'not_allowed' };
    // Rank: only an admin sanctions a moderator, and no one an admin from here
    if (u.staffRole && (u.staffRole === 'admin' || staff.role !== 'admin')) return { ok: false, reason: 'not_allowed' };
    const endsAt = input.days ? new Date(now.getTime() + input.days * 86_400_000) : null;
    const listingTargets: Target[] = input.alsoListingId ? [{ listingId: input.alsoListingId }] : [];
    const onReport = await hasOpenReports(tx, [{ reportedUserId: u.id }, ...listingTargets]);
    const what: StatementWhat =
      input.kind === 'warning' || input.kind === 'banned' ? { kind: input.kind } : { kind: input.kind, until: endsAt };
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        userId: u.id,
        decision: input.kind === 'warning' ? 'warn' : 'sanction',
        reasonCode: input.reason,
        policyGround: input.section ? policyGround(input.section) : null,
        legalGround: input.legalGround,
        statementFa: composeStatement({ what, facts: input.facts, section: input.section, legalGround: input.legalGround, onReport, timeZone: opts.timeZone }),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
        contentSnapshot: { sanction: input.kind, days: input.days, ...(input.alsoListingId ? { listingId: input.alsoListingId } : {}) },
      })
      .returning({ id: moderationDecisions.id });
    await tx.insert(userSanctions).values({ userId: u.id, type: input.kind, moderationDecisionId: d!.id, startsAt: now, endsAt, createdByUserId: staff.userId });
    let takenDown = 0;
    if (input.kind === 'suspended' || input.kind === 'banned') {
      const live = await tx.select().from(listings).where(and(eq(listings.userId, u.id), inArray(listings.status, [...VISIBLE, 'pending_review']))).for('update');
      for (const l of live) {
        await takeDownRow(tx, l, d!.id, staff, now, { reason: input.reason, sanction: input.kind });
        listingTargets.push({ listingId: l.id });
      }
      takenDown = live.length;
    }
    const closed = await closeReports(tx, [{ reportedUserId: u.id }, ...listingTargets], d!.id, 'resolved', now);
    await staffAudit(tx, staff, 'user.sanctioned', { type: 'user', id: u.id }, { decisionId: d!.id, kind: input.kind, days: input.days, listings: takenDown, reports: closed });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/** Listings a suspension took down that are still down because of it */
async function listingsDownBy(tx: Queryable, decisionId: string): Promise<Listing[]> {
  const ids = await tx.execute<{ id: string }>(sql`
    SELECT DISTINCT e.listing_id AS id FROM listing_events e
    JOIN listings l ON l.id = e.listing_id
    WHERE e.moderation_decision_id = ${decisionId} AND e.to_status = 'rejected' AND l.status = 'rejected'
  `);
  if (ids.length === 0) return [];
  const rows = await tx.select().from(listings).where(inArray(listings.id, ids.map((r) => r.id))).for('update');
  const out: Listing[] = [];
  // Only those whose last take-down is still this one (not a later decision about the listing)
  for (const l of rows) if ((await lastTakeDown(tx, l.id))?.decisionId === decisionId) out.push(l);
  return out;
}

/** Whether the user still has another suspension or ban running */
async function stillSuspended(tx: Queryable, userId: string, exceptSanctionId: string, now: Date): Promise<boolean> {
  const [r] = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM user_sanctions WHERE user_id = ${userId} AND id <> ${exceptSanctionId} AND revoked_at IS NULL
      AND type IN ('suspended', 'banned') AND starts_at <= ${now.toISOString()}::timestamptz AND (ends_at IS NULL OR ends_at > ${now.toISOString()}::timestamptz)
  `);
  return (r?.n ?? 0) > 0;
}

/** Lifts a sanction early (an admin, or a granted appeal); a suspension's listings come back */
export async function liftSanction(db: Db, staff: StaffContext, sanctionId: string, note: string, opts: DecideOptions): Promise<DecideResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(userSanctions).where(eq(userSanctions.id, sanctionId)).for('update');
    if (!s || s.revokedAt || (s.endsAt && s.endsAt <= now)) return { ok: false, reason: 'not_found' };
    if (s.userId === staff.userId) return { ok: false, reason: 'not_allowed' };
    await tx.update(userSanctions).set({ revokedAt: now, revokedByUserId: staff.userId, revokeNote: note.trim() || null }).where(eq(userSanctions.id, s.id));
    const t = messages_.moderation.staff;
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        userId: s.userId,
        decision: 'restore',
        statementFa: [opts.appealId ? t.appealGranted : null, t.restored.sanction, note.trim() || null].filter(Boolean).join(' '),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
        contentSnapshot: { liftedSanctionId: s.id, type: s.type },
      })
      .returning({ id: moderationDecisions.id });
    let restored = 0;
    if ((s.type === 'suspended' || s.type === 'banned') && !(await stillSuspended(tx, s.userId, s.id, now))) {
      for (const l of await listingsDownBy(tx, s.moderationDecisionId)) {
        await restoreRow(tx, l, d!.id, { type: 'staff', userId: staff.userId }, now);
        restored++;
      }
    }
    await staffAudit(tx, staff, 'user.sanction_lifted', { type: 'user', id: s.userId }, { decisionId: d!.id, sanctionId: s.id, type: s.type, listings: restored });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/**
 * A suspension that ran out: its listings come back by themselves (worker, every 15 minutes),
 * each with a `restore` decision by rule, and the person is told once.
 */
export async function restoreAfterSuspensions(db: Db, now = new Date()): Promise<number> {
  const due = await db.execute<{ id: string; user_id: string; moderation_decision_id: string }>(sql`
    SELECT s.id, s.user_id, s.moderation_decision_id FROM user_sanctions s
    WHERE s.type = 'suspended' AND s.revoked_at IS NULL AND s.ends_at <= ${now.toISOString()}::timestamptz
      AND s.ends_at > ${now.toISOString()}::timestamptz - interval '30 days'
      AND EXISTS (SELECT 1 FROM listing_events e JOIN listings l ON l.id = e.listing_id
                  WHERE e.moderation_decision_id = s.moderation_decision_id AND e.to_status = 'rejected' AND l.status = 'rejected')
  `);
  let total = 0;
  const t = messages_.moderation.staff;
  for (const s of due) {
    total += await db.transaction(async (tx) => {
      if (await stillSuspended(tx, s.user_id, s.id, now)) return 0;
      const down = await listingsDownBy(tx, s.moderation_decision_id);
      if (down.length === 0) return 0;
      const [d] = await tx
        .insert(moderationDecisions)
        .values({ userId: s.user_id, decision: 'restore', statementFa: t.restored.expired, decidedBy: 'rule', aiOutput: { rule: 'suspension_ended', sanctionId: s.id }, contentSnapshot: {} })
        .returning({ id: moderationDecisions.id });
      for (const l of down) await restoreRow(tx, l, d!.id, { type: 'system', userId: null }, now);
      await decided(tx, d!.id, true);
      return down.length;
    });
  }
  return total;
}

// ---------------------------------------------------------------------------------------------
// Businesses and messages
// ---------------------------------------------------------------------------------------------

/** Suspends a business (admins): its page and listings go, until the suspension is lifted */
export async function suspendBusiness(db: Db, staff: StaffContext, organizationId: string, g: Grounds, opts: DecideOptions): Promise<DecideResult> {
  if (!validGrounds(g)) return { ok: false, reason: 'invalid' };
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).for('update');
    if (!o || o.status !== 'active') return { ok: false, reason: 'not_found' };
    const onReport = await hasOpenReports(tx, [{ organizationId: o.id }]);
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        organizationId: o.id,
        decision: 'sanction',
        reasonCode: g.reason,
        policyGround: g.section ? policyGround(g.section) : null,
        legalGround: g.legalGround,
        statementFa: composeStatement({ what: { kind: 'business_suspended', name: o.name }, facts: g.facts, section: g.section, legalGround: g.legalGround, onReport, timeZone: opts.timeZone }),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
        contentSnapshot: { name: o.name, slug: o.slug },
      })
      .returning({ id: moderationDecisions.id });
    await tx.update(organizations).set({ status: 'suspended' }).where(eq(organizations.id, o.id));
    const live = await tx.select().from(listings).where(and(eq(listings.organizationId, o.id), inArray(listings.status, [...VISIBLE, 'pending_review']))).for('update');
    const targets: Target[] = [{ organizationId: o.id }];
    for (const l of live) {
      await takeDownRow(tx, l, d!.id, staff, now, { reason: g.reason, sanction: 'business_suspended' });
      targets.push({ listingId: l.id });
    }
    const closed = await closeReports(tx, targets, d!.id, 'resolved', now);
    await staffAudit(tx, staff, 'organization.suspended', { type: 'organization', id: o.id }, { decisionId: d!.id, listings: live.length, reports: closed });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

export async function liftBusinessSuspension(db: Db, staff: StaffContext, organizationId: string, note: string, opts: DecideOptions): Promise<DecideResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).for('update');
    if (!o || o.status !== 'suspended') return { ok: false, reason: 'not_found' };
    const [last] = await tx.execute<{ id: string }>(sql`
      SELECT id FROM moderation_decisions WHERE organization_id = ${o.id} AND decision = 'sanction' ORDER BY created_at DESC LIMIT 1`);
    const t = messages_.moderation.staff;
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        organizationId: o.id,
        decision: 'restore',
        statementFa: [opts.appealId ? t.appealGranted : null, t.restored.business(o.name), note.trim() || null].filter(Boolean).join(' '),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
        contentSnapshot: { name: o.name, slug: o.slug },
      })
      .returning({ id: moderationDecisions.id });
    await tx.update(organizations).set({ status: 'active' }).where(eq(organizations.id, o.id));
    let restored = 0;
    if (last) {
      for (const l of await listingsDownBy(tx, last.id)) {
        await restoreRow(tx, l, d!.id, { type: 'staff', userId: staff.userId }, now);
        restored++;
      }
    }
    await staffAudit(tx, staff, 'organization.suspension_lifted', { type: 'organization', id: o.id }, { decisionId: d!.id, listings: restored });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/** Hides a chat message from the other side (it stays stored as evidence) */
export async function hideMessage(db: Db, staff: StaffContext, messageId: string, g: Grounds, opts: DecideOptions): Promise<DecideResult> {
  if (!validGrounds(g)) return { ok: false, reason: 'invalid' };
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [m] = await tx.select({ id: messages.id, hiddenAt: messages.hiddenAt, kind: messages.kind }).from(messages).where(eq(messages.id, messageId)).for('update');
    if (!m || m.kind !== 'text') return { ok: false, reason: 'not_found' };
    if (m.hiddenAt) return { ok: false, reason: 'not_allowed' };
    const onReport = await hasOpenReports(tx, [{ messageId: m.id }]);
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        messageId: m.id,
        decision: 'hide',
        reasonCode: g.reason,
        policyGround: g.section ? policyGround(g.section) : null,
        legalGround: g.legalGround,
        statementFa: composeStatement({ what: { kind: 'message_hidden' }, facts: g.facts, section: g.section, legalGround: g.legalGround, onReport, timeZone: opts.timeZone }),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
      })
      .returning({ id: moderationDecisions.id });
    await tx.update(messages).set({ hiddenAt: now }).where(eq(messages.id, m.id));
    const closed = await closeReports(tx, [{ messageId: m.id }], d!.id, 'resolved', now);
    await staffAudit(tx, staff, 'message.hidden', { type: 'message', id: m.id }, { decisionId: d!.id, reports: closed });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

export async function unhideMessage(db: Db, staff: StaffContext, messageId: string, note: string, opts: DecideOptions): Promise<DecideResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [m] = await tx.select({ id: messages.id, hiddenAt: messages.hiddenAt }).from(messages).where(eq(messages.id, messageId)).for('update');
    if (!m?.hiddenAt) return { ok: false, reason: 'not_found' };
    const t = messages_.moderation.staff;
    const [d] = await tx
      .insert(moderationDecisions)
      .values({
        messageId: m.id,
        decision: 'restore',
        statementFa: [opts.appealId ? t.appealGranted : null, t.restored.message, note.trim() || null].filter(Boolean).join(' '),
        decidedBy: 'staff',
        moderatorUserId: staff.userId,
        appealOfDecisionId: await answerAppeal(tx, opts.appealId, now),
      })
      .returning({ id: moderationDecisions.id });
    await tx.update(messages).set({ hiddenAt: null }).where(eq(messages.id, m.id));
    await staffAudit(tx, staff, 'message.restored', { type: 'message', id: m.id }, { decisionId: d!.id });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/** Keeps an appealed decision, with one sentence why; the person is told */
export async function keepDecision(db: Db, staff: StaffContext, appealId: string, note: string, opts: DecideOptions): Promise<DecideResult> {
  if (note.trim().length < 10) return { ok: false, reason: 'invalid' };
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const appealed = await answerAppeal(tx, appealId, now);
    if (!appealed) return { ok: false, reason: 'not_found' };
    const [orig] = await tx.select().from(moderationDecisions).where(eq(moderationDecisions.id, appealed));
    const t = messages_.moderation.staff;
    const target = { listingId: orig!.listingId, listingRevision: orig!.listingRevision, listingImageId: orig!.listingImageId, userId: orig!.userId, organizationId: orig!.organizationId, messageId: orig!.messageId };
    const [d] = await tx
      .insert(moderationDecisions)
      .values({ ...target, decision: 'no_action', statementFa: t.appealKept(note.trim()), decidedBy: 'staff', moderatorUserId: staff.userId, appealOfDecisionId: appealed })
      .returning({ id: moderationDecisions.id });
    await staffAudit(tx, staff, 'appeal.kept', { type: 'moderation_decision', id: appealed }, { decisionId: d!.id, appealId });
    await decided(tx, d!.id, true);
    return { ok: true, decisionId: d!.id };
  });
}

/** The open appeal on a decision, if any (for granting it through one of the functions above) */
export async function openAppealOf(db: Queryable, decisionId: string): Promise<string | null> {
  const [a] = await db.select({ id: moderationAppeals.id }).from(moderationAppeals).where(and(eq(moderationAppeals.decisionId, decisionId), eq(moderationAppeals.status, 'open'), isNull(moderationAppeals.decidedAt)));
  return a?.id ?? null;
}
