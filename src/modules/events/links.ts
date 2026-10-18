// Ticket and online links of an event. Only https, no user name or password in the link, a real
// host name (no IP address, no localhost), and no URL shorteners: a shortened link hides where it
// goes, which is how fake ticket pages are spread. The page shows links with rel="nofollow ugc".

export const MAX_LINK = 500;

/** Shorteners refused as ticket or online links (the host, or any subdomain of it) */
export const SHORTENERS = [
  'bit.ly',
  'bitly.com',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'lnkd.in',
  's.id',
  'v.gd',
  'shorte.st',
  'adf.ly',
  'linktr.ee',
];

export type LinkError = 'invalid' | 'too_long' | 'short_link';

/** The link as it is stored (the URL parser's own form), or why it is refused */
export function checkLink(input: string): { ok: true; url: string } | { ok: false; error: LinkError } {
  const raw = input.trim();
  if (raw.length > MAX_LINK) return { ok: false, error: 'too_long' };
  // Organizers often paste "www.example.com/tickets"
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return { ok: false, error: 'invalid' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // A name with a dot and a letter in its last label: no IP addresses, no intranet names
  // (the parser has already turned non-Latin names into xn-- form)
  if (!/^[a-z0-9.-]+$/.test(host) || !/\.[a-z][a-z0-9-]*[a-z0-9]$/.test(host)) {
    return { ok: false, error: 'invalid' };
  }
  if (SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`))) return { ok: false, error: 'short_link' };
  const out = url.toString();
  if (out.length > MAX_LINK) return { ok: false, error: 'too_long' };
  return { ok: true, url: out };
}
