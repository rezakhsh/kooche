import { visitorCountry } from './client-ip';

// People using Peydoo from Iran (owner's rule, Oct 27, 2026; replaces wave 0's "Iran read-only";
// messaging rule of Nov 4, 2026). Access follows the account and its number, never the visitor's
// country alone (many use a VPN): without an account only reading; sending messages needs a
// verified number, which may be Iranian (+98, through Telegram only, messages only;
// src/modules/users/permissions.ts); posting, events, businesses and seeing sellers' numbers need a
// number from an allowed country. Many Iranians abroad travel to Iran and keep using their account.
// What the country does change: paying is refused for requests from Iran (Stripe's checkout and
// portal, src/modules/payments/checkout.ts; refunds and withdrawals are not), and the phone page
// offers no WhatsApp to them (src/modules/users/phone-ways.ts). Pages for Iran carry a banner and
// are never kept by Cloudflare (src/proxy.ts). Never mention "sanctions" to the user (owner, round 12).

export const isIranRequest = (headers: Headers): boolean => visitorCountry(headers) === 'IR';
