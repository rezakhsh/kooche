import { headers } from 'next/headers';
import { countries } from '../../seed/countries';
import { messages } from '../messages/fa';
import { viewAsCountry } from '../modules/admin/view-as';
import { endViewAsAction } from '../app/view-as-actions';
import { Icon } from './icons';

// The staff banner while viewing the site as a country (src/modules/admin/view-as.ts; mockup
// final/viewas-banner): on every page, so it is never mistaken for a normal visit, with «پایان».

export async function ViewAsBanner() {
  const code = viewAsCountry(await headers());
  if (!code) return null;
  const name = code === 'IR' ? messages.viewAs.iran : (countries.find((c) => c.code === code)?.nameFa ?? code);
  return (
    <div data-view-as className="bg-saffron-500 text-ink">
      <form action={endViewAsAction} className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm font-bold sm:px-6">
        <Icon name="shield" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{messages.viewAs.banner(name)}</span>
        <button type="submit" className="flex h-8 items-center rounded-lg bg-ink px-3 text-xs text-snow hover:opacity-90">
          {messages.viewAs.end}
        </button>
      </form>
    </div>
  );
}
