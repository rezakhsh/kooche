'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { cookieCountry } from '../app/[country]/remember-country';
import { messages } from '../messages/fa';
import { headerPlace, needsServerHeader, serverCountry, type HeaderPlace, type HeaderPlaceData } from './header-place';
import { Icon } from './icons';
import { SearchBox } from './search-box';

/**
 * The header's middle and end (./site-header.tsx): the place chip, the keyword box and the links,
 * drawn in the browser from the address (./header-place.ts), so an in-app link changes them at
 * once and without a second request. When the server would draw it for another remembered
 * country, the header stays as it is until the server's comes (./header-sync.tsx asks for it), so
 * it never shows a guess.
 */
export function HeaderPlaceRow({
  data,
  nav,
  signIn,
  post,
  phoneSignIn,
}: {
  data: HeaderPlaceData;
  /** A signed-in user's links (chat, my listings, saved, account) */
  nav: ReactNode;
  /** «ورود» for a visitor, not on the sign-in pages */
  signIn: ReactNode;
  post: ReactNode;
  phoneSignIn: ReactNode;
}) {
  const path = usePathname();
  const drawn = headerPlace(path, data);
  const check = { ...data, countrySlug: data.country?.slug ?? null };
  // The server's first render is for this address; in the browser the cookie decides
  const ours = typeof document === 'undefined' || !needsServerHeader(check, serverCountry(path, check, cookieCountry(document.cookie)));
  const last = useRef<HeaderPlace | null>(null);
  const shown = ours || !last.current ? drawn : last.current;
  useEffect(() => {
    last.current = shown;
  });
  return (
    <>
      {shown.chip && (
        <Link
          href="/cities"
          className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 ps-2.5 pe-3 text-[13px] font-medium whitespace-nowrap text-neutral-700 hover:border-brand-300"
          title={messages.cities.title}
        >
          <Icon name="pin" className="size-4 text-brand-700" />
          {shown.chip}
          <Icon name="chevronDown" className="size-3.5" />
        </Link>
      )}
      {shown.search && shown.country && (
        <SearchBox
          key={shown.search.action}
          id="header-q"
          action={shown.search.action}
          country={shown.country}
          city={shown.search.city}
          placeholder={shown.search.placeholder}
          plain={shown.search.plain}
          className="ms-auto hidden min-w-0 max-w-sm flex-1 lg:block"
        />
      )}
      <nav aria-label={messages.nav.label} className={`${shown.search ? '' : 'ms-auto'} hidden shrink-0 items-center gap-1 whitespace-nowrap sm:flex xl:gap-2`}>
        {nav}
        {!shown.onLogin && signIn}
        {post}
      </nav>
      {!shown.onLogin && phoneSignIn}
    </>
  );
}
