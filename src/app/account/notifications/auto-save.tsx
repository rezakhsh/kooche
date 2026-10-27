'use client';

import type { ReactNode } from 'react';

// Saves as soon as a switch changes; without JavaScript the page shows a save button instead.

export function AutoSave({ action, children }: { action: (form: FormData) => Promise<void>; children: ReactNode }) {
  return (
    <form action={action} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
