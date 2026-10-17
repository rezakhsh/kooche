'use client';

import { useEffect } from 'react';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE } from '../country-cookie-name';

/** Remembers the country page the visitor opened, so the home page leads back to it */
export function RememberCountry({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `${COUNTRY_COOKIE}=${slug}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; samesite=lax; secure`;
  }, [slug]);
  return null;
}
