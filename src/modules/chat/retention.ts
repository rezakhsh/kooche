import type postgres from 'postgres';
import { inBatches, type PurgeOptions } from '../../db/retention';

// Chats of deleted accounts (docs/schema.md, section 14): kept 90 days after either participant
// deleted their account (for the other person and for open reports), then deleted with their
// messages (ON DELETE CASCADE). A conversation with a message that a report or a moderation
// decision still points at stays until purge_moderation_records() has removed those (2 years).
// Runs daily as classifieds_worker, same pattern as the other retention jobs.

export const DELETED_ACCOUNT_CHAT_RETENTION = '90 days';

export async function purgeChatsOfDeletedUsers(
  sql: postgres.Sql,
  { batchSize = 1_000, maxBatches = 100 }: PurgeOptions = {},
): Promise<number> {
  return inBatches(
    async (limit) =>
      (
        await sql`
          WITH gone AS (
            SELECT id FROM users
            WHERE status = 'deleted' AND deleted_at < now() - ${DELETED_ACCOUNT_CHAT_RETENTION}::interval
          ), due AS (
            SELECT c.id FROM conversations c
            WHERE (c.buyer_user_id IN (SELECT id FROM gone) OR c.seller_user_id IN (SELECT id FROM gone))
              AND NOT EXISTS (
                SELECT 1 FROM messages m
                WHERE m.conversation_id = c.id
                  AND (EXISTS (SELECT 1 FROM reports r WHERE r.message_id = m.id)
                    OR EXISTS (SELECT 1 FROM moderation_decisions d WHERE d.message_id = m.id))
              )
            ORDER BY c.id
            LIMIT ${limit}
          )
          DELETE FROM conversations WHERE id IN (SELECT id FROM due)
        `
      ).count,
    batchSize,
    maxBatches,
  );
}
