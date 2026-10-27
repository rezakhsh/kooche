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
