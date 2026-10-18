import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';

// The chat part of a GDPR data export (docs/schema.md, section 15: exports run as a job, recorded
// in audit_log). Every conversation the user takes part in, with the messages they can see: what
// both sides wrote, and their own withheld messages, but not what someone they blocked sent.

export type ChatExport = Array<{
  conversationId: string;
  role: 'buyer' | 'seller';
  listing: { id: string; title: string };
  status: string;
  startedAt: string;
  messages: Array<{ id: string; from: 'me' | 'other' | 'system'; body: string; sentAt: string; riskFlags: string[] }>;
}>;

export async function exportChatData(db: Queryable, userId: string): Promise<ChatExport> {
  const convs = await db.execute<{
    id: string;
    buyer_user_id: string;
    status: string;
    created_at: Date | string;
    listing_id: string;
    title: string;
  }>(sql`
    SELECT c.id, c.buyer_user_id, c.status, c.created_at, l.id AS listing_id, l.title
    FROM conversations c JOIN listings l ON l.id = c.listing_id
    WHERE c.buyer_user_id = ${userId} OR c.seller_user_id = ${userId}
    ORDER BY c.created_at
  `);
  const out: ChatExport = [];
  for (const c of convs) {
    const rows = await db.execute<{ id: string; sender_user_id: string | null; body: string; created_at: Date | string; risk_flags: string[] }>(sql`
      SELECT id, sender_user_id, body, created_at, risk_flags FROM messages
      WHERE conversation_id = ${c.id} AND (NOT withheld OR sender_user_id = ${userId})
      ORDER BY created_at, id
    `);
    out.push({
      conversationId: c.id,
      role: c.buyer_user_id === userId ? 'buyer' : 'seller',
      listing: { id: c.listing_id, title: c.title },
      status: c.status,
      startedAt: new Date(c.created_at).toISOString(),
      messages: [...rows].map((m) => ({
        id: m.id,
        from: m.sender_user_id === null ? 'system' : m.sender_user_id === userId ? 'me' : 'other',
        body: m.body,
        sentAt: new Date(m.created_at).toISOString(),
        riskFlags: m.risk_flags,
      })),
    });
  }
  return out;
}
