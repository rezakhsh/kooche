import Link from 'next/link';
import { Icon } from '../../components/icons';
import { messages } from '../../messages/fa';

// The posting pages' own bar (wave 1, mockups final/post1–post4): ✕, «ثبت آگهی» and the category
// under it, instead of the site's header and footer (globals.css hides them while this bar is on
// the page). The category links to changing it while the listing is a draft. Events (part 6) pass
// their own title, «رویداد تازه», with the event's title under it.

export function PostingBar({ category, changeHref, closeHref = '/my/listings', title }: { category?: string; changeHref?: string; closeHref?: string; title?: string }) {
  const t = messages.post;
  return (
    <div data-app-bar className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
        <Link href={closeHref} aria-label={t.close} title={t.close} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-800 hover:bg-neutral-50">
          <Icon name="close" className="size-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold">{title ?? t.title}</p>
          {category &&
            (changeHref ? (
              <Link href={changeHref} className="block truncate text-xs text-neutral-600 hover:underline">
                {category}
              </Link>
            ) : (
              <p className="truncate text-xs text-neutral-600">{category}</p>
            ))}
        </div>
      </div>
    </div>
  );
}
