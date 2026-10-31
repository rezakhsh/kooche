import Link from 'next/link';
import { messages } from '../messages/fa';
import { Icon } from './icons';
import { cardDate } from '../modules/events/format';
import { eventPath } from '../modules/events/slug';

// One event in a list: poster, the date line (weekday, Gregorian day and month, time at the venue;
// under the poster, never on it: it covered the poster's own text, design check Oct 31, 2026),
// title, where, price, and a label when it is online, postponed or cancelled.

export type EventCardData = {
  title: string;
  publicToken: string;
  startsAt: Date;
  timeZone: string;
  where: string | null;
  price: string | null;
  attendance: string;
  scheduleStatus: string;
  moreDates: number;
  cover: string | null;
  /** A running `featured` entitlement (roadmap step 6) */
  featured?: boolean;
};

export function EventCard({ e }: { e: EventCardData }) {
  const t = messages.events;
  const when = cardDate(e.startsAt, e.timeZone);
  const label =
    e.scheduleStatus !== 'scheduled'
      ? t.scheduleStatus[e.scheduleStatus as 'postponed' | 'cancelled']
      : e.attendance === 'online'
        ? t.card.online
        : e.attendance === 'hybrid'
          ? t.card.hybrid
          : null;
  return (
    <Link href={eventPath(e.title, e.publicToken)} className="block overflow-hidden rounded-2xl border border-neutral-200 hover:bg-neutral-50">
      <div className="relative aspect-[4/5] bg-neutral-100">
        {e.cover && <img src={e.cover} alt="" width={480} height={600} loading="lazy" decoding="async" className="size-full object-cover" />}
        {e.featured && (
          <span className="absolute start-2 bottom-2 flex items-center gap-1 rounded-md bg-saffron-500 px-1.5 text-xs font-bold leading-5 text-ink">
            <Icon name="star" className="size-3" />
            {messages.featured.badge}
          </span>
        )}
        {label && (
          <span
            className={`absolute end-2 top-2 rounded-md px-2 py-0.5 text-xs font-semibold ${e.scheduleStatus === 'scheduled' ? 'bg-brand-700 text-white' : 'bg-danger text-snow'}`}
          >
            {label}
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs font-bold text-brand-800">{t.card.when(when.weekday, when.day, when.time)}</p>
        <p className="line-clamp-2 text-sm font-semibold">{e.title}</p>
        {e.where && <p className="truncate text-xs text-neutral-500">{e.where}</p>}
        {e.price && <p className="text-xs text-neutral-700">{e.price}</p>}
        {e.moreDates > 0 && <p className="text-xs text-neutral-500">{t.card.moreDates(e.moreDates)}</p>}
      </div>
    </Link>
  );
}
