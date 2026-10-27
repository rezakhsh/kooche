import Link from 'next/link';
import type { ReactNode } from 'react';
import { messages } from '../messages/fa';
import type { CardFact } from '../modules/listings/attribute-text';
import { Icon } from './icons';

// One listing in a list of listings (country page; later city pages, search and events reuse
// it). `grid`: photo on top, two or more per row. `list`: a row with the photo at the start.

export type CardData = {
  href: string;
  title: string;
  /** Already formatted ("۲۵۰ €", "توافقی"), or null when the category has no price */
  price: string | null;
  place: { text: string; latin: boolean } | null;
  ago: string | null;
  cover: string | null;
  photoCount: number;
  wanted: boolean;
  /** Up to three of the category's card fields ("۲۰۱۸", "۱۲۰٬۰۰۰ کیلومتر", "دیزل") */
  facts: CardFact[];
  /** "حدود ۳ کیلومتر" when the page measures from a place; never more exact than the stored point */
  distance?: string | null;
  /** A running `featured` entitlement (computed, never stored on the listing) */
  featured?: boolean;
  /** Posted by a founding business while its badge runs */
  founding?: boolean;
};

/** `favorite`: the ♡ button, laid over the card next to the link (a button can't sit inside a link) */
export function ListingCard({ card, view, favorite }: { card: CardData; view: 'grid' | 'list'; favorite?: ReactNode }) {
  const t = messages.country;
  const photo = (
    <div className={`relative overflow-hidden bg-neutral-100 ${view === 'grid' ? 'aspect-[4/3]' : 'aspect-[4/3] w-32 shrink-0 rounded-xl lg:w-44'}`}>
      {card.cover ? (
        <img src={card.cover} alt="" width={480} height={360} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-neutral-400">
          <Icon name="image" className="size-8" />
        </div>
      )}
      {(card.featured || card.founding) && (
        <span className="absolute top-2 start-2 flex flex-col items-start gap-1">
          {card.featured && (
            <span className="flex items-center gap-1 rounded-md bg-saffron-500 px-1.5 text-xs font-bold leading-5 text-neutral-900">
              <Icon name="star" className="size-3" />
              {messages.featured.badge}
            </span>
          )}
          {card.founding && (
            <span title={messages.business.foundingBadgeTitle} className="flex items-center gap-1 rounded-md bg-white/95 px-1.5 text-xs font-bold leading-5 text-saffron-800">
              <Icon name="star" className="size-3" />
              {messages.business.foundingBadge}
            </span>
          )}
        </span>
      )}
      {card.photoCount > 1 && (
        <span className="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-md bg-neutral-900/70 px-1.5 text-xs leading-5 text-white">
          <Icon name="camera" className="size-3" />
          <span className="sr-only">{t.photoCount(card.photoCount)}</span>
          <span aria-hidden>{card.photoCount.toLocaleString('fa-IR')}</span>
        </span>
      )}
    </div>
  );
  const title = (
    <p className={`line-clamp-2 font-bold leading-6 ${view === 'grid' ? 'text-sm text-neutral-900' : 'text-[15px]'}`}>
      {card.wanted && <span className="me-1 rounded-full bg-saffron-50 px-2 py-0.5 text-xs font-bold text-saffron-700">{messages.listing.wanted}</span>}
      {card.title}
    </p>
  );
  const price = card.price && <p className="text-[15px] font-extrabold text-brand-800">{card.price}</p>;
  // Grid cards: price first, the title without an empty band, then place and time (mockup final/browse)
  const body = (
    <div className={`flex min-w-0 flex-1 flex-col ${view === 'grid' ? 'gap-1 p-3' : 'gap-0.5 py-0.5'}`}>
      {view === 'grid' ? (
        <>
          {price}
          {title}
        </>
      ) : (
        <>
          {title}
          {price}
          {card.facts.length > 0 && (
            <p className="truncate text-xs text-neutral-600">
              {card.facts.map((f, i) => (
                <span key={f.label}>
                  {i > 0 && '، '}
                  {/* Counts and yes/no facts already carry their label */}
                  {!f.text.startsWith(f.label) && <span className="sr-only">{f.label}: </span>}
                  <bdi>{f.text}</bdi>
                </span>
              ))}
            </p>
          )}
        </>
      )}
      <p className="mt-auto flex min-w-0 items-center gap-1 pt-1 text-xs text-neutral-600">
        {card.place && (
          <>
            <Icon name="pin" className="size-3.5 shrink-0" />
            <span className="truncate">
              {card.place.latin ? <bdi dir="ltr">{card.place.text}</bdi> : card.place.text}
              {(card.distance || card.ago) && '،'}
            </span>
          </>
        )}
        {card.distance ? <span className="shrink-0 font-bold text-brand-700">{card.distance}</span> : card.ago && <span className="shrink-0">{card.ago}</span>}
      </p>
    </div>
  );
  const link =
    view === 'grid' ? (
      <Link href={card.href} className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-700">
        {photo}
        {body}
      </Link>
    ) : (
      <Link href={card.href} className="flex gap-3 border-b border-neutral-200 py-3 pe-12 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-700">
        {photo}
        {body}
      </Link>
    );
  if (!favorite) return link;
  return (
    <div className="relative h-full">
      {link}
      <div className={`absolute z-10 ${view === 'grid' ? 'top-0.5 end-0.5' : 'top-2 -end-1'}`}>{favorite}</div>
    </div>
  );
}
