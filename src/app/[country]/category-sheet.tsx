'use client';

import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../components/icons';
import { Sheet } from '../../components/sheet';

// "All categories" and "filters" on phones: a sheet from the bottom (src/components/sheet.tsx);
// choosing a category or applying filters changes the address, which closes it.

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
  return (
    <Sheet
      dialog={false}
      className="shrink-0"
      title={title}
      closeLabel={closeLabel}
      summaryClassName={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap ${
        tone === 'on' ? 'border-neutral-900 bg-neutral-900 font-bold text-white' : tone === 'plain' ? 'border-neutral-300 bg-white font-medium text-neutral-800' : 'border-brand-200 bg-brand-50 font-bold text-brand-800'
      }`}
      summary={
        <>
          <Icon name={icon} className="size-4" />
          {label}
          {chevron && <Icon name="chevronDown" className="size-3.5" />}
        </>
      }
    >
      {children}
    </Sheet>
  );
}
