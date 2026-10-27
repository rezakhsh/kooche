'use client';

import type { ReactNode } from 'react';

// "Back": the previous Peydoo page when there is one, else `fallback` (a shared link, a new tab).
// A plain link without JavaScript.

export function BackLink({ fallback, label, className, children }: { fallback: string; label: string; className: string; children: ReactNode }) {
  return (
    <a
      href={fallback}
      aria-label={label}
      title={label}
      className={className}
      onClick={(e) => {
        const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
        if (fromHere && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      }}
    >
      {children}
    </a>
  );
}
