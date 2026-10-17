import { eq } from 'drizzle-orm';
import type { Db } from '../../../db/drizzle';
import { listings, users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { ancestry, cachedCatalog, effectiveAttributes } from '../../../modules/listings/catalog';
import { maxImages, priceTypesFor } from '../../../modules/listings/listings';
import { amountInputValue } from '../../../modules/listings/price';
import { activeCities } from '../../../modules/listings/queries';
import { storage } from '../../../modules/media/server';
import { photoView, type PhotoView } from './photo-view';
import type { FormProps } from './[id]/form';

// What the listing editor needs, for a saved listing or for a new one that exists only in the
// browser so far (`listing` null). Server code only.

type Listing = typeof listings.$inferSelect;
type Image = { id: string; status: PhotoView['status']; storageKey: string };

export async function editorData(
  db: Db,
  userId: string,
  categoryId: string,
  listing: Listing | null,
  images: Image[] = [],
): Promise<{ form: FormProps; photos: { max: number; initial: PhotoView[]; enabled: boolean } }> {
  const [catalog, cities, [me]] = await Promise.all([
    cachedCatalog(db),
    activeCities(db),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)),
  ]);
  const category = catalog.byId.get(categoryId)!;
  const currency = listing?.currency ? catalog.currencies.get(listing.currency) : undefined;
  const city = cities.find((c) => c.id === listing?.locationId);

  return {
    form: {
      listingId: listing?.id ?? null,
      categoryId,
      status: listing?.status ?? 'draft',
      categoryPath: ancestry(catalog, category.id).map((c) => c.nameFa),
      defs: effectiveAttributes(catalog, category.id).filter((d) => d.isActive),
      priceTypes: [...priceTypesFor(category.priceMode)],
      currencies: [...catalog.currencies.values()].map((c) => ({ code: c.code, label: `${c.nameFa} (${c.symbol})` })),
      cities: cities.map((c) => ({ id: c.id, label: c.regionFa ? `${c.nameFa}، ${c.regionFa}` : c.nameFa, currency: c.defaultCurrency })),
      needsName: me?.displayName === messages.account.defaultDisplayName,
      values: {
        kind: listing?.kind ?? 'offer',
        title: listing?.title ?? '',
        description: listing?.description ?? '',
        attributes: (listing?.attributes as Record<string, unknown>) ?? {},
        priceType: listing?.priceType ?? 'fixed',
        amount: listing?.priceMinor != null && currency ? amountInputValue(listing.priceMinor, currency.minorUnit) : '',
        currency: listing?.currency ?? city?.defaultCurrency ?? cities[0]?.defaultCurrency ?? 'EUR',
        locationId: listing?.locationId ?? '',
        district: listing?.district ?? '',
        area: listing?.locationPrecision === 'area' && listing.point ? listing.point : null,
        allowPhoneContact: listing?.allowPhoneContact ?? false,
        shippingOffered: listing?.shippingOffered ?? false,
      },
    },
    photos: { max: maxImages(category), initial: images.map(photoView), enabled: storage() !== null },
  };
}
