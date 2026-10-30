import { BrowseLink as Link } from '../../../components/browse-link';
import { Icon } from '../../../components/icons';
import { messages } from '../../../messages/fa';
import type { OnlineCounts } from '../../../modules/listings/online';

// The link to «آنلاین از همه‌جا» (wave 2 part 6, ../online/page.tsx) on a country's pages, in the
// shape of the «این هفته در برلین» strip above it, on brand instead of saffron: what the online
// page holds on the first page, what other countries add on a services, lessons or jobs page and
// under a search.

const t = messages.online.link;

/** «۱۲ رویداد، ۳۴ خدمت و کلاس، ۵ کار دورکاری», without the empty ones */
export function onlineSummary(c: OnlineCounts): string {
  return t.counts([c.events ? t.events(c.events) : '', c.services ? t.services(c.services) : '', c.jobs ? t.jobs(c.jobs) : ''].filter(Boolean));
}

/** `category`: a services, lessons or jobs category the page opens on; `q`: a search it repeats */
export function OnlineLink({ country, text, category, q, className = 'mb-3' }: { country: string; text: string; category?: string | null; q?: string | null; className?: string }) {
  const query = new URLSearchParams([...(category ? [['c', category]] : []), ...(q ? [['q', q]] : [])]).toString();
  return (
    <Link href={`/${country}/online${query ? `?${query}` : ''}`} className={`flex items-center gap-3 rounded-2xl bg-brand-50 p-2.5 hover:bg-brand-100/70 ${className}`}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">
        <Icon name="globe" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-brand-800">{t.title}</span>
        <span className="block truncate text-sm font-bold">{text}</span>
      </span>
      <Icon name="chevronEnd" className="size-4 shrink-0 text-brand-700" />
    </Link>
  );
}
