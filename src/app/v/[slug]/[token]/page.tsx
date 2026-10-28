import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import { OutlineMap } from '../../../../components/outline-map';
import { StreetMap } from '../../../../components/street-map';
import { ListingFooter } from '../../../../components/report-link';
import { FavoriteButton } from '../../../../components/favorite-button';
import { Icon, type IconName } from '../../../../components/icons';
import { clientIp } from '../../../../lib/client-ip';
import { valkey } from '../../../../lib/valkey';
import { countView } from '../../../../modules/listings/views';
import { streetMapView } from '../../../../modules/maps/street-map';
import { isFeatured } from '../../../../modules/payments/plans';
import { Alert, Card, LinkButton } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatAgo, formatDate, formatMonth } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { attributeText } from '../../../../modules/listings/attribute-text';
import { ancestry, cachedCatalog, effectiveAttributes, listingCurrency } from '../../../../modules/listings/catalog';
import { placeParts } from '../../../../modules/listings/place-text';
import { amountInputValue, formatPrice } from '../../../../modules/listings/price';
import { isEventListing } from '../../../../modules/events/queries';
import { eventPath } from '../../../../modules/events/slug';
import { favoriteCounts, savedAmong } from '../../../../modules/listings/favorites';
import { activeCountries, otherActiveListings, publicListing } from '../../../../modules/listings/queries';
import { browsePath } from '../../../../modules/search/paths';
import { similarListings } from '../../../../modules/search/browse';
import { sellerReplySpeed } from '../../../../modules/chat/response-time';
import { cardFacts } from '../../../../modules/listings/attribute-text';
import { cardOf } from '../../../../modules/listings/card';
import { safetyKind } from '../../../../modules/listings/safety-kind';
import { ListingCard } from '../../../../components/listing-card';
import { allCities } from '../../../../modules/search/places';
import { listingPath } from '../../../../modules/listings/slug';
import { imageSources, imageUrl } from '../../../../modules/media/server';
import { chatEntry } from '../../../../modules/chat/entry';
import { sellerPath } from '../../../../modules/users/profile';
import { currentSession } from '../../../../modules/users/server';
import { Contact } from './contact';
import { Gallery, type GalleryImage } from './gallery';
import { BackButton, CopyLink, ShareButton } from './photo-bar';

// The public listing page, /v/{persian-title}/{token}, rendered on the server. The token finds the
// listing; the title part is not checked, and the canonical link carries the current one.
// Never shown: the exact location (only postal code, place, district, and the street map with the
// postal code's area shaded, never a point), the phone number (fetched on request), internal ids.
// Wave 1 (mockup final/listing): on phones back, share and save over the photo, the site header and
// bottom bar out of the way, and a fixed bar with chat, phone and save; on computers title, price
// and contact in a card beside the photo. Fact tiles, a safety box for the category, the seller
// with how fast they usually answer, and similar listings.

type Params = { slug: string; token: string };

