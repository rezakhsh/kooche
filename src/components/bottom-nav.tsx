'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { messages } from '../messages/fa';
import { Icon, type IconName } from './icons';

// The bar at the bottom of the screen on phones (approved Oct 17, 2026): listings, post, my
// listings, account. Hidden from the small breakpoint up, where the header has the same links.

export function BottomNav({ home, signedIn }: { home: string; signedIn: boolean }) {
  const path = usePathname();
  const t = messages.nav;
  const items: { href: string; label: string; icon: IconName; active: boolean; primary?: boolean }[] = [
    { href: home, label: t.listings, icon: 'home', active: path === '/' || (home !== '/' && path.startsWith(home)) || path.startsWith('/v/') },
    { href: '/new', label: t.post, icon: 'plus', active: path.startsWith('/new'), primary: true },
    { href: '/my/listings', label: t.myListings, icon: 'doc', active: path.startsWith('/my') },
    { href: signedIn ? '/account' : '/login', label: signedIn ? t.account : t.signIn, icon: 'user', active: path.startsWith('/account') || path.startsWith('/login') },
  ];
  return (
    <nav
      aria-label={t.label}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] ${i.active ? 'font-bold text-brand-700' : 'text-neutral-600'}`}
        >
          <span className={i.primary ? 'rounded-xl bg-brand-700 px-3 py-0.5 text-white' : ''}>
            <Icon name={i.icon} className="size-5" />
          </span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
