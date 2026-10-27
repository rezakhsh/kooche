'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Icon } from '../../../components/icons';
import { messages } from '../../../messages/fa';
import { saveSearchAction } from '../../my/searches/actions';

// «ذخیره این جستجو» (approved Oct 22, 2026): a form with a server action, so it works without
// JavaScript. Once saved it links to the saved searches. `compact` (wave 1, the result line):
// «خبرم کن», and once saved «خبرتان می‌کنیم» linking to the saved searches.

export function SaveSearchButton({ path, query, saved, compact = false }: { path: string; query: string; saved: boolean; compact?: boolean }) {
  const t = messages.savedSearches;
  const [state, action, pending] = useActionState(saveSearchAction, { saved });
  if (state.saved && compact) {
    return (
      <Link href="/my/searches" title={state.message ?? t.saved} className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold whitespace-nowrap text-brand-800 hover:bg-brand-50">
        <Icon name="check" className="size-4" />
        {t.notifying}
      </Link>
    );
  }
  if (state.saved) {
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-800">
        <Icon name="bell" className="size-4" />
        {state.message ?? t.saved}
        <Link href="/my/searches" className="font-bold underline-offset-2 hover:underline">
          {t.title}
        </Link>
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="query" value={query} />
      <button
        type="submit"
        disabled={pending}
        title={t.saveHint}
        className={`flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 text-sm font-bold whitespace-nowrap text-brand-800 hover:border-brand-400 disabled:opacity-60 ${compact ? 'h-10 rounded-lg px-2.5' : 'px-3 py-1.5'}`}
      >
        <Icon name="bell" className="size-4" />
        {compact ? t.notify : t.save}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
