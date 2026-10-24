import type { Event } from '@sentry/core';
import type { Redis } from 'ioredis';

// Keeps error reports inside Sentry's free plan (5,000 errors a month; docs/setup.md, "Error
// monitoring"). Every sender takes one unit of a daily budget in Valkey before sending: 160 a day
// for everything (31 × 160 = 4,960), of which browsers may use at most 60. Without Valkey each
// process allows 20 an hour. On top, each server process sends the same error at most once per
// 10 minutes, so a database outage is a handful of events, not thousands.

export const DAILY_BUDGET = 160;
export const BROWSER_DAILY_BUDGET = 60;
const FALLBACK_PER_HOUR = 20;
const THROTTLE_MS = 10 * 60_000;
const VALKEY_TIMEOUT_MS = 500;

export type Sender = 'server' | 'browser';

export function budgetKey(day: string, sender?: Sender): string {
  return `monitoring:budget:${day}${sender === 'browser' ? ':browser' : ''}`;
}

// INCR with a two-day expiry in the same round trip (noeviction: no key may live forever)
const INCR = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], 172800) end
return n
`;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

let fallback = { hour: '', count: 0 };

/** Takes one unit of today's budget (UTC); false when it is used up */
export async function takeBudget(redis: Redis | null, sender: Sender, now = new Date()): Promise<boolean> {
  const day = now.toISOString().slice(0, 10);
  if (redis) {
    try {
      const incr = (key: string) => withTimeout(redis.eval(INCR, 1, key) as Promise<number>, VALKEY_TIMEOUT_MS);
      if (sender === 'browser' && (await incr(budgetKey(day, 'browser'))) > BROWSER_DAILY_BUDGET) return false;
      return (await incr(budgetKey(day))) <= DAILY_BUDGET;
    } catch {
      // Valkey down or slow: fall through to the per-process limit
    }
  }
  const hour = now.toISOString().slice(0, 13);
  if (fallback.hour !== hour) fallback = { hour, count: 0 };
  return ++fallback.count <= FALLBACK_PER_HOUR;
}

/** What makes two reports the same error: type, message and the innermost frame of our code */
export function fingerprint(event: Event): string {
  const e = event.exception?.values?.at(-1);
  const frames = e?.stacktrace?.frames ?? [];
  const top = frames.findLast((f) => f.in_app) ?? frames.at(-1);
  return [e?.type ?? '', e?.value ?? event.message ?? '', top ? `${top.filename}:${top.function}:${top.lineno}` : ''].join('|');
}

/** Per process: true when the same error went out less than 10 minutes ago */
export function createThrottle(windowMs = THROTTLE_MS) {
  const seen = new Map<string, number>();
  let dropped = 0;
  return {
    isRepeat(key: string, now = Date.now()): boolean {
      const last = seen.get(key);
      if (last !== undefined && now - last < windowMs) {
        dropped++;
        return true;
      }
      seen.delete(key);
      seen.set(key, now);
      // Oldest first in a Map: keep it small
      if (seen.size > 500) seen.delete(seen.keys().next().value!);
      return false;
    },
    /** Repeats dropped since the last call */
    takeDropped(): number {
      const n = dropped;
      dropped = 0;
      return n;
    },
  };
}

/** For tests */
export function resetFallbackBudget(): void {
  fallback = { hour: '', count: 0 };
}
