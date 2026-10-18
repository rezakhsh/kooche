import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import { OutlineMap } from '../../../../components/outline-map';
import { FavoriteButton } from '../../../../components/favorite-button';
import { Icon } from '../../../../components/icons';
import { Alert, Card, LinkButton } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatAgo, formatDate, formatMonth } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { ancestry, cachedCatalog, effectiveAttributes, listingCurrency, type AttributeDef, type Currency } from '../../../../modules/listings/catalog';
import { placeParts } from '../../../../modules/listings/place-text';
import { amountInputValue, formatPrice } from '../../../../modules/listings/price';
import { isEventListing } from '../../../../modules/events/queries';
import { eventPath } from '../../../../modules/events/slug';
import { favoriteCounts, savedAmong } from '../../../../modules/listings/favorites';
import { activeCountries, publicListing } from '../../../../modules/listings/queries';
import { browsePath } from '../../../../modules/search/paths';
import { allCities } from '../../../../modules/search/places';
import { listingPath } from '../../../../modules/listings/slug';
import { imageSources, imageUrl } from '../../../../modules/media/server';
import { chatEntry } from '../../../../modules/chat/entry';
import { currentSession } from '../../../../modules/users/server';
import { Contact } from './contact';
import { Gallery, type GalleryImage } from './gallery';

// The public listing page, /v/{persian-title}/{token}, rendered on the server. The token finds the
// listing; the title part is not checked, and the canonical link carries the current one.
// Never shown: the exact location (only postal code, place, district, and a dot on an outline of
// the country drawn from the stored point, which is never exact), the phone number (fetched on
// request), internal ids.

type Params = { slug: string; token: string };

const load = cache(async (token: string) => (/^[0-9a-hjkmnp-tv-z]{10}$/.test(token) ? publicListing(appDb(), token) : null));

/** Statuses anyone may see; the rest only the owner (with a notice) */
const PUBLIC = new Set(['active', 'paused', 'sold', 'expired']);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data || !PUBLIC.has(data.listing.status)) return { title: messages.notFound.title, robots: { index: false } };
  const l = data.listing;
  const cover = data.images[0] ? imageUrl(data.images[0].key, 'full', 'webp') : null;
  return {
    title: `${l.title} | ${messages.site.name}`,
    description: l.description.slice(0, 160),
    alternates: { canonical: `${webEnv().APP_URL}${listingPath(l.title, l.publicToken)}` },
    // Gone listings stay reachable for a while, but out of search results
    robots: l.status === 'active' ? undefined : { index: false },
    openGraph: { title: l.title, description: l.description.slice(0, 160), images: cover ? [cover] : undefined, locale: 'fa_IR', type: 'website' },
  };
}

function attributeText(def: AttributeDef, value: unknown, currency: Currency | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (def.validation.money) {
    return typeof value === 'number' && currency ? formatPrice(value, currency.code, currency.minorUnit) : null;
  }
  const option = (v: unknown) => def.options.find((o) => o.value === v)?.labelFa ?? String(v);
  switch (def.type) {
    case 'select':
      return option(value);
    case 'multi_select':
      return Array.isArray(value) ? value.map(option).join('، ') : null;
    case 'boolean':
      return value ? messages.form.yes : messages.form.no;
    case 'number':
      return `${Number(value).toLocaleString('fa-IR')}${def.unitFa ? ` ${def.unitFa}` : ''}`;
    case 'date': {
      const [y, m, d] = String(value).split('-').map(Number);
      if (!y || !m) return null;
      // A day in the Jalali calendar; a month (TÜV) as the Gregorian month it is
      return d
        ? formatDate(new Date(Date.UTC(y, m - 1, d)), 'UTC')
        : `${messages.form.months[m - 1] ?? m} ${y.toLocaleString('fa-IR', { useGrouping: false })}`;
    }
    default:
      return String(value);
  }
}

const CONDITION: Record<string, string> = {
  new: 'https://schema.org/NewCondition',
  like_new: 'https://schema.org/UsedCondition',
  used: 'https://schema.org/UsedCondition',
  for_parts: 'https://schema.org/DamagedCondition',
};

