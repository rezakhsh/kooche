import type { Metadata } from 'next';
import { cache } from 'react';
import { appDb } from '../../db/drizzle';
import { countryBySlug, isPlanned, isStarter, type CountryInfo } from '../../modules/launch/country-page';
import type { RawParams } from '../../modules/search/filters';
import { BrowsePage, browseMetadata } from './_browse/browse-page';
import { CountrySoon, countrySoonMetadata } from './_browse/country-soon';
import { resolveBrowse } from './_browse/resolve';
import { StarterPage } from './_browse/starter-page';

// A country's page, /germany, /austria: its newest active listings with filters (src/app/[country]/_browse/).
// The old `?category=<slug>` address moves to /germany/<slug>. Wave 2 part 8: a planned country
// that isn't open shows «پیدو به‌زودی» (./_browse/country-soon.tsx), and an open one in its
// starter weeks its starter page when nothing is searched or filtered (./_browse/starter-page.tsx).

type Props = { params: Promise<{ country: string }>; searchParams: Promise<RawParams> };

const countryInfo = cache((slug: string) => countryBySlug(appDb(), slug));

/** The country of the address when it isn't open but planned, else null */
async function soon(slug: string): Promise<CountryInfo | null> {
  const info = await countryInfo(slug);
  return info && info.mode !== 'open' && (await isPlanned(appDb(), info)) ? info : null;
}

/** The country of the address when its first page is the starter page now */
async function starter(slug: string, searchParams: Promise<RawParams>): Promise<CountryInfo | null> {
  if (Object.keys(await searchParams).length > 0) return null;
  const info = await countryInfo(slug);
  return info && isStarter(info) ? info : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const closed = await soon((await params).country);
  if (closed) return countrySoonMetadata(closed);
  return browseMetadata(await resolveBrowse(params, searchParams));
}

export default async function CountryPage({ params, searchParams }: Props) {
  const slug = (await params).country;
  const closed = await soon(slug);
  if (closed) return <CountrySoon country={closed} />;
  const first = await starter(slug, searchParams);
  if (first) return <StarterPage country={first} remember />;
  return <BrowsePage b={await resolveBrowse(params, searchParams)} />;
}
