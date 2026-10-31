'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cookieCountry } from '../app/[country]/remember-country';
import { headerKey } from './header-key';

/**
 * Keeps the header (root layout) true to the page after in-app links: when the address or the
 * remembered country no longer match what it was rendered for, the server parts are fetched once
 * more (owner, Oct 31, 2026: after choosing Canada the header still said Germany until a refresh).
 * Rendered after the page, so a page's RememberCountry has set the cookie first.
 */
export function HeaderSync({ renderedFor, countrySlugs }: { renderedFor: string; countrySlugs: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const asked = useRef<string | null>(null);
  useEffect(() => {
    const now = headerKey(pathname, countrySlugs, cookieCountry(document.cookie));
    // Once per address and country, so a header that still differs can't loop
    if (now === renderedFor || asked.current === `${pathname}|${now}`) return;
    asked.current = `${pathname}|${now}`;
    router.refresh();
  }, [pathname, renderedFor, countrySlugs, router]);
  return null;
}
