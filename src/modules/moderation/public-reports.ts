import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Db, Queryable } from '../../db/drizzle';
import { listings, organizationMembers, organizations, outboxEvents, reports, users } from '../../db/schema';
import { hit, type Limit } from '../../lib/rate-limit';
import { CHAT_LIMITS } from '../chat/limits';
import { eventPath } from '../events/slug';
import { listingPath } from '../listings/slug';
import { sellerPath } from '../users/profile';
import { isNewAccount } from '../users/new-account';
import { PUBLIC_REASONS, type ReasonCode, type ReportTargetKind } from './reasons';

// Reports from the report buttons on listing, event, seller and business pages (DSA art. 16;
// approved Oct 23, 2026). Anyone may report: signed in directly, signed out with a name, an email
// and the good-faith statement (docs/schema.md, decision 16.6), behind Turnstile. Each report
// writes `report.created` to the outbox: the worker emails the reporter a confirmation and
// alerts the owner (src/worker/moderation.ts). Chat messages are reported from the chat
// (./reports.ts).

export const REPORT_LIMITS = {
  /** Signed in: shared with chat reports */
  perUserDay: CHAT_LIMITS.reportsPerUserDay,
  perNewUserDay: { name: 'report:new-user:1d', max: 5, windowSeconds: 86_400 },
  /** Signed out */
  perIpHour: { name: 'report:ip:1h', max: 5, windowSeconds: 3_600 },
  perEmailDay: { name: 'report:email:1d', max: 10, windowSeconds: 86_400 },
} as const satisfies Record<string, Limit>;

/** Statuses of listings a visitor can see, so can report */
const VISIBLE = ['active', 'paused', 'sold', 'expired'] as const;

export const reportInput = z
  .object({
    kind: z.enum(['listing', 'user', 'business']),
    /** Listing or user public token, business slug */
    ref: z.string().min(1).max(80),
    reason: z.string(),
    details: z.string().trim().max(2000).optional(),
    illegal: z.boolean().default(false),
    legalReference: z.string().trim().max(300).optional(),
    goodFaith: z.boolean().default(false),
    name: z.string().trim().min(2).max(100).optional(),
    email: z.email().max(254).optional(),
  })
  .refine((r) => (PUBLIC_REASONS[r.kind] as readonly string[]).includes(r.reason), { path: ['reason'], message: 'reason' })
  // A notice that something is illegal carries the good-faith statement (DSA art. 16(2)(d))
  .refine((r) => !r.illegal || r.goodFaith, { path: ['goodFaith'], message: 'required' });

export type ReportInput = z.infer<typeof reportInput>;

export type Reporter = { userId: string } | { userId: null; ip: string | null };

export type ReportResult =
  | { ok: true; reportId: string | null; already: boolean }
  | { ok: false; reason: 'not_found' | 'own' | 'rate_limited' | 'invalid'; fields?: string[]; retryAfterSeconds?: number };

type Target = { listingId?: string; reportedUserId?: string; organizationId?: string };

/** The reported thing, if a visitor could see it; and whose it is, so nobody reports their own */
async function resolveTarget(db: Queryable, kind: ReportTargetKind, ref: string): Promise<{ target: Target; owners: string[] } | null> {
  if (kind === 'listing') {
    if (!/^[0-9a-hjkmnp-tv-z]{10}$/.test(ref)) return null;
    const [l] = await db
      .select({ id: listings.id, userId: listings.userId })
      .from(listings)
      .where(and(eq(listings.publicToken, ref), inArray(listings.status, [...VISIBLE])));
    return l ? { target: { listingId: l.id }, owners: [l.userId] } : null;
  }
  if (kind === 'user') {
    if (!/^[0-9a-hjkmnp-tv-z]{10}$/.test(ref)) return null;
    const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.publicToken, ref), eq(users.status, 'active')));
    return u ? { target: { reportedUserId: u.id }, owners: [u.id] } : null;
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ref)) return null;
  const [o] = await db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.slug, ref), eq(organizations.status, 'active')));
  if (!o) return null;
  const members = await db.select({ userId: organizationMembers.userId }).from(organizationMembers).where(eq(organizationMembers.organizationId, o.id));
  return { target: { organizationId: o.id }, owners: members.map((m) => m.userId) };
}

