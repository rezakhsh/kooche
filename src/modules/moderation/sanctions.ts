import { and, eq, gt, isNull, lte, ne, or } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { userSanctions } from '../../db/schema';

// Active restrictions of an account (docs/schema.md, section 11, user_sanctions): the single
// source of truth. Warnings restrict nothing.

export type SanctionType = (typeof userSanctions.$inferSelect)['type'];

export async function activeSanctions(db: Queryable, userId: string, now = new Date()): Promise<SanctionType[]> {
  const rows = await db
    .select({ type: userSanctions.type })
    .from(userSanctions)
    .where(
      and(
        eq(userSanctions.userId, userId),
        isNull(userSanctions.revokedAt),
        ne(userSanctions.type, 'warning'),
        lte(userSanctions.startsAt, now),
        or(isNull(userSanctions.endsAt), gt(userSanctions.endsAt, now)),
      ),
    );
  return rows.map((r) => r.type);
}

/** Sanctions that stop someone from sending chat messages */
export function restrictsMessaging(types: readonly SanctionType[]): boolean {
  return types.some((t) => t === 'messaging_restricted' || t === 'suspended' || t === 'banned');
}

/** Sanctions that stop someone from publishing listings, events or a business */
export function restrictsPosting(types: readonly SanctionType[]): boolean {
  return types.some((t) => t === 'posting_restricted' || t === 'suspended' || t === 'banned');
}
