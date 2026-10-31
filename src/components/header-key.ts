// What the header shows depends on the address (a country's page, its city, its category, the
// sign-in pages) and on the remembered country (the logo, the chip away from country pages). The
// header is in the root layout, which an in-app link doesn't render again, so the browser compares
// this key with the one the header was rendered for and fetches it again when they differ
// (./header-sync.tsx; design check, Oct 31, 2026).

/** The header's key for an address and the `country` cookie */
export function headerKey(path: string, countrySlugs: readonly string[], cookie: string | null): string {
  const segments = path.split('/').filter(Boolean);
  const first = segments[0] ?? '';
  const place = countrySlugs.includes(first) ? segments.slice(0, 3).join('/') : first === 'login' ? 'login' : '';
  return `${place}|${cookie ?? ''}`;
}
