import Link from 'next/link';
import { messages } from '../messages/fa';

// A row's title with «همه ←» at its end (wave 1 polish, owner's choice on Oct 27, 2026): one style
// for every row on the first and city pages, so the way to "more" is always in the same place.

export function SectionTitle({ title, href, more = messages.site.seeAll, className = '' }: { title: string; href?: string; more?: string; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-bold text-brand-700 hover:underline">
          {more} ←
        </Link>
      )}
    </div>
  );
}
