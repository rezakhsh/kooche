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

/** "۲ ساعت پیش", with the full date and time on hover */
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

/** A plain GET search form (works without JavaScript; the address stays under the secret path) */
export function SearchForm({ label, name = 'q', value, children }: { label: string; name?: string; value: string; children?: ReactNode }) {
  return (
    <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 basis-64">
        <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
        <input name={name} defaultValue={value} dir="auto" className="block w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
      </label>
      {children}
      <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
        {admin.common.search}
      </button>
    </form>
  );
}

export const selectClass = 'rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600';

/** Widths in steps of 5%: classes, not a style attribute (the CSP allows no inline styles) */
const WIDTH = ['w-0', 'w-[5%]', 'w-[10%]', 'w-[15%]', 'w-[20%]', 'w-[25%]', 'w-[30%]', 'w-[35%]', 'w-[40%]', 'w-[45%]', 'w-[50%]', 'w-[55%]', 'w-[60%]', 'w-[65%]', 'w-[70%]', 'w-[75%]', 'w-[80%]', 'w-[85%]', 'w-[90%]', 'w-[95%]', 'w-full'];

/** A thin bar towards a goal, green once it is reached (wave 1: the gates, the cities) */
export function Progress({ value, goal, className = '' }: { value: number; goal: number; className?: string }) {
  const step = goal > 0 ? Math.min(20, Math.round((value / goal) * 20)) : 0;
  return (
    <span className={`block h-2 overflow-hidden rounded-full bg-neutral-100 ${className}`} aria-hidden="true">
      <i className={`block h-full rounded-full ${value >= goal ? 'bg-green-600' : 'bg-brand-600'} ${WIDTH[value > 0 ? Math.max(1, step) : 0]}`} />
    </span>
  );
}
