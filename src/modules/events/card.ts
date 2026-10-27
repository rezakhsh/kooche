import type { EventCardData } from '../../components/event-card';
import type { EventRowData } from '../../components/event-row';
import { messages } from '../../messages/fa';
import type { Catalog } from '../listings/catalog';
import { imageUrl } from '../media/server';
import { cardDate, eventPriceText } from './format';
import type { EventCardRow } from './queries';
import { inSeason, type ActiveSeason } from './seasons';

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

const dayFormat = (timeZone: string) => {
  const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { weekday: 'long', timeZone });
  const dayMonth = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', timeZone });
  return (d: Date) => `${weekday.format(d)}، ${dayMonth.format(d)}`;
};

/** A row of the wave 1 list (src/components/event-row.tsx) from an event row */
export function eventRowOf(catalog: Catalog, e: EventCardRow, ctx: { saved: Set<string>; season: ActiveSeason | null }): EventRowData {
  const currency = e.currency ? catalog.currencies.get(e.currency) : undefined;
  const online = e.attendance === 'online';
  const where = online ? messages.events.card.online : [e.venueName, e.neighbourhood ?? e.cityFa ?? e.placeName].filter(Boolean).join('، ');
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: e.timeZone, ...o }).format(e.startsAt);
  return {
    id: e.id,
    title: e.title,
    publicToken: e.publicToken,
    day: dayFormat(e.timeZone)(e.startsAt),
    time: cardDate(e.startsAt, e.timeZone).time,
    badge: { day: part({ day: 'numeric' }), month: part({ month: 'short' }) },
    where: where || null,
    online,
    price: eventPriceText(e.priceType, e.priceMinor !== null && currency ? { minor: e.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null),
    free: e.priceType === 'free',
    dates: e.dateCount,
    going: e.going,
    season: ctx.season && inSeason(ctx.season, e.title, e.startsAt) ? messages.events.seasons.names[ctx.season.key]! : null,
    organizer: e.organizerName,
    organizerVerified: e.organizerVerified,
    scheduleStatus: e.scheduleStatus,
    typeName: e.categoryId ? (catalog.byId.get(e.categoryId)?.nameFa ?? null) : null,
    cover: e.coverKey ? imageUrl(e.coverKey, 'poster', 'webp') : null,
    saved: ctx.saved.has(e.id),
  };
}
