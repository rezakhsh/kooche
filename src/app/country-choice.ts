import { cookies } from 'next/headers';
import type { Queryable } from '../db/drizzle';
import { countryBySlug, isPlanned, preparingCountries } from '../modules/launch/country-page';
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

/**
 * The chosen country if listings, events and businesses can be made there: open, or preparing to
 * open (prestart; wave 2 part 8). A prestart country is chosen only through its page's «آماده کنید»
 * buttons (src/app/[country]/_browse/prepare-action.ts).
 */
export async function chosenPostingCountry(db: Queryable): Promise<Country | null> {
  const slug = (await cookies()).get(COUNTRY_COOKIE)?.value;
  if (!slug) return null;
  return (await preparingCountries(db)).find((c) => c.slug === slug) ?? null;
}

/** The chosen country if it has a first page: open, or planned and not open yet (wave 2 part 8) */
export async function chosenPageCountry(db: Queryable): Promise<{ slug: string } | null> {
  const open = await chosenCountry(db);
  if (open) return open;
  const slug = (await cookies()).get(COUNTRY_COOKIE)?.value;
  const info = slug ? await countryBySlug(db, slug) : null;
  return info && (await isPlanned(db, info)) ? info : null;
}
