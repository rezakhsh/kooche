import Link from 'next/link';
import { chosenCountry } from '../app/country-choice';
import { appDb } from '../db/drizzle';
import { messages } from '../messages/fa';
import { unreadConversations } from '../modules/chat/queries';
import { activeCountries } from '../modules/listings/queries';
import { currentSession } from '../modules/users/server';
import { BottomNav } from './bottom-nav';
import { Icon } from './icons';
import { LogoMark } from './logo';
import { SearchBox } from './search-box';

// The header on every page: the logo with its line, the chosen country (the way back to the list
// of countries), on computers the keyword box and the main actions. On phones the actions are in
// the bottom bar (approved Oct 17, 2026) and the keyword box is on the browse pages, so the header
// stays one short row with a search button that leads there. Nothing in the row ever wraps: the
// keyword box gives way first, and below 1280 px chat, my listings and account are icons (with
// their names as tooltips and for screen readers).

export async function SiteHeader() {
  const [session, country] = await Promise.all([currentSession(), chosenCountry(appDb())]);
  const t = messages.nav;
  const home = country ? `/${country.slug}` : '/';
  // Conversations with unread messages, for the badge (one small query on the inbox indexes)
  const unread = session ? await unreadConversations(appDb(), session.user.id) : 0;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href={home} className="flex shrink-0 items-center gap-2.5" aria-label={messages.site.logoAlt}>
            <LogoMark className="size-9" />
            <span className="flex flex-col">
              <span className="text-xl font-black leading-none">{messages.site.name}</span>
              <span className="mt-1 hidden text-[11px] leading-none whitespace-nowrap text-neutral-500 lg:block">{messages.site.tagline}</span>
            </span>
          </Link>
          {country && (
            <Link
              href="/?choose"
              className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-1 ps-2 pe-3 text-xs font-medium whitespace-nowrap text-neutral-700 hover:border-brand-300"
              title={messages.country.change}
            >
              <Icon name="pin" className="size-3.5 text-brand-700" />
              {country.nameFa}
            </Link>
          )}
          {country && (
            <SearchBox
              id="header-q"
              action={`/${country.slug}`}
              country={country.slug}
              placeholder={messages.search.placeholderIn(country.nameFa)}
              className="ms-auto hidden min-w-0 max-w-sm flex-1 lg:block"
            />
          )}
          <nav aria-label={t.label} className={`${country ? '' : 'ms-auto'} hidden shrink-0 items-center gap-1 whitespace-nowrap sm:flex xl:gap-2`}>
            {session && (
              <Link href="/chat" title={t.chat} className="relative flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium hover:bg-neutral-50 xl:px-3">
                <Icon name="chat" className="size-[18px] xl:size-4" />
                <Label text={t.chat} />
                <UnreadBadge count={unread} />
              </Link>
            )}
            {session && (
              <Link href="/my/favorites" aria-label={messages.favorites.title} title={messages.favorites.title} className="flex items-center rounded-xl px-2.5 py-2 hover:bg-neutral-50">
                <Icon name="heart" className="size-[18px]" />
              </Link>
            )}
            {session && (
              <Link href="/my/listings" title={t.myListings} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium hover:bg-neutral-50 xl:px-3">
                <Icon name="doc" className="size-[18px] xl:size-4" />
                <Label text={t.myListings} />
              </Link>
            )}
            <Link
              href={session ? '/account' : '/login'}
              title={session ? t.account : undefined}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-2.5 py-2 text-sm font-medium hover:bg-neutral-50 xl:px-3"
            >
              <Icon name="user" className="size-4" />
              {session ? <Label text={t.account} /> : t.signIn}
            </Link>
            <Link href="/new" className="flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">
              <Icon name="plus" className="size-4" />
              {t.post}
            </Link>
          </nav>
          {country && (
            <Link
              href={`/${country.slug}#q`}
              aria-label={messages.search.label}
              title={messages.search.label}
              className="ms-auto flex items-center rounded-xl p-2 text-neutral-700 hover:bg-neutral-50 lg:hidden"
            >
              <Icon name="search" className="size-5" />
            </Link>
          )}
          {!session && (
            <Link href="/login" className={`${country ? '' : 'ms-auto'} rounded-xl border border-neutral-200 px-3 py-1.5 text-sm font-medium sm:hidden`}>
              {t.signIn}
            </Link>
          )}
        </div>
      </header>
      <BottomNav home={home} signedIn={!!session} unread={unread} />
    </>
  );
}

/** A nav label shown from 1280 px; below, the icon stands alone and the label is for screen readers */
function Label({ text }: { text: string }) {
  return (
    <>
      <span className="hidden xl:inline">{text}</span>
      <span className="sr-only xl:hidden">{text}</span>
    </>
  );
}

export function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron-500 px-1 text-[11px] font-bold text-neutral-900 ${className}`}>
      <span aria-hidden>{count > 99 ? '۹۹+' : count.toLocaleString('fa-IR')}</span>
      <span className="sr-only">{messages.nav.unread(count)}</span>
    </span>
  );
}

const FOOTER_LINKS = [
  ['help', '/help'],
  ['safety', '/safety'],
  ['contact', '/contact'],
  ['terms', '/terms'],
  ['privacy', '/privacy'],
  ['impressum', '/impressum'],
] as const satisfies readonly (readonly [keyof typeof messages.footer.links, string])[];

export async function SiteFooter() {
  const countries = await activeCountries(appDb());
  return (
    <footer className="mt-12 border-t border-neutral-200 bg-neutral-50 pb-20 sm:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-neutral-600 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark className="size-8" />
          <div>
            <p className="font-bold text-neutral-900">{messages.site.tagline}</p>
            <p>{messages.site.slogan}</p>
          </div>
        </div>
        <nav aria-label={messages.footer.about} className="flex flex-wrap gap-x-4 gap-y-1 sm:max-w-xs">
          {FOOTER_LINKS.map(([key, href]) => (
            <Link key={key} href={href} className="hover:text-brand-800 hover:underline">
              {messages.footer.links[key]}
            </Link>
          ))}
        </nav>
        <nav aria-label={messages.footer.countries} className="flex flex-wrap gap-x-4 gap-y-1">
          {countries.map((c) => (
            <Link key={c.code} href={`/${c.slug}`} className="hover:text-brand-800 hover:underline">
              {messages.country.title(c.nameFa)}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-neutral-500">{messages.footer.rights(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
}
