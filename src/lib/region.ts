import { cloudflareLocation, visitorCountry } from './client-ip';

// People using Peydoo from Iran (owner's rule, Oct 27, 2026; replaces wave 0's "Iran read-only";
// messaging rule of Nov 4, 2026). Access follows the account and its number, never the visitor's
// country alone (many use a VPN): without an account only reading; sending messages needs a
// verified number, which may be Iranian (+98, through Telegram only, messages only;
// src/modules/users/permissions.ts); posting, events, businesses and seeing sellers' numbers need a
// number from an allowed country. Many Iranians abroad travel to Iran and keep using their account.
// What the country does change: paying is refused for requests from Iran (and from every other
// place below), and the phone page offers no WhatsApp to them (src/modules/users/phone-ways.ts).
// Pages for Iran carry a banner and are never kept by Cloudflare (src/proxy.ts). Never mention
// "sanctions" to the user (owner, round 12).

export const isIranRequest = (headers: Headers): boolean => visitorCountry(headers) === 'IR';

// ---------------------------------------------------------------------------
// Where payments can't come from (owner, Nov 4, 2026; docs/setup.md, "Payments and Pro")
// ---------------------------------------------------------------------------
//
// Stripe's restricted jurisdictions, from https://stripe.com/legal/restricted-businesses ("Last
// updated: 2026-09-22", read Nov 4, 2026): Cuba, Iran, North Korea, Syria, and the Crimea, Donetsk
// and Luhansk regions of Ukraine. Zaporizhzhia and Kherson are added because the EU's rules
// (Council Regulation (EU) 2022/263) cover them too and the seller is in Germany; Ukraine isn't one
// of our countries, so no customer of ours is affected. Two controls use this list:
// - before payment, by the request's location (Cloudflare): src/modules/payments/checkout.ts and
//   ./founding.ts refuse with `restricted_country` before Stripe is called;
// - after payment, by the billing address Stripe collected: src/modules/payments/apply.ts and
//   ./restricted.ts refund it and grant nothing.

/** Whole countries: no payment from a request or a billing address there */
export const PAYMENT_BLOCKED_COUNTRIES: readonly string[] = ['CU', 'IR', 'KP', 'SY'];

/**
 * Regions of a country, by ISO 3166-2 code without the country (as Cloudflare's `cf-region-code`
 * sends them): Ukraine's Crimea (43), Sevastopol (40), Donetsk (14), Luhansk (09), Zaporizhzhia (23)
 * and Kherson (65). A request from such a country without a region code is refused too: we can't
 * tell where in the country it is.
 */
export const PAYMENT_BLOCKED_REGIONS: Readonly<Record<string, readonly string[]>> = { UA: ['43', '40', '14', '09', '23', '65'] };

/**
 * The same regions by name, in any country (`cf-region`, a billing address's state or city): some
 * networks in Crimea are placed in Russia.
 */
const BLOCKED_REGION_NAME = /crimea|krym|sevastopol|donetsk|donezk|luhansk|lugansk|zaporizh|zaporozh|saporischschja|kherson|cherson/i;

/**
 * Ukrainian postcodes of those regions, by their first two digits: Zaporizhzhia 69–72, Kherson
 * 73–75, Donetsk 83–87, Luhansk 91–94, Crimea 95–98, Sevastopol 99.
 */
const BLOCKED_UA_POSTCODES = new Set(['69', '70', '71', '72', '73', '74', '75', '83', '84', '85', '86', '87', '91', '92', '93', '94', '95', '96', '97', '98', '99']);

/**
 * Cloudflare's country code for Tor: nobody can tell where the visitor is, so no payment (as most
 * payment pages do). `XX` (no country known) may pay; the billing address is checked after payment.
 */
export const TOR_COUNTRY = 'T1';

/**
 * Where a request comes from, when payments can't come from there: `IR`, `CU`, `KP`, `SY`, `T1`
 * (Tor), `UA-43` (a blocked region), `UA` (Ukraine without a region), `RU-region` (a blocked region
 * placed in another country). Null when paying is fine. Staff viewing the site as a country count as
 * that country (src/modules/admin/view-as.ts).
 */
export function restrictedPaymentPlace(headers: Headers): string | null {
  const where = cloudflareLocation(headers);
  const country = visitorCountry(headers) ?? (where?.country === TOR_COUNTRY ? TOR_COUNTRY : null);
  if (!country) return null;
  if (country === TOR_COUNTRY || PAYMENT_BLOCKED_COUNTRIES.includes(country)) return country;
  const regions = PAYMENT_BLOCKED_REGIONS[country];
  const real = where?.country === country ? where : null;
  if (regions) {
    if (!real?.regionCode) return country;
    if (regions.includes(real.regionCode)) return `${country}-${real.regionCode}`;
  }
  if (real?.regionName && BLOCKED_REGION_NAME.test(real.regionName)) return `${country}-region`;
  return null;
}

/** Whether payments are refused for this request (the checkout functions' `fromRestrictedCountry`) */
export const isRestrictedCountryRequest = (headers: Headers): boolean => restrictedPaymentPlace(headers) !== null;

/** The parts of a billing address Stripe sends (a Checkout Session's customer_details, an invoice's customer_address) */
export type BillingAddress = { country?: string | null; postal_code?: string | null; state?: string | null; city?: string | null } | null | undefined;

/**
 * Where a billing address is, when payments can't come from there; null when it's fine or has no
 * country. A Ukrainian address is placed by its postcode, else by its region or city name; one with
 * neither counts as blocked (we can't tell where in Ukraine it is).
 */
export function restrictedBillingPlace(address: BillingAddress): string | null {
  const country = address?.country?.trim().toUpperCase();
  if (!country) return null;
  if (PAYMENT_BLOCKED_COUNTRIES.includes(country)) return country;
  const named = [address?.state, address?.city].some((v) => !!v && BLOCKED_REGION_NAME.test(v));
  if (country === 'UA') {
    const postcode = address?.postal_code?.replace(/\s/g, '') ?? '';
    if (/^\d{5}$/.test(postcode) && BLOCKED_UA_POSTCODES.has(postcode.slice(0, 2))) return `UA-postcode-${postcode.slice(0, 2)}`;
    if (named) return 'UA-region';
    return /^\d{5}$/.test(postcode) || address?.state || address?.city ? null : 'UA';
  }
  return named ? `${country}-region` : null;
}
