import { eq } from 'drizzle-orm';
import type { Db } from '../../../db/drizzle';
import { listings, users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { ancestry, cachedCatalog, effectiveAttributes } from '../../../modules/listings/catalog';
import { maxImages, priceTypesFor } from '../../../modules/listings/listings';
import { amountInputValue } from '../../../modules/listings/price';
import { placeLabel, placeOfListing, placeValue, type Place } from '../../../modules/listings/places';
import { activeCountries, savedPlace } from '../../../modules/listings/queries';
import { storage } from '../../../modules/media/server';
import { photoView, type PhotoView } from './photo-view';
import type { FormProps } from './[id]/form';

// What the listing editor needs, for a saved listing or for a new one that exists only in the
// browser so far (`listing` null). Server code only. A new listing starts with the account's
// saved place, else in the country the visitor chose on the home page (`preferredCountry`).

type Listing = typeof listings.$inferSelect;
type Image = { id: string; status: PhotoView['status']; storageKey: string };

export async function editorData(
  db: Db,
  userId: string,
  categoryId: string,
  listing: Listing | null,
  images: Image[] = [],
  preferredCountry: string | null = null,
): Promise<{ form: FormProps; photos: { max: number; initial: PhotoView[]; enabled: boolean } }> {
  const [catalog, countries, saved, [me]] = await Promise.all([
    cachedCatalog(db),
    activeCountries(db),
    savedPlace(db, userId),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)),
  ]);
  const category = catalog.byId.get(categoryId)!;
  const currency = listing?.currency ? catalog.currencies.get(listing.currency) : undefined;
  const open = (code: string | null | undefined) => (code && countries.some((c) => c.code === code) ? code : null);

  let place: Place | null = null;
  let district = '';
  if (listing) {
    place = await placeOfListing(db, listing);
    district = listing.district ?? '';
  } else if (saved && open(saved.place.countryCode)) {
    place = saved.place;
    district = saved.district;
  }
  const countryCode = open(place?.countryCode) ?? open(listing?.countryCode) ?? open(preferredCountry) ?? countries[0]?.code ?? '';

  return {
    form: {
      listingId: listing?.id ?? null,
      categoryId,
      status: listing?.status ?? 'draft',
      categoryPath: ancestry(catalog, category.id).map((c) => c.nameFa),
      defs: effectiveAttributes(catalog, category.id).filter((d) => d.isActive),
      priceTypes: [...priceTypesFor(category.priceMode)],
      countries: countries.map((c) => ({ code: c.code, nameFa: c.nameFa, currencySymbol: c.currency.symbol })),
      needsName: me?.displayName === messages.account.defaultDisplayName,
      values: {
        kind: listing?.kind ?? 'offer',
        title: listing?.title ?? '',
        description: listing?.description ?? '',
        attributes: (listing?.attributes as Record<string, unknown>) ?? {},
        priceType: listing?.priceType ?? 'fixed',
        amount: listing?.priceMinor != null && currency ? amountInputValue(listing.priceMinor, currency.minorUnit) : '',
        place: {
          countryCode,
          place: place ? placeLabel(place) : '',
          placeValue: place ? placeValue(place) : '',
          district,
          area: listing?.locationPrecision === 'area' && listing.point ? listing.point : null,
          center: place?.center ?? null,
        },
        // Ticked until the account has a saved place, so the first listing's place is remembered
        rememberPlace: !saved,
        allowPhoneContact: listing?.allowPhoneContact ?? false,
        shippingOffered: listing?.shippingOffered ?? false,
      },
    },
    photos: { max: maxImages(category), initial: images.map(photoView), enabled: storage() !== null },
  };
}
