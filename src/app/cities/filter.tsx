'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { normalizePersian } from '../../lib/normalize-persian';

// «جستجوی شهر»: hides the rows on the page whose city or country doesn't match (each row carries
// its names in data-names). Hidden through the `hidden` attribute, since the CSP allows no
// injected styles. Without JavaScript the whole list stays.

export function CityFilter({ placeholder }: { placeholder: string }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    const needle = normalizePersian(q.trim()).toLowerCase();
    const root = ref.current?.closest('main');
    root?.querySelectorAll<HTMLElement>('[data-names]').forEach((el) => {
      el.hidden = !!needle && !(el.dataset.names ?? '').includes(needle);
    });
  }, [q]);
  return (
    <label ref={ref} className="flex h-12 items-center gap-2 rounded-xl border border-neutral-300 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
      <Icon name="search" className="size-5 text-neutral-500" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-500"
      />
    </label>
  );
}
