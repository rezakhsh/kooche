import type { LocationsSeed } from '../types';

// Netherlands: its provinces and its places of 100,000+ people, without Amsterdam's stadsdelen.
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only Amsterdam has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.

export const netherlands: LocationsSeed = {
  countryCode: 'NL',
  regions: [
    { slug: "flevoland", nameFa: "فلیوولاند", nameLocal: "Flevoland", geonamesId: 3319179, lat: 52.53333, lng: 5.66667, population: 444701, timezone: "Europe/Amsterdam" },
    { slug: "friesland", nameFa: "فریسلاند", nameLocal: "Friesland", geonamesId: 2755812, lat: 53.16667, lng: 5.83333, population: 659551, timezone: "Europe/Amsterdam" },
    { slug: "gelderland", nameFa: "خلدرلاند", nameLocal: "Gelderland", geonamesId: 2755634, lat: 52.0, lng: 5.83333, population: 2133708, timezone: "Europe/Amsterdam" },
    { slug: "groningen", nameFa: "استان خرونینگن", nameLocal: "Groningen", geonamesId: 2755249, lat: 53.25, lng: 6.75, population: 596075, timezone: "Europe/Amsterdam" },
    { slug: "limburg", nameFa: "لیمبورخ", nameLocal: "Limburg", geonamesId: 2751596, lat: 51.25, lng: 6.0, population: 1128367, timezone: "Europe/Amsterdam" },
    { slug: "noord-brabant", nameFa: "برابانت شمالی", nameLocal: "Noord-Brabant", geonamesId: 2749990, lat: 51.66667, lng: 5.0, population: 2626210, timezone: "Europe/Amsterdam" },
    { slug: 'noord-holland', nameFa: 'هلند شمالی', nameLocal: 'Noord-Holland', geonamesId: 2749879, lat: 52.58333, lng: 4.91667, population: 2639000, timezone: 'Europe/Amsterdam' },
    { slug: "overijssel", nameFa: "افریسل", nameLocal: "Overijssel", geonamesId: 2748838, lat: 52.41667, lng: 6.5, population: 1184333, timezone: "Europe/Amsterdam" },
    { slug: "utrecht", nameFa: "استان اوترخت", nameLocal: "Utrecht", geonamesId: 2745909, lat: 52.0, lng: 5.25, population: 1387643, timezone: "Europe/Amsterdam" },
    { slug: "zuid-holland", nameFa: "هلند جنوبی", nameLocal: "Zuid-Holland", geonamesId: 2743698, lat: 52.0, lng: 4.66667, population: 3804906, timezone: "Europe/Amsterdam" },
  ],
  cities: [
    { slug: "rotterdam", nameFa: "رتردام", nameLocal: "Rotterdam", geonamesId: 2747891, region: "zuid-holland", lat: 51.9225, lng: 4.47917, population: 868135, timezone: "Europe/Amsterdam" },
    { slug: 'amsterdam', nameFa: 'آمستردام', nameLocal: 'Amsterdam', geonamesId: 2759794, region: 'noord-holland', lat: 52.37403, lng: 4.88969, population: 741636, timezone: 'Europe/Amsterdam', launch: { status: 'waitlist', goal: 15 } },
    { slug: "den-haag", nameFa: "لاهه", nameLocal: "Den Haag", geonamesId: 2747373, region: "zuid-holland", lat: 52.07667, lng: 4.29861, population: 474292, timezone: "Europe/Amsterdam" },
    { slug: "utrecht", nameFa: "اوترخت", nameLocal: "Utrecht", geonamesId: 2745912, region: "utrecht", lat: 52.09083, lng: 5.12222, population: 376435, timezone: "Europe/Amsterdam" },
    { slug: "groningen", nameFa: "خرونینگن", nameLocal: "Groningen", geonamesId: 2755251, region: "groningen", lat: 53.21917, lng: 6.56667, population: 244807, timezone: "Europe/Amsterdam" },
    { slug: "eindhoven", nameFa: "آیندهوون", nameLocal: "Eindhoven", geonamesId: 2756253, region: "noord-brabant", lat: 51.44083, lng: 5.47778, population: 235691, timezone: "Europe/Amsterdam" },
    { slug: "tilburg", nameFa: "تیلبورخ", nameLocal: "Tilburg", geonamesId: 2746301, region: "noord-brabant", lat: 51.55551, lng: 5.0913, population: 221947, timezone: "Europe/Amsterdam" },
    { slug: "breda", nameFa: "بردا", nameLocal: "Breda", geonamesId: 2758401, region: "noord-brabant", lat: 51.58656, lng: 4.77596, population: 184126, timezone: "Europe/Amsterdam" },
    { slug: "nijmegen", nameFa: "نیمیخن", nameLocal: "Nijmegen", geonamesId: 2750053, region: "gelderland", lat: 51.8425, lng: 5.85278, population: 177359, timezone: "Europe/Amsterdam" },
    { slug: "almere", nameFa: "آلمره", nameLocal: "Almere", geonamesId: 2759879, region: "flevoland", lat: 52.37025, lng: 5.21413, population: 176432, timezone: "Europe/Amsterdam" },
    { slug: "haarlem", nameFa: "هارلم", nameLocal: "Haarlem", geonamesId: 2755003, region: "noord-holland", lat: 52.38084, lng: 4.63683, population: 162543, timezone: "Europe/Amsterdam" },
    { slug: "arnhem", nameFa: "آرنهم", nameLocal: "Arnhem", geonamesId: 2759661, region: "gelderland", lat: 51.98, lng: 5.91111, population: 162424, timezone: "Europe/Amsterdam" },
    { slug: "s-hertogenbosch", nameFa: "سرتوخنبوس", nameLocal: "'s-Hertogenbosch", geonamesId: 2747351, region: "noord-brabant", lat: 51.69917, lng: 5.30417, population: 160783, timezone: "Europe/Amsterdam" },
    { slug: "enschede", nameFa: "انسخده", nameLocal: "Enschede", geonamesId: 2756071, region: "overijssel", lat: 52.21833, lng: 6.89583, population: 153655, timezone: "Europe/Amsterdam" },
    { slug: "zaanstad", nameFa: "زانستات", nameLocal: "Zaanstad", geonamesId: 2744114, region: "noord-holland", lat: 52.45313, lng: 4.81356, population: 140085, timezone: "Europe/Amsterdam" },
    { slug: "amersfoort", nameFa: "آمرسفورت", nameLocal: "Amersfoort", geonamesId: 2759821, region: "utrecht", lat: 52.155, lng: 5.3875, population: 139914, timezone: "Europe/Amsterdam" },
    { slug: "apeldoorn", nameFa: "اپلدورن", nameLocal: "Apeldoorn", geonamesId: 2759706, region: "gelderland", lat: 52.21, lng: 5.96944, population: 136670, timezone: "Europe/Amsterdam" },
    { slug: "hoofddorp", nameFa: "هوفددورپ", nameLocal: "Hoofddorp", geonamesId: 2753801, region: "noord-holland", lat: 52.3025, lng: 4.68889, population: 132734, timezone: "Europe/Amsterdam" },
    { slug: "zwolle", nameFa: "زووله", nameLocal: "Zwolle", geonamesId: 2743477, region: "overijssel", lat: 52.5125, lng: 6.09444, population: 129840, timezone: "Europe/Amsterdam" },
    { slug: "leeuwarden", nameFa: "لیوواردن", nameLocal: "Leeuwarden", geonamesId: 2751792, region: "friesland", lat: 53.20271, lng: 5.80973, population: 124481, timezone: "Europe/Amsterdam" },
    { slug: "maastricht", nameFa: "ماستریخت", nameLocal: "Maastricht", geonamesId: 2751283, region: "limburg", lat: 50.84833, lng: 5.68889, population: 122378, timezone: "Europe/Amsterdam" },
    { slug: "leiden", nameFa: "لیدن", nameLocal: "Leiden", geonamesId: 2751773, region: "zuid-holland", lat: 52.15833, lng: 4.49306, population: 119713, timezone: "Europe/Amsterdam" },
    { slug: "dordrecht", nameFa: "دوردرخت", nameLocal: "Dordrecht", geonamesId: 2756669, region: "zuid-holland", lat: 51.81, lng: 4.67361, population: 119260, timezone: "Europe/Amsterdam" },
    { slug: "zoetermeer", nameFa: "زوترمیر", nameLocal: "Zoetermeer", geonamesId: 2743856, region: "zuid-holland", lat: 52.0575, lng: 4.49306, population: 115845, timezone: "Europe/Amsterdam" },
    { slug: "venlo", nameFa: "فنلو", nameLocal: "Venlo", geonamesId: 2745641, region: "limburg", lat: 51.37, lng: 6.16806, population: 101988, timezone: "Europe/Amsterdam" },
  ],
};
