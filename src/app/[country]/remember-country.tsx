'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE, VIEW_COOKIE } from '../country-cookie-name';

/** The country cookie's value as the browser has it */
export function cookieCountry(cookie: string): string | null {
  const found = cookie.split('; ').find((c) => c.startsWith(`${COUNTRY_COOKIE}=`));
  return found ? found.slice(COUNTRY_COOKIE.length + 1) : null;
}

/**
 * Remembers the country page the visitor opened, so the home page leads back to it. The header
 * (country, keyword box, logo link, bottom bar) is in the root layout, which an in-app link
 * doesn't render again: when the country changed, the server parts are fetched once more with
 * the new cookie, or the header would keep the old country and its logo would lead back there.
 */
export function RememberCountry({ slug }: { slug: string }) {
  const router = useRouter();
  useEffect(() => {
    const before = cookieCountry(document.cookie);
    document.cookie = `${COUNTRY_COOKIE}=${slug}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; samesite=lax; secure`;
    if (before !== slug) router.refresh();
  }, [slug, router]);
  return null;
}

/** Remembers grid or list after the visitor switched, for the next listing pages */
export function RememberView({ view }: { view: 'grid' | 'list' | null }) {
  useEffect(() => {
    if (view) document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; samesite=lax; secure`;
  }, [view]);
  return null;
}
