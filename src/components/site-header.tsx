import Link from 'next/link';
import type { ReactNode } from 'react';
import { foundingPath, eventsPath } from '../modules/search/paths';
import { keyCitiesOf, waitingCountries } from '../modules/launch/waitlist';
import { webEnv } from '../lib/env';
import { chosenCountry } from '../app/country-choice';
import { currentTheme } from '../app/theme';
import { appDb } from '../db/drizzle';
import { messages } from '../messages/fa';
import { unreadConversations } from '../modules/chat/queries';
import { activeCountries } from '../modules/listings/queries';
import { currentSession } from '../modules/users/server';
import { BottomNav } from './bottom-nav';
import { Flag } from './flag';
import { FooterLink } from './footer-link';
import { headerPlaceData } from './header-place-data';
import { HeaderPlaceRow } from './header-place-row';
import { Icon } from './icons';
import { LEGAL_LINKS } from './legal-nav';
import { LogoMark } from './logo';
import { ThemeSwitch } from './theme-switch';

// The header on every page: the logo with its line, the chosen country (the way back to the list
// of countries), on computers the keyword box and the main actions. On phones the actions are in
// the bottom bar (approved Oct 17, 2026) and the keyword box is on the browse pages, so the header
// stays one short row with a search button that leads there. Nothing in the row ever wraps: the
// keyword box gives way first, and below 1280 px chat, my listings and account are icons (with
// their names as tooltips and for screen readers).

