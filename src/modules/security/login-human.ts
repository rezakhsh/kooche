import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';

// "Send the code again" has no widget of its own: it works for 10 minutes after a send for the
// same email passed Turnstile. The email cookie alone can be forged, so it isn't enough.

export const LOGIN_HUMAN_SECONDS = 10 * 60;

function humanKey(email: string): string {
  return `login-human:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

export async function markLoginHuman(redis: Redis, email: string): Promise<void> {
  await redis.set(humanKey(email), '1', 'EX', LOGIN_HUMAN_SECONDS);
}

export async function isLoginHuman(redis: Redis, email: string): Promise<boolean> {
  return (await redis.exists(humanKey(email))) === 1;
}
