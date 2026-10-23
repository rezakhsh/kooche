import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FavoriteButton } from '../../../components/favorite-button';
import { Icon } from '../../../components/icons';
import { ListingCard } from '../../../components/listing-card';
import { OutlineMap } from '../../../components/outline-map';
import { ReportLink } from '../../../components/report-link';
import { Card, LinkButton } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatMonth } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { cardOf } from '../../../modules/listings/card';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { savedAmong } from '../../../modules/listings/favorites';
import { businessBySlug, roleIn } from '../../../modules/organizations/organizations';
import { businessListingCards } from '../../../modules/organizations/queries';
import { featuredListingIds } from '../../../modules/payments/plans';
import { currentSession } from '../../../modules/users/server';

// A business's public page, /b/{slug} (roadmap step 6): name, the verified badge, description,
// address with a map link and the outline map, contact, live listings, and the legal details
// German law asks of traders (§5 DDG), in German. Businesses are public, so the page is indexable
// (while SEARCH_INDEXING is on) and its address is exact, unlike a private seller's.

type Params = { slug: string };

const load = cache(async (slug: string) => businessBySlug(appDb(), slug));

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: messages.notFound.title, robots: { index: false } };
  const t = messages.business.page;
  return {
    title: t.title(found.org.name),
    description: found.org.description.slice(0, 160) || t.description(found.org.name, found.cityFa ?? ''),
    alternates: { canonical: `${webEnv().APP_URL}/b/${found.org.slug}` },
  };
}

export default async function BusinessPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { org, cityFa, cityLocal } = found;
  const db = appDb();
  const env = webEnv();
  const t = messages.business;
  const session = await currentSession();
  const [catalog, items, member] = await Promise.all([cachedCatalog(db), businessListingCards(db, org.id), session ? roleIn(db, session.user.id, org.id) : Promise.resolve(null)]);
  const [saved, featured] = await Promise.all([
    session ? savedAmong(db, session.user.id, items.map((l) => l.id)) : Promise.resolve(new Set<string>()),
    featuredListingIds(db, items.map((l) => l.id)),
  ]);
  const address = [org.addressLine1, org.addressLine2, [org.postalCode, cityFa].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const addressLatin = [org.addressLine1, [org.postalCode, cityLocal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const path = `/b/${org.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: org.name,
    legalName: org.legalName ?? undefined,
    url: `${env.APP_URL}${path}`,
    email: org.email ?? undefined,
    telephone: org.phoneE164 ?? undefined,
    address: { '@type': 'PostalAddress', streetAddress: [org.addressLine1, org.addressLine2].filter(Boolean).join(', '), postalCode: org.postalCode ?? undefined, addressCountry: org.countryCode },
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="mb-6 flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl font-extrabold text-brand-700" aria-hidden>
          {org.name.trim().charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            <bdi>{org.name}</bdi>
            {org.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700" title={t.verifiedHint}>
                <Icon name="verified" className="size-4" />
                {t.verified}
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <Icon name="store" className="size-4" />
              {t.label}
            </span>
            {cityFa && (
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" className="size-4" />
                {cityFa}
              </span>
            )}
            <span>{t.page.memberSince(formatMonth(org.createdAt, env.APP_TIME_ZONE))}</span>
          </p>
        </div>
      </header>

      {member && (
        <LinkButton href={`${path}/manage`} variant="secondary" className="mb-6">
          <Icon name="gear" className="size-4" />
          {t.page.manage}
        </LinkButton>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
        <div className="min-w-0 space-y-6">
          {org.description && (
            <section>
              <h2 className="mb-2 font-extrabold">{t.page.about}</h2>
              <p className="whitespace-pre-line leading-8 text-neutral-800" dir="auto">
                {org.description}
              </p>
            </section>
          )}
          <section>
            <h2 className="mb-3 font-extrabold">{t.page.listings}</h2>
            {items.length === 0 ? (
              <p className="text-neutral-600">{t.page.noListings}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {items.map((l) => (
                  <li key={l.id}>
                    <ListingCard
                      card={{ ...cardOf(catalog, l, env.APP_TIME_ZONE), featured: featured.has(l.id) }}
                      view="grid"
                      favorite={member ? undefined : <FavoriteButton token={l.publicToken} saved={saved.has(l.id)} back={path} />}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="mt-6 space-y-4 lg:mt-0">
          <Card className="space-y-3 text-sm">
            <h2 className="font-extrabold">{t.page.contact}</h2>
            <p className="flex gap-2">
              <Icon name="pin" className="mt-0.5 size-4 text-neutral-500" />
              <span>
                <bdi dir="auto">{address}</bdi>
                <br />
                <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(addressLatin)}`} target="_blank" rel="noopener noreferrer" className="text-brand-800 hover:underline">
                  {t.page.openMap}
                </a>
              </span>
            </p>
            {org.phoneE164 && (
              <p className="flex items-center gap-2">
                <Icon name="phone" className="size-4 text-neutral-500" />
                <a href={`tel:${org.phoneE164}`} dir="ltr" className="hover:underline">
                  {org.phoneE164}
                </a>
              </p>
            )}
            {org.email && (
              <p className="flex items-center gap-2">
                <Icon name="mail" className="size-4 text-neutral-500" />
                <a href={`mailto:${org.email}`} dir="ltr" className="break-all hover:underline">
                  {org.email}
                </a>
              </p>
            )}
            {org.website && (
              <p className="flex items-center gap-2">
                <Icon name="globe" className="size-4 text-neutral-500" />
                <a href={org.website} target="_blank" rel="noopener noreferrer nofollow ugc" dir="ltr" className="break-all text-brand-800 hover:underline">
                  {org.website.replace(/^https:\/\//, '')}
                </a>
              </p>
            )}
            {org.point && <OutlineMap countryCode={org.countryCode} point={org.point} label={t.page.address} />}
          </Card>

          <Card className="text-sm">
            <h2 className="mb-2 font-extrabold">{t.page.imprint}</h2>
            <div lang="de" dir="ltr" className="space-y-1 text-start text-neutral-800">
              <p className="font-bold">
                {org.legalName ?? org.name}
                {org.legalForm && !org.legalName?.includes(org.legalForm) ? ` (${org.legalForm})` : ''}
              </p>
              <p>{org.addressLine1}</p>
              {org.addressLine2 && <p>{org.addressLine2}</p>}
              <p>{[org.postalCode, cityLocal].filter(Boolean).join(' ')}</p>
              <p>{org.countryCode === 'AT' ? 'Österreich' : 'Deutschland'}</p>
              {org.representativeName && <p>Vertreten durch: {org.representativeName}</p>}
              {org.email && <p>E-Mail: {org.email}</p>}
              {org.phoneE164 && <p>Telefon: {org.phoneE164}</p>}
              {org.registerCourt && org.registrationNumber && (
                <p>
                  Registergericht: {org.registerCourt}, {org.registrationNumber}
                </p>
              )}
              {org.vatId && <p>USt-IdNr.: {org.vatId}</p>}
              {org.imprintExtra && <p className="whitespace-pre-line">{org.imprintExtra}</p>}
            </div>
          </Card>
          {!member && (
            <div className="mt-4">
              <ReportLink kind="business" id={org.slug} label={messages.report.button.business} />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
