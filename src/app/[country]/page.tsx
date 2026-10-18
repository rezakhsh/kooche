import type { Metadata } from 'next';
import type { RawParams } from '../../modules/search/filters';
import { BrowsePage, browseMetadata } from './_browse/browse-page';
import { resolveBrowse } from './_browse/resolve';

// A country's page, /germany, /austria: its newest active listings with filters (src/app/[country]/_browse/).
// The old `?category=<slug>` address moves to /germany/<slug>.

type Props = { params: Promise<{ country: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await resolveBrowse(params, searchParams));
}

export default async function CountryPage({ params, searchParams }: Props) {
  return <BrowsePage b={await resolveBrowse(params, searchParams)} />;
}
