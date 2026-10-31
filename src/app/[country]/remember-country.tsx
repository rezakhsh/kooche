'use client';

import { useEffect } from 'react';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE, VIEW_COOKIE } from '../country-cookie-name';

/** The country cookie's value as the browser has it */
export function cookieCountry(cookie: string): string | null {
  const found = cookie.split('; ').find((c) => c.startsWith(`${COUNTRY_COOKIE}=`));
  return found ? found.slice(COUNTRY_COOKIE.length + 1) : null;
}

/**
 * Remembers the country page the visitor opened, open or not yet open, so the home page and the
 * logo lead back to it (owner, Oct 31, 2026: the last country opened is the visitor's country).
 * The header follows through src/components/header-sync.tsx, which reads the cookie set here.
 */
export function RememberCountry({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `${COUNTRY_COOKIE}=${slug}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; samesite=lax; secure`;
  }, [slug]);
  return null;
}

/** Remembers grid or list after the visitor switched, for the next listing pages */
export function RememberView({ view }: { view: 'grid' | 'list' | null }) {
  useEffect(() => {
    if (view) document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; samesite=lax; secure`;
  }, [view]);
  return null;
}
