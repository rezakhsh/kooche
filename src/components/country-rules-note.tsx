import Link from 'next/link';
import { messages } from '../messages/fa';
import { Icon } from './icons';

// The one line on a country's pages and in the posting picker that explains why some categories
// are missing there (src/modules/listings/country-rules.ts: Turkey, owner Nov 5, 2026). No mockup:
// styled like the saffron +98 line on the phone page, with a link to the country's terms section.

export function CountryRulesNote({ className = '' }: { className?: string }) {
  const t = messages.countryRules;
  return (
    <p data-country-rules className={`flex items-start gap-2 rounded-xl bg-saffron-50 px-3 py-2.5 text-sm leading-7 text-saffron-800 ${className}`}>
      <Icon name="shield" className="mt-1.5 size-4 shrink-0" />
      <span>
        {t.closedNote}{' '}
        <Link href="/terms#s17" className="font-bold underline">
          {t.rulesLink}
        </Link>
      </span>
    </p>
  );
}
