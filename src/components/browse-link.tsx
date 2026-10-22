import NextLink from 'next/link';
import type { ComponentProps } from 'react';

// Next.js fetches links ahead as they scroll into view. A keyword address is a search: fetching
// it ahead runs a Meilisearch query nobody asked for and counts against the visitor's keyword
// limit (a keyword page links to ~20 others: categories, sorts, chips). So those are never
// prefetched; every other link behaves as usual.

export function BrowseLink({ prefetch, ...props }: ComponentProps<typeof NextLink>) {
  const keyword = typeof props.href === 'string' && /[?&]q=/.test(props.href);
  return <NextLink {...props} prefetch={keyword ? false : prefetch} />;
}
