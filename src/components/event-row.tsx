import Link from 'next/link';
import { messages } from '../messages/fa';
import { eventPath } from '../modules/events/slug';
import { FavoriteButton } from './favorite-button';
import { Icon } from './icons';

// One event in the list (wave 1, mockup final/events eventRow): the poster small and upright
// (4:5, as organisers make them for Instagram), «پنجشنبه، ۲۹ اکتبر، ساعت ۱۹:۰۰» with the season's
// tag, the title, where, the price (free in green), how many dates and how many saved it, and the
// ♡. `featured`: the paid «ویژه» card above the list, wider and on saffron.

export type EventRowData = {
  id: string;
  title: string;
  publicToken: string;
  /** «پنجشنبه، ۲۹ اکتبر» and «۱۹:۰۰», at the venue */
  day: string;
  time: string;
  /** The date badge on the featured card: «۱۹» and «دسامبر» */
  badge: { day: string; month: string };
  where: string | null;
  online: boolean;
  price: string | null;
  free: boolean;
  dates: number;
  going: number;
  season: string | null;
  organizer: string | null;
  organizerVerified: boolean;
  scheduleStatus: string;
  typeName: string | null;
  cover: string | null;
  saved: boolean;
};

/** Shown under this many, a count of people says little */
const GOING_FROM = 3;

export function Poster({ e, className = '' }: { e: Pick<EventRowData, 'cover' | 'typeName' | 'title'>; className?: string }) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden bg-brand-900 ${className}`}>
      {e.cover ? (
        <img src={e.cover} alt="" width={240} height={300} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        // No poster yet: the title on the brand's colour, like a typographic poster
        <div className="flex size-full flex-col justify-between p-[8%] text-white">
          <span className="text-[0.65em] font-bold opacity-80">{e.typeName}</span>
          <span className="line-clamp-4 text-[0.95em] font-black leading-[1.35]">{e.title}</span>
        </div>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  if (status === 'scheduled') return null;
  return <span className="ms-1 rounded-full bg-red-50 px-1.5 text-red-700">{messages.events.scheduleStatus[status as 'postponed' | 'cancelled']}</span>;
}

export function EventRow({ e, back }: { e: EventRowData; back: string }) {
  const t = messages.events.list;
  return (
    <div className="relative flex gap-3 py-3">
      <Link href={eventPath(e.title, e.publicToken)} className="w-24 shrink-0 overflow-hidden rounded-xl text-[9px] lg:w-28" tabIndex={-1} aria-hidden>
        <Poster e={e} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-brand-800">
          {e.day}، {t.at(e.time)}
          {e.season && <span className="ms-1 rounded-full bg-saffron-100 px-1.5 text-saffron-800">{e.season}</span>}
          <StatusTag status={e.scheduleStatus} />
        </p>
        <Link href={eventPath(e.title, e.publicToken)} className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-6 after:absolute after:inset-0 hover:underline">
          {e.title}
        </Link>
        {e.where && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-600">
            <Icon name={e.online ? 'globe' : 'pin'} className="size-3.5 shrink-0" />
            <span className="truncate">{e.where}</span>
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {e.price && <b className={e.free ? 'text-green-800' : 'text-neutral-900'}>{e.price}</b>}
          {e.dates > 1 && <span className="rounded-full bg-brand-50 px-2 font-bold leading-5 text-brand-800">{t.dates(e.dates)}</span>}
          {e.going >= GOING_FROM && <span className="text-neutral-600">{t.going(e.going)}</span>}
        </p>
      </div>
      <div className="relative z-10 shrink-0 self-start">
        <FavoriteButton token={e.publicToken} saved={e.saved} back={back} />
      </div>
    </div>
  );
}

export function FeaturedEvent({ e }: { e: EventRowData }) {
  return (
    <Link href={eventPath(e.title, e.publicToken)} className="flex gap-3 rounded-2xl border border-saffron-100 bg-saffron-50 p-3 hover:bg-saffron-100/60">
      <div className="relative w-32 shrink-0 overflow-hidden rounded-xl text-[11px] lg:w-40">
        <Poster e={e} />
        <span className="absolute start-2 top-2 rounded-xl bg-white/95 px-2 py-1 text-center leading-tight shadow-sm">
          <b className="block text-base">{e.badge.day}</b>
          <span className="block text-xs text-neutral-700">{e.badge.month}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-saffron-800">
          {e.day}، {e.time}
        </p>
        <p className="mt-1 text-base font-extrabold leading-7">{e.title}</p>
        {e.where && <p className="mt-1 text-xs text-neutral-700">{e.where}</p>}
        {e.price && <p className="mt-2 text-sm font-bold">{e.price}</p>}
        {e.organizer && (
          <p className="mt-1 flex items-center gap-1 text-xs text-neutral-700">
            {e.organizerVerified && <Icon name="verified" className="size-3.5 text-brand-700" />}
            {e.organizer}
          </p>
        )}
      </div>
    </Link>
  );
}
