import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { messages } from '../../messages/fa';
import { cachedCatalog } from '../../modules/listings/catalog';
import { placeParts } from '../../modules/listings/place-text';
import { formatPrice } from '../../modules/listings/price';
import { activeCountries, countryListings } from '../../modules/listings/queries';
import { listingPath } from '../../modules/listings/slug';
import { imageUrl } from '../../modules/media/server';
import { RememberCountry } from './remember-country';

// A country's page, /germany, /austria: its newest active listings, 24 at a time
// (listings_country_ranked_idx). City pages (/germany/berlin) and categories come later.
// `?after=<ranked_at>_<id>` continues after the last listing of the previous page.

type Params = { country: string };

const cursor = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/)
  .transform((s) => {
    const [at, id] = s.split('_');
    return { rankedAt: new Date(at!), id: id! };
  });

async function find(slug: string) {
  return (await activeCountries(appDb())).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const country = await find((await params).country);
  if (!country) return { title: messages.notFound.title, robots: { index: false } };
  const t = messages.country;
  return {
    title: `${t.title(country.nameFa)} | ${messages.site.name}`,
    description: t.description(country.nameFa),
    alternates: { canonical: `${webEnv().APP_URL}/${country.slug}` },
  };
}

export default async function CountryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ after?: string }> }) {
  const country = await find((await params).country);
  if (!country) notFound();
  const after = cursor.safeParse((await searchParams).after ?? '');
  const db = appDb();
  const [catalog, page] = await Promise.all([cachedCatalog(db), countryListings(db, country.code, after.success ? after.data : null)]);
  const t = messages.country;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <RememberCountry slug={country.slug} />
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.title(country.nameFa)}</h1>
        <Link href="/?choose" className="text-sm text-emerald-800 hover:underline">
          {t.change}
        </Link>
      </div>
      <Link
        href={`/${country.slug}/events`}
        className="mb-6 block rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-100"
      >
        {messages.events.linkFromCountry} ←
      </Link>
      {page.items.length === 0 && <p className="text-neutral-600">{t.empty}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {page.items.map((l) => {
          const cover = l.coverKey ? imageUrl(l.coverKey, 'card', 'webp') : null;
          const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
          const noPrice = l.categoryId ? catalog.byId.get(l.categoryId)?.priceMode === 'none' : false;
          const price =
            l.priceMinor !== null && currency
              ? formatPrice(l.priceMinor, currency.code, currency.minorUnit)
              : noPrice
                ? null
                : messages.priceType[l.priceType];
          const place = placeParts({ ...l, cityLocal: null }, t.near);
          return (
            <li key={l.id}>
              <Link href={listingPath(l.title, l.publicToken)} className="block overflow-hidden rounded-2xl border border-neutral-200 hover:bg-neutral-50">
                <div className="aspect-[4/3] bg-neutral-100">
                  {cover && <img src={cover} alt="" width={480} height={360} loading="lazy" decoding="async" className="size-full object-cover" />}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{l.title}</p>
                  {price && <p className="text-sm text-emerald-800">{price}</p>}
                  <p className="truncate text-xs text-neutral-500">{place.local ? <bdi dir="ltr">{l.placeName}</bdi> : place.city}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {page.next && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/${country.slug}?after=${page.next.rankedAt.toISOString()}_${page.next.id}`}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {t.more}
          </Link>
        </div>
      )}
    </main>
  );
}
