import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Db, Queryable } from '../../db/drizzle';
import { moderationAppeals, outboxEvents } from '../../db/schema';
import { hit } from '../../lib/rate-limit';

// Decisions about a user, and their appeals (roadmap step 8; terms 7.4). Not required of a small
// enterprise by the DSA (art. 19 exempts art. 20), offered anyway: one appeal per decision within
// six months, against any restriction, also an automatic one. Staff answer it in the admin queue
// with a new decision (decide.ts), and the person hears the answer like any statement.

export const APPEAL_DAYS = 183;
export const APPEALABLE = ['reject', 'remove', 'hide', 'warn', 'sanction'] as const;
export const APPEAL_LIMIT = { name: 'appeal:user:1d', max: 10, windowSeconds: 86_400 };

export type Notice = {
  id: string;
  decision: string;
  decidedBy: 'staff' | 'ai' | 'rule';
  statement: string | null;
  policyGround: string | null;
  createdAt: Date;
  kind: 'listing' | 'user' | 'business' | 'message';
  title: string | null;
  listingCode: number | null;
  appeal: { status: 'open' | 'decided'; createdAt: Date } | null;
  /** The decision this one answers (an appeal's answer) */
  answers: string | null;
};

/** A decision is about this user when it concerns their listing, account, sent message or owned business */
const ABOUT = (userId: string) => sql`(
  l.user_id = ${userId} OR d.user_id = ${userId} OR m.sender_user_id = ${userId}
  OR d.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ${userId} AND role = 'owner')
)`;

/** What /account/notices shows: restrictions, restorations and appeal answers, newest first */
export async function decisionsAbout(db: Queryable, userId: string, opts: { limit?: number; id?: string } = {}): Promise<Notice[]> {
  const rows = await db.execute<{
    id: string; decision: string; decided_by: Notice['decidedBy']; statement_fa: string | null; policy_ground: string | null; created_at: string | Date;
    kind: Notice['kind']; title: string | null; ref_number: string | null; appeal_status: 'open' | 'decided' | null; appeal_at: string | Date | null; appeal_of: string | null;
  }>(sql`
    SELECT d.id, d.decision, d.decided_by, d.statement_fa, d.policy_ground, d.created_at, d.appeal_of_decision_id AS appeal_of,
      CASE WHEN d.listing_id IS NOT NULL THEN 'listing' WHEN d.user_id IS NOT NULL THEN 'user'
           WHEN d.organization_id IS NOT NULL THEN 'business' ELSE 'message' END AS kind,
      coalesce(l.title, o.name) AS title, l.ref_number, a.status AS appeal_status, a.created_at AS appeal_at
    FROM moderation_decisions d
    LEFT JOIN listings l ON l.id = d.listing_id
    LEFT JOIN organizations o ON o.id = d.organization_id
    LEFT JOIN messages m ON m.id = d.message_id
    LEFT JOIN moderation_appeals a ON a.decision_id = d.id
    WHERE ${ABOUT(userId)} ${opts.id ? sql`AND d.id = ${opts.id}` : sql``}
      AND (d.decision IN ('reject', 'remove', 'hide', 'warn', 'sanction', 'restore') OR (d.decision = 'no_action' AND d.appeal_of_decision_id IS NOT NULL))
    ORDER BY d.created_at DESC
    LIMIT ${opts.limit ?? 100}
  `);
  return rows.map((r) => ({
    id: r.id,
    decision: r.decision,
    decidedBy: r.decided_by,
    statement: r.statement_fa,
    policyGround: r.policy_ground,
    createdAt: new Date(r.created_at),
    kind: r.kind,
    title: r.title,
    listingCode: r.ref_number === null ? null : Number(r.ref_number),
    appeal: r.appeal_status ? { status: r.appeal_status, createdAt: new Date(r.appeal_at!) } : null,
    answers: r.appeal_of,
  }));
}

/** Whether this notice can still be appealed */
export function appealable(n: Notice, now = new Date()): boolean {
  return (APPEALABLE as readonly string[]).includes(n.decision) && !n.appeal && now.getTime() - n.createdAt.getTime() < APPEAL_DAYS * 86_400_000;
}

export type AppealResult = { ok: true } | { ok: false; reason: 'not_found' | 'closed' | 'already' | 'invalid' | 'rate_limited'; retryAfterSeconds?: number };

export async function appealDecision(db: Db, redis: Redis, userId: string, decisionId: string, body: string, now = new Date()): Promise<AppealResult> {
  const text = body.trim();
  if (text.length < 10 || text.length > 2000) return { ok: false, reason: 'invalid' };
  if (!/^[0-9a-f-]{36}$/.test(decisionId)) return { ok: false, reason: 'not_found' };
  return db.transaction(async (tx) => {
    const [n] = await decisionsAbout(tx, userId, { id: decisionId });
    if (!n) return { ok: false, reason: 'not_found' };
    if (n.appeal) return { ok: false, reason: 'already' };
    if (!appealable(n, now)) return { ok: false, reason: 'closed' };
    const limited = await hit(redis, [[APPEAL_LIMIT, userId]]);
    if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };
    const [a] = await tx.insert(moderationAppeals).values({ decisionId, userId, body: text }).onConflictDoNothing().returning({ id: moderationAppeals.id });
    if (!a) return { ok: false, reason: 'already' };
    await tx.insert(outboxEvents).values({ eventType: 'appeal.created', aggregateType: 'appeal', aggregateId: a.id, payload: { decisionId } });
    return { ok: true };
  });
}
