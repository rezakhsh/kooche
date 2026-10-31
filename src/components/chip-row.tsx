'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A row of filter chips that scrolls sideways on phones, with the chosen chip (aria-current)
 * scrolled into view when the page opens (design check, Oct 31, 2026: on «آگهی‌های من» the
 * chosen «رد شده» sat out of view, so no chip looked chosen).
 */
export function ChipRow({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
  });
  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
