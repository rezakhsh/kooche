import type { Metadata } from 'next';
import type { RawParams } from '../../../modules/search/filters';
import { BrowsePage, browseMetadata } from '../_browse/browse-page';
import { resolveBrowse } from '../_browse/resolve';

// /germany/berlin (a city) or /germany/cars (a category in the country): city and category slugs
// never clash (seed check), so the resolver tries the city first.

type Props = { params: Promise<{ country: string; place: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await resolveBrowse(params, searchParams));
}

export default async function PlacePage({ params, searchParams }: Props) {
  return <BrowsePage b={await resolveBrowse(params, searchParams)} />;
}
