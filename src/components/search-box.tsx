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
  large = false,
  plain = false,
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
  large?: boolean;
  /** No suggestions (the events list searches its own events, wave 1 part 6) */
  plain?: boolean;
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
      {plain ? (
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={placeholder}
          maxLength={100}
          autoComplete="off"
          enterKeyHint="search"
          className="block h-12 w-full rounded-xl border border-neutral-300 bg-white ps-11 pe-3 text-base placeholder:text-neutral-500 focus:border-brand-700 focus:outline-none lg:h-10 lg:text-sm"
        />
      ) : (
        <SearchSuggest id={id} defaultValue={q ?? ''} placeholder={placeholder} country={country} city={city} large={large} />
      )}
      <button type="submit" aria-label={t.submit} title={t.submit} className="absolute inset-y-0 start-0 flex w-11 items-center justify-center text-neutral-600 hover:text-brand-700">
        <Icon name="search" className="size-5" />
      </button>
    </form>
  );
}
