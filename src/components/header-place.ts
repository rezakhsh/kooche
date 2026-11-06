import { messages } from '../messages/fa';
import { listingPageToken } from '../modules/listings/shared-page';
import { browseCountry } from '../modules/search/browse-country';
import { browsePath, eventsPath } from '../modules/search/paths';

// What the header's middle shows for an address: the place chip («برلین ▾») and the keyword box's
// target and label («جستجو در برلین…»). One function for the server's first render and for the
// browser after in-app links (./header-place-row.tsx), so the header follows the page without
// asking the server again: an in-app link doesn't render the root layout again, and asking for it
// (router.refresh) rendered every tapped page twice and threw away the memory Back uses
// (owner's approval, Nov 6, 2026; docs/setup.md, "Smooth loading").

type Place = { slug: string; nameFa: string };

/** Everything the header's middle depends on besides the address, sent once with the page */
export type HeaderPlaceData = {
  /** The header's country: the chosen one, else the signed-in user's, else the connection's (open countries only) */
  country: Place | null;
  /** The remembered country the page was rendered with (as the proxy passed it on; see serverCountry) */
  cookie: string | null;
  /** Staff viewing the site as a country: the proxy hides the remembered country (src/modules/admin/view-as.ts) */
  viewAs: boolean;
  /** On the admin page: its first segment, which the proxy leaves alone (the browser is at that address already) */
  adminRoot: string | null;
  /** The country the footer was rendered for (chosen, else the first open one) */
  footer: string | null;
  /** Open countries' address names */
  open: string[];
  /** Countries with a page that aren't open (waitlist, planned) */
  closed: [string, string][];
  /** The header country's cities and browsable categories (slug, Persian name) */
  cities: [string, string][];
  categories: [string, string][];
  /** A signed-in user's own city, when it is in the header's country */
  home: Place | null;
  /** The remembered country when it has a page but isn't open */
  mineClosed: Place | null;
  /** The home page's country for a visitor from a planned country that isn't open, when no country is chosen */
  visitorPlanned: Place | null;
  /** Whether that applies (no country chosen, the connection's country isn't open) */
  visitorPlannedAsked: boolean;
};

export type HeaderPlace = {
  /** The chip's name, or no chip */
  chip: string | null;
  /** The keyword box, or none (no country, or a country that isn't open yet) */
  search: { action: string; city: string | null; placeholder: string; plain: boolean } | null;
  country: string | null;
  /** The sign-in pages, which show no «ورود» */
  onLogin: boolean;
};

function decode(x?: string): string {
  try {
    return x ? decodeURIComponent(x) : '';
  } catch {
    return '';
  }
}

function lookup(list: [string, string][], slug: string): Place | null {
  const found = list.find(([s]) => s === slug);
  return found ? { slug: found[0], nameFa: found[1] } : null;
}

/** The header's middle for an address (the same rules as the server header had, Oct 17–31, 2026) */
export function headerPlace(path: string, d: HeaderPlaceData): HeaderPlace {
  const country = d.country;
  // The chip says the city on a city's pages, else the country; on a browse page the search
  // searches that page (mockups final/browse, final/category)
  const segments = country ? (new RegExp(`^/${country.slug}/([^/]+)(?:/([^/]+))?`).exec(path) ?? []) : [];
  const city = country && segments[1] ? lookup(d.cities, decode(segments[1])) : null;
  // Away from the country's pages a signed-in user's own city takes its place (mockup header())
  const onCountryPages = !!country && (path === `/${country.slug}` || path.startsWith(`/${country.slug}/`));
  const place = city ?? (country && !onCountryPages ? d.home : null);
  // On a country's own pages before it opens the chip names that country and there is nothing to
  // search yet (wave 2 part 8), and on the first page for a visitor from a planned country
  const first = /^\/([a-z][a-z-]{1,40})(?:\/|$)/.exec(path)?.[1];
  const closedHere = first
    ? d.open.includes(first)
      ? null
      : lookup(d.closed, first)
    : path === '/' && d.visitorPlannedAsked
      ? d.visitorPlanned
      : null;
  // The remembered country when it isn't open (owner, Oct 31, 2026), away from an open country's pages
  const shownClosed = closedHere ?? (d.mineClosed && !(first && d.open.includes(first)) ? d.mineClosed : null);
  const category = country && segments[1] ? lookup(d.categories, decode(city ? segments[2] : segments[1])) : null;
  // On the events pages the box searches the events (wave 1, mockup final/events)
  const onEvents = !!country && (segments[1] === 'events' || (!!city && segments[2] === 'events'));
  const chip = shownClosed?.nameFa ?? place?.nameFa ?? country?.nameFa ?? null;
  const search =
    country && !shownClosed
      ? {
          action: onEvents ? eventsPath(country.slug, city?.slug ?? null) : browsePath(country.slug, place?.slug ?? null, category?.slug ?? null),
          city: place?.slug ?? null,
          placeholder: onEvents ? messages.events.list.searchIn(city?.nameFa ?? country.nameFa) : messages.search.placeholderIn(category?.nameFa ?? place?.nameFa ?? country.nameFa),
          plain: onEvents,
        }
      : null;
  return { chip, search, country: country?.slug ?? null, onLogin: path === '/login' || path.startsWith('/login/') };
}

/** A `country` cookie's value as the server reads it: a country with a page, else as if none was remembered */
function known(d: Pick<HeaderPlaceData, 'open' | 'closed'>, slug: string | null): string | null {
  return slug && (d.open.includes(slug) || d.closed.some(([s]) => s === slug)) ? slug : null;
}

export type HeaderCookieData = Pick<HeaderPlaceData, 'cookie' | 'footer' | 'viewAs' | 'adminRoot' | 'open' | 'closed'> & {
  countrySlug: string | null;
  /** The token of the listing or event page this was rendered as Cloudflare's shared copy for (src/proxy.ts), if so */
  shared?: string | null;
};

/**
 * The remembered country the server would render an address with: src/proxy.ts renders a browse
 * page as if the page's own country were chosen and hides it while staff view the site as a
 * country; elsewhere it is the browser's `country` cookie.
 */
export function serverCountry(path: string, d: HeaderCookieData, cookie: string | null): string | null {
  if (d.adminRoot && path.split('/')[1] === d.adminRoot) return known(d, cookie);
  // The shared copy of a listing or event page is drawn without the remembered country (as on a
  // first visit) for everyone: asking the server again would only bring the same copy
  if (d.shared && listingPageToken(path)?.token === d.shared) return renderedCountry(d);
  return known(d, browseCountry(path) ?? (d.viewAs ? null : cookie));
}

/** The rendered country as serverCountry() would name it (the server sends the proxy's value) */
export function renderedCountry(d: HeaderCookieData): string | null {
  return known(d, d.cookie);
}

/**
 * Whether the header drawn for this page is not the server's for the address: the remembered
 * country the server would use differs (another country's page, a country chosen or forgotten,
 * staff viewing as a country). Then the header waits for the server's (./header-sync.tsx). Not when
 * a first visit only remembers the country the header and the footer already show.
 */
export function needsServerHeader(d: HeaderCookieData, country: string | null): boolean {
  const rendered = renderedCountry(d);
  if (country === rendered) return false;
  return !(rendered === null && country !== null && country === d.countrySlug && country === d.footer);
}
