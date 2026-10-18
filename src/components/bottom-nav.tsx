'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { messages } from '../messages/fa';
import { Icon, type IconName } from './icons';

// The bar at the bottom of the screen on phones (approved Oct 17, 2026; messages added Oct 18):
// listings, messages, post, my listings, account. Hidden from the small breakpoint up, where the
// header has the same links, and inside a conversation, which fills the screen like a messenger.

export function BottomNav({ home, signedIn, unread }: { home: string; signedIn: boolean; unread: number }) {
  const path = usePathname();
  const t = messages.nav;
  if (/^\/chat\/./.test(path)) return null;
  const items: { href: string; label: string; icon: IconName; active: boolean; primary?: boolean; badge?: number }[] = [
    { href: home, label: t.listings, icon: 'home', active: path === '/' || (home !== '/' && path.startsWith(home)) || path.startsWith('/v/') },
    { href: signedIn ? '/chat' : '/login?next=%2Fchat', label: t.chat, icon: 'chat', active: path.startsWith('/chat'), badge: unread },
    { href: '/new', label: t.post, icon: 'plus', active: path.startsWith('/new'), primary: true },
    { href: '/my/listings', label: t.myListings, icon: 'doc', active: path.startsWith('/my') },
    { href: signedIn ? '/account' : '/login', label: signedIn ? t.account : t.signIn, icon: 'user', active: path.startsWith('/account') || path.startsWith('/login') },
  ];
  return (
    <nav
      aria-label={t.label}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] ${i.active ? 'font-bold text-brand-700' : 'text-neutral-600'}`}
        >
          <span className={`relative ${i.primary ? 'rounded-xl bg-brand-700 px-3 py-0.5 text-white' : ''}`}>
            <Icon name={i.icon} className="size-5" />
            {!!i.badge && (
              <span className="absolute -top-1.5 -end-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron-500 px-1 text-[10px] font-bold text-neutral-900">
                <span aria-hidden>{i.badge > 99 ? '۹۹+' : i.badge.toLocaleString('fa-IR')}</span>
                <span className="sr-only">{t.unread(i.badge)}</span>
              </span>
            )}
          </span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
