import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { sessions } from '../../db/schema';
import { describeDevice, type Device } from '../../lib/user-agent';
import { endRemovedActing } from '../admin/acting';

// "My devices": every live session of a user, each one revocable. Sessions are matched by id and
// owner; the session token never leaves the server. Better Auth's cookie cache is off, so a
// deleted session is logged out on its next request.

export type DeviceSession = Device & {
  id: string;
  createdAt: Date;
  lastActiveAt: Date;
  current: boolean;
};

export async function listDevices(
  db: Queryable,
  userId: string,
  currentSessionId: string,
): Promise<DeviceSession[]> {
  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(desc(sessions.updatedAt));
  return rows
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      lastActiveAt: r.updatedAt,
      current: r.id === currentSessionId,
      ...describeDevice(r.userAgent),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** What a deleted session tells endRemovedActing(): a "sign in as" session is recorded as ended */
const GONE = { id: sessions.id, userId: sessions.userId, openedBy: sessions.openedByUserId, writableAt: sessions.writableAt };

/** Logs out one of the user's own sessions. False when it isn't theirs or is already gone. */
export async function revokeDevice(db: Queryable, userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning(GONE);
  await endRemovedActing(db, deleted);
  return deleted.length > 0;
}

/** Logs out every session of the user except the current one. Returns how many. */
export async function revokeOtherDevices(
  db: Queryable,
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
    .returning(GONE);
  await endRemovedActing(db, deleted);
  return deleted.length;
}

/** Whether a session still exists and hasn't run out (the chat stream asks on every ping) */
export async function sessionLive(db: Queryable, sessionId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)));
  return !!row;
}
