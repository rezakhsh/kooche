// The languages an event may be in, per country (field audit part C). No runtime imports: the
// event form (a client component) uses it too.
import type { EVENT_LANGUAGES } from '../../db/schema/events';

export type EventLanguage = (typeof EVENT_LANGUAGES)[number];

/** Each country's own language among the event languages */
const EVENT_LOCAL_LANGUAGE: Readonly<Record<string, EventLanguage>> = {
  DE: 'de', AT: 'de', CH: 'de', LI: 'de', NL: 'nl', BE: 'nl', FR: 'fr', LU: 'fr', IT: 'it', SE: 'sv', TR: 'tr',
  GB: 'en', IE: 'en', US: 'en', CA: 'en', AU: 'en',
};

/**
 * The languages an event in this country may be in, in order: Persian, the country's own, English,
 * other (field audit part C: German only where it is spoken). Values saved before stay valid.
 */
export function eventLanguagesIn(country: string | null | undefined): EventLanguage[] {
  const local = country ? EVENT_LOCAL_LANGUAGE[country] : undefined;
  return [...new Set<EventLanguage>(['fa', ...(local ? [local] : []), 'en', 'other'])];
}
