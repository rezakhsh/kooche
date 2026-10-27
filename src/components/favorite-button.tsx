'use client';

import { useActionState } from 'react';
import { favoriteAction } from '../app/favorites/actions';
import { messages } from '../messages/fa';
import { Icon } from './icons';

// The ♡ on listing cards and pages: a form with a server action, so it works without JavaScript
// (the page renders again with the new state). With JavaScript the heart flips at once while
// the request runs. `back` is the page to return to after signing in. Wave 1 adds `photo` (a white
// circle over a listing's photo) and `bar` (beside chat in the phone's contact bar).

export function FavoriteButton({ token, saved, back, variant = 'card' }: { token: string; saved: boolean; back: string; variant?: 'card' | 'page' | 'photo' | 'bar' }) {
  const t = messages.favorites;
  const [state, action, pending] = useActionState(favoriteAction, { saved });
  // While the request runs, show what it will do
  const on = pending ? !state.saved : state.saved;
  const label = on ? t.remove : t.add;
  return (
    <form action={action} className={variant === 'page' ? 'flex flex-col items-start gap-1' : undefined}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="intent" value={state.saved ? 'remove' : 'add'} />
      <button
        type="submit"
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={
          variant === 'card'
            ? `group flex size-11 items-center justify-center rounded-full ${on ? 'text-red-600' : 'text-neutral-700'}`
            : variant === 'photo'
              ? `pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/95 shadow ${on ? 'text-red-600' : 'text-neutral-900'}`
              : variant === 'bar'
                ? `flex size-12 items-center justify-center rounded-xl border ${on ? 'border-red-200 bg-red-50 text-red-600' : 'border-neutral-300 text-neutral-800'}`
                : `flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold ${on ? 'border-red-200 bg-red-50 text-red-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`
        }
      >
        {/* On cards a 36px circle inside a 44px target */}
        {variant === 'card' ? (
          <span className="flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-neutral-900/5 backdrop-blur group-hover:bg-white">
            <Icon name="heart" className={`size-5 ${on ? 'fill-current' : ''}`} />
          </span>
        ) : (
          <Icon name="heart" className={`${variant === 'page' ? 'size-[18px]' : 'size-5'} ${on ? 'fill-current' : ''}`} />
        )}
        {variant === 'page' && <span>{on ? t.saved : t.save}</span>}
      </button>
      {state.error && (
        <p role="status" className={`text-xs text-red-700 ${variant === 'page' ? '' : 'sr-only'}`}>
          {state.error}
        </p>
      )}
    </form>
  );
}