/** Icons of the fact tiles by field (mockup final/listing); others get a tick */
const FACT_ICONS: Record<string, IconName> = {
  area_m2: 'ruler',
  room_m2: 'ruler',
  living_m2: 'ruler',
  rooms: 'door',
  available_from: 'calendar',
  event_date: 'calendar',
  start_date: 'calendar',
  year: 'calendar',
  mileage_km: 'car',
};

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

  const { listing: l, images, seller, business, cityFa, cityLocal, neighbourhood } = data;
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
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  // A view for the seller's stats (src/modules/listings/views.ts); never the seller's own
  if (!isOwner && l.status === 'active') {
    await countView(valkey(), { listingId: l.id, ip: clientIp(requestHeaders), userAgent: requestHeaders.get('user-agent') }).catch(() => false);
  }
  const { published } = await searchParams;
  const country = l.countryCode ? (await activeCountries(appDb())).find((c) => c.code === l.countryCode) : undefined;
  const countrySlug = country?.slug ?? null;
  const countryName = country?.nameFa ?? '';
  const city = countrySlug && l.locationId ? ((await allCities(appDb())).find((c) => c.id === l.locationId) ?? null) : null;
  // The ♡ for visitors; the seller sees how many saved it instead (nobody else does)
  const [savedByMe, favCount, featured, replySpeed, others, similar, mapView] = await Promise.all([
    session && !isOwner ? savedAmong(appDb(), session.user.id, [l.id]).then((s) => s.has(l.id)) : Promise.resolve(false),
    isOwner ? favoriteCounts(appDb(), session!.user.id, [l.id]).then((m) => m.get(l.id) ?? 0) : Promise.resolve(null),
    l.status === 'active' ? isFeatured(appDb(), l.id) : Promise.resolve(false),
    sellerReplySpeed(appDb(), l.userId),
    otherActiveListings(appDb(), l),
    similarListings(appDb(), l),
    // The postal code's area, never a point (docs/setup.md, "The street map")
    streetMapView(appDb(), { countryCode: l.countryCode, postalCode: l.postalCode, placeName: l.placeName, point: l.point, precision: l.locationPrecision }, isOwner ? null : session?.user.id),
  ]);
  const facts = cardFacts(catalog, l.categoryId, attrs, amountCurrency);
  const safety = t.safetyBox[safetyKind(crumbs)];
  // Back from a shared link: the listing's category in its city
  const backHref = countrySlug ? browsePath(countrySlug, city?.slug ?? null, crumbs.at(-1)?.slug ?? null) : '/';
  // «ودینگ، 13351 Berlin» (mockup final/listing); without a postal code «ودینگ، برلین»
  const placeText = neighbourhood ? (place.local ? null : cityFa ? `${neighbourhood}، ${cityFa}` : neighbourhood) : null;
  const factIcon = (key?: string): IconName => (key && FACT_ICONS[key]) || 'check';
  const canContact = !!chat && l.status === 'active';

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
      seller: business ? { '@type': 'Organization', name: business.name, url: `${env.APP_URL}/b/${business.slug}` } : { '@type': 'Person', name: seller.displayName },
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
      {business ? (
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-extrabold text-brand-700">
            {[...business.name][0]}
          </span>
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-xs text-neutral-600">
              <Icon name="store" className="size-3.5" />
              {messages.business.label}
            </span>
            <Link href={`/b/${business.slug}`} className="flex items-center gap-1 truncate font-bold hover:underline">
              <bdi>{business.name}</bdi>
              {business.verificationStatus === 'verified' && <Icon name="verified" className="size-4 text-brand-700" />}
            </Link>
            <span className="block text-xs text-neutral-600">
              {messages.business.page.memberSince(formatMonth(business.createdAt, env.APP_TIME_ZONE))}
              {replySpeed && `، ${t.reply[replySpeed]}`}
            </span>
          </div>
          <Icon name="chevronEnd" className="size-4 text-neutral-500" />
        </div>
      ) : (
        <Link href={sellerPath(seller.publicToken)} className="flex items-center gap-3 hover:opacity-90">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-saffron-50 text-lg font-extrabold text-saffron-800">
            {[...seller.displayName][0]}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-bold">
              <bdi>{seller.displayName}</bdi>
            </span>
            <span className="block text-xs text-neutral-600">
              {t.memberSince(formatMonth(seller.createdAt, env.APP_TIME_ZONE))}
              {replySpeed && `، ${t.reply[replySpeed]}`}
            </span>
          </div>
          <Icon name="chevronEnd" className="size-4 text-neutral-500" />
        </Link>
      )}
      <div className="flex flex-wrap gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 text-xs font-bold leading-7 text-brand-800">
          <Icon name="shield" className="size-3.5" />
          {business?.verificationStatus === 'verified' ? messages.business.verified : t.phoneVerified}
        </span>
        {others > 0 && (
          <Link href={business ? `/b/${business.slug}` : sellerPath(seller.publicToken)} className="rounded-full bg-neutral-100 px-2.5 text-xs leading-7 text-neutral-700 hover:bg-neutral-200">
            {t.otherListings(others)}
          </Link>
        )}
      </div>
      {isOwner && favCount !== null && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-600" title={messages.favorites.countHint}>
          <Icon name="heart" className="size-4 text-red-600" />
          {messages.favorites.count(favCount)}
          <span className="sr-only">{messages.favorites.countHint}</span>
        </p>
      )}
      {isOwner && (
        <>
          <LinkButton href={`/my/listings/${l.id}`} variant="secondary" className="w-full">
            {t.edit}
          </LinkButton>
          {l.status === 'active' && (
            <LinkButton href={`/my/listings/${l.id}/promote`} variant="accent" className="mt-2 w-full">
              <Icon name="arrow-up" className="size-4" />
              {messages.promote.link}
            </LinkButton>
          )}
        </>
      )}
    </Card>
  );

  const safetyBox = (
    <section className="rounded-2xl bg-saffron-50 p-4 text-saffron-800">
      <h2 className="flex items-center gap-2 font-bold">
        <Icon name="alert" className="size-5" />
        {safety.title}
      </h2>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-7">
        {safety.points.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <Link href={safety.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-2">
        {safety.link}
      </Link>
    </section>
  );

  const placeLine = (
    <p className="flex flex-wrap items-center gap-x-1 text-sm text-neutral-600">
      {hasPlace && (
        <>
          <Icon name="pin" className="size-4" />
          {/* The neighbourhood where the city has them, then the postal code; the seller's own words after it */}
          {neighbourhood && place.local ? (
            <>
              {neighbourhood}، <bdi dir="ltr">{place.local}</bdi>
            </>
          ) : (
            (placeText ?? (place.local ? <bdi dir="ltr">{place.local}</bdi> : place.city))
          )}
          {place.district && <span>، {place.district}</span>}
          {posted && '،'}
        </>
      )}
      {posted && <span title={t.postedOn(formatDate(posted, env.APP_TIME_ZONE))}>{formatAgo(posted, env.APP_TIME_ZONE)}</span>}
    </p>
  );

  const titleBlock = (h: 'h1' | 'p') => {
    const Title = h;
    return (
      <div className="space-y-1">
        <Title className="text-xl leading-9 font-extrabold text-balance">
          {featured && (
            <span className="me-2 inline-flex items-center gap-1 rounded-full bg-saffron-500 px-2.5 py-0.5 align-middle text-xs font-bold text-ink">
              <Icon name="star" className="size-3" />
              {messages.featured.badge}
            </span>
          )}
          {l.kind === 'wanted' && <span className="me-2 inline-block rounded-full bg-saffron-50 px-2.5 py-0.5 align-middle text-xs font-bold text-saffron-700">{t.wanted}</span>}
          {l.title}
        </Title>
        {price && (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-black text-brand-800 lg:text-3xl">{price}</span>
            {/* «اجارهٔ سرد، با هزینه‌ها ۱٬۰۲۰ €» (mockup final/listing) */}
            {warmRent && <span className="text-sm text-neutral-700">{t.coldWithCosts(warmRent)}</span>}
          </p>
        )}
        {placeLine}
      </div>
    );
  };

  return (
    <main data-listing-page className={`mx-auto w-full max-w-6xl sm:px-6 lg:pt-6 ${canContact && !isOwner ? 'pb-28 lg:pb-6' : 'pb-6'}`}>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-8">
        <div className="min-w-0 space-y-5">
          {((published && !isOwner) || !PUBLIC.has(l.status) || l.status === 'paused' || l.status === 'sold' || l.status === 'expired') && (
            <div className="space-y-2 px-4 pt-4 sm:px-0 sm:pt-0">
              {published && !isOwner && <Alert tone="success">{messages.form.published}</Alert>}
              {!PUBLIC.has(l.status) && <Alert tone="info">{t.ownerPreview}</Alert>}
              {(l.status === 'paused' || l.status === 'sold' || l.status === 'expired') && <Alert tone="info">{t.unavailable[l.status]}</Alert>}
            </div>
          )}

          {/* Right after publishing (wave 1, mockup final/posted): share where people already are, then the boost */}
          {published && isOwner && l.status === 'active' && (
            <section className="mx-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 text-center sm:mx-0">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon name="check" className="size-8" />
              </span>
              <h2 className="mt-3 text-2xl font-extrabold">{t.posted.title}</h2>
              <p className="mt-1 text-base text-neutral-700">{t.posted.body(placeText ?? cityFa ?? countryName)}</p>
              <h3 className="mt-5 text-start font-extrabold">{t.posted.share}</h3>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(`${env.APP_URL}${path}`)}&text=${encodeURIComponent(l.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 bg-white text-sm font-bold hover:bg-neutral-50"
                >
                  <Icon name="send" className="size-5 text-brand-700" />
                  {t.posted.telegram}
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${l.title}\n${env.APP_URL}${path}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 bg-white text-sm font-bold hover:bg-neutral-50"
                >
                  <Icon name="chat" className="size-5 text-brand-700" />
                  {t.posted.whatsapp}
                </a>
                <CopyLink label={t.posted.copy} />
              </div>
              <Link href={`/my/listings/${l.id}/promote`} className="mt-5 flex items-center gap-3 rounded-2xl bg-saffron-50 p-4 text-start">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-saffron-500 text-ink">
                  <Icon name="arrowUp" className="size-5" />
                </span>
                <span className="flex-1">
                  <b className="block">{t.posted.promote}</b>
                  <span className="text-sm text-saffron-800">{t.posted.promoteText}</span>
                </span>
                <Icon name="chevronEnd" className="size-5 text-saffron-800" />
              </Link>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/my/listings" className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 bg-white font-bold">
                  {t.posted.mine}
                </Link>
                <Link href="/new" className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 bg-white font-bold">
                  {t.posted.another}
                </Link>
              </div>
            </section>
          )}

          <div className="relative">
            {gallery.length > 0 ? (
              <Gallery images={gallery} title={l.title} />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-neutral-100 text-sm text-neutral-600 sm:rounded-2xl">
                <Icon name="image" className="size-10 text-neutral-400" />
                {t.noPhotos}
              </div>
            )}
            {/* Phones: the site header is hidden here, so back, share and save sit over the photo */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3 lg:hidden">
              <BackButton fallback={backHref} />
              <span className="ms-auto">
                <ShareButton title={l.title} />
              </span>
              {!isOwner && l.status === 'active' && <FavoriteButton token={l.publicToken} saved={savedByMe} back={path} variant="photo" />}
            </div>
          </div>

          <div className="space-y-5 px-4 sm:px-0">
            <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-neutral-600">
              {/* From the city when there is one (mockup final/listing: «برلین › املاک › …») */}
              {countrySlug && city ? (
                <Link href={browsePath(countrySlug, city.slug, null)} className="hover:underline">
                  {city.nameFa}
                </Link>
              ) : countrySlug ? (
                <Link href={`/${countrySlug}`} className="hover:underline">
                  {countryName}
                </Link>
              ) : (
                <Link href="/" className="hover:underline">
                  {t.breadcrumbHome}
                </Link>
              )}
              {crumbs.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <Icon name="chevronEnd" className="size-3" />
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

            {/* The heading is the page's h1 on phones; on computers the card beside the photo has it */}
            <div className="lg:hidden">{titleBlock('h1')}</div>

            {facts.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {facts.map((f) => (
                  <li key={f.label} className="flex min-h-12 items-center gap-2 rounded-xl bg-neutral-50 px-3 text-sm font-bold">
                    <Icon name={factIcon(f.key)} className="size-5 shrink-0 text-brand-700" />
                    {!f.text.startsWith(f.label) && <span className="sr-only">{f.label}: </span>}
                    <bdi>{f.text}</bdi>
                  </li>
                ))}
              </ul>
            )}

            {!isOwner && <div className="lg:hidden">{safetyBox}</div>}
            <div className="lg:hidden">{sellerBox}</div>

            {l.description && (
              <section>
                <h2 className="mb-2 text-lg font-extrabold">{t.description}</h2>
                <p className="text-base leading-8 whitespace-pre-line text-neutral-800">{l.description}</p>
              </section>
            )}
            {(details.length > 0 || l.shippingOffered || (place.local && place.city && !neighbourhood)) && (
              <section>
                <h2 className="mb-1 text-lg font-extrabold">{t.details}</h2>
                <dl className="divide-y divide-neutral-200">
                  {place.local && place.city && !neighbourhood && <Row label={t.location} value={place.city} />}
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
            {mapView && (
              <section>
                <h2 className="mb-2 text-lg font-extrabold">{messages.map.section}</h2>
                <StreetMap
                  view={mapView}
                  label={messages.map.section}
                  fallback={l.countryCode ? <OutlineMap countryCode={l.countryCode} point={{ lng: mapView.center[0], lat: mapView.center[1] }} label={messages.map.section} /> : null}
                />
                <p className="mt-2 text-xs leading-6 text-neutral-600">
                  {mapView.area && l.postalCode ? messages.map.listingArea(l.postalCode) : mapView.circle ? messages.map.listingCircle : messages.map.listingCity}
                  {mapView.home && ` ${mapView.home.km < 1 ? messages.map.sameArea : messages.map.fromHome(messages.map.km(mapView.home.km))}`}
                </p>
              </section>
            )}
            {similar.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-extrabold">{t.similar}</h2>
                <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
                  {similar.map((x) => (
                    <li key={x.id} className="w-44 shrink-0 sm:w-auto">
                      <ListingCard card={cardOf(catalog, x, env.APP_TIME_ZONE)} view="grid" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <ListingFooter refNumber={l.refNumber} token={l.publicToken} isOwner={isOwner} isEvent={false} />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <Card className="space-y-3">
              {titleBlock('p')}
              {canContact && !isOwner && <Contact token={l.publicToken} allowPhone={l.allowPhoneContact} returnTo={path} chat={chat!} />}
              {!isOwner && l.status === 'active' && <FavoriteButton token={l.publicToken} saved={savedByMe} back={path} variant="page" />}
            </Card>
            {sellerBox}
            {!isOwner && safetyBox}
          </div>
        </aside>
      </div>

      {/* Phones: chat, phone and save always at hand */}
      {canContact && !isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <Contact token={l.publicToken} allowPhone={l.allowPhoneContact} returnTo={path} chat={chat!} layout="bar" save={<FavoriteButton token={l.publicToken} saved={savedByMe} back={path} variant="bar" />} />
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-[15px]">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="text-end font-bold">{value}</dd>
    </div>
  );
}

