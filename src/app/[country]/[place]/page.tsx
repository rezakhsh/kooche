import type { Metadata } from 'next';
import type { RawParams } from '../../../modules/search/filters';
import { BrowsePage, browseMetadata } from '../_browse/browse-page';
import { CityWaitlist, waitingCity, waitlistMetadata } from '../_browse/waitlist-page';
import { resolveBrowse } from '../_browse/resolve';

// /germany/berlin (a city) or /germany/cars (a category in the country): city and category slugs
// never clash (seed check), so the resolver tries the city first.

type Props = { params: Promise<{ country: string; place: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const b = await resolveBrowse(params, searchParams);
  const launch = await waitingCity(b);
  return launch ? waitlistMetadata(b, launch) : browseMetadata(b);
}

export default async function PlacePage({ params, searchParams }: Props) {
  const b = await resolveBrowse(params, searchParams);
  // A city that isn't open yet shows its waitlist (round 12); its events pages work as usual
  const launch = await waitingCity(b);
  return launch ? <CityWaitlist b={b} launch={launch} /> : <BrowsePage b={b} />;
}
