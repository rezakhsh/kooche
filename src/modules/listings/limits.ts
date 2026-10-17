import type { Limit } from '../../lib/rate-limit';

// Rate limits for posting (Valkey, src/lib/rate-limit.ts). New-account limits and Turnstile come
// with moderation (phase 4).

const HOUR = 3_600;
const DAY = 86_400;

export const LISTING_LIMITS = {
  draftsPerUserDay: { name: 'listing-draft:user:1d', max: 20, windowSeconds: DAY },
  uploadsPerUserHour: { name: 'listing-upload:user:1h', max: 60, windowSeconds: HOUR },
  // "Show number": per viewer and per IP, so numbers can't be harvested
  phoneRevealPerUserHour: { name: 'phone-reveal:user:1h', max: 20, windowSeconds: HOUR },
  phoneRevealPerIpHour: { name: 'phone-reveal:ip:1h', max: 40, windowSeconds: HOUR },
} as const satisfies Record<string, Limit>;
