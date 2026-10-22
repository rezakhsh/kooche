import { messages } from '../messages/fa';
import { Icon } from './icons';

// The keyword box (approved Oct 22, 2026): a plain GET form, so it works without JavaScript. The
// header's box searches the chosen country; a browse page's own box searches within its city and
// category and keeps the place and filters as hidden fields.

export function SearchBox({
  action,
  q,
  placeholder,
  hidden = [],
  id,
  className = '',
}: {
  action: string;
  q?: string | null;
  placeholder: string;
  /** Other parameters the search keeps (name, value) */
  hidden?: [string, string][];
  /** Unique per page (the box can appear twice) */
  id: string;
  className?: string;
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
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={q ?? ''}
        placeholder={placeholder}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        className="block w-full rounded-xl border border-neutral-300 bg-white py-2 ps-3 pe-10 text-sm placeholder:text-neutral-400 focus:border-brand-700 focus:outline-none"
      />
      <button type="submit" aria-label={t.submit} title={t.submit} className="absolute inset-y-0 end-0 flex items-center px-3 text-neutral-500 hover:text-brand-700">
        <Icon name="search" className="size-[18px]" />
      </button>
    </form>
  );
}
