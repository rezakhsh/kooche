import type { Limit } from '../../lib/rate-limit';

// Rate limits for sign-in and phone verification (Valkey, src/lib/rate-limit.ts). The durable
// records behind them are verifications and phone_verifications.

const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;

export const LIMITS = {
  // Email login codes
  codeSendPerEmailMinute: { name: 'code-send:email:1m', max: 1, windowSeconds: MINUTE },
  codeSendPerEmailHour: { name: 'code-send:email:1h', max: 5, windowSeconds: HOUR },
  codeSendPerIp: { name: 'code-send:ip:1h', max: 20, windowSeconds: HOUR },
  codeCheckPerEmail: { name: 'code-check:email:15m', max: 10, windowSeconds: 15 * MINUTE },
  codeCheckPerIp: { name: 'code-check:ip:1h', max: 50, windowSeconds: HOUR },
  // Phone verification attempts (Telegram link or SMS code), per user
  phoneStartPerUserHour: { name: 'phone-start:user:1h', max: 5, windowSeconds: HOUR },
  phoneStartPerUserDay: { name: 'phone-start:user:1d', max: 10, windowSeconds: DAY },
  phoneStartPerIp: { name: 'phone-start:ip:1h', max: 20, windowSeconds: HOUR },
  // SMS pumping: few messages per number, whoever asks
  smsPerNumberDay: { name: 'sms:number:1d', max: 3, windowSeconds: DAY },
  smsCheckPerUser: { name: 'sms-check:user:15m', max: 10, windowSeconds: 15 * MINUTE },
} as const satisfies Record<string, Limit>;
