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

// The header on every page: the logo with its line, the chosen country (the way back to the list
// of countries), and on computers the main actions. On phones the actions are in the bottom bar
// (approved Oct 17, 2026), so the header stays one short row.

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
          <Link href={home} className="flex items-center gap-2.5" aria-label={messages.site.logoAlt}>
            <LogoMark className="size-9" />
            <span className="flex flex-col">
              <span className="text-xl font-black leading-none">{messages.site.name}</span>
              <span className="mt-1 hidden text-[11px] leading-none text-neutral-500 sm:block">{messages.site.tagline}</span>
            </span>
          </Link>
          {country && (
            <Link
              href="/?choose"
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-1 ps-2 pe-3 text-xs font-medium text-neutral-700 hover:border-brand-300"
              title={messages.country.change}
            >
              <Icon name="pin" className="size-3.5 text-brand-700" />
              {country.nameFa}
            </Link>
          )}
          <nav aria-label={t.label} className="ms-auto hidden items-center gap-2 sm:flex">
            {session && (
              <Link href="/chat" className="relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50">
                <Icon name="chat" className="size-4" />
                {t.chat}
                <UnreadBadge count={unread} />
              </Link>
            )}
            {session && (
              <Link href="/my/favorites" aria-label={messages.favorites.title} title={messages.favorites.title} className="flex items-center rounded-xl px-2.5 py-2 hover:bg-neutral-50">
                <Icon name="heart" className="size-[18px]" />
              </Link>
            )}
            {session && (
              <Link href="/my/listings" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50">
                <Icon name="doc" className="size-4" />
                {t.myListings}
              </Link>
            )}
            <Link
              href={session ? '/account' : '/login'}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              <Icon name="user" className="size-4" />
              {session ? t.account : t.signIn}
            </Link>
            <Link href="/new" className="flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">
              <Icon name="plus" className="size-4" />
              {t.post}
            </Link>
          </nav>
          {!session && (
            <Link href="/login" className="ms-auto rounded-xl border border-neutral-200 px-3 py-1.5 text-sm font-medium sm:hidden">
              {t.signIn}
            </Link>
          )}
        </div>
      </header>
      <BottomNav home={home} signedIn={!!session} unread={unread} />
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
