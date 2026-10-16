import type { Redis } from 'ioredis';

// Fixed-window counters in Valkey. Every key gets an expiry in the same round trip: Valkey runs
// with maxmemory-policy noeviction (BullMQ needs it), so a key without one would stay forever.

export type Limit = {
  /** Key prefix, e.g. `otp-send:email` */
  name: string;
  max: number;
  windowSeconds: number;
};

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

// INCR, set the expiry on the first hit, return the count and the remaining time.
const SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {n, ttl}
`;

export function limitKey(limit: Limit, subject: string): string {
  return `rl:${limit.name}:${subject}`;
}

/** Counts one hit for each (limit, subject) pair and fails if any of them is over its maximum. */
export async function hit(
  redis: Redis,
  checks: ReadonlyArray<readonly [Limit, string]>,
): Promise<LimitResult> {
  let retryAfterSeconds = 0;
  for (const [limit, subject] of checks) {
    const [count, ttl] = (await redis.eval(
      SCRIPT,
      1,
      limitKey(limit, subject),
      String(limit.windowSeconds),
    )) as [number, number];
    if (count > limit.max) retryAfterSeconds = Math.max(retryAfterSeconds, ttl);
  }
  return retryAfterSeconds > 0 ? { ok: false, retryAfterSeconds } : { ok: true };
}

/** Clears the counters, e.g. after a successful sign-in */
export async function reset(
  redis: Redis,
  checks: ReadonlyArray<readonly [Limit, string]>,
): Promise<void> {
  if (checks.length) await redis.del(...checks.map(([l, s]) => limitKey(l, s)));
}
