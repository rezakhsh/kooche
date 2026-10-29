import { eq } from 'drizzle-orm';
import type { Db } from '../../db/drizzle';
import { eventDetails, listings, locations, users } from '../../db/schema';
import { messages } from '../../messages/fa';
import { DEFAULT_TIME_ZONE } from '../../modules/events/events';
import { formatLocalDate, formatLocalTime, localParts } from '../../modules/events/time';
import { EVENT_ROOT_SLUG, cachedCatalog } from '../../modules/listings/catalog';
import { maxImages } from '../../modules/listings/listings';
import { amountInputValue } from '../../modules/listings/price';
import { placeLabel, placeOfListing, placeValue, type Place } from '../../modules/listings/places';
import { postingCountry } from '../../modules/listings/posting-country';
import { savedPlace } from '../../modules/listings/queries';
import { storage } from '../../modules/media/server';
import { myBusinesses } from '../../modules/organizations/organizations';
import { streetMapVersion } from '../../modules/maps/street-map';
import { turnstileSiteKey } from '../../modules/security/server';
import { photoView, type PhotoView } from '../my/listings/photo-view';
import type { EventFormProps } from './form';
import { preparingCountries } from '../../modules/launch/country-page';

// What the event editor needs, for a saved event or for a new one that exists only in the browser
// (`event` null). Server code only. The local times are shown in the event's own time zone.

type Image = { id: string; status: PhotoView['status']; storageKey: string };

export async function eventEditorData(
  db: Db,
  userId: string,
  event: {
    listing: typeof listings.$inferSelect;
    details: typeof eventDetails.$inferSelect;
    dates: { startsAt: Date; endsAt: Date }[];
    images: Image[];
  } | null,
  preferred: { countryCode: string | null; typeSlug: string | null },
): Promise<{ form: EventFormProps; photos: { max: number; initial: PhotoView[]; enabled: boolean } }> {
  const [catalog, countries, saved, [me], businesses] = await Promise.all([
    cachedCatalog(db),
    preparingCountries(db),
    savedPlace(db, userId),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)),
    myBusinesses(db, userId),
  ]);
  const root = catalog.bySlug.get(EVENT_ROOT_SLUG);
  const types = (root?.childIds ?? []).map((id) => catalog.byId.get(id)!).filter((c) => c.isActive && c.allowsListings);
  const l = event?.listing ?? null;
  const d = event?.details ?? null;
  // The country is fixed, like for every listing (src/modules/listings/posting-country.ts)
  const countryCode = postingCountry({
    listingCountry: l?.countryCode ?? null,
    chosen: preferred.countryCode,
    saved: saved?.place.countryCode ?? null,
    countries,
  });
  let place: Place | null = null;
  if (l) place = await placeOfListing(db, l);
  else if (saved && saved.place.countryCode === countryCode) place = saved.place;
  const currency = l?.currency ? catalog.currencies.get(l.currency) : undefined;

  const tz = d?.timeZone ?? DEFAULT_TIME_ZONE;
  const first = event?.dates[0];
  const start = first ? localParts(first.startsAt, tz) : null;
  const end = first ? localParts(first.endsAt, tz) : null;
  const sameDay = start && end && start.y === end.y && start.m === end.m && start.d === end.d;
  const overnight = first && !sameDay && first.endsAt.getTime() - first.startsAt.getTime() < 24 * 3_600_000;

  const preferredType = preferred.typeSlug ? catalog.bySlug.get(preferred.typeSlug) : undefined;
  // «به وقت برلین»: the city of the place, else of the saved place, else the default zone's
  const cityId = place?.locationId ?? null;
  const [city] = cityId ? await db.select({ nameFa: locations.nameFa }).from(locations).where(eq(locations.id, cityId)) : [];
  return {
    form: {
      listingId: l?.id ?? null,
      status: l?.status ?? 'draft',
      types: types.map((c) => ({ id: c.id, nameFa: c.nameFa })),
      // Only the event's country: shown as fixed text
      countries: countries.filter((c) => c.code === countryCode).map((c) => ({ code: c.code, nameFa: c.nameFa, currencySymbol: c.currency.symbol })),
      countryChangeable: !l?.countryCode,
      needsName: me?.displayName === messages.account.defaultDisplayName,
      userName: me?.displayName ?? '',
      cityName: city?.nameFa ?? messages.notifications.defaultCity,
      postAs: {
        options: businesses.filter((b) => !countryCode || b.countryCode === countryCode).map((b) => ({ id: b.id, name: b.name, slug: b.slug, legal: b.legal })),
        locked: !!l && l.status !== 'draft',
      },
      turnstileSiteKey: turnstileSiteKey(),
      mapVersion: streetMapVersion(),
      values: {
        categoryId: l?.categoryId ?? (preferredType && types.some((t) => t.id === preferredType.id) ? preferredType.id : ''),
        title: l?.title ?? '',
        description: l?.description ?? '',
        priceType: l && ['free', 'fixed', 'on_request'].includes(l.priceType) ? (l.priceType as 'free' | 'fixed' | 'on_request') : 'free',
        amount: l?.priceMinor != null && currency ? amountInputValue(l.priceMinor, currency.minorUnit) : '',
        place: {
          countryCode: countryCode ?? '',
          place: place ? placeLabel(place) : '',
          placeValue: place ? placeValue(place) : '',
          district: '',
          area: l?.locationPrecision === 'area' && l.point ? l.point : null,
          center: place?.center ?? null,
        },
        allowPhoneContact: l?.allowPhoneContact ?? false,
        startDate: start ? formatLocalDate(start) : '',
        startTime: start ? formatLocalTime(start) : '',
        // An end on the next morning is read from the time alone, like the organizer typed it
        endDate: end && !sameDay && !overnight ? formatLocalDate(end) : '',
        endTime: end && !d?.openEnd ? formatLocalTime(end) : '',
        repeat: d?.repeat ?? 'none',
        repeatUntil: d?.repeatUntil ?? '',
        attendance: d?.attendance ?? 'in_person',
        venueName: d?.venueName ?? '',
        streetAddress: d?.streetAddress ?? '',
        pin: d?.venuePin ? `${d.venuePin.lat},${d.venuePin.lng}` : '',
        onlineUrl: d?.onlineUrl ?? '',
        ticketUrl: d?.ticketUrl ?? '',
        organizerName: d?.organizerName ?? '',
        languages: (d?.languages ?? ['fa']) as ('fa' | 'de' | 'en' | 'other')[],
        minAge: d?.minAge ? String(d.minAge) : '',
        scheduleStatus: d?.scheduleStatus ?? 'scheduled',
        timeZone: tz,
        seating: d?.seating ?? '',
        stepFree: d?.stepFree == null ? '' : d.stepFree ? 'yes' : 'no',
        doorSales: d?.doorSales == null ? '' : d.doorSales ? 'yes' : 'no',
        refundNote: d?.refundNote ?? '',
        performers: (d?.performers ?? []).map((p) => ({ name: p.name, role: p.role ?? '' })),
        organizationId: l?.organizationId ?? '',
      },
    },
    photos: {
      max: maxImages(l?.categoryId ? catalog.byId.get(l.categoryId) : root),
      initial: (event?.images ?? []).map(photoView),
      enabled: storage() !== null,
    },
  };
}
