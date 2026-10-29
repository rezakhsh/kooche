import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { visitorCountry } from '../lib/client-ip';
import { homeArea } from '../modules/listings/neighbourhood';
import { cityOf } from '../modules/search/places';
import { browsableCategory, cachedCatalog } from '../modules/listings/catalog';
import { browsePath, eventsPath, foundingPath } from '../modules/search/paths';
import { keyCitiesOf, waitingCountries } from '../modules/launch/waitlist';
import { webEnv } from '../lib/env';
import { chosenCountry } from '../app/country-choice';
import { countryBySlug } from '../modules/launch/country-page';
import { currentTheme } from '../app/theme';
import { appDb } from '../db/drizzle';
import { messages } from '../messages/fa';
import { unreadConversations } from '../modules/chat/queries';
import { activeCountries } from '../modules/listings/queries';
import { currentSession } from '../modules/users/server';
import { BottomNav } from './bottom-nav';
import { Flag } from './flag';
import { Icon } from './icons';
import { LEGAL_LINKS } from './legal-nav';
import { LogoMark } from './logo';
import { SearchBox } from './search-box';
import { ThemeSwitch } from './theme-switch';

// The header on every page: the logo with its line, the chosen country (the way back to the list
// of countries), on computers the keyword box and the main actions. On phones the actions are in
// the bottom bar (approved Oct 17, 2026) and the keyword box is on the browse pages, so the header
// stays one short row with a search button that leads there. Nothing in the row ever wraps: the
// keyword box gives way first, and below 1280 px chat, my listings and account are icons (with
// their names as tooltips and for screen readers).

