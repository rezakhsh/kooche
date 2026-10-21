import type { EventCardData } from '../../components/event-card';
import { messages } from '../../messages/fa';
import type { Catalog } from '../listings/catalog';
import { imageUrl } from '../media/server';
import { eventPriceText } from './format';
import type { EventCardRow } from './queries';

// An event card's data from an event row (events pages, the seller page)

export function eventCardOf(catalog: Catalog, e: EventCardRow): EventCardData {
  const currency = e.currency ? catalog.currencies.get(e.currency) : undefined;
  const where = e.attendance === 'online' ? messages.events.card.online : [e.venueName, e.cityFa ?? e.placeName].filter(Boolean).join('، ');
  return {
    title: e.title,
    publicToken: e.publicToken,
    startsAt: e.startsAt,
    timeZone: e.timeZone,
    where: where || null,
    price: eventPriceText(e.priceType, e.priceMinor !== null && currency ? { minor: e.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null),
    attendance: e.attendance,
    scheduleStatus: e.scheduleStatus,
    moreDates: e.dateCount - 1,
    cover: e.coverKey ? imageUrl(e.coverKey, 'poster', 'webp') : null,
  };
}
