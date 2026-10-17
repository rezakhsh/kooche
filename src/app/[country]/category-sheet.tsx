'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../components/icons';

// "All categories" on phones: a sheet from the bottom. A plain <details>, so it opens without
// JavaScript too; with JavaScript a tap outside the sheet, the close button and choosing a
// category close it.

export function CategorySheet({ label, title, closeLabel, children }: { label: string; title: string; closeLabel: string; children: ReactNode }) {
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
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-bold whitespace-nowrap text-brand-700 [&::-webkit-details-marker]:hidden">
        <Icon name="grid" className="size-4" />
        {label}
      </summary>
      <div className="fixed inset-0 z-40 flex items-end bg-neutral-900/45" onClick={(e) => e.target === e.currentTarget && close()}>
        <div className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" />
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold">{title}</h2>
            <button type="button" onClick={close} className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100" aria-label={closeLabel}>
              <Icon name="close" className="size-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </details>
  );
}
