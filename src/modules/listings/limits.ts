import type { Limit } from '../../lib/rate-limit';

// Rate limits for posting (Valkey, src/lib/rate-limit.ts). New-account limits and Turnstile come
// with moderation (phase 4).

const HOUR = 3_600;
const DAY = 86_400;

export const LISTING_LIMITS = {
  draftsPerUserDay: { name: 'listing-draft:user:1d', max: 20, windowSeconds: DAY },
  uploadsPerUserHour: { name: 'listing-upload:user:1h', max: 60, windowSeconds: HOUR },
  // The place field's suggestions (own data, but each one is a query)
  placeSearchPerUserHour: { name: 'place-search:user:1h', max: 600, windowSeconds: HOUR },
  // "Show number" (approved Oct 18, 2026): per viewer and per IP, hourly and daily, so numbers
  // can't be harvested. Every reveal is also in audit_log (listing.phone_revealed).
  phoneRevealPerUserHour: { name: 'phone-reveal:user:1h', max: 10, windowSeconds: HOUR },
  phoneRevealPerUserDay: { name: 'phone-reveal:user:1d', max: 30, windowSeconds: DAY },
  phoneRevealPerIpHour: { name: 'phone-reveal:ip:1h', max: 40, windowSeconds: HOUR },
  phoneRevealPerIpDay: { name: 'phone-reveal:ip:1d', max: 100, windowSeconds: DAY },
} as const satisfies Record<string, Limit>;
