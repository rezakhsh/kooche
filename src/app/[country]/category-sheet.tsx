'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/icons';

// "All categories" and "filters" on phones: a sheet from the bottom. A plain <details>, so it opens
// without JavaScript too; with JavaScript a tap outside the sheet, the close button and choosing a
// category or applying filters (the address changes) close it.

export function CategorySheet({
  label,
  title,
  closeLabel,
  icon = 'grid',
  tone = 'brand',
  chevron = false,
  children,
}: {
  label: string;
  title: string;
  closeLabel: string;
  icon?: IconName;
  /** brand: the filters; on: filters applied; plain: «همه دسته‌ها» */
  tone?: 'brand' | 'on' | 'plain';
  chevron?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path, query]);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details ref={ref} className="shrink-0">
      <summary
        className={`flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap [&::-webkit-details-marker]:hidden ${
          tone === 'on' ? 'border-neutral-900 bg-neutral-900 font-bold text-white' : tone === 'plain' ? 'border-neutral-300 bg-white font-medium text-neutral-800' : 'border-brand-200 bg-brand-50 font-bold text-brand-800'
        }`}
      >
        <Icon name={icon} className="size-4" />
        {label}
        {chevron && <Icon name="chevronDown" className="size-3.5" />}
      </summary>
      <div className="fixed inset-0 z-40 flex items-end bg-neutral-900/45" onClick={(e) => e.target === e.currentTarget && close()}>
        <div className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" />
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold">{title}</h2>
            <button type="button" onClick={close} className="flex size-11 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100" aria-label={closeLabel}>
              <Icon name="close" className="size-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </details>
  );
}
