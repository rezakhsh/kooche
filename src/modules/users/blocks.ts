import { and, eq, or } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { userBlocks } from '../../db/schema';

// One user blocks another (docs/schema.md, user_blocks). The chat checks both directions before
// a message is sent: the blocker can't write until they unblock, and the blocked person's
// messages are withheld from the blocker without telling them (src/modules/chat/conversations.ts).

export type BlockState = { iBlocked: boolean; blockedMe: boolean };

export async function blockState(db: Queryable, me: string, other: string): Promise<BlockState> {
  const rows = await db
    .select({ blocker: userBlocks.blockerUserId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerUserId, me), eq(userBlocks.blockedUserId, other)),
        and(eq(userBlocks.blockerUserId, other), eq(userBlocks.blockedUserId, me)),
      ),
    );
  return { iBlocked: rows.some((r) => r.blocker === me), blockedMe: rows.some((r) => r.blocker === other) };
}

export async function blockUser(db: Queryable, blocker: string, blocked: string): Promise<void> {
  if (blocker === blocked) return;
  await db.insert(userBlocks).values({ blockerUserId: blocker, blockedUserId: blocked }).onConflictDoNothing();
}

export async function unblockUser(db: Queryable, blocker: string, blocked: string): Promise<void> {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerUserId, blocker), eq(userBlocks.blockedUserId, blocked)));
}
