'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from '../../components/icons';
import { normalizePersian } from '../../lib/normalize-persian';
import { messages } from '../../messages/fa';

// Posting, step 1 (wave 1, mockup final/post1): a search over the category names with
// suggestions; one tap on a suggestion opens its form. A plain GET form (?q=) without JavaScript,
// where the page lists the same matches.

export type Pickable = { slug: string; nameFa: string; parentFa: string; search: string };

export const MAX_SUGGESTIONS = 6;

/** Leaves whose name or parent's name contains every typed word (normalized Persian) */
export function matchCategories(all: Pickable[], q: string): Pickable[] {
  const words = normalizePersian(q).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return all.filter((c) => words.every((w) => c.search.includes(w))).slice(0, MAX_SUGGESTIONS);
}

export function CategorySearch({ all, initial }: { all: Pickable[]; initial: string }) {
  const t = messages.post;
  const [q, setQ] = useState(initial);
  const found = useMemo(() => matchCategories(all, q), [all, q]);
  return (
    <form method="get" action="/new" role="search">
      <label htmlFor="category-q" className="sr-only">
        {t.searchCategory}
      </label>
      <span className="flex h-14 items-center gap-2 rounded-2xl border-2 border-brand-600 px-4 focus-within:ring-2 focus-within:ring-brand-600/20">
        <Icon name="search" className="size-5 text-neutral-500" />
        <input
          id="category-q"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchCategoryPlaceholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </span>
      {q.trim() !== '' && (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/60" aria-live="polite">
          {found.length === 0 && <li className="px-4 py-3 text-sm text-neutral-700">{t.noCategoryFound}</li>}
          {found.map((c) => (
            <li key={c.slug} className="border-b border-brand-100 last:border-0">
              <Link href={`/new/${c.slug}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-brand-50">
                <span className="flex-1">
                  <b className="block text-[15px]">{c.nameFa}</b>
                  <span className="text-xs text-neutral-600">{t.inParent(c.parentFa)}</span>
                </span>
                <Icon name="chevronEnd" className="size-5 text-neutral-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
