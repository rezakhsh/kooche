import type { Redis } from 'ioredis';

// Each channel of a notice once (check B, Nov 1, 2026). A job that sends by Telegram and by email
// and fails on the second is retried from the start; the channel that went out is marked, so the
// retry sends only the other one. The mark is freed when its own send throws, so that one is tried
// again. The send queues can't do this themselves: they forget finished jobs after a few seconds
// of traffic.

export const SENT_TTL_SECONDS = 30 * 86_400;

/** Runs `send` unless `key` was marked sent; true when it ran */
export async function sendOnce(redis: Redis, key: string, send: () => Promise<unknown>, ttlSeconds = SENT_TTL_SECONDS): Promise<boolean> {
  if ((await redis.set(`notice-sent:${key}`, '1', 'EX', ttlSeconds, 'NX')) !== 'OK') return false;
  try {
    await send();
  } catch (e) {
    await redis.del(`notice-sent:${key}`);
    throw e;
  }
  return true;
}

/** A channel of an inline notice once, when the worker gave the notice's key; always without one (tests) */
export function onceFor(redis: Redis, key: string | undefined, channel: string, send: () => Promise<unknown>): Promise<boolean> {
  return key ? sendOnce(redis, `notice_${key}_${channel}`, send) : send().then(() => true);
}
