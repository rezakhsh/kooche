import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { outboxEvents, sessions, users } from '../../db/schema';
import { ACTING_MINUTES, readReturn, sessionTokenOf } from './acting-cookies';
import { staffAudit, type StaffContext } from './audit';

// Sign in as a user (wave 2 part 1, step 1d, owner Oct 29, 2026; mockups final/admin-viewas
// section 3 and final/viewas-banner; docs/setup.md, "Sign in as a user").
//
// Only an admin, never into a staff account. A real person: a written reason and a fresh two-step
// code, read only until «اجازهٔ تغییر» with its own reason; the person is told by email when changes
// were allowed. A test account: no reason or code, changes allowed from the start.
//
// The admin's own session cookie is kept in STAFF_RETURN_COOKIE (signed, with the end time) and the
// session cookie becomes a new session for the user, marked in `sessions` (opened_by_user_id,
// opened_reason, writable_at). It lasts ACTING_MINUTES: after that currentSession() no longer
// accepts it and src/proxy.ts puts the admin's own cookie back. «پایان» does the same at once.
// While it lasts, src/modules/users/server.ts stops changes in read-only mode (server actions and
// anything but GET) and writes every change to audit_log otherwise; the proxy refuses Better Auth's
// own endpoints (sign-out, email change …) altogether.

export { ACTING_BLOCKED_COOKIE, ACTING_MINUTES, readReturn, returnToken, sessionCookieName, sessionTokenOf, signSessionToken, STAFF_RETURN_COOKIE } from './acting-cookies';

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** The user to sign in as: by email, id or public token */
export async function findUserToActAs(db: Queryable, query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const where = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
    ? eq(users.id, q.toLowerCase())
    : q.includes('@')
      ? eq(users.email, q.toLowerCase())
      : eq(users.publicToken, q);
  const [u] = await db.select({ id: users.id }).from(users).where(where);
  return u?.id ?? null;
}

export type OpenResult =
  | { ok: true; token: string; until: Date; userId: string; test: boolean }
  | { ok: false; reason: 'not_found' | 'staff' | 'self' | 'reason_required' };

/**
 * Opens a session for the user, after the action checked the admin and (for a real person) the
 * fresh code. `reason` is required for a real person; a test account needs none and may change
 * things from the start.
 */
export async function openActingSession(
  tx: Queryable,
  ctx: StaffContext,
  input: { userId: string; reason: string; userAgent?: string | null; now?: Date },
): Promise<OpenResult> {
  const [u] = await tx
    .select({ id: users.id, status: users.status, staff: users.staffRole, test: users.testAccount })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!u || u.status === 'deleted') return { ok: false, reason: 'not_found' };
  if (u.id === ctx.userId) return { ok: false, reason: 'self' };
  if (u.staff) return { ok: false, reason: 'staff' };
  const test = !!u.test;
  const reason = input.reason.trim().slice(0, 500);
  if (!test && reason.length < 5) return { ok: false, reason: 'reason_required' };
  const now = input.now ?? new Date();
  const until = new Date(now.getTime() + ACTING_MINUTES * 60_000);
  // Like Better Auth's own tokens: 32 letters and digits
  const token = Array.from(randomBytes(32), (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('');
  await tx.insert(sessions).values({
    userId: u.id,
    token,
    expiresAt: until,
    userAgent: input.userAgent ?? null,
    openedByUserId: ctx.userId,
    openedReason: reason || null,
    writableAt: test ? now : null,
  });
  await staffAudit(tx, ctx, 'staff.acting_started', { type: 'user', id: u.id }, { reason: reason || null, test, minutes: ACTING_MINUTES });
  return { ok: true, token, until, userId: u.id, test };
}

export type ActingState = { userId: string; openedBy: string; writable: boolean; until: Date; test: boolean };

/** Whether a session is one an admin opened, and its state; ended ones (after ACTING_MINUTES) count as ended */
export async function actingState(db: Queryable, sessionId: string, now = new Date()): Promise<ActingState | 'ended' | null> {
  const [s] = await db
    .select({ userId: sessions.userId, openedBy: sessions.openedByUserId, writableAt: sessions.writableAt, createdAt: sessions.createdAt, test: users.testAccount })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId));
  if (!s?.openedBy) return null;
  // The admin who opened it must still be an active admin (code check, Oct 30, 2026)
  const [opener] = await db.select({ role: users.staffRole, status: users.status }).from(users).where(eq(users.id, s.openedBy));
  if (opener?.role !== 'admin' || opener.status !== 'active') return 'ended';
  // Better Auth may push expires_at forward while the session is used; the 30 minutes count from its start
  const until = new Date(s.createdAt.getTime() + ACTING_MINUTES * 60_000);
  if (until <= now) return 'ended';
  return { userId: s.userId, openedBy: s.openedBy, writable: !!s.writableAt, until, test: !!s.test };
}

/**
 * What a request may do in such a session: pages and other reads always; changes (server actions
 * and anything but GET or HEAD) only once allowed, and then each is written to audit_log.
 */
export function actingGate(state: Pick<ActingState, 'writable'>, request: { method: string; action: boolean }): 'read' | 'block' | 'record' {
  const change = request.action || (request.method !== 'GET' && request.method !== 'HEAD');
  if (!change) return 'read';
  return state.writable ? 'record' : 'block';
}

