import type { Metadata } from 'next';
import type { RawParams } from '../../../../modules/search/filters';
import { BrowsePage, browseMetadata } from '../../_browse/browse-page';
import { resolveBrowse } from '../../_browse/resolve';

// /germany/berlin/cars: a category in a city, the main browse page of a city-first site.

type Props = { params: Promise<{ country: string; place: string; category: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await resolveBrowse(params, searchParams));
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  return <BrowsePage b={await resolveBrowse(params, searchParams)} />;
}
