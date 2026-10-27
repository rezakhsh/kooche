import type { CardData } from '../../components/listing-card';
import { formatAgo } from '../../lib/format';
import { messages } from '../../messages/fa';
import { imageUrl } from '../media/server';
import type { BrowseItem } from '../search/browse';
import { cardFacts } from './attribute-text';
import { listingCurrency, type Catalog } from './catalog';
import { placeParts } from './place-text';
import { formatPrice } from './price';
import { listingPath } from './slug';

// A listing card's data from a card row (browse pages, the seller page)

export type CardRow = Omit<BrowseItem, 'distanceKm'> & { distanceKm?: number | null };

export function cardOf(catalog: Catalog, l: CardRow, timeZone: string): CardData {
  const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
  const noPrice = l.categoryId ? catalog.byId.get(l.categoryId)?.priceMode === 'none' : false;
  const price =
    l.priceMinor !== null && currency
      ? `${formatPrice(l.priceMinor, currency.code, currency.minorUnit)}${l.priceType === 'negotiable' ? ` (${messages.priceType.negotiable})` : ''}`
      : noPrice
        ? null
        : messages.priceType[l.priceType];
  const place = placeParts({ ...l, cityLocal: null }, messages.country.near);
  // Amounts in fields (salary) are in the listing's currency, else its country's
  const amountCurrency = listingCurrency(catalog, l);
  return {
    href: listingPath(l.title, l.publicToken),
    title: l.title,
    price,
    place: place.local ? { text: l.placeName!, latin: true } : place.city ? { text: place.city, latin: false } : null,
    // The last bump counts as new, as on Kleinanzeigen: a bumped listing says «۵ دقیقه پیش»
    ago: (l.rankedAt ?? l.publishedAt) ? formatAgo((l.rankedAt ?? l.publishedAt)!, timeZone) : null,
    cover: l.coverKey ? imageUrl(l.coverKey, 'card', 'webp') : null,
    photoCount: l.photoCount,
    wanted: l.kind === 'wanted',
    facts: cardFacts(catalog, l.categoryId, l.attributes, amountCurrency),
    distance: l.distanceKm != null ? messages.browse.distance(l.distanceKm) : null,
  };
}
