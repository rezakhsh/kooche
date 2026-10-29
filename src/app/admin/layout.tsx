import Link from 'next/link';
import type { ReactNode } from 'react';
import type { IconName } from '../../components/icons';
import { Icon } from '../../components/icons';
import { LogoMark } from '../../components/logo';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { admin, faDigits } from '../../messages/fa';
import { can, type StaffAction } from '../../modules/admin/access';
import { queueAge } from '../../modules/admin/queue';
import { adminHref, staffSession } from '../../modules/admin/server';
import { AdminKeys } from './keys';
import { AdminNav, type NavItem } from './nav';
import { systemState } from './system/checks';

// The admin page (roadmap step 8). Reached only through /<ADMIN_PATH>/… (src/modules/admin/gate.ts);
// staffSession() answers 404 to everyone else. Each page checks its own permission again.
// Wave 1 (mockup ui.js adminShell): its own dark bar with «پنل مدیریت» and the environment, the
// search on computers ("/" focuses it), the sections with the queue's size and the system's
// problems; the public header, footer and bottom bar step aside (globals.css, [data-admin]).

export const metadata = { title: admin.title, robots: { index: false, follow: false } };

const SECTIONS: Array<{ path: string; key: keyof typeof admin.nav; action: StaffAction; icon: IconName }> = [
  { path: '', key: 'overview', action: 'overview.view', icon: 'chart' },
  { path: '/queue', key: 'queue', action: 'queue.view', icon: 'flag' },
  { path: '/fresh', key: 'fresh', action: 'queue.view', icon: 'sparkle' },
  { path: '/listings', key: 'listings', action: 'listings.view', icon: 'doc' },
  { path: '/users', key: 'users', action: 'users.view', icon: 'people' },
  { path: '/view-as', key: 'viewAs', action: 'overview.view', icon: 'globe' },
  { path: '/businesses', key: 'businesses', action: 'businesses.view', icon: 'store' },
  { path: '/cities', key: 'cities', action: 'cities.manage', icon: 'globe' },
  { path: '/payments', key: 'payments', action: 'payments.view', icon: 'card' },
  { path: '/audit', key: 'audit', action: 'overview.view', icon: 'list' },
  { path: '/system', key: 'system', action: 'system.view', icon: 'gear' },
  { path: '/staff', key: 'staff', action: 'staff.manage', icon: 'shield' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { state } = await staffSession();
  const ok = state.kind === 'ok';
  const t = admin.shell;
  const [queue, system] = ok
    ? await Promise.all([can(state.role, 'queue.view') ? queueAge(appDb()).catch(() => null) : null, can(state.role, 'system.view') ? systemState() : null])
    : [null, null];
  const badges: Partial<Record<string, { text: string; tone: 'saffron' | 'red' }>> = {
    ...(queue?.count ? { queue: { text: faDigits(String(queue.count)), tone: 'saffron' as const } } : {}),
    ...(system?.problems.length ? { system: { text: faDigits(String(system.problems.length)), tone: 'red' as const } } : {}),
  };
  const items: NavItem[] = ok
    ? SECTIONS.filter((s) => can(state.role, s.action)).map((s) => ({ href: adminHref(s.path), label: admin.nav[s.key], icon: s.icon, badge: badges[s.key] }))
    : [];
  const envName = webEnv().SENTRY_ENVIRONMENT ?? 'local';
  return (
    <div data-admin className="min-h-dvh bg-neutral-50">
      <header className="sticky top-0 z-30 bg-brand-950 text-snow">
        <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
          <LogoMark className="size-8 shrink-0" />
          <b className="text-base">پیدو</b>
          <span className="rounded-md bg-snow/15 px-2 text-xs leading-6 font-bold">{t.panel}</span>
          <span className={`rounded-md px-2 text-xs leading-6 font-bold ${envName === 'production' ? 'bg-danger text-snow' : 'bg-saffron-500 text-ink'}`} dir="ltr">
            {t.env[envName] ?? envName}
          </span>
          {items.length > 0 && (
            <form method="get" action={adminHref('/find')} role="search" className="ms-auto hidden h-10 w-80 items-center gap-2 rounded-lg bg-snow/10 px-3 text-sm focus-within:ring-2 focus-within:ring-snow/40 lg:flex">
              <Icon name="search" className="size-4 shrink-0 text-snow/75" />
              <input name="q" data-admin-search aria-label={t.searchLabel} placeholder={t.search} dir="rtl" className="min-w-0 flex-1 bg-transparent text-snow outline-none placeholder:text-snow/75" />
              <kbd className="rounded border border-snow/30 px-1.5 text-xs text-snow/75">/</kbd>
            </form>
          )}
          {ok && <span className="ms-auto truncate text-sm text-snow/75 lg:ms-3">{`${state.name}، ${admin.roles[state.role]}`}</span>}
          <Link href="/" prefetch={false} className={`${ok ? '' : 'ms-auto '}hidden h-9 shrink-0 items-center rounded-lg px-3 text-sm text-snow/75 ring-1 ring-snow/25 hover:bg-snow/10 lg:flex`}>
            {t.back}
          </Link>
        </div>
      </header>
      <div className={items.length > 0 ? 'lg:grid lg:grid-cols-[15rem_1fr]' : ''}>
        {items.length > 0 && <AdminNav items={items} home={adminHref()} site={t.back} />}
        <main className="min-w-0 p-4 lg:p-6">{children}</main>
      </div>
      {items.length > 0 && <AdminKeys />}
    </div>
  );
}