export async function createReport(db: Db, redis: Redis, reporter: Reporter, raw: unknown, now = new Date()): Promise<ReportResult> {
  const parsed = reportInput.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid', fields: parsed.error.issues.map((i) => String(i.path[0])) };
  const input = parsed.data;
  const email = input.email?.toLowerCase();
  // Signed out: name, email and the good-faith statement (a DSA notice)
  if (!reporter.userId) {
    const missing = [...(input.name ? [] : ['name']), ...(email ? [] : ['email']), ...(input.goodFaith ? [] : ['goodFaith'])];
    if (missing.length) return { ok: false, reason: 'invalid', fields: missing };
  }

  const found = await resolveTarget(db, input.kind, input.ref);
  if (!found) return { ok: false, reason: 'not_found' };
  if (reporter.userId && found.owners.includes(reporter.userId)) return { ok: false, reason: 'own' };

  const checks: Array<readonly [Limit, string]> = [];
  if (reporter.userId) {
    checks.push([REPORT_LIMITS.perUserDay, reporter.userId]);
    const [me] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, reporter.userId));
    if (me && isNewAccount(me.createdAt, now)) checks.push([REPORT_LIMITS.perNewUserDay, reporter.userId]);
  } else {
    const ip = 'ip' in reporter ? reporter.ip : null;
    if (ip) checks.push([REPORT_LIMITS.perIpHour, ip]);
    checks.push([REPORT_LIMITS.perEmailDay, email!]);
  }

  return db.transaction(async (tx) => {
    const t = found.target;
    // Signed out: one open report per email per thing (signed in, the unique indexes do it)
    if (!reporter.userId) {
      const [open] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            sql`${reports.reporterUserId} IS NULL`,
            eq(reports.reporterEmail, email!),
            inArray(reports.status, ['open', 'in_review']),
            t.listingId ? eq(reports.listingId, t.listingId) : t.reportedUserId ? eq(reports.reportedUserId, t.reportedUserId) : eq(reports.organizationId, t.organizationId!),
          ),
        );
      if (open) return { ok: true, reportId: null, already: true };
    }
    const limited = await hit(redis, checks);
    if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };

    const [row] = await tx
      .insert(reports)
      .values({
        reporterUserId: reporter.userId,
        reporterEmail: reporter.userId ? null : email!,
        reporterName: reporter.userId ? null : input.name!,
        listingId: t.listingId ?? null,
        reportedUserId: t.reportedUserId ?? null,
        organizationId: t.organizationId ?? null,
        reasonCode: input.reason as ReasonCode,
        details: input.details || null,
        isIllegalContentNotice: input.illegal,
        legalReference: input.illegal ? input.legalReference || null : null,
        goodFaithConfirmed: input.goodFaith,
      })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!row) return { ok: true, reportId: null, already: true };
    await tx.insert(outboxEvents).values({
      eventType: 'report.created',
      aggregateType: 'report',
      aggregateId: row.id,
      payload: { target: input.kind, reason: input.reason, illegal: input.illegal },
    });
    return { ok: true, reportId: row.id, already: false };
  });
}

/** What the report page shows about the thing reported, and where "back" goes */
export async function reportTargetSummary(
  db: Queryable,
  kind: ReportTargetKind,
  ref: string,
): Promise<{ label: string; isEvent: boolean; back: string } | null> {
  const found = await resolveTarget(db, kind, ref);
  if (!found) return null;
  const t = found.target;
  if (t.listingId) {
    const [l] = await db
      .select({ title: listings.title, token: listings.publicToken, isEvent: sql<boolean>`EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})` })
      .from(listings)
      .where(eq(listings.id, t.listingId));
    return { label: l!.title, isEvent: l!.isEvent, back: l!.isEvent ? eventPath(l!.title, l!.token) : listingPath(l!.title, l!.token) };
  }
  if (t.reportedUserId) {
    const [u] = await db.select({ name: users.displayName, token: users.publicToken }).from(users).where(eq(users.id, t.reportedUserId));
    return { label: u!.name, isEvent: false, back: sellerPath(u!.token) };
  }
  const [o] = await db.select({ name: organizations.name, slug: organizations.slug }).from(organizations).where(eq(organizations.id, t.organizationId!));
  return { label: o!.name, isEvent: false, back: `/b/${o!.slug}` };
}
