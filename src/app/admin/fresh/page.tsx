import Link from 'next/link';
import { Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin, faDigits, messages } from '../../../messages/fa';
import { freshListings } from '../../../modules/admin/queue';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { riskyParts } from '../../../modules/admin/risky';
import { eventPath } from '../../../modules/events/slug';
import { rentUnit } from '../../../modules/listings/card';
import { ancestry, cachedCatalog } from '../../../modules/listings/catalog';
import { formatPrice } from '../../../modules/listings/price';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { PUBLIC_REASONS } from '../../../modules/moderation/reasons';
import { typicalPrice } from '../../../modules/search/browse';
import { Flag } from '../../../components/flag';
import { countryNameFa } from '../../../modules/listings/zones';
import { Highlighted } from '../items/parts';
import { AdminTitle, Ago } from '../ui';
import { FreshList, type FreshItem } from './cards';

// The quick look at new listings from accounts under 7 days and from numbers of another zone (wave 2
// part 5): the moderation routine, list B, until the AI review takes this over. Since Nov 3, 2026
// (owner: staff need the photos, title, description and price to decide) one wide card each, with
// approve and take down on the card (./cards.tsx).

export default async function FreshPage() {
  await requireStaff('listing.moderate');
  const db = appDb();
  const [rows, catalog] = await Promise.all([freshListings(db), cachedCatalog(db)]);
  const t = admin.fresh;
  const it = admin.item;

  // Much cheaper than the middle of similar listings is a classic sign (as on the item page)
  const cheaper = await Promise.all(
    rows.map(async (r) => {
      const price = r.price_minor === null ? null : Number(r.price_minor);
      if (!price || !r.category_id || !r.country_code || (r.price_type !== 'fixed' && r.price_type !== 'negotiable')) return null;
      const typical = await typicalPrice(db, { countryCode: r.country_code, categoryIds: [r.category_id], locationId: r.location_id }).catch(() => null);
      if (!typical || price >= typical.low) return null;
      const pct = Math.round((1 - price / ((typical.low + typical.high) / 2)) * 100);
      return pct > 0 ? pct : null;
    }),
  );

  const items: FreshItem[] = rows.map((r, n) => {
    const cur = r.currency ? catalog.currencies.get(r.currency) : undefined;
    const price = r.price_minor === null ? null : Number(r.price_minor);
    const unit = rentUnit(catalog, r.category_id, price);
    const priceText =
      price !== null && cur
        ? `${formatPrice(price, cur.code, cur.minorUnit)}${unit ? ` ${unit}` : ''}`
        : r.price_type && r.price_type !== 'fixed'
          ? (messages.priceType as Record<string, string>)[r.price_type]
          : null;
    const categories = r.category_id ? ancestry(catalog, r.category_id).map((c) => c.nameFa).join(' › ') : null;
    const place = [r.district, r.place_name ?? r.city].filter(Boolean).join('، ');
    const risky = riskyParts(`${r.title}\n${r.description ?? ''}`).some((x) => x.risky);
    const site = r.is_event ? eventPath(r.title, r.token) : listingPath(r.title, r.token);
    const flags = [
      cheaper[n] ? <Pill key="cheap" tone="danger">{it.cheaper(cheaper[n]!)}</Pill> : null,
      r.same_text > 0 ? <Pill key="same" tone="saffron">{it.sameText(r.same_text)}</Pill> : null,
      r.other_zone ? (
        <span key="zone" className="flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 text-xs font-bold leading-7 text-saffron-800">
          <Flag code={r.other_zone} className="h-3 w-4" />
          {t.otherZone(countryNameFa(r.other_zone))}
        </span>
      ) : null,
      r.images.length === 0 ? <Pill key="nophoto" tone="neutral">{it.noPhotos}</Pill> : null,
      r.is_event ? <Pill key="event" tone="brand">{it.kinds.event}</Pill> : null,
    ].filter(Boolean);
    return {
      id: r.id,
      title: r.title,
      reviewHref: adminHref(`/items/listing/${r.id}`),
      photos: r.images.map((k) => ({ thumb: imageUrl(k, 'card', 'webp'), full: imageUrl(k, 'full', 'webp') })),
      body: (
        <div className="flex h-full flex-col gap-2 text-sm">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
            {categories && <span>{categories}</span>}
            <a href={site} target="_blank" rel="noreferrer" className="ms-auto font-bold text-brand-800 hover:underline">
              {admin.common.viewOnSite}
            </a>
          </p>
          <h2 className="text-lg font-extrabold leading-8" dir="auto">
            <Highlighted text={r.title} />
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-neutral-700">
            {priceText && <b className="text-base text-brand-800">{priceText}</b>}
            {place && <span>{place}</span>}
            <span className="text-xs text-neutral-500">
              {it.code} {faDigits(String(r.ref_number))}
            </span>
          </p>
          {flags.length > 0 && <p className="flex flex-wrap gap-1.5">{flags}</p>}
          {r.description ? (
            <p className="max-h-80 overflow-y-auto rounded-xl bg-neutral-50 p-3 leading-7 whitespace-pre-line text-neutral-800" dir="auto">
              <Highlighted text={r.description} />
            </p>
          ) : (
            <p className="text-neutral-500">{admin.common.none}</p>
          )}
          {risky && <p className="text-xs text-neutral-600">{it.riskyNote}</p>}
          <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-neutral-600">
            <Link href={adminHref(`/items/user/${r.seller_id}`)} prefetch={false} className="font-bold text-neutral-800 hover:underline">
              <bdi>{r.seller}</bdi>
            </Link>
            <span>
              {t.sellerAge('')}
              <Ago date={new Date(r.seller_since)} />
            </span>
            <span>{t.sellerOthers(r.seller_others)}</span>
            <span className="ms-auto">
              {it.published}: <Ago date={new Date(r.published_at)} />
            </span>
          </p>
        </div>
      ),
    };
  });

  const reasons = PUBLIC_REASONS.listing.map((code) => ({ code, label: messages.report.reasons[code] ?? code, template: admin.decide.templates[code] ?? '' }));

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{t.empty}</p>
      ) : (
        <FreshList items={items} reasons={reasons} />
      )}
    </>
  );
}
