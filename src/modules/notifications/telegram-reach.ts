import type { Redis } from 'ioredis';

// Whether the bot can reach a Telegram account. Marked when Telegram refuses a message (the
// person blocked the bot) or reports the block (my_chat_member "kicked"); cleared when the person
// writes to the bot again or unblocks it. After 30 days the bot simply tries again. Valkey runs
// with noeviction, so the key always has an expiry.

const TTL_SECONDS = 30 * 86_400;
const key = (telegramUserId: number) => `tg:unreachable:${telegramUserId}`;

export async function markUnreachable(redis: Redis, telegramUserId: number): Promise<void> {
  await redis.set(key(telegramUserId), '1', 'EX', TTL_SECONDS);
}

export async function clearUnreachable(redis: Redis, telegramUserId: number): Promise<void> {
  await redis.del(key(telegramUserId));
}

export async function isUnreachableMarked(redis: Redis, telegramUserId: number): Promise<boolean> {
  return (await redis.exists(key(telegramUserId))) === 1;
}
