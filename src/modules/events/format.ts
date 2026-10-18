import { messages } from '../../messages/fa';
import { formatPrice } from '../listings/price';
import { localParts } from './time';

// How an event's time reads: the Gregorian (miladi) date in Persian, with the weekday first, in
// the time zone of the venue (decided by the owner on Oct 18, 2026: Iranians outside Iran live by
// the Gregorian calendar, and venues and tickets use it). The event page adds the Jalali date as
// a small second line.

// Intl puts the weekday after the year when asked for both, so the weekday and the date are
// formatted apart
const withWeekday = (calendar: 'gregory' | 'persian', timeZone: string) => {
  const weekday = new Intl.DateTimeFormat(`fa-IR-u-ca-${calendar}`, { weekday: 'long', timeZone });
  const date = new Intl.DateTimeFormat(`fa-IR-u-ca-${calendar}`, { dateStyle: 'long', timeZone });
  return { format: (d: Date) => `${weekday.format(d)} ${date.format(d)}` };
};
const gregorian = (timeZone: string) => withWeekday('gregory', timeZone);
const gregorianShort = (timeZone: string) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', timeZone });
const time = (timeZone: string) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });

const sameDay = (a: Date, b: Date, timeZone: string) => {
  const x = localParts(a, timeZone);
  const y = localParts(b, timeZone);
  return x.y === y.y && x.m === y.m && x.d === y.d;
};

/** "شنبه ۱۹ دسامبر ۲۰۲۶، ۲۰:۰۰" */
export function formatEventStart(startsAt: Date, timeZone: string): string {
  return `${gregorian(timeZone).format(startsAt)}، ${time(timeZone).format(startsAt)}`;
}

/** "شنبه ۱۹ دسامبر ۲۰۲۶، ۲۰:۰۰ تا ۲۳:۳۰" or, over several days, "… ۲۰:۰۰ تا یکشنبه ۲۰ دسامبر ۲۰۲۶، ۱۸:۰۰" */
export function formatEventWhen(startsAt: Date, endsAt: Date, timeZone: string): string {
  const start = formatEventStart(startsAt, timeZone);
  // A night that ends in the early morning still reads as one evening
  const overnight = !sameDay(startsAt, endsAt, timeZone) && endsAt.getTime() - startsAt.getTime() < 12 * 3_600_000;
  const end = sameDay(startsAt, endsAt, timeZone) || overnight
    ? time(timeZone).format(endsAt)
    : `${gregorian(timeZone).format(endsAt)}، ${time(timeZone).format(endsAt)}`;
  return `${start} تا ${end}`;
}

/** The Jalali reading, for the event page's second line: "شنبه ۲۸ آذر ۱۴۰۵" */
export function formatJalaliDate(date: Date, timeZone: string): string {
  return withWeekday('persian', timeZone).format(date);
}

/** For the date badge on a card: day and month ("۱۹ دسامبر"), weekday and the start time */
export function cardDate(startsAt: Date, timeZone: string): { day: string; weekday: string; time: string } {
  return {
    day: gregorianShort(timeZone).format(startsAt),
    weekday: new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { weekday: 'long', timeZone }).format(startsAt),
    time: time(timeZone).format(startsAt),
  };
}

/** The short name of a time zone at a moment ("CET", "CEST") */
export function zoneName(date: Date, timeZone: string): string {
  return (
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName')
      ?.value ?? timeZone
  );
}

/** "ورود رایگان", "بلیت از ۱۵ €" or "قیمت در محل یا متغیر" */
export function eventPriceText(
  priceType: string,
  amount: { minor: number; currency: string; minorUnit: number } | null,
): string | null {
  const t = messages.events.price;
  if (priceType === 'free') return t.free;
  if (priceType === 'fixed' && amount) return t.from(formatPrice(amount.minor, amount.currency, amount.minorUnit));
  if (priceType === 'on_request') return t.at_door;
  return null;
}
