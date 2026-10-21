import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { EventCard } from '../../../components/event-card';
import { FavoriteButton } from '../../../components/favorite-button';
import { Icon } from '../../../components/icons';
import { ListingCard } from '../../../components/listing-card';
import { Alert, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatMonth } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { eventCardOf } from '../../../modules/events/card';
import { cardOf } from '../../../modules/listings/card';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { savedAmong } from '../../../modules/listings/favorites';
import { sellerPath, sellerProfile } from '../../../modules/users/profile';
import { currentSession } from '../../../modules/users/server';

// A seller's public page, /u/{token} (approved Oct 21, 2026): name, member since, whether the phone
// is verified, active listings and upcoming events. Never the email, phone number or internal ids.
// Kept out of search engines, so a private person's name isn't searchable; the listings are indexed.

type Params = { token: string };
type Search = { after?: string };

const load = cache(async (token: string, after: string | null) => {
  const session = await currentSession();
  const profile = await sellerProfile(appDb(), token, { viewerId: session?.user.id ?? null, after });
  return profile ? { profile, session } : null;
});

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const [{ token }, { after }] = await Promise.all([params, searchParams]);
  const data = await load(token, after ?? null);
  if (!data) return { title: messages.notFound.title, robots: { index: false } };
  return {
    title: `${messages.seller.title(data.profile.name)} | ${messages.site.name}`,
    alternates: { canonical: `${webEnv().APP_URL}${sellerPath(token)}` },
    robots: { index: false, follow: true },
  };
}

export default async function SellerPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ token }, { after }] = await Promise.all([params, searchParams]);
  const data = await load(token, after ?? null);
  if (!data) notFound();
  const { profile: p, session } = data;
  const t = messages.seller;
  const env = webEnv();
  const db = appDb();
  const catalog = await cachedCatalog(db);
  const here = `${sellerPath(token)}${after ? `?after=${encodeURIComponent(after)}` : ''}`;
  const saved = session && !p.isOwner ? await savedAmong(db, session.user.id, p.listings.map((l) => l.id)) : new Set<string>();
  const empty = p.listings.length === 0 && p.events.length === 0 && !after;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex items-center gap-4">
        <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-saffron-50 text-2xl font-extrabold text-saffron-700">
          {[...p.name][0]}
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-extrabold">
            <bdi>{p.name}</bdi>
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span>{messages.listing.memberSince(formatMonth(p.memberSince, env.APP_TIME_ZONE))}</span>
            {p.phoneVerified && (
              <Pill tone="success">
                <Icon name="shield" className="me-1 size-3.5" />
                {messages.listing.phoneVerified}
              </Pill>
            )}
          </p>
        </div>
      </header>

      {p.isOwner && (
        <div className="mb-6">
          <Alert tone="info">
            {t.ownerNotice}{' '}
            <Link href="/account/name" className="font-bold underline">
              {t.changeName}
            </Link>
          </Alert>
        </div>
      )}

      {empty && (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-600">
          <Icon name="store" className="mx-auto mb-3 size-8 text-neutral-400" />
          <p>{t.empty}</p>
        </div>
      )}

      {p.events.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold">{t.events}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {p.events.map((e) => (
              <li key={e.id}>
                <EventCard e={eventCardOf(catalog, e)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(p.listings.length > 0 || after) && (
        <section>
          <h2 className="mb-4 text-lg font-bold">{t.listings}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {p.listings.map((l) => (
              <li key={l.id}>
                <ListingCard
                  card={cardOf(catalog, l, env.APP_TIME_ZONE)}
                  view="grid"
                  favorite={p.isOwner ? undefined : <FavoriteButton token={l.publicToken} saved={saved.has(l.id)} back={here} />}
                />
              </li>
            ))}
          </ul>
          {p.next && (
            <div className="mt-8 flex justify-center">
              <Link href={`${sellerPath(token)}?after=${encodeURIComponent(p.next)}`} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50">
                {messages.country.more}
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
