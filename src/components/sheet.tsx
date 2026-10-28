'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

// A sheet from the bottom on phones, a centred dialog on computers (wave 1, mockup ui.js sheet()).
// A plain <details>, so it opens without JavaScript too; with JavaScript a tap outside it, the
// close button and a change of address close it. While one is open the bottom bar hides
// (globals.css).

export function Sheet({
  summary,
  summaryClassName,
  summaryLabel,
  title,
  closeLabel,
  dialog = true,
  full = false,
  className = '',
  children,
}: {
  summary: ReactNode;
  summaryClassName: string;
  /** For a summary that is only an icon */
  summaryLabel?: string;
  title: string;
  closeLabel: string;
  /** false: a sheet on computers too (the browse page's filters, which computers show beside the results) */
  dialog?: boolean;
  /**
   * A form that should read as one page (the filters, owner's request of Oct 27, 2026): the whole
   * screen on phones, no small box scrolling inside a sheet; a wide dialog on computers
   */
  full?: boolean;
  className?: string;
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
    <details ref={ref} data-sheet className={className}>
      <summary aria-label={summaryLabel} className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}>
        {summary}
      </summary>
      <div
        className={`fixed inset-0 z-40 flex items-end bg-neutral-950/45 ${dialog ? 'lg:items-center lg:justify-center' : ''}`}
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div
          className={`w-full overflow-y-auto bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            full ? 'h-dvh max-h-dvh pt-[max(0.5rem,env(safe-area-inset-top))]' : 'max-h-[80dvh] rounded-t-3xl pt-3'
          } ${dialog ? (full ? 'lg:h-auto lg:max-h-[92dvh] lg:max-w-3xl lg:rounded-3xl lg:pt-4' : 'lg:max-w-lg lg:rounded-3xl') : ''}`}
        >
          {!full && <div className={`mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200 ${dialog ? 'lg:hidden' : ''}`} />}
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="min-w-0 truncate text-lg font-extrabold">{title}</h2>
            <button type="button" onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100" aria-label={closeLabel}>
              <Icon name="close" className="size-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </details>
  );
}
