// Dates in the interface: the Gregorian calendar with Persian month names and digits, through the
// built-in Intl API (no date library). Iranians abroad can't convert Jalali easily (owner, Oct
// 2026); Jalali appears only as a second label on cultural dates (Nowruz, Yalda). Storage stays
// timestamptz in UTC; this is display only.

const LOCALE = 'fa-IR-u-ca-gregory';

/** "۸ نوامبر ۲۰۲۶" */
export function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeZone }).format(date);
}

/** "۸ نوامبر ۲۰۲۶ ساعت ۱۴:۳۰" */
export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date);
}

/** "۲ ساعت پیش", "دیروز", "۳ روز پیش" for the first week; then "۶ اکتبر" (with the year if another) */
export function formatAgo(date: Date, timeZone: string, now = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
  if (seconds < 3600) return rtf.format(-Math.max(1, Math.floor(seconds / 60)), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  if (seconds < 7 * 86_400) return rtf.format(-Math.floor(seconds / 86_400), 'day');
  const year = (d: Date) => new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(d);
  if (year(date) !== year(now)) return formatDate(date, timeZone);
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone }).format(date);
}

/** "اکتبر ۲۰۲۶" */
export function formatMonth(date: Date, timeZone: string): string {
  // Built from parts, so the month always comes first
  const parts = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')} ${part('year')}`;
}
