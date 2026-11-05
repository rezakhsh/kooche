// What the posting fields say per country beyond each field's own rules (field audit items 5–6,
// approved by the owner on Nov 5, 2026; docs/research/field-audit.md §20). The fields' rules
// (shown, label, hint, options per country) live in seed/categories.ts, read by inCountry() in
// catalog.ts; this file holds what isn't a field: the photo chip's word, the rent's local name, the
// area's second unit and the short-let registration number's rule.

import type { RentKind } from './safety-kind';

/**
 * Countries where a tenant registers the address, with the local word: the chip on a room's photo
 * and its tooltip (owner, Nov 5, 2026: «Anmeldung» showed in every country). Elsewhere (UK, FR,
 * US, CA, AU…) there is no such duty: no field, no chip. Must match the `anmeldung` field's
 * `countries` in seed/categories.ts (tests/country-fields.test.ts).
 */
export const REGISTRATION_WORD: Readonly<Record<string, string>> = {
  DE: 'Anmeldung',
  AT: 'Meldezettel',
  NL: 'Inschrijving',
  SE: 'Folkbokföring',
  IT: 'Residenza',
};

/** The local name of the amount, in brackets after the rent's label: «اجارهٔ کل ماهانه (Bruttomiete)» */
export const RENT_LOCAL_WORD: Readonly<Record<string, string>> = {
  AT: 'Bruttomiete',
  FR: 'charges comprises',
  NL: 'kale huur',
  IT: 'canone',
};

/**
 * Countries whose ads give the area in square feet: the seller types it so, and it is stored so
 * (a listing never changes country, and browse pages show one country). The listing page adds the
 * square metres, as Rightmove does.
 */
export const SQ_FT_COUNTRIES: ReadonlySet<string> = new Set(['GB', 'US', 'CA']);
export const SQ_FT_IN_M2 = 0.09290304;

/** How the extra costs relate to the price, for the listing page's second line */
export function extraCostsLine(kind: RentKind | null): 'warm' | 'with_charges' | 'of_which' | null {
  if (kind === 'cold') return 'warm';
  if (kind === 'net') return 'with_charges';
  if (kind === 'gross') return 'of_which';
  return null;
}

/**
 * Cities (slugs) whose law wants a registration number in every ad for a whole flat let by the
 * night or week: Berlin (ZwVbG, since 2018), Amsterdam, Paris, New York (Local Law 18). Italy
 * wants its CIN everywhere (since Jan 2025). The EU regulation 2024/1028 applies from May 20, 2026.
 */
export const REGISTRATION_NUMBER_CITIES: ReadonlySet<string> = new Set(['berlin', 'amsterdam', 'paris', 'new-york']);
export const REGISTRATION_NUMBER_COUNTRIES: ReadonlySet<string> = new Set(['IT']);

/** Whether a short let must give its registration number before it is published */
export function registrationNumberRequired(where: { countryCode: string | null; citySlug: string | null }, attributes: Record<string, unknown>): boolean {
  const whole = attributes.room_type === 'entire_place';
  const short = attributes.rent_period === 'night' || attributes.rent_period === 'week';
  if (!whole || !short) return false;
  return (!!where.countryCode && REGISTRATION_NUMBER_COUNTRIES.has(where.countryCode)) || (!!where.citySlug && REGISTRATION_NUMBER_CITIES.has(where.citySlug));
}
