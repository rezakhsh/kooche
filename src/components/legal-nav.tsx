import Link from 'next/link';
import { messages } from '../messages/fa';

// Wave 1, part 8: the legal pages link to each other, so «Impressum، شرایط و حریم خصوصی» (the
// account page, a conversation's ⋯) reaches all of them from the Impressum. `slim` is the one line
// under the posting pages, which have no site footer (globals.css).

export const LEGAL_LINKS = [
  ['impressum', '/impressum'],
  ['terms', '/terms'],
  ['privacy', '/privacy'],
  ['dsa', '/contact#dsa'],
] as const;

type Legal = (typeof LEGAL_LINKS)[number][0];

export function LegalNav({ current }: { current: Legal }) {
  const t = messages.footer;
  return (
    <nav aria-label={t.legalNav} className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
      {LEGAL_LINKS.map(([key, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={key === current ? 'page' : undefined}
          className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm whitespace-nowrap ${key === current ? 'bg-brand-50 font-bold text-brand-800' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
        >
          <bdi>{t.legalLinks[key]}</bdi>
        </Link>
      ))}
    </nav>
  );
}