export default async function ListingPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ published?: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  // An event is a listing with its own page
  if (await isEventListing(appDb(), data.listing.id)) permanentRedirect(eventPath(data.listing.title, data.listing.publicToken));
  const session = await currentSession();
  const isOwner = session?.user.id === data.listing.userId;
  if (!PUBLIC.has(data.listing.status) && !isOwner) notFound();

  const { listing: l, images, seller, cityFa, cityLocal } = data;
  const env = webEnv();
  const t = messages.listing;
  const catalog = await cachedCatalog(appDb());
  const crumbs = l.categoryId ? ancestry(catalog, l.categoryId) : [];
  const defs = l.categoryId ? effectiveAttributes(catalog, l.categoryId) : [];
  const attrs = l.attributes as Record<string, unknown>;
  const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
  const amountCurrency = listingCurrency(catalog, l);
  const details = defs.map((d) => ({ label: d.labelFa, text: attributeText(d, attrs[d.key], amountCurrency) })).filter((x) => x.text);
  // Rent: the price is the cold rent; with the extra costs the page adds up the warm rent
  const extraCosts = defs.some((d) => d.key === 'extra_costs') ? attrs.extra_costs : undefined;
  const warmRent =
    l.priceMinor !== null && currency && typeof extraCosts === 'number'
      ? formatPrice(l.priceMinor + extraCosts, currency.code, currency.minorUnit)
      : null;
  const price =
    l.priceMinor !== null && currency
      ? `${formatPrice(l.priceMinor, currency.code, currency.minorUnit)}${l.priceType === 'negotiable' ? ` (${messages.priceType.negotiable})` : ''}`
      : l.categoryId && catalog.byId.get(l.categoryId)?.priceMode === 'none'
        ? null
        : messages.priceType[l.priceType];
  const place = placeParts({ ...l, cityFa, cityLocal }, t.near);
  const hasPlace = !!(place.local || place.city || place.district);
  const mapLabel = l.locationPrecision === 'area' ? t.mapArea : l.locationPrecision === 'postal_code' ? t.mapPostal : t.mapCity;
  const path = listingPath(l.title, l.publicToken);
  // The seller sees no chat button on their own listing
  const chat = isOwner || l.status !== 'active' ? null : await chatEntry(appDb(), { userId: session?.user.id ?? null, listing: l, returnTo: path });
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { published } = await searchParams;
  const country = l.countryCode ? (await activeCountries(appDb())).find((c) => c.code === l.countryCode) : undefined;
  const countrySlug = country?.slug ?? null;
  const countryName = country?.nameFa ?? '';
  const city = countrySlug && l.locationId ? ((await allCities(appDb())).find((c) => c.id === l.locationId) ?? null) : null;
  // The ♡ for visitors; the seller sees how many saved it instead (nobody else does)
  const [savedByMe, favCount] = await Promise.all([
    session && !isOwner ? savedAmong(appDb(), session.user.id, [l.id]).then((s) => s.has(l.id)) : Promise.resolve(false),
    isOwner ? favoriteCounts(appDb(), session!.user.id, [l.id]).then((m) => m.get(l.id) ?? 0) : Promise.resolve(null),
  ]);

  // schema.org Product with an Offer. Price in major units as a decimal string, never a float.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l.title,
    description: l.description,
    url: `${env.APP_URL}${path}`,
    image: images.map((i) => imageUrl(i.key, 'full', 'webp')).filter(Boolean),
    ...(crumbs.length ? { category: crumbs.map((c) => c.nameFa).join(' > ') } : {}),
    offers: {
      '@type': 'Offer',
      url: `${env.APP_URL}${path}`,
      ...(l.priceMinor !== null && currency
        ? { price: amountInputValue(l.priceMinor, currency.minorUnit), priceCurrency: currency.code }
        : l.priceType === 'free' && currency
          ? { price: '0', priceCurrency: currency.code }
          : {}),
      availability:
        l.status === 'active'
          ? 'https://schema.org/InStock'
          : l.status === 'sold'
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/Discontinued',
      ...(typeof attrs.condition === 'string' && CONDITION[attrs.condition] ? { itemCondition: CONDITION[attrs.condition] } : {}),
      ...(l.expiresAt ? { priceValidUntil: l.expiresAt.toISOString().slice(0, 10) } : {}),
      availableAtOrFrom: { '@type': 'Place', address: {
          '@type': 'PostalAddress',
          addressLocality: l.placeName ?? cityLocal ?? undefined,
          postalCode: l.postalCode ?? undefined,
          addressCountry: l.countryCode ?? undefined,
        },
      },
      seller: { '@type': 'Person', name: seller.displayName },
    },
  };

  const gallery: GalleryImage[] = images.map((img) => ({
    id: img.id,
    full: imageSources(img.key, 'full'),
    thumb: imageUrl(img.key, 'thumb', 'webp'),
    placeholder: img.blur ? thumbHashToDataURL(Buffer.from(img.blur, 'base64')) : null,
    width: img.width,
    height: img.height,
  }));
  const posted = l.publishedAt ?? l.createdAt;

  const sellerBox = (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-saffron-50 text-lg font-extrabold text-saffron-700">
          {[...seller.displayName][0]}
        </span>
        <div className="min-w-0">
          <span className="block text-xs text-neutral-500">{t.seller}</span>
          <span className="block truncate font-bold">{seller.displayName}</span>
          <span className="block text-xs text-neutral-500">{t.memberSince(formatMonth(seller.createdAt, env.APP_TIME_ZONE))}</span>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-brand-800">
        <Icon name="shield" className="size-4" />
        {t.phoneVerified}
      </p>
      {isOwner && favCount !== null && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-600" title={messages.favorites.countHint}>
          <Icon name="heart" className="size-4 text-red-600" />
          {messages.favorites.count(favCount)}
          <span className="sr-only">{messages.favorites.countHint}</span>
        </p>
      )}
      {isOwner ? (
        <LinkButton href={`/my/listings/${l.id}`} variant="secondary" className="w-full">
          {t.edit}
        </LinkButton>
      ) : chat && l.status === 'active' ? (
        <Contact token={l.publicToken} allowPhone={l.allowPhoneContact} returnTo={path} chat={chat} />
      ) : null}
    </Card>
  );

  return (
    <main className="mx-auto w-full max-w-6xl pb-6 sm:px-6 sm:pt-6">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
        <div className="min-w-0 space-y-5">
          {(published || !PUBLIC.has(l.status) || l.status === 'paused' || l.status === 'sold' || l.status === 'expired') && (
            <div className="space-y-2 px-4 pt-4 sm:px-0 sm:pt-0">
              {published && <Alert tone="success">{messages.form.published}</Alert>}
              {!PUBLIC.has(l.status) && <Alert tone="info">{t.ownerPreview}</Alert>}
              {(l.status === 'paused' || l.status === 'sold' || l.status === 'expired') && <Alert tone="info">{t.unavailable[l.status]}</Alert>}
            </div>
          )}

          {gallery.length > 0 ? (
            <Gallery images={gallery} title={l.title} />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-neutral-100 text-sm text-neutral-500 sm:rounded-2xl">
              <Icon name="image" className="size-10 text-neutral-400" />
              {t.noPhotos}
            </div>
          )}

          <div className="space-y-5 px-4 sm:px-0">
            <div className="space-y-2">
              <nav aria-label="breadcrumb" className="flex flex-wrap gap-1 text-xs text-neutral-500">
                {countrySlug ? (
                  <Link href={`/${countrySlug}`} className="hover:underline">
                    {countryName}
                  </Link>
                ) : (
                  <Link href="/" className="hover:underline">
                    {t.breadcrumbHome}
                  </Link>
                )}
                {countrySlug && city && (
                  <span>
                    ›{' '}
                    <Link href={browsePath(countrySlug, city.slug, null)} className="hover:underline">
                      {city.nameFa}
                    </Link>
                  </span>
                )}
                {crumbs.map((c) => (
                  <span key={c.id}>
                    ›{' '}
                    {countrySlug ? (
                      <Link href={browsePath(countrySlug, city?.slug ?? null, c.slug)} className="hover:underline">
                        {c.nameFa}
                      </Link>
                    ) : (
                      c.nameFa
                    )}
                  </span>
                ))}
              </nav>
              <h1 className="text-xl leading-relaxed font-extrabold text-balance sm:text-2xl">
                {l.kind === 'wanted' && <span className="me-2 inline-block rounded-full bg-saffron-50 px-2.5 py-0.5 align-middle text-xs font-bold text-saffron-700">{t.wanted}</span>}
                {l.title}
              </h1>
              {price && (
                <p className="flex flex-wrap items-baseline gap-x-2 text-2xl font-black text-brand-700">
                  {warmRent && <span className="text-sm font-medium text-neutral-500">{t.coldRent}</span>}
                  {price}
                </p>
              )}
              {warmRent && (
                <p className="text-sm text-neutral-700">
                  {t.warmRent}: <span className="font-bold">{warmRent}</span>
                </p>
              )}
              {!isOwner && l.status === 'active' && <FavoriteButton token={l.publicToken} saved={savedByMe} back={path} variant="page" />}
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                {hasPlace && (
                  <span className="flex items-center gap-1">
                    <Icon name="pin" className="size-3.5" />
                    {place.local ? <bdi dir="ltr">{place.local}</bdi> : place.city}
                    {place.district && <span>· {place.district}</span>}
                  </span>
                )}
                {posted && (
                  <span className="flex items-center gap-1">
                    <Icon name="clock" className="size-3.5" />
                    <span title={t.postedOn(formatDate(posted, env.APP_TIME_ZONE))}>{formatAgo(posted, env.APP_TIME_ZONE)}</span>
                  </span>
                )}
              </p>
            </div>

            <div className="lg:hidden">{sellerBox}</div>

            {(details.length > 0 || l.shippingOffered || (place.local && place.city)) && (
              <section>
                <h2 className="mb-2 font-bold">{t.details}</h2>
                <dl className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
                  {place.local && place.city && <Row label={t.location} value={place.city} />}
                  {details.map((d) => (
                    <Row key={d.label} label={d.label} value={d.text} />
                  ))}
                  {l.shippingOffered && (
                    <Row
                      label={t.shipping}
                      value={
                        <span className="inline-flex items-center gap-1 text-brand-800">
                          <Icon name="truck" className="size-4" />
                          {messages.form.yes}
                        </span>
                      }
                    />
                  )}
                </dl>
              </section>
            )}
            {l.description && (
              <section>
                <h2 className="mb-2 font-bold">{t.description}</h2>
                <p className="leading-loose whitespace-pre-line text-neutral-800">{l.description}</p>
              </section>
            )}
            {l.point && l.countryCode && (
              <figure className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 p-4">
                <OutlineMap countryCode={l.countryCode} point={l.point} label={mapLabel} />
                <figcaption className="text-xs text-neutral-500">{mapLabel}</figcaption>
              </figure>
            )}
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">{sellerBox}</div>
        </aside>
      </div>
    </main>
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

