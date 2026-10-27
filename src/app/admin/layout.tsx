import type { ReactNode } from 'react';
import { admin } from '../../messages/fa';
import { can, type StaffAction } from '../../modules/admin/access';
import { adminHref, staffSession } from '../../modules/admin/server';
import { AdminNav, type NavItem } from './nav';

// The admin page (roadmap step 8). Reached only through /<ADMIN_PATH>/… (src/modules/admin/gate.ts);
// staffSession() answers 404 to everyone else. Each page checks its own permission again.

export const metadata = { title: admin.title, robots: { index: false, follow: false } };

const SECTIONS: Array<{ path: string; key: keyof typeof admin.nav; action: StaffAction }> = [
  { path: '', key: 'overview', action: 'overview.view' },
  { path: '/queue', key: 'queue', action: 'queue.view' },
  { path: '/fresh', key: 'fresh', action: 'queue.view' },
  { path: '/listings', key: 'listings', action: 'listings.view' },
  { path: '/users', key: 'users', action: 'users.view' },
  { path: '/businesses', key: 'businesses', action: 'businesses.view' },
  { path: '/cities', key: 'cities', action: 'cities.manage' },
  { path: '/payments', key: 'payments', action: 'payments.view' },
  { path: '/audit', key: 'audit', action: 'overview.view' },
  { path: '/system', key: 'system', action: 'system.view' },
  { path: '/staff', key: 'staff', action: 'staff.manage' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { state } = await staffSession();
  const items: NavItem[] =
    state.kind === 'ok' ? SECTIONS.filter((s) => can(state.role, s.action)).map((s) => ({ href: adminHref(s.path), label: admin.nav[s.key] })) : [];
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:flex lg:gap-8">
      {items.length > 0 && <AdminNav items={items} home={adminHref()} who={`${state.name}، ${admin.roles[state.role]}`} />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
