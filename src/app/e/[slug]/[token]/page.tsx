import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { OutlineMap } from '../../../../components/outline-map';
import { Alert, Card, LinkButton } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { messages } from '../../../../messages/fa';
import { eventPriceText, formatEventWhen, formatGregorianDate, zoneName } from '../../../../modules/events/format';
import { publicEvent } from '../../../../modules/events/queries';
import { eventPath } from '../../../../modules/events/slug';
import { ancestry, cachedCatalog } from '../../../../modules/listings/catalog';
import { amountInputValue } from '../../../../modules/listings/price';
import { activeCountries } from '../../../../modules/listings/queries';
import { imageSources, imageUrl } from '../../../../modules/media/server';
import { currentSession } from '../../../../modules/users/server';
import { Contact } from '../../../v/[slug]/[token]/contact';
import { ShareButtons } from './share';

// The event page, /e/{persian-title}/{token}. Unlike a listing, the venue's address is public
// (people have to get there); the stored point is still only the postal-code area or a ~500 m
// cell. The online link is shown only to signed-in visitors. schema.org Event markup lets search
// engines show the event in their event listings.

type Params = { slug: string; token: string };

const load = cache(async (token: string) => (/^[0-9a-hjkmnp-tv-z]{10}$/.test(token) ? publicEvent(appDb(), token) : null));

/** Statuses anyone may see; the rest only the owner (with a notice). An ended event is `expired`. */
const PUBLIC = new Set(['active', 'paused', 'expired']);

const STATUS: Record<string, string> = {
  scheduled: 'https://schema.org/EventScheduled',
  postponed: 'https://schema.org/EventPostponed',
  cancelled: 'https://schema.org/EventCancelled',
};
const MODE: Record<string, string> = {
  in_person: 'https://schema.org/OfflineEventAttendanceMode',
  online: 'https://schema.org/OnlineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode',
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data || !PUBLIC.has(data.listing.status)) return { title: messages.notFound.title, robots: { index: false } };
  const l = data.listing;
  const cover = data.images[0] ? imageUrl(data.images[0].key, 'full', 'webp') : null;
  return {
    title: `${l.title} | ${messages.site.name}`,
    description: l.description.slice(0, 160),
    alternates: { canonical: `${webEnv().APP_URL}${eventPath(l.title, l.publicToken)}` },
    // Ended and hidden events stay reachable for shared links, but out of search results
    robots: l.status === 'active' ? undefined : { index: false },
    openGraph: { title: l.title, description: l.description.slice(0, 160), images: cover ? [cover] : undefined, locale: 'fa_IR', type: 'website' },
  };
}

