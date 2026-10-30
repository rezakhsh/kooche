import type postgres from 'postgres';
import { type PurgeOptions, inBatches } from '../../db/retention';

// Retention of account data (docs/schema.md, section 14), run daily by the worker as
// classifieds_worker. Each table is deleted in bounded batches, oldest id first, like the purge
// functions in migration 0004. The periods are fixed here, not parameters, so a bug in a caller
// can't shorten them.
//
// Every id is a UUIDv7, so ORDER BY id walks the primary key from the oldest row and stops after
// one batch; phone_verifications needs no created_at index for this.

/** Expired sessions are kept 30 days after expires_at */
export const SESSION_RETENTION = '30 days';
/** Login codes are kept 1 day after expires_at */
export const LOGIN_CODE_RETENTION = '1 day';
/** Phone verification attempts are kept 90 days after created_at */
export const PHONE_VERIFICATION_RETENTION = '90 days';

export interface PurgeResult {
  sessions: number;
  verifications: number;
  phoneVerifications: number;
  /** Banned people's fingerprints past their 2 years (migration 0037) */
  bannedIdentifiers: number;
}

/** Deletes expired sessions, old login codes, old phone verification attempts and expired fingerprints. */
export async function purgeAccountData(
  sql: postgres.Sql,
  { batchSize = 5_000, maxBatches = 100 }: PurgeOptions = {},
): Promise<PurgeResult> {
  const sessions = await inBatches(
    async (limit) =>
      (
        await sql`
          DELETE FROM sessions WHERE id IN (
            SELECT id FROM sessions
            WHERE expires_at < now() - ${SESSION_RETENTION}::interval
            ORDER BY id LIMIT ${limit})
        `
      ).count,
    batchSize,
    maxBatches,
  );
  const verifications = await inBatches(
    async (limit) =>
      (
        await sql`
          DELETE FROM verifications WHERE id IN (
            SELECT id FROM verifications
            WHERE expires_at < now() - ${LOGIN_CODE_RETENTION}::interval
            ORDER BY id LIMIT ${limit})
        `
      ).count,
    batchSize,
    maxBatches,
  );
  const phoneVerifications = await inBatches(
    async (limit) =>
      (
        await sql`
          DELETE FROM phone_verifications WHERE id IN (
            SELECT id FROM phone_verifications
            WHERE created_at < now() - ${PHONE_VERIFICATION_RETENTION}::interval
            ORDER BY id LIMIT ${limit})
        `
      ).count,
    batchSize,
    maxBatches,
  );
  const bannedIdentifiers = await inBatches(
    async (limit) =>
      (
        await sql`
          DELETE FROM banned_identifiers WHERE id IN (
            SELECT id FROM banned_identifiers WHERE expires_at < now() ORDER BY id LIMIT ${limit})
        `
      ).count,
    batchSize,
    maxBatches,
  );
  return { sessions, verifications, phoneVerifications, bannedIdentifiers };
}
