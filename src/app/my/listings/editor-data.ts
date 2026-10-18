import { eq } from 'drizzle-orm';
import type { Db } from '../../../db/drizzle';
import { listings, users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { ancestry, cachedCatalog, effectiveAttributes, listingCurrency } from '../../../modules/listings/catalog';
import { maxImages, priceTypesFor } from '../../../modules/listings/listings';
import { amountInputValue } from '../../../modules/listings/price';
import { placeLabel, placeOfListing, placeValue, type Place } from '../../../modules/listings/places';
import { postingCountry } from '../../../modules/listings/posting-country';
import { activeCountries, savedPlace } from '../../../modules/listings/queries';
import { storage } from '../../../modules/media/server';
import { photoView, type PhotoView } from './photo-view';
import type { FormProps } from './[id]/form';

// What the listing editor needs, for a saved listing or for a new one that exists only in the
// browser so far (`listing` null). Server code only. The country is the listing's own, else the
// one the visitor chose on the home page (`preferredCountry`), else the saved place's.

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

  // The country is fixed (decided Oct 17, 2026, src/modules/listings/posting-country.ts). The
  // saved place fills in a new listing only when it is in that country.
  const countryCode = postingCountry({
    listingCountry: listing?.countryCode ?? null,
    chosen: preferredCountry,
    saved: saved?.place.countryCode ?? null,
    open: countries.map((c) => c.code),
  });
  let place: Place | null = null;
  let district = '';
  if (listing) {
    place = await placeOfListing(db, listing);
    district = listing.district ?? '';
  } else if (saved && saved.place.countryCode === countryCode) {
    place = saved.place;
    district = saved.district;
  }
  const country = countries.find((c) => c.code === countryCode);
  const defs = effectiveAttributes(catalog, category.id).filter((d) => d.isActive);

  // Stored amounts are minor units; the form shows them as typed, like the price
  const attributes = { ...((listing?.attributes as Record<string, unknown>) ?? {}) };
  const minorUnit = (listing && listingCurrency(catalog, listing)?.minorUnit) ?? country?.currency.minorUnit ?? 2;
  for (const d of defs) {
    const a = attributes[d.key];
    if (d.validation.money && typeof a === 'number') attributes[d.key] = amountInputValue(a, minorUnit);
  }

  return {
    form: {
      listingId: listing?.id ?? null,
      categoryId,
      status: listing?.status ?? 'draft',
      categoryPath: ancestry(catalog, category.id).map((c) => c.nameFa),
      defs,
      priceTypes: [...priceTypesFor(category.priceMode)],
      country: country ? { code: country.code, nameFa: country.nameFa, currencySymbol: country.currency.symbol, currencyName: country.currency.nameFa } : null,
      // Only a listing that has no country yet may still take another one
      countryChangeable: !listing?.countryCode,
      needsName: me?.displayName === messages.account.defaultDisplayName,
      values: {
        kind: listing?.kind ?? 'offer',
        title: listing?.title ?? '',
        description: listing?.description ?? '',
        attributes,
        priceType: listing?.priceType ?? 'fixed',
        amount: listing?.priceMinor != null && currency ? amountInputValue(listing.priceMinor, currency.minorUnit) : '',
        place: {
          countryCode: countryCode ?? '',
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
