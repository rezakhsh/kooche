import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Db } from '../../db/drizzle';
import { outboxEvents, reports } from '../../db/schema';
import { hit } from '../../lib/rate-limit';
import { CHAT_LIMITS } from '../chat/limits';

// Reports on chat messages (docs/schema.md, section 11, reports.message_id): the input of the
// phase-4 moderation queue. Only a participant who can see the message reports it, never their
// own, and one open report per person per message (migration 0011).

export const MESSAGE_REPORT_REASONS = ['scam', 'harassment', 'spam', 'offensive', 'personal_data', 'other'] as const;
export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number];

export type ReportResult =
  | { ok: true; reportId: string | null; already: boolean; senderId: string }
  | { ok: false; reason: 'not_found' | 'rate_limited'; retryAfterSeconds?: number };

export async function reportMessage(
  db: Db,
  redis: Redis,
  opts: { userId: string; messageId: string; reason: MessageReportReason; details?: string | null },
): Promise<ReportResult> {
  if (!/^[0-9a-f-]{36}$/.test(opts.messageId)) return { ok: false, reason: 'not_found' };
  return db.transaction(async (tx) => {
    const [m] = await tx.execute<{ sender_user_id: string }>(sql`
      SELECT m.sender_user_id FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ${opts.messageId} AND m.kind = 'text' AND NOT m.withheld
        AND m.sender_user_id <> ${opts.userId}
        AND (c.buyer_user_id = ${opts.userId} OR c.seller_user_id = ${opts.userId})
    `);
    if (!m) return { ok: false, reason: 'not_found' };

    const limited = await hit(redis, [[CHAT_LIMITS.reportsPerUserDay, opts.userId]]);
    if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };

    const details = opts.details?.trim().slice(0, 2000) || null;
    const [row] = await tx
      .insert(reports)
      .values({ reporterUserId: opts.userId, messageId: opts.messageId, reasonCode: opts.reason, details })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!row) return { ok: true, reportId: null, already: true, senderId: m.sender_user_id };
    await tx.insert(outboxEvents).values({
      eventType: 'report.created',
      aggregateType: 'report',
      aggregateId: row.id,
      payload: { target: 'message', messageId: opts.messageId, reason: opts.reason },
    });
    return { ok: true, reportId: row.id, already: false, senderId: m.sender_user_id };
  });
}
