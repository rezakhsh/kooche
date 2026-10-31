import type { LocationsSeed } from '../types';

// The first city of each country after Germany and Austria (round 12, mockup city-chooser): only
// that city, on a waitlist with its business goal, so the city chooser can list the country with
// «اول تورنتو: ۹ از ۳۰ کسب‌وکار» and people can join its list. The rest of each country's cities
// come when it opens (wave 2). Coordinates, population, time zones and IDs are from GeoNames
// (CC BY 4.0, see seed/README.md); Persian names are written by hand.

export const canada: LocationsSeed = {
  countryCode: 'CA',
  regions: [{ slug: 'ontario', nameFa: 'انتاریو', nameLocal: 'Ontario', geonamesId: 6093943, lat: 49.25014, lng: -84.49983, population: 12861940, timezone: 'America/Toronto' }],
  cities: [
    { slug: 'toronto', nameFa: 'تورنتو', nameLocal: 'Toronto', geonamesId: 6167865, region: 'ontario', lat: 43.70011, lng: -79.4163, population: 2600000, timezone: 'America/Toronto', launch: { status: 'waitlist', goal: 30 } },
  ],
};

export const unitedStates: LocationsSeed = {
  countryCode: 'US',
  regions: [{ slug: 'california', nameFa: 'کالیفرنیا', nameLocal: 'California', geonamesId: 5332921, lat: 37.25022, lng: -119.75126, population: 37691912, timezone: 'America/Los_Angeles' }],
  cities: [
    { slug: 'los-angeles', nameFa: 'لس‌آنجلس', nameLocal: 'Los Angeles', geonamesId: 5368361, region: 'california', lat: 34.05223, lng: -118.24368, population: 3971883, timezone: 'America/Los_Angeles', launch: { status: 'waitlist', goal: 30 } },
  ],
};

export const australia: LocationsSeed = {
  countryCode: 'AU',
  regions: [{ slug: 'new-south-wales', nameFa: 'نیو ساوت ولز', nameLocal: 'New South Wales', geonamesId: 2155400, lat: -33.0, lng: 146.0, population: 7317500, timezone: 'Australia/Sydney' }],
  cities: [
    { slug: 'sydney', nameFa: 'سیدنی', nameLocal: 'Sydney', geonamesId: 2147714, region: 'new-south-wales', lat: -33.86785, lng: 151.20732, population: 4627345, timezone: 'Australia/Sydney', launch: { status: 'waitlist', goal: 20 } },
  ],
};

export const unitedKingdom: LocationsSeed = {
  countryCode: 'GB',
  regions: [{ slug: 'england', nameFa: 'انگلستان', nameLocal: 'England', geonamesId: 6269131, lat: 52.16045, lng: -0.70312, population: 54786300, timezone: 'Europe/London' }],
  cities: [
    { slug: 'london', nameFa: 'لندن', nameLocal: 'London', geonamesId: 2643743, region: 'england', lat: 51.50853, lng: -0.12574, population: 8961989, timezone: 'Europe/London', launch: { status: 'waitlist', goal: 30 } },
  ],
};

export const netherlands: LocationsSeed = {
  countryCode: 'NL',
  regions: [{ slug: 'noord-holland', nameFa: 'هلند شمالی', nameLocal: 'Noord-Holland', geonamesId: 2749879, lat: 52.58333, lng: 4.91667, population: 2639000, timezone: 'Europe/Amsterdam' }],
  cities: [
    { slug: 'amsterdam', nameFa: 'آمستردام', nameLocal: 'Amsterdam', geonamesId: 2759794, region: 'noord-holland', lat: 52.37403, lng: 4.88969, population: 741636, timezone: 'Europe/Amsterdam', launch: { status: 'waitlist', goal: 15 } },
  ],
};

// Italy and Sweden start in April 2027, Paris in May (round 7 calendar); Milan first in Italy
// (round 5: Milan, Turin, Rome), Stockholm in Sweden (round 4). Added Oct 29, 2026 so their
// countries have a «به‌زودی» page (wave 2 part 8).
export const italy: LocationsSeed = {
  countryCode: 'IT',
  regions: [{ slug: 'lombardia', nameFa: 'لومباردی', nameLocal: 'Lombardia', geonamesId: 3174618, lat: 45.66667, lng: 9.5, population: 10060574, timezone: 'Europe/Rome' }],
  cities: [
    { slug: 'milano', nameFa: 'میلان', nameLocal: 'Milano', geonamesId: 3173435, region: 'lombardia', lat: 45.46427, lng: 9.18951, population: 1236837, timezone: 'Europe/Rome', launch: { status: 'waitlist', goal: 15 } },
  ],
};

export const sweden: LocationsSeed = {
  countryCode: 'SE',
  regions: [{ slug: 'stockholms-lan', nameFa: 'استان استکهلم', nameLocal: 'Stockholms län', geonamesId: 2673722, lat: 59.5, lng: 18.0, population: 2377081, timezone: 'Europe/Stockholm' }],
  cities: [
    { slug: 'stockholm', nameFa: 'استکهلم', nameLocal: 'Stockholm', geonamesId: 2673730, region: 'stockholms-lan', lat: 59.32938, lng: 18.06871, population: 1515017, timezone: 'Europe/Stockholm', launch: { status: 'waitlist', goal: 20 } },
  ],
};

export const france: LocationsSeed = {
  countryCode: 'FR',
  regions: [{ slug: 'ile-de-france', nameFa: 'ایل‌دوفرانس', nameLocal: 'Île-de-France', geonamesId: 3012874, lat: 48.5, lng: 2.5, population: 11959807, timezone: 'Europe/Paris' }],
  cities: [
    { slug: 'paris', nameFa: 'پاریس', nameLocal: 'Paris', geonamesId: 2988507, region: 'ile-de-france', lat: 48.85341, lng: 2.3488, population: 2138551, timezone: 'Europe/Paris', launch: { status: 'waitlist', goal: 20 } },
  ],
};

// Turkey is a guide country (no marketplace): Istanbul's waitlist is the page's «خبرم کن» (design
// check, Oct 31, 2026); its goal only counts once Turkey's mode changes.
export const turkey: LocationsSeed = {
  countryCode: 'TR',
  regions: [{ slug: 'istanbul-province', nameFa: 'استان استانبول', nameLocal: 'İstanbul', geonamesId: 745042, lat: 41.03508, lng: 28.98331, population: 15907951, timezone: 'Europe/Istanbul' }],
  cities: [
    { slug: 'istanbul', nameFa: 'استانبول', nameLocal: 'İstanbul', geonamesId: 745044, region: 'istanbul-province', lat: 41.01384, lng: 28.94966, population: 15701602, timezone: 'Europe/Istanbul', launch: { status: 'waitlist', goal: 30 } },
  ],
};
