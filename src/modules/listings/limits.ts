import type { Limit } from '../../lib/rate-limit';
import { isNewAccount } from '../users/new-account';

// Rate limits for posting (Valkey, src/lib/rate-limit.ts), and the tighter ones for accounts in
// their first 7 days (src/modules/users/new-account.ts; docs/setup.md, "Bot protection").

const HOUR = 3_600;
const DAY = 86_400;

export const LISTING_LIMITS = {
  draftsPerUserDay: { name: 'listing-draft:user:1d', max: 20, windowSeconds: DAY },
  uploadsPerUserHour: { name: 'listing-upload:user:1h', max: 60, windowSeconds: HOUR },
  uploadsPerNewUserHour: { name: 'listing-upload:new-user:1h', max: 20, windowSeconds: HOUR },
  uploadsPerNewUserDay: { name: 'listing-upload:new-user:1d', max: 40, windowSeconds: DAY },
  // The place field's suggestions (own data, but each one is a query)
  placeSearchPerUserHour: { name: 'place-search:user:1h', max: 600, windowSeconds: HOUR },
  // "Show number" (approved Oct 18, 2026): per viewer and per IP, hourly and daily, so numbers
  // can't be harvested. Every reveal is also in audit_log (listing.phone_revealed).
  phoneRevealPerUserHour: { name: 'phone-reveal:user:1h', max: 10, windowSeconds: HOUR },
  phoneRevealPerUserDay: { name: 'phone-reveal:user:1d', max: 30, windowSeconds: DAY },
  phoneRevealPerIpHour: { name: 'phone-reveal:ip:1h', max: 40, windowSeconds: HOUR },
  phoneRevealPerIpDay: { name: 'phone-reveal:ip:1d', max: 100, windowSeconds: DAY },
} as const satisfies Record<string, Limit>;

/** Listings a new account may publish in 24 hours (counted in PostgreSQL, events apart) */
export const NEW_ACCOUNT_LISTINGS_PER_DAY = 3;

/** The extra photo limits for an account in its first 7 days; none for older accounts */
export function newAccountUploadChecks(userId: string, createdAt: Date, now: Date): Array<readonly [Limit, string]> {
  if (!isNewAccount(createdAt, now)) return [];
  return [
    [LISTING_LIMITS.uploadsPerNewUserHour, userId],
    [LISTING_LIMITS.uploadsPerNewUserDay, userId],
  ];
}
