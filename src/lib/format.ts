// Dates in the interface: Jalali calendar with Persian digits, through the built-in Intl API
// (no date library). Storage stays timestamptz in UTC; this is display only.

const LOCALE = 'fa-IR-u-ca-persian';

/** "۲۵ مهر ۱۴۰۵" */
export function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeZone }).format(date);
}

/** "۲۵ مهر ۱۴۰۵، ۱۴:۳۰" */
export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date);
}

/** "۲ ساعت پیش", "دیروز", "۳ هفته پیش" for listing cards; a date after about two months */
export function formatAgo(date: Date, timeZone: string, now = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
  if (seconds < 3600) return rtf.format(-Math.max(1, Math.floor(seconds / 60)), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  if (seconds < 7 * 86_400) return rtf.format(-Math.floor(seconds / 86_400), 'day');
  if (seconds < 60 * 86_400) return rtf.format(-Math.floor(seconds / (7 * 86_400)), 'week');
  return formatDate(date, timeZone);
}

/** "مهر ۱۴۰۵" */
export function formatMonth(date: Date, timeZone: string): string {
  // Built from parts: ICU puts the year first ("۱۴۰۵ مهر"), which reads oddly
  const parts = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')} ${part('year')}`;
}
