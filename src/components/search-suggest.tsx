'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { messages } from '../messages/fa';
import type { Suggestion } from '../modules/search/suggest';
import { Icon } from './icons';

// The keyword input with suggestions while typing (approved Oct 22, 2026; rows from
// src/modules/search/suggest.ts through /api/search/suggest). An ARIA combobox: arrow keys move
// through the rows, Enter opens the highlighted one or submits the form as typed, Escape closes,
// every row is a real link. Without JavaScript the input is a plain field of the GET form.

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

const LINK = 'flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-800';

export function SearchSuggest({
  id,
  defaultValue,
  placeholder,
  country,
  city,
}: {
  id: string;
  defaultValue: string;
  placeholder: string;
  country: string;
  city: string | null;
}) {
  const t = messages.search;
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(timer.current);
    request.current?.abort();
  }, []);

  const load = (text: string) => {
    clearTimeout(timer.current);
    request.current?.abort();
    if (text.replace(/[\s‌]/g, '').length < MIN_CHARS) {
      setRows([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      request.current = ctrl;
      const params = new URLSearchParams({ country, q: text, ...(city ? { city } : {}) });
      try {
        const res = await fetch(`/api/search/suggest?${params}`, { signal: ctrl.signal });
        const body = res.ok ? ((await res.json()) as { rows: Suggestion[] }) : { rows: [] };
        setRows(body.rows);
        setActive(-1);
        setOpen(body.rows.length > 0);
      } catch {
        // Aborted by newer typing, or offline: the form still works as typed
      }
    }, DEBOUNCE_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape closes the list; only a second one clears the field (the browser's own behaviour)
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open || rows.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // -1 is the input itself: past the last row comes back to it, and up from it goes to the last
      setActive((a) => {
        const next = a + step;
        return next < -1 ? rows.length - 1 : next >= rows.length ? -1 : next;
      });
    } else if (e.key === 'Enter' && active >= 0 && rows[active]) {
      e.preventDefault();
      setOpen(false);
      router.push(rows[active]!.href);
    }
  };

  return (
    <>
      <input
        id={id}
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          load(e.target.value);
        }}
        onFocus={() => rows.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        className="block w-full rounded-xl border border-neutral-300 bg-white py-2 ps-3 pe-10 text-sm placeholder:text-neutral-400 focus:border-brand-700 focus:outline-none"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={t.suggestions}
        hidden={!open}
        // Keep the focus in the input while a row is pressed
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
      >
        {rows.map((r, i) => (
          <li key={r.href} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'bg-brand-50' : 'hover:bg-neutral-50'}>
            <Link href={r.href} prefetch={false} onClick={() => setOpen(false)} className={LINK}>
              <Row r={r} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Row({ r }: { r: Suggestion }) {
  const t = messages.search;
  switch (r.kind) {
    case 'search':
      return (
        <>
          <Icon name="search" className="size-4 shrink-0 text-neutral-400" />
          <span className="min-w-0 truncate">
            <b>{r.q}</b> <span className="text-neutral-500">{r.where ? t.inPlace(r.where) : t.inAll}</span>
          </span>
        </>
      );
    case 'in':
      return (
        <>
          <Icon name="search" className="size-4 shrink-0 text-neutral-400" />
          <span className="min-w-0 truncate">
            <b>{r.q}</b> <span className="text-neutral-500">{t.inPlace(r.where)}</span>
          </span>
          <span className="ms-auto shrink-0 text-xs text-neutral-500">{t.matches(r.count)}</span>
        </>
      );
    case 'category':
      return (
        <>
          <Icon name="grid" className="size-4 shrink-0 text-brand-700" />
          <span className="min-w-0 truncate font-medium">{r.label}</span>
          {r.parent && <span className="ms-auto shrink-0 text-xs text-neutral-500">{r.parent}</span>}
        </>
      );
    case 'field':
      return (
        <>
          <Icon name="sliders" className="size-4 shrink-0 text-brand-700" />
          <span className="min-w-0 truncate font-medium">{r.label}</span>
          <span className="ms-auto shrink-0 text-xs text-neutral-500">{t.inPlace(r.where)}</span>
        </>
      );
  }
}
