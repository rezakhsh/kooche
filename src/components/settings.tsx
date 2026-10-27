import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppBar } from './app-bar';
import { Icon, type IconName } from './icons';

// Pages under the account that had no mockup (wave 1, the owner's rule: design them in the
// approved style): the task bar with back and the page's name, a narrow column, and settings in
// groups of rows (an icon in a tinted square, the name, its current value under it).

export function TaskPage({ title, back, backLabel, children, wide = false }: { title: string; back: string; backLabel: string; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <AppBar title={title} back={back} backLabel={backLabel} />
      <main className={`mx-auto w-full px-4 pt-5 pb-10 ${wide ? 'max-w-2xl' : 'max-w-xl'}`}>{children}</main>
    </>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      {title && <h2 className="mb-2 px-1 text-sm font-bold text-neutral-600">{title}</h2>}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">{children}</ul>
    </section>
  );
}

export function SettingsRow({
  href,
  icon,
  label,
  value,
  tone = 'normal',
}: {
  href?: string;
  icon: IconName;
  label: string;
  value?: ReactNode;
  /** warn: something to do (name or phone missing); danger: deleting the account */
  tone?: 'normal' | 'warn' | 'danger';
}) {
  const tile = tone === 'danger' ? 'bg-red-50 text-red-700' : tone === 'warn' ? 'bg-saffron-50 text-saffron-800' : 'bg-brand-50 text-brand-700';
  const inner = (
    <>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tile}`}>
        <Icon name={icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] ${tone === 'danger' ? 'text-red-700' : ''}`}>{label}</span>
        {value && <span className={`block truncate text-xs ${tone === 'warn' ? 'font-bold text-saffron-800' : 'text-neutral-600'}`}>{value}</span>}
      </span>
      {href && <Icon name="chevronEnd" className="size-4 text-neutral-400" />}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
          {inner}
        </Link>
      ) : (
        <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">{inner}</div>
      )}
    </li>
  );
}
