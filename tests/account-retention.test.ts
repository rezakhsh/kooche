import { inArray, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { phoneVerifications, sessions, verifications } from '../src/db/schema';
import { purgeAccountData } from '../src/modules/users/retention';
import { workerSql } from './accounts';
import { db, makeUser, publicToken } from './db';

// Account data retention (docs/schema.md, section 14), run as classifieds_worker, so the test
// also proves the worker's grants are enough. Rows are committed (the purge runs on another
// connection) and every assertion looks only at this file's own rows.

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);

const purge = (options?: Parameters<typeof purgeAccountData>[1]) => purgeAccountData(workerSql, options);

async function makeSessions(userId: string, expiresAt: Date[]) {
  const rows = await db
    .insert(sessions)
    .values(expiresAt.map((e) => ({ userId, token: `s-${publicToken()}`, expiresAt: e })))
    .returning({ id: sessions.id });
  return rows.map((r) => r.id);
}

async function remainingSessions(ids: string[]) {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(inArray(sessions.id, ids));
  return new Set(rows.map((r) => r.id));
}

describe('purgeAccountData', () => {
  it('deletes sessions 30 days after they expired and keeps newer ones', async () => {
    const user = await db.transaction((tx) => makeUser(tx));
    const [old, recent, active] = await makeSessions(user.id, [daysAgo(31), daysAgo(29), daysAgo(-10)]);

    const result = await purge();

    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(await remainingSessions([old!, recent!, active!])).toEqual(new Set([recent, active]));
  });

  it('deletes login codes 1 day after they expired and keeps newer ones', async () => {
    const prefix = `sign-in-otp-${publicToken()}`;
    const rows = await db
      .insert(verifications)
      .values([
        { identifier: `${prefix}-old`, value: 'hash:0', expiresAt: hoursAgo(25) },
        { identifier: `${prefix}-recent`, value: 'hash:0', expiresAt: hoursAgo(23) },
        { identifier: `${prefix}-active`, value: 'hash:0', expiresAt: new Date(Date.now() + 600_000) },
      ])
      .returning({ identifier: verifications.identifier });
    expect(rows).toHaveLength(3);

    const result = await purge();

    expect(result.verifications).toBeGreaterThanOrEqual(1);
    const left = await db
      .select({ identifier: verifications.identifier })
      .from(verifications)
      .where(like(verifications.identifier, `${prefix}-%`));
    expect(left.map((r) => r.identifier).sort()).toEqual([`${prefix}-active`, `${prefix}-recent`]);
  });

  it('deletes phone verification attempts older than 90 days and keeps newer ones', async () => {
    const user = await db.transaction((tx) => makeUser(tx));
    const attempt = (createdAt: Date) => ({
      userId: user.id,
      method: 'telegram' as const,
      linkTokenHash: Buffer.from(publicToken()),
      status: 'expired' as const,
      expiresAt: new Date(createdAt.getTime() + 15 * 60_000),
      createdAt,
    });
    const [old, recent] = await db
      .insert(phoneVerifications)
      .values([attempt(daysAgo(91)), attempt(daysAgo(89))])
      .returning({ id: phoneVerifications.id });

    const result = await purge();

    expect(result.phoneVerifications).toBeGreaterThanOrEqual(1);
    const left = await db
      .select({ id: phoneVerifications.id })
      .from(phoneVerifications)
      .where(inArray(phoneVerifications.id, [old!.id, recent!.id]));
    expect(left.map((r) => r.id)).toEqual([recent!.id]);
  });

  it('works in batches until nothing old is left', async () => {
    const user = await db.transaction((tx) => makeUser(tx));
    const ids = await makeSessions(user.id, Array.from({ length: 7 }, () => daysAgo(40)));

    const result = await purge({ batchSize: 3 });

    expect(result.sessions).toBe(7);
    expect(await remainingSessions(ids)).toEqual(new Set());
  });

  it('stops after maxBatches and leaves the rest for the next run', async () => {
    const user = await db.transaction((tx) => makeUser(tx));
    const ids = await makeSessions(user.id, Array.from({ length: 7 }, () => daysAgo(40)));

    expect((await purge({ batchSize: 3, maxBatches: 1 })).sessions).toBe(3);
    expect((await remainingSessions(ids)).size).toBe(4);

    expect((await purge({ batchSize: 3 })).sessions).toBe(4);
    expect((await remainingSessions(ids)).size).toBe(0);
  });
});
