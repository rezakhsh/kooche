import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';

// A listing's last take-down: the decision linked to its newest move to `rejected`, whether a rule,
// the AI or a person decided it, and about the listing or (a suspension) about its seller or
// business. Its statement is what the seller sees on the edit page.

export type TakeDown = {
  decisionId: string;
  decidedBy: 'staff' | 'ai' | 'rule';
  statement: string | null;
  policyGround: string | null;
  /** The status before the take-down, to go back to on a restore */
  fromStatus: string | null;
  at: Date;
};

export async function lastTakeDown(db: Queryable, listingId: string): Promise<TakeDown | null> {
  const rows = await db.execute<{ decision_id: string; decided_by: TakeDown['decidedBy']; statement_fa: string | null; policy_ground: string | null; from_status: string | null; created_at: string | Date }>(sql`
    SELECT d.id AS decision_id, d.decided_by, d.statement_fa, d.policy_ground, e.from_status, e.created_at
    FROM listing_events e JOIN moderation_decisions d ON d.id = e.moderation_decision_id
    WHERE e.listing_id = ${listingId} AND e.to_status = 'rejected'
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
  `);
  const r = rows[0];
  return r ? { decisionId: r.decision_id, decidedBy: r.decided_by, statement: r.statement_fa, policyGround: r.policy_ground, fromStatus: r.from_status, at: new Date(r.created_at) } : null;
}
