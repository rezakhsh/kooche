import type { LocationsSeed } from '../types';

// United Kingdom: the 4 nations (regions) and its cities of 100,000+ people: the largest 50, without London's
// boroughs and areas (Croydon, Ilford, Walthamstow…), Sutton Coldfield (part of Birmingham) and GeoNames'
// districts (Mendip).
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only London has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.

export const unitedKingdom: LocationsSeed = {
  countryCode: 'GB',
  regions: [
    { slug: 'england', nameFa: 'انگلستان', nameLocal: 'England', geonamesId: 6269131, lat: 52.16045, lng: -0.70312, population: 54786300, timezone: 'Europe/London' },
    { slug: "northern-ireland", nameFa: "ایرلند شمالی", nameLocal: "Northern Ireland", geonamesId: 2641364, lat: 54.5, lng: -6.5, population: 1910543, timezone: "Europe/London" },
    { slug: "scotland", nameFa: "اسکاتلند", nameLocal: "Scotland", geonamesId: 2638360, lat: 56.0, lng: -4.0, population: 5439842, timezone: "Europe/London" },
    { slug: "wales", nameFa: "ولز", nameLocal: "Wales", geonamesId: 2634895, lat: 52.5, lng: -3.5, population: 3131640, timezone: "Europe/London" },
  ],
  cities: [
    { slug: 'london', nameFa: 'لندن', nameLocal: 'London', geonamesId: 2643743, region: 'england', lat: 51.50853, lng: -0.12574, population: 8961989, timezone: 'Europe/London', launch: { status: 'waitlist', goal: 30 } },
    { slug: "birmingham", nameFa: "بیرمنگام", nameLocal: "Birmingham", geonamesId: 2655603, region: "england", lat: 52.48142, lng: -1.89983, population: 1157603, timezone: "Europe/London" },
    { slug: "glasgow", nameFa: "گلاسگو", nameLocal: "Glasgow", geonamesId: 2648579, region: "scotland", lat: 55.86515, lng: -4.25763, population: 626410, timezone: "Europe/London" },
    { slug: "manchester", nameFa: "منچستر", nameLocal: "Manchester", geonamesId: 2643123, region: "england", lat: 53.48095, lng: -2.23743, population: 568996, timezone: "Europe/London" },
    { slug: "sheffield", nameFa: "شفیلد", nameLocal: "Sheffield", geonamesId: 2638077, region: "england", lat: 53.38297, lng: -1.4659, population: 556500, timezone: "Europe/London" },
    { slug: "leeds", nameFa: "لیدز", nameLocal: "Leeds", geonamesId: 2644688, region: "england", lat: 53.79648, lng: -1.54785, population: 536280, timezone: "Europe/London" },
    { slug: "edinburgh", nameFa: "ادینبرو", nameLocal: "Edinburgh", geonamesId: 2650225, region: "scotland", lat: 55.95206, lng: -3.19648, population: 514990, timezone: "Europe/London" },
    { slug: "liverpool", nameFa: "لیورپول", nameLocal: "Liverpool", geonamesId: 2644210, region: "england", lat: 53.41058, lng: -2.97794, population: 496770, timezone: "Europe/London" },
    { slug: "bristol", nameFa: "بریستول", nameLocal: "Bristol", geonamesId: 2654675, region: "england", lat: 51.45523, lng: -2.59665, population: 479024, timezone: "Europe/London" },
    { slug: "cardiff", nameFa: "کاردیف", nameLocal: "Cardiff", geonamesId: 2653822, region: "wales", lat: 51.48, lng: -3.18, population: 372089, timezone: "Europe/London" },
    { slug: "leicester", nameFa: "لستر", nameLocal: "Leicester", geonamesId: 2644668, region: "england", lat: 52.6386, lng: -1.13169, population: 368600, timezone: "Europe/London" },
    { slug: "bradford", nameFa: "بردفورد", nameLocal: "Bradford", geonamesId: 2654993, region: "england", lat: 53.79391, lng: -1.75206, population: 366187, timezone: "Europe/London" },
    { slug: "belfast", nameFa: "بلفاست", nameLocal: "Belfast", geonamesId: 2655984, region: "northern-ireland", lat: 54.59682, lng: -5.92541, population: 348005, timezone: "Europe/London" },
    { slug: "coventry", nameFa: "کاونتری", nameLocal: "Coventry", geonamesId: 2652221, region: "england", lat: 52.40656, lng: -1.51217, population: 345324, timezone: "Europe/London" },
    { slug: "birkenhead", nameFa: "برکنهد", nameLocal: "Birkenhead", geonamesId: 2655613, region: "england", lat: 53.39337, lng: -3.01479, population: 325264, timezone: "Europe/London" },
    { slug: "nottingham", nameFa: "ناتینگهام", nameLocal: "Nottingham", geonamesId: 2641170, region: "england", lat: 52.9536, lng: -1.15047, population: 323632, timezone: "Europe/London" },
    { slug: "reading", nameFa: "ردینگ", nameLocal: "Reading", geonamesId: 2639577, region: "england", lat: 51.45625, lng: -0.97113, population: 318014, timezone: "Europe/London" },
    { slug: "kingston-upon-hull", nameFa: "هال", nameLocal: "Kingston upon Hull", geonamesId: 2645425, region: "england", lat: 53.7446, lng: -0.33525, population: 314018, timezone: "Europe/London" },
    { slug: "preston", nameFa: "پرستون", nameLocal: "Preston", geonamesId: 2639912, region: "england", lat: 53.76282, lng: -2.70452, population: 313332, timezone: "Europe/London" },
    { slug: "swansea", nameFa: "سوانزی", nameLocal: "Swansea", geonamesId: 2636432, region: "wales", lat: 51.62079, lng: -3.94323, population: 300352, timezone: "Europe/London" },
    { slug: "newcastle-upon-tyne", nameFa: "نیوکاسل آپون تاین", nameLocal: "Newcastle upon Tyne", geonamesId: 2641673, region: "england", lat: 54.97328, lng: -1.61396, population: 300125, timezone: "Europe/London" },
    { slug: "southend-on-sea", nameFa: "ساوتند-آن-سی", nameLocal: "Southend-on-Sea", geonamesId: 2637433, region: "england", lat: 51.53782, lng: 0.71433, population: 295310, timezone: "Europe/London" },
    { slug: "brighton", nameFa: "برایتون", nameLocal: "Brighton", geonamesId: 2654710, region: "england", lat: 50.82838, lng: -0.13947, population: 283870, timezone: "Europe/London" },
    { slug: "derby", nameFa: "داربی", nameLocal: "Derby", geonamesId: 2651347, region: "england", lat: 52.92277, lng: -1.47663, population: 270468, timezone: "Europe/London" },
    { slug: "southampton", nameFa: "ساوتهمپتون", nameLocal: "Southampton", geonamesId: 2637487, region: "england", lat: 50.90395, lng: -1.40428, population: 269781, timezone: "Europe/London" },
    { slug: "wolverhampton", nameFa: "ولورهمپتون", nameLocal: "Wolverhampton", geonamesId: 2633691, region: "england", lat: 52.58547, lng: -2.12296, population: 263700, timezone: "Europe/London" },
    { slug: "plymouth", nameFa: "پلیموث", nameLocal: "Plymouth", geonamesId: 2640194, region: "england", lat: 50.37153, lng: -4.14305, population: 260203, timezone: "Europe/London" },
    { slug: "stoke-on-trent", nameFa: "استوک-آن-ترنت", nameLocal: "Stoke-on-Trent", geonamesId: 2636841, region: "england", lat: 53.00415, lng: -2.18538, population: 258366, timezone: "Europe/London" },
    { slug: "milton-keynes", nameFa: "میلتون کینز", nameLocal: "Milton Keynes", geonamesId: 2642465, region: "england", lat: 52.04172, lng: -0.75583, population: 256385, timezone: "Europe/London" },
    { slug: "northampton", nameFa: "نورثهمپتون", nameLocal: "Northampton", geonamesId: 2641430, region: "england", lat: 52.25, lng: -0.88333, population: 245899, timezone: "Europe/London" },
    { slug: "oldham", nameFa: "اولدهام", nameLocal: "Oldham", geonamesId: 2641022, region: "england", lat: 53.54051, lng: -2.1183, population: 237110, timezone: "Europe/London" },
    { slug: "luton", nameFa: "لوتن", nameLocal: "Luton", geonamesId: 2643339, region: "england", lat: 51.87967, lng: -0.41748, population: 225262, timezone: "Europe/London" },
    { slug: "portsmouth", nameFa: "پورتسموث", nameLocal: "Portsmouth", geonamesId: 2639996, region: "england", lat: 50.79899, lng: -1.09125, population: 208100, timezone: "Europe/London" },
    { slug: "swindon", nameFa: "سوئیندون", nameLocal: "Swindon", geonamesId: 2636389, region: "england", lat: 51.55797, lng: -1.78116, population: 201669, timezone: "Europe/London" },
    { slug: "dudley", nameFa: "دادلی", nameLocal: "Dudley", geonamesId: 2650839, region: "england", lat: 52.5, lng: -2.08333, population: 199059, timezone: "Europe/London" },
    { slug: "aberdeen", nameFa: "ابردین", nameLocal: "Aberdeen", geonamesId: 2657832, region: "scotland", lat: 57.14369, lng: -2.09814, population: 198590, timezone: "Europe/London" },
    { slug: "st-helens", nameFa: "سنت هلنز", nameLocal: "St Helens", geonamesId: 2638785, region: "england", lat: 53.45, lng: -2.73333, population: 183200, timezone: "Europe/London" },
    { slug: "ipswich", nameFa: "ایپسوییچ", nameLocal: "Ipswich", geonamesId: 2646057, region: "england", lat: 52.05917, lng: 1.15545, population: 178835, timezone: "Europe/London" },
    { slug: "wigan", nameFa: "ویگان", nameLocal: "Wigan", geonamesId: 2633948, region: "england", lat: 53.54296, lng: -2.63706, population: 175405, timezone: "Europe/London" },
    { slug: "warrington", nameFa: "وارینگتون", nameLocal: "Warrington", geonamesId: 2634739, region: "england", lat: 53.39254, lng: -2.58024, population: 172330, timezone: "Europe/London" },
    { slug: "walsall", nameFa: "والسال", nameLocal: "Walsall", geonamesId: 2634853, region: "england", lat: 52.58528, lng: -1.98396, population: 172141, timezone: "Europe/London" },
    { slug: "mansfield", nameFa: "منزفیلد", nameLocal: "Mansfield", geonamesId: 2643097, region: "england", lat: 53.13333, lng: -1.2, population: 171958, timezone: "Europe/London" },
    { slug: "sunderland", nameFa: "ساندرلند", nameLocal: "Sunderland", geonamesId: 2636531, region: "england", lat: 54.90465, lng: -1.38222, population: 170134, timezone: "Europe/London" },
    { slug: "slough", nameFa: "اسلاو", nameLocal: "Slough", geonamesId: 2637627, region: "england", lat: 51.50949, lng: -0.59541, population: 164793, timezone: "Europe/London" },
    { slug: "bournemouth", nameFa: "بورنموث", nameLocal: "Bournemouth", geonamesId: 2655095, region: "england", lat: 50.72048, lng: -1.8795, population: 163600, timezone: "Europe/London" },
    { slug: "peterborough", nameFa: "پیتربورو", nameLocal: "Peterborough", geonamesId: 2640354, region: "england", lat: 52.57364, lng: -0.24777, population: 163379, timezone: "Europe/London" },
    { slug: "oxford", nameFa: "آکسفورد", nameLocal: "Oxford", geonamesId: 2640729, region: "england", lat: 51.75222, lng: -1.25596, population: 162100, timezone: "Europe/London" },
    { slug: "newport", nameFa: "نیوپورت", nameLocal: "Newport", geonamesId: 2641598, region: "wales", lat: 51.58774, lng: -2.99835, population: 161506, timezone: "Europe/London" },
    { slug: "york", nameFa: "یورک", nameLocal: "York", geonamesId: 2633352, region: "england", lat: 53.95763, lng: -1.08271, population: 156135, timezone: "Europe/London" },
    { slug: "telford", nameFa: "تلفورد", nameLocal: "Telford", geonamesId: 3345439, region: "england", lat: 52.67659, lng: -2.44926, population: 155570, timezone: "Europe/London" },
  ],
};
