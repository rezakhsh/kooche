import { appDb } from '../../db/drizzle';
import { valkey } from '../../lib/valkey';
import { markRead } from './conversations';
import { publish } from './realtime';

// The Next.js side of the chat. Server code only, and never a server action: the user id comes
// from the session of the caller.

/** Marks a conversation read and tells the other side (the "seen" ticks) and the reader's other tabs */
export async function markReadAndPublish(userId: string, conversationId: string): Promise<void> {
  const result = await markRead(appDb(), { userId, conversationId });
  if (!result.ok || !result.readAt) return;
  const redis = valkey();
  await publish(redis, [result.otherId], { type: 'read', conversationId, readerId: userId, at: result.readAt.toISOString() });
  await publish(redis, [userId], { type: 'unread' });
}
