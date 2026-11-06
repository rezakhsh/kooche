import type { Metadata } from 'next';
import type { RawParams } from '../../../../modules/search/filters';
import { BrowsePage, browseMetadata } from '../../_browse/browse-page';
import { CityWaitlist, waitingCity, waitlistMetadata } from '../../_browse/waitlist-page';
import { resolveBrowse } from '../../_browse/resolve';

// /germany/berlin/cars: a category in a city, the main browse page of a city-first site.

type Props = { params: Promise<{ country: string; place: string; category: string }>; searchParams: Promise<RawParams> };

// Back to this page within 5 minutes comes from the browser's memory at once (smooth loading,
// docs/setup.md). Any server action (♡, save, publish) clears that memory. A literal: Next.js
// reads it from the file. Chat, account and posting pages keep 0, so they always come fresh.
export const unstable_dynamicStaleTime = 300;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const b = await resolveBrowse(params, searchParams);
  const launch = await waitingCity(b);
  return launch ? waitlistMetadata(b, launch) : browseMetadata(b);
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  const b = await resolveBrowse(params, searchParams);
  // A city that isn't open yet shows its waitlist (round 12); its events pages work as usual
  const launch = await waitingCity(b);
  return launch ? <CityWaitlist b={b} launch={launch} /> : <BrowsePage b={b} />;
}
