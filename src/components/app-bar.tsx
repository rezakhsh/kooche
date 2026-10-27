import type { ReactNode } from 'react';
import { BackLink } from './back-link';
import { Icon } from './icons';

// A task page's own bar (wave 1, mockup ui.js appBar()): back and the page's name, instead of the
// site header and footer (globals.css hides them while a [data-app-bar] is on the page).

/** `back`: where back leads when there is no previous Peydoo page; `action`: one thing at the end */
export function AppBar({ title, back, backLabel, sub, action, close = false }: { title: string; back: string; backLabel: string; sub?: string; action?: ReactNode; /** ✕ instead of the back arrow (a chooser) */ close?: boolean }) {
  return (
    <div data-app-bar className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
        <BackLink fallback={back} label={backLabel} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-800 hover:bg-neutral-50">
          <Icon name={close ? 'close' : 'back'} className="size-6" />
        </BackLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold">{title}</h1>
          {sub && <p className="truncate text-xs text-neutral-600">{sub}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
