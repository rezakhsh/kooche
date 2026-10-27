import { visitorCountry } from './client-ip';

// People using Peydoo from Iran (owner's rule, Oct 27, 2026; replaces wave 0's "Iran read-only").
// Access follows the account, as everywhere: without an account only reading; an email account
// can also send messages; an account verified with a number from an allowed country (never +98,
// src/modules/users/phone-number.ts) can do everything. Many Iranians abroad travel to Iran and
// keep using their account. The one exception is paying: Stripe's checkout and portal are refused
// for requests from Iran (src/modules/payments/checkout.ts), refunds and withdrawals are not.
// Pages for Iran carry a banner and are never kept by Cloudflare (src/proxy.ts). Never mention
// "sanctions" to the user (owner, round 12).

export const isIranRequest = (headers: Headers): boolean => visitorCountry(headers) === 'IR';
