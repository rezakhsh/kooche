'use client';

import { useEffect, useRef, useState } from 'react';
import { messages } from '../../../messages/fa';

// The filter form's button, «نمایش ۲۳ آگهی» (wave 1, mockup final/filters): it starts with the
// page's own count, which matches the form as sent, and follows each change of the form with the
// count it would show (/api/search/count, src/modules/search/form-count.ts). Without JavaScript it
// keeps the first count; a failed count shows the plain «نمایش نتایج».

const WAIT_MS = 350;

export function FilterSubmit({ path, count, capped }: { path: string; count: number; capped: boolean }) {
  const t = messages.browse;
  const ref = useRef<HTMLButtonElement>(null);
  const [label, setLabel] = useState(t.showCount(count, capped));
  const [none, setNone] = useState(count === 0);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        controller?.abort();
        controller = new AbortController();
        const query = new URLSearchParams();
        query.set('p', path);
        for (const [k, v] of new FormData(form)) if (typeof v === 'string' && v !== '') query.append(k, v);
        try {
          const res = await fetch(`/api/search/count?${query}`, { signal: controller.signal });
          const body = (await res.json()) as { count: number | null; capped?: boolean };
          if (!res.ok || body.count === null) throw new Error('no count');
          setLabel(t.showCount(body.count, !!body.capped));
          setNone(body.count === 0);
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setLabel(t.apply);
          setNone(false);
        }
      }, WAIT_MS);
    };
    form.addEventListener('change', update);
    form.addEventListener('input', update);
    return () => {
      clearTimeout(timer);
      controller?.abort();
      form.removeEventListener('change', update);
      form.removeEventListener('input', update);
    };
  }, [path, t]);

  return (
    <button
      ref={ref}
      type="submit"
      aria-live="polite"
      className={`flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold ${none ? 'bg-neutral-200 text-neutral-700' : 'bg-brand-700 text-white hover:bg-brand-800'}`}
    >
      {label}
    </button>
  );
}
