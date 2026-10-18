import type { Limit } from '../../lib/rate-limit';

// Chat rate limits (Valkey, src/lib/rate-limit.ts) and the new-account rule (approved Oct 18,
// 2026, docs/setup.md "Chat").

const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;

/** Accounts younger than this can't send links or IBANs and start fewer conversations */
export const NEW_ACCOUNT_DAYS = 7;

export const CHAT_LIMITS = {
  messagesPerUserMinute: { name: 'chat-message:user:1m', max: 20, windowSeconds: MINUTE },
  messagesPerUserHour: { name: 'chat-message:user:1h', max: 300, windowSeconds: HOUR },
  conversationsPerUserHour: { name: 'chat-start:user:1h', max: 30, windowSeconds: HOUR },
  conversationsPerNewUserHour: { name: 'chat-start:new-user:1h', max: 5, windowSeconds: HOUR },
  conversationsPerNewUserDay: { name: 'chat-start:new-user:1d', max: 15, windowSeconds: DAY },
  reportsPerUserDay: { name: 'chat-report:user:1d', max: 20, windowSeconds: DAY },
  blocksPerUserDay: { name: 'chat-block:user:1d', max: 50, windowSeconds: DAY },
} as const satisfies Record<string, Limit>;

export function isNewAccount(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < NEW_ACCOUNT_DAYS * DAY * 1000;
}
