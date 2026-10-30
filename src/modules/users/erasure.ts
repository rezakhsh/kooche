import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import type { Db } from '../../db/drizzle';

// "Delete my account" (approved Oct 21, 2026). erase_user (docs/schema.md, section 14) stays
// executable by the worker only, so the app never holds that power: the request deactivates the
// account and logs out every device in one transaction with an outbox event, and the worker's
// `accounts` queue then calls erase_user, about a second later. A deactivated account gets no new
// sessions (src/modules/users/auth.ts) and can't post or message.

export const ERASE_REQUESTED = 'user.erase_requested';
export const ERASED = 'user.erased';

export type ErasureResult = { ok: true } | { ok: false; error: 'email_mismatch' | 'sole_owner' | 'not_active' };

/** The confirmation: the account's own email address, typed again (case and spaces ignored) */
export function emailMatches(typed: string, email: string): boolean {
  return typed.normalize('NFKC').trim().toLowerCase() === email.toLowerCase();
}

/** Starts deleting the signed-in user's own account. The user id comes from the session only. */
export async function requestErasure(db: Db, userId: string, typedEmail: string): Promise<ErasureResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx.execute<{ email: string; status: string }>(sql`
      SELECT email, status FROM users WHERE id = ${userId} FOR UPDATE
    `);
    if (!user || user.status !== 'active') return { ok: false, error: 'not_active' } as const;
    if (!emailMatches(typedEmail, user.email)) return { ok: false, error: 'email_mismatch' } as const;
    // erase_user refuses the only owner of an organization; say so before anything changes
    if (await soleOwner(tx, userId)) return { ok: false, error: 'sole_owner' } as const;

    // A banned person's number and Telegram account stay as fingerprints, so they can't verify a
    // new account with them (code check, Oct 30, 2026; migration 0037)
    await tx.execute(sql`SELECT record_banned_identifiers(${userId}::uuid)`);
    await tx.execute(sql`UPDATE users SET status = 'deactivated' WHERE id = ${userId}`);
    await tx.execute(sql`DELETE FROM sessions WHERE user_id = ${userId}`);
    await tx.execute(sql`
      INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id) VALUES (${ERASE_REQUESTED}, 'user', ${userId})
    `);
    await tx.execute(sql`
      INSERT INTO audit_log (actor_type, actor_user_id, action, target_type, target_id)
      VALUES ('user', ${userId}, ${ERASE_REQUESTED}, 'user', ${userId})
    `);
    return { ok: true } as const;
  });
}

async function soleOwner(db: Queryable, userId: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT 1 FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id AND o.status <> 'deleted'
    WHERE m.user_id = ${userId} AND m.role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM organization_members m2
        WHERE m2.organization_id = m.organization_id AND m2.role = 'owner' AND m2.user_id <> ${userId})
    LIMIT 1
  `);
  return rows.length > 0;
}

export type EraseOutcome = 'erased' | 'already_deleted' | 'not_requested' | 'missing';

/**
 * The worker's half, as classifieds_worker: erases an account whose owner asked for it. Only a
 * deactivated account is erased, so a stray event can never erase an active one; erase_user itself
 * does nothing for an account that is already deleted, so a retried job is harmless.
 */
export async function eraseRequestedUser(db: Queryable, userId: string): Promise<EraseOutcome> {
  const [user] = await db.execute<{ status: string }>(sql`SELECT status FROM users WHERE id = ${userId}`);
  if (!user) return 'missing';
  if (user.status === 'deleted') return 'already_deleted';
  if (user.status !== 'deactivated') return 'not_requested';
  await db.execute(sql`SELECT erase_user(${userId}::uuid)`);
  return 'erased';
}

/** A deletion asked for this long ago and not done is finished by the sweep */
export const ERASE_RETRY_AFTER_MS = 3_600_000;
/** …and one still not done after this long shows on the admin page */
export const ERASE_STUCK_AFTER_MS = 24 * 3_600_000;

const askedBefore = (cutoff: Date) => sql`
  SELECT u.id FROM users u
  WHERE u.status = 'deactivated'
    AND EXISTS (SELECT 1 FROM audit_log a WHERE a.action = ${ERASE_REQUESTED} AND a.target_id = u.id AND a.created_at <= ${cutoff.toISOString()}::timestamptz)`;

/**
 * Worker, hourly (code check, Oct 30, 2026): finishes deletions whose job ran out of retries (the
 * database away for minutes, a lock), so a person's data never stays because a job gave up. Each
 * in its own transaction; one that still fails waits for the next hour.
 */
export async function finishStuckErasures(db: Db, now: Date = new Date()): Promise<{ erased: number; failed: number }> {
  const due = await db.execute<{ id: string }>(sql`${askedBefore(new Date(now.getTime() - ERASE_RETRY_AFTER_MS))} ORDER BY u.id LIMIT 100`);
  let erased = 0;
  let failed = 0;
  for (const { id } of due) {
    try {
      if ((await db.transaction((tx) => eraseRequestedUser(tx, id))) === 'erased') erased++;
    } catch (e) {
      failed++;
      console.error(`erasure: ${id} still not erased:`, e instanceof Error ? e.message : e);
    }
  }
  return { erased, failed };
}

/** Deletions asked for more than a day ago and still not done (the admin page's system problems) */
export async function stuckErasures(db: Queryable, now: Date = new Date()): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM (${askedBefore(new Date(now.getTime() - ERASE_STUCK_AFTER_MS))}) x`);
  return r?.n ?? 0;
}
