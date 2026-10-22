import { messages } from '../messages/fa';
import { Icon } from './icons';
import { SearchSuggest } from './search-suggest';

// The keyword box (approved Oct 22, 2026): a plain GET form, so it works without JavaScript. The
// header's box searches the chosen country; a browse page's own box searches within its city and
// category and keeps the place and filters as hidden fields. With JavaScript the input suggests
// where to look while typing (./search-suggest.tsx).

export function SearchBox({
  action,
  q,
  placeholder,
  hidden = [],
  id,
  className = '',
  country,
  city = null,
}: {
  action: string;
  q?: string | null;
  placeholder: string;
  /** Other parameters the search keeps (name, value) */
  hidden?: [string, string][];
  /** Unique per page (the box can appear twice) */
  id: string;
  className?: string;
  /** The country (and city) slugs the suggestions are for */
  country: string;
  city?: string | null;
}) {
  const t = messages.search;
  return (
    <form method="get" action={action} role="search" className={`relative ${className}`}>
      {hidden.map(([name, value]) => (
        <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={id} className="sr-only">
        {t.label}
      </label>
      <SearchSuggest id={id} defaultValue={q ?? ''} placeholder={placeholder} country={country} city={city} />
      <button type="submit" aria-label={t.submit} title={t.submit} className="absolute inset-y-0 end-0 flex items-center px-3 text-neutral-500 hover:text-brand-700">
        <Icon name="search" className="size-[18px]" />
      </button>
    </form>
  );
}
