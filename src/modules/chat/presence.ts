import type { Redis } from 'ioredis';

// "Has the chat open": each open, visible chat page keeps a live stream, and each stream keeps a
// member in a sorted set (score: when it expires) refreshed with every heartbeat. The inbox
// counts as viewing every conversation. Notices are not sent while the receiver is viewing.
// Every key has an expiry (Valkey runs with noeviction).

export const PRESENCE_TTL_MS = 60_000;
export const INBOX_SCOPE = '*';

const key = (userId: string, scope: string) => `chat:viewing:${userId}:${scope}`;

export async function markViewing(redis: Redis, userId: string, scope: string, connectionId: string, now = Date.now()) {
  const k = key(userId, scope);
  await redis
    .multi()
    .zadd(k, now + PRESENCE_TTL_MS, connectionId)
    .zremrangebyscore(k, '-inf', now)
    .pexpire(k, PRESENCE_TTL_MS + 30_000)
    .exec();
}

export async function stopViewing(redis: Redis, userId: string, scope: string, connectionId: string) {
  await redis.zrem(key(userId, scope), connectionId);
}

/** Whether the user has this conversation (or the inbox) open right now */
export async function isViewing(redis: Redis, userId: string, conversationId: string, now = Date.now()): Promise<boolean> {
  const [a, b] = await Promise.all([
    redis.zcount(key(userId, conversationId), now, '+inf'),
    redis.zcount(key(userId, INBOX_SCOPE), now, '+inf'),
  ]);
  return a + b > 0;
}
