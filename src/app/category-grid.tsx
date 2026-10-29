import Link from 'next/link';
import { categoryIcon, Icon } from '../components/icons';
import { messages } from '../messages/fa';
import { EVENT_ROOT_SLUG, type Catalog } from '../modules/listings/catalog';
import { browsePath, eventsPath } from '../modules/search/paths';

// The first page's row of top categories (mockup final/home), events first in saffron so people
// find them at once (owner, Oct 27, 2026); also on a country's starter page (wave 2 part 8).

export function CategoryGrid({ catalog, country }: { catalog: Catalog; country: string }) {
  const t = messages.home;
  // The mockup's order and short names («دیجیتال», «خانه»), the rest after them
  const order = Object.keys(t.categoryShort);
  const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
  const roots = catalog.rootIds
    .map((id) => catalog.byId.get(id)!)
    .filter((c) => c.isActive && c.slug !== EVENT_ROOT_SLUG)
    .sort((a, b) => rank(a.slug) - rank(b.slug));
  return (
    <ul className="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-8">
      <li>
        <Link href={eventsPath(country, null)} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-bold hover:bg-saffron-50">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-saffron-100 text-saffron-800 ring-1 ring-saffron-300 ring-inset">
            <Icon name="calendar" className="size-6" />
          </span>
          {messages.events.section}
        </Link>
      </li>
      {roots.slice(0, 7).map((c) => (
        <li key={c.id}>
          <Link href={browsePath(country, null, c.slug)} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium hover:bg-neutral-50">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Icon name={categoryIcon(c.slug)} className="size-6" />
            </span>
            {t.categoryShort[c.slug] ?? c.nameFa}
          </Link>
        </li>
      ))}
    </ul>
  );
}