export default async function EventPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ published?: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  const session = await currentSession();
  const isOwner = session?.user.id === data.listing.userId;
  if (!PUBLIC.has(data.listing.status) && !isOwner) notFound();

  const { listing: l, details: d, dates, images, seller, cityFa, cityLocal } = data;
  const env = webEnv();
  const t = messages.events.page;
  const now = new Date();
  const db = appDb();
  const [catalog, countries] = await Promise.all([cachedCatalog(db), activeCountries(db)]);
  const country = countries.find((c) => c.code === l.countryCode);
  const type = l.categoryId ? ancestry(catalog, l.categoryId).at(-1) : undefined;
  const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
  const price = eventPriceText(l.priceType, l.priceMinor !== null && currency ? { minor: l.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null);
  const upcoming = dates.filter((x) => x.endsAt > now);
  const next = upcoming[0] ?? dates.at(-1);
  const ended = l.status === 'expired' || upcoming.length === 0;
  const path = eventPath(l.title, l.publicToken);
  const url = `${env.APP_URL}${path}`;
  const inPerson = d.attendance !== 'online';
  const placeLine = [l.postalCode && l.placeName ? `${l.postalCode} ${l.placeName}` : null, cityFa && cityLocal !== l.placeName ? cityFa : null].filter(Boolean).join('، ');
  const addressText = [d.venueName, d.streetAddress, l.postalCode && l.placeName ? `${l.postalCode} ${l.placeName}` : cityLocal, country?.nameLocal].filter(Boolean).join(', ');
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { published } = await searchParams;
  const organizer = d.organizerName ?? seller.displayName;
  const languages = d.languages.map((x) => messages.events.languages[x as keyof typeof messages.events.languages]).join('، ');

  const jsonLd = next && {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: l.title,
    description: l.description,
    url,
    startDate: next.startsAt.toISOString(),
    endDate: next.endsAt.toISOString(),
    eventStatus: STATUS[d.scheduleStatus],
    eventAttendanceMode: MODE[d.attendance],
    image: images.map((i) => imageUrl(i.key, 'full', 'webp')).filter(Boolean),
    location: [
      ...(inPerson
        ? [
            {
              '@type': 'Place',
              name: d.venueName ?? cityLocal ?? undefined,
              address: {
                '@type': 'PostalAddress',
                streetAddress: d.streetAddress ?? undefined,
                postalCode: l.postalCode ?? undefined,
                addressLocality: l.placeName ?? cityLocal ?? undefined,
                addressCountry: l.countryCode ?? undefined,
              },
            },
          ]
        : []),
      ...(d.attendance !== 'in_person' ? [{ '@type': 'VirtualLocation', url }] : []),
    ],
    organizer: { '@type': d.organizerName ? 'Organization' : 'Person', name: organizer },
    ...(d.languages.length ? { inLanguage: d.languages.filter((x) => x !== 'other') } : {}),
    ...(d.minAge ? { typicalAgeRange: `${d.minAge}-` } : {}),
    ...(currency && (l.priceType === 'free' || l.priceMinor !== null)
      ? {
          offers: {
            '@type': 'Offer',
            url: d.ticketUrl ?? url,
            price: l.priceType === 'free' ? '0' : amountInputValue(l.priceMinor!, currency.minorUnit),
            priceCurrency: currency.code,
            availability: 'https://schema.org/InStock',
            validFrom: (l.publishedAt ?? l.createdAt).toISOString(),
          },
        }
      : {}),
  };

  const [cover, ...rest] = images;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {jsonLd && !ended && (
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}
      <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap gap-1 text-xs text-neutral-500">
        {country && (
          <Link href={`/${country.slug}/events`} className="hover:underline">
            {t.back(country.nameFa)}
          </Link>
        )}
        {type && country && (
          <Link href={`/${country.slug}/events?type=${type.slug}`} className="hover:underline">
            › {type.nameFa}
          </Link>
        )}
      </nav>

      <div className="space-y-4">
        {published && <Alert tone="success">{t.published}</Alert>}
        {!PUBLIC.has(l.status) && <Alert tone="info">{messages.listing.ownerPreview}</Alert>}
        {ended && <Alert tone="info">{t.ended}</Alert>}
        {!ended && d.scheduleStatus === 'cancelled' && <Alert tone="error">{t.cancelled}</Alert>}
        {!ended && d.scheduleStatus === 'postponed' && <Alert tone="info">{t.postponed}</Alert>}
        {l.status === 'paused' && <Alert tone="info">{t.paused}</Alert>}

        <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
          <div className="space-y-2">
            {cover ? (
              <Poster image={cover} alt={l.title} />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-500">{type?.nameFa}</div>
            )}
            {rest.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {rest.map((img, i) => (
                  <li key={img.id}>
                    <a href={imageUrl(img.key, 'full', 'webp') ?? '#'} target="_blank" rel="noopener">
                      <img src={imageUrl(img.key, 'thumb', 'webp') ?? ''} alt={messages.listing.photo(i + 2, images.length)} width={160} height={160} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div>
              {type && <span className="mb-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{type.nameFa}</span>}
              <h1 className="text-2xl font-bold leading-snug">{l.title}</h1>
            </div>

            <dl className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
              {next && (
                <Row
                  label={t.when}
                  value={
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="font-semibold">{formatEventWhen(next.startsAt, next.endsAt, d.timeZone)}</span>
                      <span className="text-xs text-neutral-500">
                        {t.gregorian} {formatGregorianDate(next.startsAt, d.timeZone)}
                      </span>
                      <span className="text-xs text-neutral-500">{t.timeZone(zoneName(next.startsAt, d.timeZone))}</span>
                    </span>
                  }
                />
              )}
              {inPerson && (
                <Row
                  label={t.where}
                  value={
                    <span className="flex flex-col items-end gap-0.5">
                      {d.venueName && <span className="font-semibold">{d.venueName}</span>}
                      {d.streetAddress && <bdi dir="ltr">{d.streetAddress}</bdi>}
                      {placeLine && <span className="text-neutral-600">{placeLine}</span>}
                      {!ended && addressText && (
                        <a
                          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(addressText)}`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-xs text-emerald-800 hover:underline"
                        >
                          {t.openMap}
                        </a>
                      )}
                    </span>
                  }
                />
              )}
              {d.attendance !== 'in_person' && !ended && (
                <Row
                  label={t.online}
                  value={
                    session ? (
                      d.onlineUrl && (
                        <a href={d.onlineUrl} target="_blank" rel="noopener noreferrer nofollow ugc" dir="ltr" className="break-all text-emerald-800 hover:underline">
                          {d.onlineUrl}
                        </a>
                      )
                    ) : (
                      <Link href={`/login?next=${encodeURIComponent(path)}`} className="text-emerald-800 hover:underline">
                        {t.onlineSignIn}
                      </Link>
                    )
                  }
                />
              )}
              {price && <Row label={t.tickets} value={<span className="font-semibold">{price}</span>} />}
              <Row label={t.organizer} value={organizer} />
              {languages && <Row label={t.language} value={languages} />}
              <Row label={t.age} value={d.minAge ? messages.events.age.min(d.minAge) : messages.events.age.all} />
            </dl>

            {!ended && (
              <div className="flex flex-wrap gap-2">
                {d.ticketUrl && d.scheduleStatus !== 'cancelled' && (
                  <LinkButton href={d.ticketUrl} target="_blank" rel="noopener noreferrer nofollow ugc">
                    {t.buyTickets}
                  </LinkButton>
                )}
                <LinkButton href={`${path}/calendar`} variant="secondary">
                  {t.addToCalendar}
                </LinkButton>
              </div>
            )}
            {!ended && l.priceType !== 'free' && <p className="text-xs text-neutral-500">{t.ticketWarning}</p>}

            {upcoming.length > 1 && (
              <section>
                <h2 className="mb-2 font-semibold">{t.allDates}</h2>
                <ul className="space-y-1 text-sm">
                  {upcoming.map((x) => (
                    <li key={x.startsAt.toISOString()}>{formatEventWhen(x.startsAt, x.endsAt, d.timeZone)}</li>
                  ))}
                </ul>
              </section>
            )}

            {l.description && (
              <section>
                <h2 className="mb-2 font-semibold">{messages.listing.description}</h2>
                <p className="whitespace-pre-line leading-relaxed text-neutral-800">{l.description}</p>
              </section>
            )}

            {l.point && l.countryCode && inPerson && (
              <figure className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 p-4">
                <OutlineMap countryCode={l.countryCode} point={l.point} label={t.mapCaption} />
                <figcaption className="text-xs text-neutral-500">{t.mapCaption}</figcaption>
              </figure>
            )}

            {!ended && (
              <section className="space-y-2">
                <h2 className="font-semibold">{t.share}</h2>
                <ShareButtons url={url} title={l.title} />
              </section>
            )}

            <Card className="space-y-4">
              <div>
                <span className="block text-xs text-neutral-500">{t.organizer}</span>
                <span className="font-semibold">{organizer}</span>
              </div>
              {isOwner ? (
                <LinkButton href={`/my/events/${l.id}`} variant="secondary" className="w-full">
                  {t.edit}
                </LinkButton>
              ) : l.status === 'active' ? (
                <Contact token={l.publicToken} allowPhone={l.allowPhoneContact} returnTo={path} />
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function Poster({ image, alt }: { image: { key: string; width: number | null; height: number | null }; alt: string }) {
  const src = imageSources(image.key, 'full');
  if (!src) return null;
  return (
    <picture>
      <source srcSet={src.avif} type="image/avif" />
      <img src={src.webp} alt={alt} width={image.width ?? undefined} height={image.height ?? undefined} fetchPriority="high" className="w-full rounded-2xl" />
    </picture>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-end">{value}</dd>
    </div>
  );
}
