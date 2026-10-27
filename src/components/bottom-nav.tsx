'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { messages } from '../messages/fa';
import { Icon, type IconName } from './icons';

// The bar at the bottom of the screen on phones (approved Oct 17, 2026; messages added Oct 18):
// listings, messages, post, my listings, account. Hidden from the small breakpoint up, where the
// header has the same links, and on task pages (wave 1: "the bottom bar only on browsing pages"):
// a conversation, posting and editing, settings, sign-in and forms, which keep the screen to
// themselves.

const TASK_PAGES = [
  // A listing page has its own bar (chat, phone, save); an event page too (tickets, save)
  /^\/v\//,
  /^\/e\//,
  /^\/chat\/./,
  /^\/new(\/|$)/,
  /^\/my\/(listings|events|orders)\/./,
  /^\/events\/new/,
  /^\/business\/new/,
  /^\/b\/[^/]+\/./,
  /^\/account\/./,
  /^\/(login|report|contact|waitlist|cities)(\/|$)/,
];

/** Whether the bar shows on this path (phones only) */
export function showsBottomNav(path: string): boolean {
  return !TASK_PAGES.some((p) => p.test(path));
}

export function BottomNav({ home, signedIn, unread }: { home: string; signedIn: boolean; unread: number }) {
  const path = usePathname();
  const t = messages.nav;
  if (!showsBottomNav(path)) return null;
  const items: { href: string; label: string; icon: IconName; active: boolean; primary?: boolean; badge?: number }[] = [
    { href: home, label: t.listings, icon: 'home', active: path === '/' || (home !== '/' && path.startsWith(home)) || path.startsWith('/v/') },
    { href: signedIn ? '/chat' : '/login?next=%2Fchat', label: t.chat, icon: 'chat', active: path.startsWith('/chat'), badge: unread },
    { href: '/new', label: t.post, icon: 'plus', active: path.startsWith('/new'), primary: true },
    { href: '/my/listings', label: t.myListings, icon: 'doc', active: /^\/my\/(listings|events)/.test(path) },
    { href: signedIn ? '/account' : '/login', label: signedIn ? t.account : t.signIn, icon: 'user', active: path.startsWith('/account') || path.startsWith('/login') || /^\/my\/(favorites|searches|orders)/.test(path) },
  ];
  return (
    <nav
      aria-label={t.label}
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-xs ${i.active ? 'font-bold text-brand-700' : 'text-neutral-600'}`}
        >
          {/* The page you are on: a soft pill behind its icon (owner's choice, Oct 27, 2026) */}
          <span className={`relative ${i.primary ? 'rounded-xl bg-brand-700 px-3 py-0.5 text-white' : `rounded-full px-4 py-0.5 transition-colors ${i.active ? 'bg-brand-50' : ''}`}`}>
            <Icon name={i.icon} className="size-5" />
            {!!i.badge && (
              <span className="absolute -top-1.5 -end-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron-500 px-1 text-xs font-bold text-neutral-900">
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
