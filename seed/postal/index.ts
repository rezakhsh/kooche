import { readFileSync } from 'node:fs';
import type { PostalPlaceSeed } from '../types';

// Postal codes and their places per country, from GeoNames (CC BY 4.0, see seed/README.md).
// The .tsv files are written by scripts/import-postal-codes.mjs; never edit them by hand.

export function postalPlaces(countryCode: string): PostalPlaceSeed[] {
  const file = new URL(`./${countryCode.toLowerCase()}.tsv`, import.meta.url);
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [postalCode, placeName, lat, lng] = line.split('\t');
      return { postalCode: postalCode!, placeName: placeName!, lat: Number(lat), lng: Number(lng) };
    });
}

/** Countries whose postal codes are seeded (the 9 planned countries since Nov 4, 2026: postal codes, step 4) */
export const POSTAL_COUNTRIES = ['DE', 'AT', 'GB', 'FR', 'TR', 'CA', 'US', 'NL', 'IT', 'SE', 'AU'] as const;
