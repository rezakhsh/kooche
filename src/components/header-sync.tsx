'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cookieCountry } from '../app/[country]/remember-country';
import { needsServerHeader, renderedCountry, serverCountry, type HeaderCookieData } from './header-place';

/**
 * Asks the server for the header again when the server would draw it for another remembered
 * country (owner, Oct 31, 2026: after choosing Canada the header still said Germany until a
 * refresh): another country's page, staff viewing the site as a country. The logo, the chip, the
 * footer and the bottom bar's first tab follow it. Otherwise the chip and the keyword box follow
 * the address in the browser (./header-place-row.tsx) and links ask nothing (Nov 6, 2026: the
 * refresh after every link that changed the header rendered each such tap twice and made Back
 * wait for the server).
 */
export function HeaderSync({ data }: { data: HeaderCookieData }) {
  const pathname = usePathname();
  const router = useRouter();
  const asked = useRef<string | null>(null);
  useEffect(() => {
    const country = serverCountry(pathname, data, cookieCountry(document.cookie));
    if (!needsServerHeader(data, country)) return;
    // Once per address and change, so a header that still differs can't loop
    const key = `${renderedCountry(data)}>${country}@${pathname}`;
    if (asked.current === key) return;
    asked.current = key;
    router.refresh();
  }, [pathname, data, router]);
  return null;
}
