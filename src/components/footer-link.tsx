'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';

// A footer link (no prefetch, see SiteFooter). One to the page you are on scrolls back to the top:
// Next.js does nothing for it, which read as a dead link at the bottom of a long page (the
// owner's first test on production, Nov 2, 2026). Links with a #section keep the usual jump.

export function FooterLink({ href, ...props }: Omit<ComponentProps<typeof NextLink>, 'href' | 'prefetch'> & { href: string }) {
  const here = usePathname() === href;
  return (
    <NextLink
      {...props}
      href={href}
      prefetch={false}
      aria-current={here ? 'page' : undefined}
      onClick={
        here
          ? (e) => {
              e.preventDefault();
              const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
            }
          : undefined
      }
    />
  );
}