/** A change made in such a session, for audit_log */
export async function recordActingChange(db: Queryable, state: ActingState, sessionId: string, path: string): Promise<void> {
  await staffAudit(db, { userId: state.openedBy, sessionId, role: 'admin', ip: null, userAgent: null }, 'staff.acting_change', { type: 'user', id: state.userId }, { path: path.slice(0, 200) });
}

/** The admin behind a return cookie: their own session must still be live and theirs an admin's */
export async function returningAdmin(db: Queryable, secret: string, returnCookie: string | null | undefined): Promise<{ userId: string; sessionId: string; ownCookie: string } | null> {
  const r = readReturn(secret, returnCookie);
  const token = r ? sessionTokenOf(secret, r.ownCookie) : null;
  if (!r || !token) return null;
  const [s] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, sql`now()`), eq(users.staffRole, 'admin'), eq(users.status, 'active'), isNull(sessions.openedByUserId)));
  return s ? { userId: s.userId, sessionId: s.id, ownCookie: r.ownCookie } : null;
}

/** «اجازهٔ تغییر»: changes allowed from now, with a reason; only the admin who opened the session */
export async function allowActingChanges(tx: Queryable, ctx: StaffContext, actingToken: string, reason: string): Promise<'ok' | 'reason_required' | 'not_found'> {
  const why = reason.trim().slice(0, 500);
  if (why.length < 5) return 'reason_required';
  const [s] = await tx
    .update(sessions)
    .set({ writableAt: sql`now()` })
    .where(and(eq(sessions.token, actingToken), eq(sessions.openedByUserId, ctx.userId), isNull(sessions.writableAt)))
    .returning({ userId: sessions.userId });
  if (!s) return 'not_found';
  await staffAudit(tx, ctx, 'staff.acting_writable', { type: 'user', id: s.userId }, { reason: why });
  return 'ok';
}

/**
 * «پایان»: the session is deleted and the end written to audit_log. A real person whose account
 * could be changed is told by email (the owner's rule: staff changes are always told). Without a
 * valid return cookie (`ctx` null) this browser's session still ends, recorded under the admin who
 * opened it.
 */
export async function closeActingSession(tx: Queryable, ctx: StaffContext | null, actingToken: string | null): Promise<{ userId: string } | null> {
  if (!actingToken) return null;
  const [s] = await tx
    .delete(sessions)
    .where(and(eq(sessions.token, actingToken), ctx ? eq(sessions.openedByUserId, ctx.userId) : isNotNull(sessions.openedByUserId)))
    .returning({ id: sessions.id, userId: sessions.userId, openedBy: sessions.openedByUserId, writableAt: sessions.writableAt });
  if (!s) return null;
  await recordEnd(tx, ctx ?? openerCtx(s), s, {});
  return { userId: s.userId };
}

/**
 * Worker, every minute (code check, Oct 30, 2026): ends the sessions whose 30 minutes ran out
 * without «پایان», or whose admin is no longer an active admin, the same way «پایان» does: the end
 * in audit_log and, when changes were allowed, the email. Until then currentSession() already
 * refuses them.
 */
export async function closeEndedActingSessions(db: Db, now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; user_id: string; opened_by: string; writable_at: Date | null; expired: boolean }>(sql`
      DELETE FROM sessions s USING (
        SELECT s2.id, s2.created_at <= ${now.toISOString()}::timestamptz - make_interval(mins => ${ACTING_MINUTES}) AS expired
        FROM sessions s2 LEFT JOIN users a ON a.id = s2.opened_by_user_id
        WHERE s2.opened_by_user_id IS NOT NULL
          AND (s2.created_at <= ${now.toISOString()}::timestamptz - make_interval(mins => ${ACTING_MINUTES})
               OR a.staff_role IS DISTINCT FROM 'admin' OR a.status <> 'active')
        ORDER BY s2.created_at LIMIT 200
        FOR UPDATE OF s2 SKIP LOCKED
      ) due
      WHERE s.id = due.id
      RETURNING s.id, s.user_id, s.opened_by_user_id AS opened_by, s.writable_at, due.expired`);
    for (const r of rows) {
      const s = { id: r.id, userId: r.user_id, openedBy: r.opened_by, writableAt: r.writable_at };
      await recordEnd(tx, openerCtx(s), s, r.expired ? { expired: true } : { adminGone: true });
    }
    return rows.length;
  });
}

type ClosedSession = { id: string; userId: string; openedBy: string | null; writableAt: Date | null };

const openerCtx = (s: ClosedSession): StaffContext => ({ userId: s.openedBy!, sessionId: s.id, role: 'admin', ip: null, userAgent: null });

async function recordEnd(tx: Queryable, ctx: StaffContext, s: ClosedSession, extra: Record<string, boolean>): Promise<void> {
  const [u] = await tx.select({ test: users.testAccount }).from(users).where(eq(users.id, s.userId));
  const changes = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM audit_log
    WHERE action = 'staff.acting_change' AND actor_user_id = ${ctx.userId} AND target_id = ${s.userId}::uuid
      AND created_at >= now() - make_interval(mins => ${ACTING_MINUTES + 5})`);
  await staffAudit(tx, ctx, 'staff.acting_ended', { type: 'user', id: s.userId }, { writable: !!s.writableAt, changes: changes[0]?.n ?? 0, ...extra });
  if (s.writableAt && !u?.test) {
    await tx.insert(outboxEvents).values({ eventType: 'user.staff_acted', aggregateType: 'user', aggregateId: s.userId, payload: { changes: changes[0]?.n ?? 0 } });
  }
}
