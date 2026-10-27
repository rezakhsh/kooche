'use client';

import { useState } from 'react';
import { messages } from '../messages/fa';

// A day as day / Persian month name / year (wave 1, mockup final/post3): the browser's own date
// input shows «mm/dd/yyyy» from the browser's language, not the page's. Three selects named
// `{name}.day`, `{name}.month`, `{name}.year`, so it works without JavaScript; the server reads
// them with dateFromForm() (src/lib/date-parts.ts). `quick` adds «از همین حالا» and «اول ماه بعد»
// (move-in dates).

const selectClass =
  'block w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

type Parts = { y: string; m: string; d: string };

const partsOf = (value: string): Parts => {
  const [y = '', m = '', d = ''] = value.split('-');
  return { y, m: m ? String(Number(m)) : '', d: d ? String(Number(d)) : '' };
};

const isoOf = (p: Parts) => (p.y && p.m && p.d ? `${p.y}-${p.m.padStart(2, '0')}-${p.d.padStart(2, '0')}` : '');

const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });

/** «سه‌شنبه، ۱ دسامبر ۲۰۲۶»; empty for a day that doesn't exist (31 February) */
function dayInWords(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  if (date.getUTCMonth() !== m! - 1) return '';
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: 'UTC', ...o }).format(date);
  return `${f({ weekday: 'long' })}، ${f({ dateStyle: 'long' })}`;
}

export function DateInput({
  label,
  name,
  defaultValue = '',
  onChange,
  quick = false,
  years = { before: 1, after: 3 },
  showDay = false,
}: {
  label: string;
  name: string;
  /** "2026-12-01", or empty */
  defaultValue?: string;
  /** The full day ("2026-12-01"), or "" while a part is missing */
  onChange?: (value: string) => void;
  quick?: boolean;
  /** Years offered around this year; a stored year outside them is added */
  years?: { before: number; after: number };
  /** The chosen day in words under the field, «سه‌شنبه، ۱ دسامبر ۲۰۲۶» (mockup final/post3) */
  showDay?: boolean;
}) {
  const t = messages.form;
  const [parts, setParts] = useState<Parts>(() => partsOf(defaultValue));
  const set = (next: Parts) => {
    setParts(next);
    onChange?.(isoOf(next));
  };
  const now = new Date();
  const thisYear = now.getFullYear();
  const yearList = Array.from({ length: years.before + years.after + 1 }, (_, i) => String(thisYear - years.before + i));
  if (parts.y && !yearList.includes(parts.y)) yearList.unshift(parts.y);
  const pick = (date: Date) => set({ y: String(date.getFullYear()), m: String(date.getMonth() + 1), d: String(date.getDate()) });

  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-bold">{label}</legend>
      <div className="grid grid-cols-[1fr_2fr_1.4fr] gap-2">
        <select name={`${name}.day`} value={parts.d} onChange={(e) => set({ ...parts, d: e.target.value })} aria-label={t.day} className={selectClass}>
          <option value="">{t.day}</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={String(i + 1)}>
              {fa(i + 1)}
            </option>
          ))}
        </select>
        <select name={`${name}.month`} value={parts.m} onChange={(e) => set({ ...parts, m: e.target.value })} aria-label={t.month} className={selectClass}>
          <option value="">{t.month}</option>
          {t.months.map((month, i) => (
            <option key={month} value={String(i + 1)}>
              {month}
            </option>
          ))}
        </select>
        <select name={`${name}.year`} value={parts.y} onChange={(e) => set({ ...parts, y: e.target.value })} aria-label={t.year} className={selectClass}>
          <option value="">{t.year}</option>
          {yearList.map((y) => (
            <option key={y} value={y}>
              {fa(Number(y))}
            </option>
          ))}
        </select>
      </div>
      {showDay && isoOf(parts) && <p className="mt-1 text-xs text-neutral-600">{dayInWords(isoOf(parts))}</p>}
      {quick && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => pick(now)} className="min-h-9 rounded-full border border-neutral-300 px-3 text-sm hover:bg-neutral-50">
            {t.fromNow}
          </button>
          <button
            type="button"
            onClick={() => pick(new Date(now.getFullYear(), now.getMonth() + 1, 1))}
            className="min-h-9 rounded-full border border-neutral-300 px-3 text-sm hover:bg-neutral-50"
          >
            {t.nextMonth}
          </button>
        </div>
      )}
    </fieldset>
  );
}
