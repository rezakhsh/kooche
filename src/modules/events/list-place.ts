import type { Queryable } from '../../db/drizzle';
import { EVENT_ROOT_SLUG, type Catalog } from '../listings/catalog';
import { activeCountries, type Country } from '../listings/queries';
import { DEFAULT_TIME_ZONE } from './events';
import { CHEAP_MAJOR, stateFilter, type EventsState } from './list-params';
import { cityBySlug, type EventFilter } from './queries';

// Where an events list is (a country, or a city of it) and what its filters need: the event
// types, the time zone the days are read in, and «تا ۲۰ €» in the country's currency. Shared by
// the list page and its live count.

export type EventsPlace = {
  country: Country;
  city: { id: string; slug: string; nameFa: string; timeZone: string } | null;
  timeZone: string;
};

export async function eventsPlace(db: Queryable, countrySlug: string, citySlug: string | null): Promise<EventsPlace | null> {
  const country = (await activeCountries(db)).find((c) => c.slug === countrySlug);
  if (!country) return null;
  if (!citySlug) return { country, city: null, timeZone: DEFAULT_TIME_ZONE };
  const city = await cityBySlug(db, country.code, citySlug);
  return city ? { country, city, timeZone: city.timeZone || DEFAULT_TIME_ZONE } : null;
}

/** The event types (leaf categories under «رویدادها») that are open */
export function eventTypes(catalog: Catalog) {
  return (catalog.bySlug.get(EVENT_ROOT_SLUG)?.childIds ?? []).map((id) => catalog.byId.get(id)!).filter((c) => c.isActive);
}

export function cheapMinor(place: EventsPlace): number {
  return CHEAP_MAJOR * 10 ** place.country.currency.minorUnit;
}

export function placeFilter(catalog: Catalog, place: EventsPlace, s: EventsState, now: Date): EventFilter {
  const types = eventTypes(catalog);
  return stateFilter(s, {
    countryCode: place.country.code,
    locationId: place.city?.id ?? null,
    typeIds: (slug) => types.find((c) => c.slug === slug)?.id ?? null,
    cheapMinor: cheapMinor(place),
    now,
    timeZone: place.timeZone,
  });
}
