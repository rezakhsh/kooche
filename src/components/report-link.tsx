import Link from 'next/link';
import { faDigits, messages } from '../messages/fa';
import { Icon } from './icons';

// The report button on listing, event, seller and business pages (DSA art. 16), and the listing
// code shown next to it («کد آگهی», like Kleinanzeigen's Anzeigen-ID).

export function ReportLink({ kind, id, label }: { kind: 'listing' | 'user' | 'business'; id: string; label: string }) {
  return (
    <Link
      href={`/report?${new URLSearchParams({ t: kind, id })}`}
      rel="nofollow"
      prefetch={false}
      className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 hover:underline"
    >
      <Icon name="flag" className="size-4" />
      {label}
    </Link>
  );
}

export function ListingCode({ value, label = messages.listingCode }: { value: number; label?: string }) {
  return (
    <span className="text-sm text-neutral-500">
      {label}: <bdi className="font-medium text-neutral-700 tabular-nums select-all">{faDigits(String(value))}</bdi>
    </span>
  );
}

/** The line at the end of a listing or event page: its code, and the report button for visitors */
export function ListingFooter({ refNumber, token, isOwner, isEvent }: { refNumber: number; token: string; isOwner: boolean; isEvent: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-4">
      {/* An event's page says «کد رویداد» and a short «گزارش» (wave 1, mockup final/event) */}
      <ListingCode value={refNumber} label={isEvent ? messages.events.view.code : undefined} />
      {!isOwner && <ReportLink kind="listing" id={token} label={isEvent ? messages.events.view.report : messages.report.button.listing} />}
    </div>
  );
}