export async function SiteHeader() {
  const requestHeaders = await headers();
  const [session, chosen, open] = await Promise.all([currentSession(), chosenCountry(appDb()), activeCountries(appDb())]);
  // Before a country is chosen, the visitor's own (Cloudflare's header) when it is open (wave 1, mockup final/home)
  const here = visitorCountry(requestHeaders);
  // A signed-in user's saved place comes before the guess from their connection
  const home = session ? await homeArea(appDb(), session.user.id).catch(() => null) : null;
  const country = chosen ?? open.find((c) => c.code === home?.countryCode) ?? open.find((c) => c.code === here) ?? null;
  // The place chip says the city on a city's pages («برلین ▾»), else the country; on a browse page
  // the header's search searches that page (mockups final/browse, final/category: «جستجو در برلین…»)
  const segments = country ? (new RegExp(`^/${country.slug}/([^/]+)(?:/([^/]+))?`).exec(requestHeaders.get('x-pathname') ?? '') ?? []) : [];
  const decode = (x?: string) => {
    try {
      return x ? decodeURIComponent(x) : '';
    } catch {
      return '';
    }
  };
  const city = country && segments[1] ? await cityOf(appDb(), country.code, decode(segments[1])).catch(() => null) : null;
  // Away from the country's pages (my listings, the account) a signed-in user's own city takes its
  // place: the chip names it and the search searches it (mockup header(): «برلین ▾», «جستجو در برلین…»)
  const path = requestHeaders.get('x-pathname') ?? '';
  const onCountryPages = !!country && (path === `/${country.slug}` || path.startsWith(`/${country.slug}/`));
  const place = city ?? (country && !onCountryPages && home?.countryCode === country.code ? { slug: home.citySlug, nameFa: home.city } : null);
  // On a country's own pages before it opens (/austria, /austria/wien; wave 2 part 8, mockup
  // final/home-waitlist) the chip names that country, and there is nothing to search yet
  const first = /^\/([a-z][a-z-]{1,40})(?:\/|$)/.exec(path)?.[1];
  const closedHere = first && !open.some((c) => c.slug === first) ? await countryBySlug(appDb(), first).catch(() => null) : null;
  const catalog = country && segments[1] ? await cachedCatalog(appDb()) : null;
  const category = catalog ? browsableCategory(catalog, decode(city ? segments[2] : segments[1])) : null;
  // On the events pages the box searches the events (wave 1, mockup final/events: «جستجو در رویدادهای برلین…»)
  const onEvents = !!country && (segments[1] === 'events' || (!!city && segments[2] === 'events'));
  const searchIn = country ? (onEvents ? eventsPath(country.slug, city?.slug ?? null) : browsePath(country.slug, place?.slug ?? null, category?.slug ?? null)) : '/';
  const searchScope = category?.nameFa ?? place?.nameFa ?? country?.nameFa ?? '';
  const searchPlaceholder = onEvents ? messages.events.list.searchIn((city ?? null)?.nameFa ?? country!.nameFa) : messages.search.placeholderIn(searchScope);
  const t = messages.nav;
  const start = country ? `/${country.slug}` : '/';
  // Conversations with unread messages, for the badge (one small query on the inbox indexes)
  const unread = session ? await unreadConversations(appDb(), session.user.id) : 0;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href={start} className="flex shrink-0 items-center gap-2.5" aria-label={messages.site.logoAlt}>
            <LogoMark className="size-9" />
            <span className="flex flex-col">
              <span className="text-xl font-black leading-none">{messages.site.name}</span>
              <span className="mt-1 hidden text-xs leading-none whitespace-nowrap text-neutral-500 lg:block">{messages.site.tagline}</span>
            </span>
          </Link>
          {(closedHere || country) && (
            <Link
              href="/cities"
              className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 ps-2.5 pe-3 text-[13px] font-medium whitespace-nowrap text-neutral-700 hover:border-brand-300"
              title={messages.cities.title}
            >
              <Icon name="pin" className="size-4 text-brand-700" />
              {closedHere?.nameFa ?? place?.nameFa ?? country!.nameFa}
              <Icon name="chevronDown" className="size-3.5" />
            </Link>
          )}
          {country && !closedHere && (
            <SearchBox
              key={searchIn}
              id="header-q"
              action={searchIn}
              country={country.slug}
              city={place?.slug ?? null}
              placeholder={searchPlaceholder}
              plain={onEvents}
              className="ms-auto hidden min-w-0 max-w-sm flex-1 lg:block"
            />
          )}
          <nav aria-label={t.label} className={`${country && !closedHere ? '' : 'ms-auto'} hidden shrink-0 items-center gap-1 whitespace-nowrap sm:flex xl:gap-2`}>
            {session && (
              <Link href="/chat" title={t.chat} className="relative flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium hover:bg-neutral-50 xl:px-3">
                <Icon name="chat" className="size-[18px]" />
                <Label text={t.chat} />
                <UnreadBadge count={unread} />
              </Link>
            )}
            {session && (
              <Link href="/my/listings" title={t.myListings} className="flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium hover:bg-neutral-50 xl:px-3">
                <Icon name="doc" className="size-[18px]" />
                <Label text={t.myListings} />
              </Link>
            )}
            {session && (
              <Link href="/my/favorites" aria-label={messages.favorites.title} title={messages.favorites.title} className="flex size-11 items-center justify-center rounded-xl hover:bg-neutral-50">
                <Icon name="heart" className="size-5" />
              </Link>
            )}
            {session ? (
              // The account as a round initial (mockup header())
              <Link href="/account" aria-label={t.account} title={t.account} className="flex size-11 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800 hover:bg-brand-100">
                <span aria-hidden>{[...(session.user.name?.trim() || messages.account.defaultDisplayName)][0]}</span>
              </Link>
            ) : (
              <Link href="/login" className="flex h-11 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50">
                <Icon name="user" className="size-4" />
                {t.signIn}
              </Link>
            )}
            <Link href="/new" className="ms-1 flex h-11 items-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
              <Icon name="plus" className="size-4" />
              {t.post}
            </Link>
          </nav>
          {/* Phones (wave 1, mockups final/home, final/browse): the saved listings; the search is on the pages */}
          {session && (
            <Link href="/my/favorites" aria-label={messages.favorites.title} title={messages.favorites.title} className="ms-auto flex size-11 items-center justify-center rounded-xl text-neutral-800 hover:bg-neutral-50 sm:hidden">
              <Icon name="heart" className="size-6" />
            </Link>
          )}
          {!session && (
            <Link href="/login" className="ms-auto flex min-h-10 items-center rounded-xl border border-neutral-200 px-3 text-sm font-medium sm:hidden">
              {t.signIn}
            </Link>
          )}
        </div>
      </header>
      <BottomNav home={start} signedIn={!!session} unread={unread} />
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
            <Link href={href} className="flex min-h-9 items-center text-sm text-neutral-700 hover:text-brand-800 hover:underline">
              {label}
            </Link>
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
                  <Link href={`/${x.slug}`} className="flex min-h-9 items-center gap-2 text-sm text-neutral-700 hover:text-brand-800 hover:underline">
                    <Flag code={x.code} className="h-4 w-6" />
                    {x.nameFa}
                  </Link>
                </li>
              ))}
            </ul>
            {waiting.length > 0 && (
              <p className="mt-2 text-xs leading-6 text-neutral-600">
                {t.soon(waiting.map((w) => w.nameFa).join('، '))}{' '}
                <Link href="/cities" className="font-bold text-brand-800 hover:underline">
                  {t.notifyMe}
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-600">{t.legalLine(new Date().getFullYear())}</p>
          <ThemeSwitch current={theme} />
        </div>
      </div>
      {/* Only on the posting pages, which have their own bar instead of the header (globals.css) */}
      <nav data-footer-slim aria-label={t.legalNav} className="mx-auto hidden max-w-3xl flex-wrap justify-center gap-x-4 px-4 py-4 text-xs">
        {LEGAL_LINKS.map(([key, href]) => (
          <Link key={key} href={href} className="flex min-h-9 items-center text-neutral-600 hover:text-brand-800 hover:underline">
            <bdi>{t.legalLinks[key]}</bdi>
          </Link>
        ))}
      </nav>
    </footer>
  );
}
