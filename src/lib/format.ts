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
