'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cookieCountry } from '../app/[country]/remember-country';
import { needsServerHeader, type HeaderCookieData } from './header-place';

/**
 * Asks the server for the header again when the remembered country changed (owner, Oct 31, 2026:
 * after choosing Canada the header still said Germany until a refresh): the logo, the chip, the
 * footer and the bottom bar's first tab follow it. The chip and the keyword box follow the address
 * in the browser (./header-place-row.tsx), so ordinary links ask nothing (Nov 6, 2026: the refresh
 * after every link rendered each tapped page twice and made Back wait for the server).
 * Rendered after the page, so a page's RememberCountry has set the cookie first.
 */
export function HeaderSync({ data }: { data: HeaderCookieData }) {
  const pathname = usePathname();
  const router = useRouter();
  const asked = useRef<string | null>(null);
  useEffect(() => {
    const cookie = cookieCountry(document.cookie);
    // Once per cookie, so a header that still differs can't loop
    if (!needsServerHeader(data, cookie) || asked.current === cookie) return;
    asked.current = cookie;
    router.refresh();
  }, [pathname, data, router]);
  return null;
}
