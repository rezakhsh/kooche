import { titleSlug } from '../listings/slug';

// The event page: /e/{persian-title}/{token}, like the listing page at /v/. The token is the
// listing's, so /v/… of an event redirects here.

export function eventPath(title: string, token: string): string {
  return `/e/${encodeURIComponent(titleSlug(title))}/${token}`;
}
