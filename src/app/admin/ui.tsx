import Link from 'next/link';
import type { ReactNode } from 'react';
import { Pill } from '../../components/ui';
import { webEnv } from '../../lib/env';
import { formatAgo, formatDateTime } from '../../lib/format';
import { admin } from '../../messages/fa';

// Small building blocks of the admin page. Logical classes only (right to left).

export function AdminTitle({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-sm text-neutral-600">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 ${className}`}>
      {title && <h2 className="mb-3 font-bold">{title}</h2>}
      {children}
    </section>
  );
}

/** "۲ ساعت پیش", with the full Jalali date and time on hover */
export function Ago({ date }: { date: Date }) {
  const tz = webEnv().APP_TIME_ZONE;
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date, tz)}>
      {formatAgo(date, tz)}
    </time>
  );
}

export function When({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{formatDateTime(date, webEnv().APP_TIME_ZONE)}</time>;
}

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'brand'> = {
  active: 'success',
  open: 'warning',
  in_review: 'warning',
  pending_review: 'warning',
  paused: 'neutral',
  rejected: 'danger',
  deleted: 'danger',
  suspended: 'danger',
  deactivated: 'neutral',
  resolved: 'success',
  dismissed: 'neutral',
};

export function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  return <Pill tone={TONE[status] ?? 'neutral'}>{admin.status[status] ?? status}</Pill>;
}

/** Tabs or filter chips that are plain links (no prefetch: see ./nav.tsx) */
export function Chips({ items }: { items: Array<{ href: string; label: string; active: boolean }> }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          prefetch={false}
          aria-current={i.active ? 'page' : undefined}
          className={`rounded-full border px-3 py-1.5 text-sm ${i.active ? 'border-brand-700 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Label and value rows that stay readable on a phone */
export function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y divide-neutral-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="min-w-0 text-end font-medium">{v ?? admin.common.none}</dd>
        </div>
      ))}
    </dl>
  );
}
