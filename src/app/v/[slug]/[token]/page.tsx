import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import { OutlineMap } from '../../../../components/outline-map';
import { Alert, Card, LinkButton } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatDate } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { ancestry, cachedCatalog, effectiveAttributes, type AttributeDef } from '../../../../modules/listings/catalog';
import { placeParts } from '../../../../modules/listings/place-text';
import { amountInputValue, formatPrice } from '../../../../modules/listings/price';
import { publicListing } from '../../../../modules/listings/queries';
import { listingPath } from '../../../../modules/listings/slug';
import { imageSources, imageUrl } from '../../../../modules/media/server';
import { currentSession } from '../../../../modules/users/server';
import { Contact } from './contact';

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

function attributeText(def: AttributeDef, value: unknown): string | null {
  if (value === undefined || value === null) return null;
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
  const details = defs.map((d) => ({ label: d.labelFa, text: attributeText(d, attrs[d.key]) })).filter((x) => x.text);
  const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
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
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { published } = await searchParams;

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

  const [cover, ...rest] = images;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap gap-1 text-xs text-neutral-500">
        <Link href="/" className="hover:underline">
          {t.breadcrumbHome}
        </Link>
        {crumbs.map((c) => (
          <span key={c.id}>› {c.nameFa}</span>
        ))}
      </nav>

      <div className="space-y-4">
        {published && <Alert tone="success">{messages.form.published}</Alert>}
        {!PUBLIC.has(l.status) && <Alert tone="info">{t.ownerPreview}</Alert>}
        {(l.status === 'paused' || l.status === 'sold' || l.status === 'expired') && <Alert tone="info">{t.unavailable[l.status]}</Alert>}

        {cover ? (
          <div className="space-y-2">
            <Photo image={cover} size="full" alt={l.title} priority />
            {rest.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {rest.map((img, i) => (
                  <li key={img.id}>
                    <Photo image={img} size="card" alt={t.photo(i + 2, images.length)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-500">{t.noPhotos}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <div>
              {l.kind === 'wanted' && <span className="mb-1 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{t.wanted}</span>}
              <h1 className="text-2xl font-bold leading-snug">{l.title}</h1>
              {l.publishedAt && <p className="mt-1 text-xs text-neutral-500">{t.postedOn(formatDate(l.publishedAt, env.APP_TIME_ZONE))}</p>}
            </div>
            <dl className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
              {price && <Row label={t.price} value={<span className="font-semibold">{price}</span>} />}
              {hasPlace && (
                <Row
                  label={t.location}
                  value={
                    <span className="flex flex-col items-end gap-0.5">
                      {place.local && <bdi dir="ltr">{place.local}</bdi>}
                      {place.city && <span className="text-neutral-600">{place.city}</span>}
                      {place.district && <span className="text-neutral-600">{place.district}</span>}
                    </span>
                  }
                />
              )}
              {details.map((d) => (
                <Row key={d.label} label={d.label} value={d.text} />
              ))}
              {l.shippingOffered && <Row label={t.shipping} value="✓" />}
            </dl>
            {l.point && l.countryCode && (
              <figure className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 p-4">
                <OutlineMap countryCode={l.countryCode} point={l.point} label={mapLabel} />
                <figcaption className="text-xs text-neutral-500">{mapLabel}</figcaption>
              </figure>
            )}
            {l.description && (
              <section>
                <h2 className="mb-2 font-semibold">{t.description}</h2>
                <p className="whitespace-pre-line leading-relaxed text-neutral-800">{l.description}</p>
              </section>
            )}
          </div>
          <aside>
            <Card className="space-y-4">
              <div>
                <span className="block text-xs text-neutral-500">{t.seller}</span>
                <span className="font-semibold">{seller.displayName}</span>
              </div>
              {isOwner ? (
                <LinkButton href={`/my/listings/${l.id}`} variant="secondary" className="w-full">
                  {t.edit}
                </LinkButton>
              ) : l.status === 'active' ? (
                <Contact token={l.publicToken} allowPhone={l.allowPhoneContact} returnTo={path} />
              ) : null}
            </Card>
          </aside>
        </div>
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

/**
 * AVIF with a WebP fallback from imgproxy, over the ThumbHash placeholder. The placeholder is a
 * data: image, not a style attribute: the CSP allows no inline styles.
 */
function Photo({
  image,
  size,
  alt,
  priority,
}: {
  image: { key: string; width: number | null; height: number | null; blur: string | null };
  size: 'full' | 'card';
  alt: string;
  priority?: boolean;
}) {
  const sources = imageSources(image.key, size);
  const placeholder = image.blur ? thumbHashToDataURL(Buffer.from(image.blur, 'base64')) : null;
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100">
      {placeholder && <img src={placeholder} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover blur-lg" />}
      {sources && (
        <picture>
          <source srcSet={sources.avif} type="image/avif" />
          <img
            src={sources.webp}
            alt={alt}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className={`relative size-full ${size === 'full' ? 'object-contain' : 'object-cover'}`}
          />
        </picture>
      )}
    </div>
  );
}
