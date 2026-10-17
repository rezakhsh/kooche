import { cookies } from 'next/headers';
import type { Queryable } from '../db/drizzle';
import { activeCountries, type Country } from '../modules/listings/queries';
import { COUNTRY_COOKIE } from './country-cookie-name';

// The country a visitor chose on the home page (decided Oct 17, 2026: the home page lists the
// countries, like Divar listed its cities). Remembered in a cookie for a year; nothing personal.

/** The chosen country if it is still open, else null */
export async function chosenCountry(db: Queryable): Promise<Country | null> {
  const slug = (await cookies()).get(COUNTRY_COOKIE)?.value;
  if (!slug) return null;
  return (await activeCountries(db)).find((c) => c.slug === slug) ?? null;
}
