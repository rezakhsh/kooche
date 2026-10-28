'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '../../components/icons';
import { admin } from '../../messages/fa';

export type NavItem = { href: string; label: string; icon: IconName; badge?: { text: string; tone: 'saffron' | 'red' } };

// The admin page's sections (wave 1, mockup ui.js adminShell): one row that scrolls sideways on
// phones, a sticky column from lg, with the queue's size and the system's problems. Links don't
// prefetch: prefetches skip src/proxy.ts, which is what lets a request through the secret address.

export function AdminNav({ items, home, site }: { items: NavItem[]; home: string; site: string }) {
  const path = usePathname();
  // An item page belongs to the queue
  const active = (href: string) => (href === home ? path === home : path === href || path.startsWith(`${href}/`) || (href.endsWith('/queue') && path.includes('/items/')));
  return (
    <nav
      aria-label={admin.nav.menu}
      className="no-scrollbar flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2 lg:sticky lg:top-[3.25rem] lg:h-[calc(100dvh-3.25rem)] lg:flex-col lg:overflow-y-auto lg:border-e lg:border-b-0 lg:p-3"
    >
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          prefetch={false}
          aria-current={active(i.href) ? 'page' : undefined}
          className={`flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm whitespace-nowrap ${active(i.href) ? 'bg-brand-50 font-bold text-brand-800' : 'text-neutral-700 hover:bg-neutral-100'}`}
        >
          <Icon name={i.icon} className="size-[18px]" />
          {i.label}
          {i.badge && <span className={`ms-auto rounded-full px-2 text-xs leading-5 font-bold ${i.badge.tone === 'red' ? 'bg-red-100 text-red-800' : 'bg-saffron-500 text-ink'}`}>{i.badge.text}</span>}
        </Link>
      ))}
      <Link href="/" prefetch={false} className="flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm whitespace-nowrap text-neutral-500 hover:bg-neutral-100 lg:mt-auto lg:hidden">
        <Icon name="back" className="size-[18px]" />
        {site}
      </Link>
    </nav>
  );
}
