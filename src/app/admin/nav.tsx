'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { admin } from '../../messages/fa';

export type NavItem = { href: string; label: string };

// The admin page's navigation: a side column from lg, a menu that opens on phones (a <details>,
// so it works without JavaScript). Links don't prefetch: prefetches skip src/proxy.ts, which is
// what lets a request through the secret address.

export function AdminNav({ items, home, who }: { items: NavItem[]; home: string; who: string }) {
  const path = usePathname();
  const active = (href: string) => (href === home ? path === home : path === href || path.startsWith(`${href}/`));
  const list = (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            prefetch={false}
            aria-current={active(i.href) ? 'page' : undefined}
            className={`block rounded-xl px-3 py-2 text-sm font-medium ${active(i.href) ? 'bg-brand-50 text-brand-800' : 'text-neutral-700 hover:bg-neutral-100'}`}
          >
            {i.label}
          </Link>
        </li>
      ))}
      <li className="border-t border-neutral-200 pt-2">
        <Link href="/" prefetch={false} className="block rounded-xl px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
          {admin.nav.site}
        </Link>
      </li>
    </ul>
  );
  return (
    <>
      <details className="mb-4 rounded-2xl border border-neutral-200 lg:hidden">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-bold">
          <span>{items.find((i) => active(i.href))?.label ?? admin.nav.menu}</span>
          <span className="text-xs font-normal text-neutral-500">{who}</span>
        </summary>
        <nav aria-label={admin.nav.menu} className="border-t border-neutral-200 p-2">{list}</nav>
      </details>
      <aside className="hidden w-56 shrink-0 lg:block">
        <p className="mb-3 px-3 text-xs text-neutral-500">{who}</p>
        <nav aria-label={admin.nav.menu}>{list}</nav>
      </aside>
    </>
  );
}
