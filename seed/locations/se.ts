import type { LocationsSeed } from '../types';

// Sweden: its counties (län) and its cities of 100,000+ people, without Södermalm (part of Stockholm) and
// Sollentuna (GeoNames counts 139,000; the municipality has about 75,000).
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only Stockholm has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.
// Sweden starts in April 2027 (round 7 calendar), Stockholm first (round 4).

export const sweden: LocationsSeed = {
  countryCode: 'SE',
  regions: [
    { slug: "jonkopings-lan", nameFa: "استان یونشوپینگ", nameLocal: "Jönköpings län", geonamesId: 2702976, lat: 57.5, lng: 14.5, population: 368856, timezone: "Europe/Stockholm" },
    { slug: "orebro-lan", nameFa: "استان اوربرو", nameLocal: "Örebro län", geonamesId: 2686655, lat: 59.5, lng: 15.0, population: 308116, timezone: "Europe/Stockholm" },
    { slug: "ostergotlands-lan", nameFa: "استان اوسترگوتلاند", nameLocal: "Östergötlands län", geonamesId: 2685867, lat: 58.41667, lng: 15.75, population: 469872, timezone: "Europe/Stockholm" },
    { slug: "skane-lan", nameFa: "استان اسکونه", nameLocal: "Skåne län", geonamesId: 3337385, lat: 55.98333, lng: 13.5, population: 1421781, timezone: "Europe/Stockholm" },
    { slug: 'stockholms-lan', nameFa: 'استان استکهلم', nameLocal: 'Stockholms län', geonamesId: 2673722, lat: 59.5, lng: 18.0, population: 2377081, timezone: 'Europe/Stockholm' },
    { slug: "uppsala-lan", nameFa: "استان اوپسالا", nameLocal: "Uppsala län", geonamesId: 2666218, lat: 60.0, lng: 17.75, population: 404589, timezone: "Europe/Stockholm" },
    { slug: "vasterbottens-lan", nameFa: "استان وستربوتن", nameLocal: "Västerbottens län", geonamesId: 2664415, lat: 65.0, lng: 17.5, population: 234817, timezone: "Europe/Stockholm" },
    { slug: "vastmanlands-lan", nameFa: "استان وستمانلاند", nameLocal: "Västmanlands län", geonamesId: 2664179, lat: 59.75, lng: 16.33333, population: 320335, timezone: "Europe/Stockholm" },
    { slug: "vastra-gotalands-lan", nameFa: "استان وسترا گوتلاند", nameLocal: "Västra Götalands län", geonamesId: 3337386, lat: 58.0, lng: 13.0, population: 1767016, timezone: "Europe/Stockholm" },
  ],
  cities: [
    { slug: 'stockholm', nameFa: 'استکهلم', nameLocal: 'Stockholm', geonamesId: 2673730, region: 'stockholms-lan', lat: 59.32938, lng: 18.06871, population: 1515017, timezone: 'Europe/Stockholm', launch: { status: 'waitlist', goal: 20 } },
    { slug: "goteborg", nameFa: "یوتبری", nameLocal: "Göteborg", geonamesId: 2711537, region: "vastra-gotalands-lan", lat: 57.70716, lng: 11.96679, population: 608462, timezone: "Europe/Stockholm" },
    { slug: "malmo", nameFa: "مالمو", nameLocal: "Malmö", geonamesId: 2692969, region: "skane-lan", lat: 55.60587, lng: 13.00073, population: 362133, timezone: "Europe/Stockholm" },
    { slug: "uppsala", nameFa: "اوپسالا", nameLocal: "Uppsala", geonamesId: 2666199, region: "uppsala-lan", lat: 59.85882, lng: 17.63889, population: 177074, timezone: "Europe/Stockholm" },
    { slug: "linkoping", nameFa: "لینشوپینگ", nameLocal: "Linköping", geonamesId: 2694762, region: "ostergotlands-lan", lat: 58.41086, lng: 15.62157, population: 166673, timezone: "Europe/Stockholm" },
    { slug: "orebro", nameFa: "اوربرو", nameLocal: "Örebro", geonamesId: 2686657, region: "orebro-lan", lat: 59.27412, lng: 15.2066, population: 155989, timezone: "Europe/Stockholm" },
    { slug: "umea", nameFa: "اومئا", nameLocal: "Umeå", geonamesId: 602150, region: "vasterbottens-lan", lat: 63.82842, lng: 20.25972, population: 130224, timezone: "Europe/Stockholm" },
    { slug: "vasteras", nameFa: "وستروس", nameLocal: "Västerås", geonamesId: 2664454, region: "vastmanlands-lan", lat: 59.61617, lng: 16.55276, population: 127799, timezone: "Europe/Stockholm" },
    { slug: "jonkoping", nameFa: "یونشوپینگ", nameLocal: "Jönköping", geonamesId: 2702979, region: "jonkopings-lan", lat: 57.78145, lng: 14.15618, population: 112766, timezone: "Europe/Stockholm" },
    { slug: "helsingborg", nameFa: "هلسینگبورگ", nameLocal: "Helsingborg", geonamesId: 2706767, region: "skane-lan", lat: 56.04673, lng: 12.69437, population: 104250, timezone: "Europe/Stockholm" },
  ],
};
