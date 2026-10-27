import { normalizePersian } from './normalize-persian';

// A day typed in the date field (src/components/date-input.tsx): three selects named
// `{name}.day`, `{name}.month` and `{name}.year`, so it works without JavaScript too. The browser's
// own date input showed «mm/dd/yyyy» from its language, not the page's (wave 1).

/**
 * "2026-12-01" from the three parts; the parts as typed when one is missing (validation then says
 * invalid); the plain field `{name}` when no part was sent; undefined when nothing was typed.
 */
export function dateFromForm(form: FormData, name: string): string | undefined {
  const part = (p: string) => normalizePersian(String(form.get(`${name}.${p}`) ?? '')).trim();
  const [y, m, d] = [part('year'), part('month'), part('day')];
  if (y || m || d) return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : `${y}-${m}-${d}`;
  const plain = form.get(name);
  return typeof plain === 'string' && plain.trim() !== '' ? normalizePersian(plain.trim()) : undefined;
}
