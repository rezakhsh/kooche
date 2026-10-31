import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { headerKey } from '../components/header-key';
import type { Queryable } from '../db/drizzle';
import { countries } from '../db/schema';
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
export async function chosenPageCountry(db: Queryable): Promise<Country | null> {
  const open = await chosenCountry(db);
  if (open) return open;
  const slug = (await cookies()).get(COUNTRY_COOKIE)?.value;
  const info = slug ? await countryBySlug(db, slug) : null;
  return info && (await isPlanned(db, info)) ? info : null;
}

/** Every country's address name, for the header's key (src/components/header-key.ts) */
export const countrySlugs = cache(async (db: Queryable): Promise<string[]> => (await db.select({ slug: countries.slug }).from(countries)).flatMap((c) => (c.slug ? [c.slug] : [])));

/** What the header in the root layout is rendered for (src/components/header-sync.tsx) */
export async function headerRenderedFor(db: Queryable): Promise<{ renderedFor: string; countrySlugs: string[] }> {
  const [slugs, jar, h] = await Promise.all([countrySlugs(db), cookies(), headers()]);
  return { renderedFor: headerKey(h.get('x-pathname') ?? '/', slugs, jar.get(COUNTRY_COOKIE)?.value ?? null), countrySlugs: slugs };
}

