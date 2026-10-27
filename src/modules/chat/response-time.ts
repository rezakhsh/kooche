import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';

// «معمولاً در چند ساعت جواب می‌دهد» on the listing page (wave 1, mockup final/listing): how long a
// seller usually takes to answer a buyer's first message, from their conversations of the last 90
// days. A conversation they never answered counts as a slow one, so ignoring buyers doesn't make
// the label look better. Nothing is shown below MIN_CONVERSATIONS, or when the usual answer takes
// more than two days.

export const MIN_CONVERSATIONS = 3;

export type ReplySpeed = 'hour' | 'hours' | 'days';

/** The median first answer in seconds → the label's bucket, or null */
export function replySpeed(medianSeconds: number | null, conversations: number): ReplySpeed | null {
  if (medianSeconds === null || conversations < MIN_CONVERSATIONS) return null;
  if (medianSeconds <= 3600) return 'hour';
  if (medianSeconds <= 6 * 3600) return 'hours';
  if (medianSeconds <= 48 * 3600) return 'days';
  return null;
}

export async function sellerReplySpeed(db: Queryable, sellerUserId: string, now = new Date()): Promise<ReplySpeed | null> {
  const [row] = await db.execute<{ n: number; median: number | null }>(sql`
    WITH firsts AS (
      SELECT
        (SELECT min(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender_user_id = c.buyer_user_id) AS asked,
        (SELECT min(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender_user_id = c.seller_user_id) AS answered
      FROM conversations c
      WHERE c.seller_user_id = ${sellerUserId} AND c.created_at > ${now.toISOString()}::timestamptz - interval '90 days'
    )
    SELECT count(*)::int AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM coalesce(answered, ${now.toISOString()}::timestamptz + interval '30 days') - asked)) AS median
    FROM firsts
    WHERE asked IS NOT NULL AND (answered IS NULL OR answered >= asked)`);
  return replySpeed(row?.median == null ? null : Number(row.median), row?.n ?? 0);
}
