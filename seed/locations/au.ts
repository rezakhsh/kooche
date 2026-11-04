import type { LocationsSeed } from '../types';

// Australia: its states and territories and its cities of 100,000+ people (Greater Capital City areas and
// the coast's council areas, as Gumtree lists them), without the City of Port Phillip (part of Melbourne).
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only Sydney has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.

export const australia: LocationsSeed = {
  countryCode: 'AU',
  regions: [
    { slug: "australian-capital-territory", nameFa: "قلمرو پایتختی استرالیا", nameLocal: "Australian Capital Territory", geonamesId: 2177478, lat: -35.5, lng: 149.0, population: 475600, timezone: "Australia/Sydney" },
    { slug: 'new-south-wales', nameFa: 'نیو ساوت ولز', nameLocal: 'New South Wales', geonamesId: 2155400, lat: -33.0, lng: 146.0, population: 7317500, timezone: 'Australia/Sydney' },
    { slug: "northern-territory", nameFa: "قلمرو شمالی", nameLocal: "Northern Territory", geonamesId: 2064513, lat: -20.0, lng: 134.0, population: 260400, timezone: "Australia/Darwin" },
    { slug: "queensland", nameFa: "کوئینزلند", nameLocal: "Queensland", geonamesId: 2152274, lat: -20.0, lng: 145.0, population: 5647468, timezone: "Australia/Brisbane" },
    { slug: "south-australia", nameFa: "استرالیای جنوبی", nameLocal: "South Australia", geonamesId: 2061327, lat: -30.0, lng: 135.0, population: 1815485, timezone: "Australia/Adelaide" },
    { slug: "tasmania", nameFa: "تاسمانی", nameLocal: "Tasmania", geonamesId: 2147291, lat: -42.0, lng: 147.0, population: 571165, timezone: "Australia/Hobart" },
    { slug: "victoria", nameFa: "ویکتوریا", nameLocal: "Victoria", geonamesId: 2145234, lat: -37.0, lng: 145.0, population: 7012962, timezone: "Australia/Melbourne" },
    { slug: "western-australia", nameFa: "استرالیای غربی", nameLocal: "Western Australia", geonamesId: 2058645, lat: -25.0, lng: 122.0, population: 3008700, timezone: "Australia/Perth" },
  ],
  cities: [
    { slug: 'sydney', nameFa: 'سیدنی', nameLocal: 'Sydney', geonamesId: 2147714, region: 'new-south-wales', lat: -33.86785, lng: 151.20732, population: 4627345, timezone: 'Australia/Sydney', launch: { status: 'waitlist', goal: 20 } },
    { slug: "melbourne", nameFa: "ملبورن", nameLocal: "Melbourne", geonamesId: 2158177, region: "victoria", lat: -37.814, lng: 144.96332, population: 5435590, timezone: "Australia/Melbourne" },
    { slug: "brisbane", nameFa: "بریزبن", nameLocal: "Brisbane", geonamesId: 2174003, region: "queensland", lat: -27.46794, lng: 153.02809, population: 2780063, timezone: "Australia/Brisbane" },
    { slug: "perth", nameFa: "پرث", nameLocal: "Perth", geonamesId: 2063523, region: "western-australia", lat: -31.95224, lng: 115.8614, population: 2384371, timezone: "Australia/Perth" },
    { slug: "adelaide", nameFa: "آدلاید", nameLocal: "Adelaide", geonamesId: 2078025, region: "south-australia", lat: -34.92866, lng: 138.59863, population: 1469163, timezone: "Australia/Adelaide" },
    { slug: "gold-coast", nameFa: "گلد کوست", nameLocal: "Gold Coast", geonamesId: 2165087, region: "queensland", lat: -28.00029, lng: 153.43088, population: 640778, timezone: "Australia/Brisbane" },
    { slug: "newcastle", nameFa: "نیوکاسل", nameLocal: "Newcastle", geonamesId: 2155472, region: "new-south-wales", lat: -32.92953, lng: 151.7801, population: 508437, timezone: "Australia/Sydney" },
    { slug: "sunshine-coast", nameFa: "سان شاین کوست", nameLocal: "Sunshine Coast", geonamesId: 10630449, region: "queensland", lat: -26.65682, lng: 153.07955, population: 398840, timezone: "Australia/Brisbane" },
    { slug: "canberra", nameFa: "کانبرا", nameLocal: "Canberra", geonamesId: 2172517, region: "australian-capital-territory", lat: -35.28346, lng: 149.12807, population: 367752, timezone: "Australia/Sydney" },
    { slug: "central-coast", nameFa: "سنترال کوست", nameLocal: "Central Coast", geonamesId: 8310663, region: "new-south-wales", lat: -33.42979, lng: 151.37144, population: 346596, timezone: "Australia/Sydney" },
    { slug: "logan-city", nameFa: "لوگان سیتی", nameLocal: "Logan City", geonamesId: 7281838, region: "queensland", lat: -27.63917, lng: 153.10944, population: 345098, timezone: "Australia/Brisbane" },
    { slug: "geelong", nameFa: "جیلانگ", nameLocal: "Geelong", geonamesId: 2165798, region: "victoria", lat: -38.14711, lng: 144.36069, population: 282809, timezone: "Australia/Melbourne" },
    { slug: "wollongong", nameFa: "ولونگونگ", nameLocal: "Wollongong", geonamesId: 2171507, region: "new-south-wales", lat: -34.424, lng: 150.89345, population: 280153, timezone: "Australia/Sydney" },
    { slug: "hobart", nameFa: "هوبارت", nameLocal: "Hobart", geonamesId: 2163355, region: "tasmania", lat: -42.87936, lng: 147.32941, population: 254930, timezone: "Australia/Hobart" },
    { slug: "townsville", nameFa: "تاونزویل", nameLocal: "Townsville", geonamesId: 2146142, region: "queensland", lat: -19.26639, lng: 146.80569, population: 201313, timezone: "Australia/Brisbane" },
    { slug: "cairns", nameFa: "کرنز", nameLocal: "Cairns", geonamesId: 2172797, region: "queensland", lat: -16.92366, lng: 145.76613, population: 153075, timezone: "Australia/Brisbane" },
    { slug: "toowoomba", nameFa: "توومبا", nameLocal: "Toowoomba", geonamesId: 2146268, region: "queensland", lat: -27.56056, lng: 151.95386, population: 142163, timezone: "Australia/Brisbane" },
    { slug: "darwin", nameFa: "داروین", nameLocal: "Darwin", geonamesId: 2073124, region: "northern-territory", lat: -12.46113, lng: 130.84185, population: 139902, timezone: "Australia/Darwin" },
    { slug: "ballarat", nameFa: "بالارات", nameLocal: "Ballarat", geonamesId: 2177091, region: "victoria", lat: -37.56622, lng: 143.84957, population: 111973, timezone: "Australia/Melbourne" },
    { slug: "mandurah", nameFa: "مندورا", nameLocal: "Mandurah", geonamesId: 2067119, region: "western-australia", lat: -32.5269, lng: 115.7217, population: 107643, timezone: "Australia/Perth" },
    { slug: "bendigo", nameFa: "بندیگو", nameLocal: "Bendigo", geonamesId: 2176187, region: "victoria", lat: -36.75818, lng: 144.28024, population: 103034, timezone: "Australia/Melbourne" },
  ],
};
