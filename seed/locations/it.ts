import type { LocationsSeed } from '../types';

// Italy: its regions and its comuni of 100,000+ people, without Rome's and Turin's districts; Venezia's
// mainland part Mestre (147,000) is counted as Venezia, whose GeoNames figure is the old town only.
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only Milano has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.
// Italy and Sweden start in April 2027, Paris in May (round 7 calendar); Milan first in Italy (round 5:
// Milan, Turin, Rome), Stockholm in Sweden (round 4); added Oct 29, 2026 so their countries have a «به‌زودی»
// page (wave 2 part 8).

export const italy: LocationsSeed = {
  countryCode: 'IT',
  regions: [
    { slug: "abruzzo", nameFa: "ابروتزو", nameLocal: "Abruzzo", geonamesId: 3183560, lat: 42.25, lng: 13.75, population: 1305770, timezone: "Europe/Rome" },
    { slug: "calabria", nameFa: "کالابریا", nameLocal: "Calabria", geonamesId: 2525468, lat: 39.0, lng: 16.5, population: 1877527, timezone: "Europe/Rome" },
    { slug: "campania", nameFa: "کامپانیا", nameLocal: "Campania", geonamesId: 3181042, lat: 40.91056, lng: 14.92053, population: 5801692, timezone: "Europe/Rome" },
    { slug: "emilia-romagna", nameFa: "امیلیا-رومانیا", nameLocal: "Emilia-Romagna", geonamesId: 3177401, lat: 44.5444, lng: 10.98361, population: 4459477, timezone: "Europe/Rome" },
    { slug: "friuli-venezia-giulia", nameFa: "فریولی ونتزیا جولیا", nameLocal: "Friuli-Venezia Giulia", geonamesId: 3176525, lat: 46.0, lng: 13.0, population: 1215220, timezone: "Europe/Rome" },
    { slug: "lazio", nameFa: "لاتزیو", nameLocal: "Lazio", geonamesId: 3174976, lat: 42.07762, lng: 12.77878, population: 5714882, timezone: "Europe/Rome" },
    { slug: "liguria", nameFa: "لیگوریا", nameLocal: "Liguria", geonamesId: 3174725, lat: 44.5, lng: 8.83333, population: 1550640, timezone: "Europe/Rome" },
    { slug: 'lombardia', nameFa: 'لومباردی', nameLocal: 'Lombardia', geonamesId: 3174618, lat: 45.66667, lng: 9.5, population: 10060574, timezone: 'Europe/Rome' },
    { slug: "piemonte", nameFa: "پیمونت", nameLocal: "Piemonte", geonamesId: 3170831, lat: 45.0, lng: 8.0, population: 4356522, timezone: "Europe/Rome" },
    { slug: "puglia", nameFa: "پولیا", nameLocal: "Puglia", geonamesId: 3169778, lat: 41.00164, lng: 16.73378, population: 4029681, timezone: "Europe/Rome" },
    { slug: "sardegna", nameFa: "ساردنی", nameLocal: "Sardegna", geonamesId: 2523228, lat: 40.0, lng: 9.0, population: 1628384, timezone: "Europe/Rome" },
    { slug: "sicilia", nameFa: "سیسیل", nameLocal: "Sicilia", geonamesId: 2523119, lat: 37.75, lng: 14.25, population: 4969147, timezone: "Europe/Rome" },
    { slug: "toscana", nameFa: "توسکانی", nameLocal: "Toscana", geonamesId: 3165361, lat: 43.41667, lng: 11.0, population: 3729641, timezone: "Europe/Rome" },
    { slug: "trentino-alto-adige", nameFa: "ترنتینو التو آدیجه", nameLocal: "Trentino-Alto Adige", geonamesId: 3165244, lat: 46.5, lng: 11.33333, population: 1071636, timezone: "Europe/Rome" },
    { slug: "umbria", nameFa: "اومبریا", nameLocal: "Umbria", geonamesId: 3165048, lat: 43.0, lng: 12.5, population: 882015, timezone: "Europe/Rome" },
    { slug: "veneto", nameFa: "ونتو", nameLocal: "Veneto", geonamesId: 3164604, lat: 45.5, lng: 11.75, population: 4906910, timezone: "Europe/Rome" },
  ],
  cities: [
    { slug: "roma", nameFa: "رم", nameLocal: "Roma", geonamesId: 3169070, region: "lazio", lat: 41.89193, lng: 12.51133, population: 2318895, timezone: "Europe/Rome" },
    { slug: 'milano', nameFa: 'میلان', nameLocal: 'Milano', geonamesId: 3173435, region: 'lombardia', lat: 45.46427, lng: 9.18951, population: 1236837, timezone: 'Europe/Rome', launch: { status: 'waitlist', goal: 15 } },
    { slug: "napoli", nameFa: "ناپل", nameLocal: "Napoli", geonamesId: 3172394, region: "campania", lat: 40.85216, lng: 14.26811, population: 909048, timezone: "Europe/Rome" },
    { slug: "torino", nameFa: "تورین", nameLocal: "Torino", geonamesId: 3165524, region: "piemonte", lat: 45.07049, lng: 7.68682, population: 847287, timezone: "Europe/Rome" },
    { slug: "palermo", nameFa: "پالرمو", nameLocal: "Palermo", geonamesId: 2523920, region: "sicilia", lat: 38.1166, lng: 13.3636, population: 648260, timezone: "Europe/Rome" },
    { slug: "genova", nameFa: "جنوا", nameLocal: "Genova", geonamesId: 3176219, region: "liguria", lat: 44.40478, lng: 8.94439, population: 580097, timezone: "Europe/Rome" },
    { slug: "bologna", nameFa: "بولونیا", nameLocal: "Bologna", geonamesId: 3181928, region: "emilia-romagna", lat: 44.49381, lng: 11.33875, population: 394843, timezone: "Europe/Rome" },
    { slug: "firenze", nameFa: "فلورانس", nameLocal: "Firenze", geonamesId: 3176959, region: "toscana", lat: 43.77925, lng: 11.24626, population: 367150, timezone: "Europe/Rome" },
    { slug: "bari", nameFa: "باری", nameLocal: "Bari", geonamesId: 3182351, region: "puglia", lat: 41.12066, lng: 16.86982, population: 316491, timezone: "Europe/Rome" },
    { slug: "catania", nameFa: "کاتانیا", nameLocal: "Catania", geonamesId: 2525068, region: "sicilia", lat: 37.49223, lng: 15.07041, population: 311584, timezone: "Europe/Rome" },
    { slug: "verona", nameFa: "ورونا", nameLocal: "Verona", geonamesId: 3164527, region: "veneto", lat: 45.43854, lng: 10.9938, population: 258031, timezone: "Europe/Rome" },
    { slug: "messina", nameFa: "مسینا", nameLocal: "Messina", geonamesId: 2524170, region: "sicilia", lat: 38.19394, lng: 15.55256, population: 219948, timezone: "Europe/Rome" },
    { slug: "trieste", nameFa: "تریسته", nameLocal: "Trieste", geonamesId: 3165185, region: "friuli-venezia-giulia", lat: 45.64953, lng: 13.77678, population: 204338, timezone: "Europe/Rome" },
    { slug: "padova", nameFa: "پادووا", nameLocal: "Padova", geonamesId: 3171728, region: "veneto", lat: 45.40797, lng: 11.88586, population: 203725, timezone: "Europe/Rome" },
    { slug: "brescia", nameFa: "برشا", nameLocal: "Brescia", geonamesId: 3181554, region: "lombardia", lat: 45.53558, lng: 10.21472, population: 200423, timezone: "Europe/Rome" },
    { slug: "taranto", nameFa: "تارانتو", nameLocal: "Taranto", geonamesId: 3165926, region: "puglia", lat: 40.46438, lng: 17.24707, population: 198585, timezone: "Europe/Rome" },
    { slug: "parma", nameFa: "پارما", nameLocal: "Parma", geonamesId: 3171457, region: "emilia-romagna", lat: 44.79935, lng: 10.32618, population: 198292, timezone: "Europe/Rome" },
    { slug: "prato", nameFa: "پراتو", nameLocal: "Prato", geonamesId: 3169921, region: "toscana", lat: 43.8805, lng: 11.09699, population: 195089, timezone: "Europe/Rome" },
    { slug: "modena", nameFa: "مودنا", nameLocal: "Modena", geonamesId: 3173331, region: "emilia-romagna", lat: 44.64783, lng: 10.92539, population: 184732, timezone: "Europe/Rome" },
    { slug: "reggio-calabria", nameFa: "رجو کالابریا", nameLocal: "Reggio Calabria", geonamesId: 2523630, region: "calabria", lat: 38.11047, lng: 15.66129, population: 182455, timezone: "Europe/Rome" },
    { slug: "reggio-emilia", nameFa: "رجو امیلیا", nameLocal: "Reggio Emilia", geonamesId: 3169522, region: "emilia-romagna", lat: 44.69825, lng: 10.63125, population: 171944, timezone: "Europe/Rome" },
    { slug: "livorno", nameFa: "لیورنو", nameLocal: "Livorno", geonamesId: 3174659, region: "toscana", lat: 43.54427, lng: 10.32615, population: 157017, timezone: "Europe/Rome" },
    { slug: "cagliari", nameFa: "کالیاری", nameLocal: "Cagliari", geonamesId: 2525473, region: "sardegna", lat: 39.23054, lng: 9.11917, population: 149257, timezone: "Europe/Rome" },
    { slug: "rimini", nameFa: "ریمینی", nameLocal: "Rimini", geonamesId: 3169361, region: "emilia-romagna", lat: 44.05755, lng: 12.56528, population: 148688, timezone: "Europe/Rome" },
    { slug: "foggia", nameFa: "فوجیا", nameLocal: "Foggia", geonamesId: 3176885, region: "puglia", lat: 41.45845, lng: 15.55188, population: 137032, timezone: "Europe/Rome" },
    { slug: "ferrara", nameFa: "فرارا", nameLocal: "Ferrara", geonamesId: 3177090, region: "emilia-romagna", lat: 44.83804, lng: 11.62057, population: 132009, timezone: "Europe/Rome" },
    { slug: "salerno", nameFa: "سالرنو", nameLocal: "Salerno", geonamesId: 3168673, region: "campania", lat: 40.67545, lng: 14.79328, population: 125797, timezone: "Europe/Rome" },
    { slug: "monza", nameFa: "مونتزا", nameLocal: "Monza", geonamesId: 3172629, region: "lombardia", lat: 45.58005, lng: 9.27246, population: 124398, timezone: "Europe/Rome" },
    { slug: "siracusa", nameFa: "سیراکوز", nameLocal: "Siracusa", geonamesId: 2523083, region: "sicilia", lat: 37.07542, lng: 15.28664, population: 121605, timezone: "Europe/Rome" },
    { slug: "bergamo", nameFa: "برگامو", nameLocal: "Bergamo", geonamesId: 3182164, region: "lombardia", lat: 45.69601, lng: 9.66721, population: 121200, timezone: "Europe/Rome" },
    { slug: "trento", nameFa: "ترنتو", nameLocal: "Trento", geonamesId: 3165243, region: "trentino-alto-adige", lat: 46.06787, lng: 11.12108, population: 120709, timezone: "Europe/Rome" },
    { slug: "perugia", nameFa: "پروجا", nameLocal: "Perugia", geonamesId: 3171180, region: "umbria", lat: 43.1122, lng: 12.38878, population: 120137, timezone: "Europe/Rome" },
    { slug: "pescara", nameFa: "پسکارا", nameLocal: "Pescara", geonamesId: 3171168, region: "abruzzo", lat: 42.4584, lng: 14.20283, population: 119554, timezone: "Europe/Rome" },
    { slug: "forli", nameFa: "فورلی", nameLocal: "Forlì", geonamesId: 3176746, region: "emilia-romagna", lat: 44.22177, lng: 12.04144, population: 116696, timezone: "Europe/Rome" },
    { slug: "vicenza", nameFa: "ویچنزا", nameLocal: "Vicenza", geonamesId: 3164419, region: "veneto", lat: 45.54672, lng: 11.5475, population: 111980, timezone: "Europe/Rome" },
    { slug: "terni", nameFa: "ترنی", nameLocal: "Terni", geonamesId: 3165771, region: "umbria", lat: 42.56335, lng: 12.64329, population: 111189, timezone: "Europe/Rome" },
    { slug: "pisa", nameFa: "پیزا", nameLocal: "Pisa", geonamesId: 3170647, region: "toscana", lat: 43.70853, lng: 10.4036, population: 109960, timezone: "Europe/Rome" },
    { slug: "bolzano", nameFa: "بولزانو", nameLocal: "Bolzano", geonamesId: 3181913, region: "trentino-alto-adige", lat: 46.49067, lng: 11.33982, population: 107436, timezone: "Europe/Rome" },
    { slug: "piacenza", nameFa: "پیاچنزا", nameLocal: "Piacenza", geonamesId: 3171058, region: "emilia-romagna", lat: 45.05242, lng: 9.69342, population: 103607, timezone: "Europe/Rome" },
    { slug: "novara", nameFa: "نووارا", nameLocal: "Novara", geonamesId: 3172189, region: "piemonte", lat: 45.44694, lng: 8.62118, population: 101916, timezone: "Europe/Rome" },
    { slug: "arezzo", nameFa: "آرتزو", nameLocal: "Arezzo", geonamesId: 3182884, region: "toscana", lat: 43.46276, lng: 11.88068, population: 100734, timezone: "Europe/Rome" },
    { slug: "udine", nameFa: "اودینه", nameLocal: "Udine", geonamesId: 3165072, region: "friuli-venezia-giulia", lat: 46.0693, lng: 13.23715, population: 100170, timezone: "Europe/Rome" },
    { slug: "venezia", nameFa: "ونیز", nameLocal: "Venezia", geonamesId: 3164603, region: "veneto", lat: 45.43713, lng: 12.33265, population: 51298, timezone: "Europe/Rome" },
  ],
};