export async function SiteHeader() {
  const [session, data] = await Promise.all([currentSession(), headerPlaceData()]);
  const t = messages.nav;
  // Conversations with unread messages, for the badge (one small query on the inbox indexes)
  const unread = session ? await unreadConversations(appDb(), session.user.id) : 0;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href={data.start} className="flex shrink-0 items-center gap-2.5" aria-label={messages.site.logoAlt}>
            <LogoMark className="size-9" />
            <span className="flex flex-col">
              <span className="text-xl font-black leading-none">{messages.site.name}</span>
              <span className="mt-1 hidden text-xs leading-none whitespace-nowrap text-neutral-500 lg:block">{messages.site.tagline}</span>
            </span>
          </Link>
          {/* The chip, the keyword box and the links follow the address in the browser (./header-place.ts) */}
          <HeaderPlaceRow
            data={data}
            nav={
              session && (
                <>
                  <Link href="/chat" title={t.chat} className="relative flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium hover:bg-neutral-50 xl:px-3">
                    <Icon name="chat" className="size-[18px]" />
                    <Label text={t.chat} />
                    <UnreadBadge count={unread} />
                  </Link>
                  <Link href="/my/listings" title={t.myListings} className="flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium hover:bg-neutral-50 xl:px-3">
                    <Icon name="doc" className="size-[18px]" />
                    <Label text={t.myListings} />
                  </Link>
                  <Link href="/my/favorites" aria-label={messages.favorites.title} title={messages.favorites.title} className="flex size-11 items-center justify-center rounded-xl hover:bg-neutral-50">
                    <Icon name="heart" className="size-5" />
                  </Link>
                  {/* The account as a round initial (mockup header()) */}
                  <Link href="/account" aria-label={t.account} title={t.account} className="flex size-11 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800 hover:bg-brand-100">
                    <span aria-hidden>{[...(session.user.name?.trim() || messages.account.defaultDisplayName)][0]}</span>
                  </Link>
                </>
              )
            }
            // No «ورود» on the sign-in pages themselves (design check, Oct 31, 2026)
            signIn={
              !session && (
                <Link href="/login" className="flex h-11 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50">
                  <Icon name="user" className="size-4" />
                  {t.signIn}
                </Link>
              )
            }
            post={
              <Link href="/new" className="ms-1 flex h-11 items-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
                <Icon name="plus" className="size-4" />
                {t.post}
              </Link>
            }
            phoneSignIn={
              !session && (
                <Link href="/login" className="ms-auto flex min-h-10 items-center rounded-xl border border-neutral-200 px-3 text-sm font-medium sm:hidden">
                  {t.signIn}
                </Link>
              )
            }
          />
          {/* Phones (wave 1, mockups final/home, final/browse): the saved listings; the search is on the pages */}
          {session && (
            <Link href="/my/favorites" aria-label={messages.favorites.title} title={messages.favorites.title} className="ms-auto flex size-11 items-center justify-center rounded-xl text-neutral-800 hover:bg-neutral-50 sm:hidden">
              <Icon name="heart" className="size-6" />
            </Link>
          )}
        </div>
      </header>
      <BottomNav home={data.start} signedIn={!!session} unread={unread} />
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
    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron-500 px-1 text-xs font-bold text-ink ${className}`}>
      <span aria-hidden>{count > 99 ? '۹۹+' : count.toLocaleString('fa-IR')}</span>
      <span className="sr-only">{messages.nav.unread(count)}</span>
    </span>
  );
}

/** One group of the footer: a heading and its links (mockup ui.js footer()) */
function FooterColumn({ title, links }: { title: string; links: [ReactNode, string][] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-extrabold text-neutral-900">{title}</h2>
      <ul className="space-y-1">
        {links.map(([label, href]) => (
          <li key={href}>
            <FooterLink href={href} className="flex min-h-11 items-center py-1 text-sm leading-6 text-neutral-700 hover:text-brand-800 hover:underline lg:min-h-9 lg:py-0">
              {label}
            </FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The footer on every browsing page (wave 1, mockup ui.js footer(); built early at the owner's
 * request): help, legal (Impressum by its German name), Peydoo, the open countries with the ones
 * coming soon, and Peydoo's Telegram channel when TELEGRAM_CHANNEL is set. Task pages hide it.
 * Its links don't prefetch: they were rarely opened, yet every page view rendered them all on the
 * server (Nov 2, 2026).
 */
export async function SiteFooter() {
  const db = appDb();
  const [countries, chosen, waiting, theme] = await Promise.all([activeCountries(db), chosenCountry(db), waitingCountries(db).catch(() => []), currentTheme()]);
  const country = chosen ?? countries[0] ?? null;
  const firstCity = country ? (await keyCitiesOf(db, country.code).catch(() => []))[0] : undefined;
  const t = messages.footer;
  const c = t.columns;
  const channel = webEnv().TELEGRAM_CHANNEL;
  const channelUrl = channel ? `https://t.me/${channel}` : null;
  return (
    <footer className="mt-12 border-t border-neutral-200 bg-neutral-50">
      <div data-footer-full className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="font-extrabold text-neutral-900">{messages.site.tagline}</p>
            <p className="text-sm text-neutral-700">{messages.site.slogan}</p>
          </div>
          {channelUrl && (
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="ms-auto hidden h-10 items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-bold hover:bg-neutral-50 lg:flex">
              <Icon name="send" className="size-4 text-brand-700" />
              {t.channel}
            </a>
          )}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
          <FooterColumn title={t.help} links={[[c.help, '/help'], [c.safety, '/safety'], [c.report, '/help#report'], [c.contact, '/contact']]} />
          <FooterColumn
            title={t.legal}
            links={[
              [<span key="i"><bdi>Impressum</bdi> (اطلاعات ناشر)</span>, '/impressum'],
              [c.terms, '/terms'],
              [c.privacy, '/privacy'],
              [c.dsa, '/contact#dsa'],
            ]}
          />
          <FooterColumn
            title={t.about}
            links={[
              [c.about, '/help#about'],
              [c.pro, '/pro'],
              ...(country && firstCity ? [[c.founding, foundingPath(country.slug, firstCity.slug)] as [ReactNode, string]] : []),
              ...(country ? [[c.events, eventsPath(country.slug, null)] as [ReactNode, string]] : []),
              ...(channelUrl ? [[c.channel, channelUrl] as [ReactNode, string]] : []),
            ]}
          />
          <div>
            <h2 className="mb-2 text-sm font-extrabold text-neutral-900">{t.countries}</h2>
            <ul className="space-y-1">
              {countries.map((x) => (
                <li key={x.code}>
                  <FooterLink href={`/${x.slug}`} className="flex min-h-11 items-center gap-2 text-sm text-neutral-700 hover:text-brand-800 hover:underline lg:min-h-9">
                    <Flag code={x.code} className="h-4 w-6" />
                    {x.nameFa}
                  </FooterLink>
                </li>
              ))}
            </ul>
            {waiting.length > 0 && (
              <p className="mt-2 text-xs leading-6 text-neutral-600">
                {t.soon(waiting.map((w) => w.nameFa).join('، '))}{' '}
                <FooterLink href="/cities" className="font-bold text-brand-800 hover:underline">
                  {t.notifyMe}
                </FooterLink>
              </p>
            )}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-600">{t.legalLine(new Date().getFullYear())}</p>
          <ThemeSwitch current={theme} />
        </div>
      </div>
      {/* Only on the posting pages, which have their own bar instead of the header (globals.css).
          In a new tab, so a half-filled listing stays as it is (owner, Nov 3, 2026) */}
      <nav data-footer-slim aria-label={t.legalNav} className="mx-auto hidden max-w-3xl flex-wrap justify-center gap-x-4 px-4 py-4 text-xs">
        {LEGAL_LINKS.map(([key, href]) => (
          <a key={key} href={href} target="_blank" rel="noopener" className="flex min-h-11 items-center text-neutral-600 hover:text-brand-800 hover:underline lg:min-h-9">
            <bdi>{t.legalLinks[key]}</bdi>
            <span className="sr-only"> {t.newTab}</span>
          </a>
        ))}
      </nav>
    </footer>
  );
}
