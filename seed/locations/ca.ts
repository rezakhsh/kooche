import type { LocationsSeed } from '../types';

// Canada: its provinces and its cities of 100,000+ people: the largest 50, without the boroughs and former
// towns merged into a bigger city (Montréal's arrondissements, Etobicoke, Nepean, Dartmouth, Thornhill…).
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only Toronto has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.

export const canada: LocationsSeed = {
  countryCode: 'CA',
  regions: [
    { slug: "alberta", nameFa: "آلبرتا", nameLocal: "Alberta", geonamesId: 5883102, lat: 52.28333, lng: -117.469, population: 4368370, timezone: "America/Edmonton" },
    { slug: "british-columbia", nameFa: "بریتیش کلمبیا", nameLocal: "British Columbia", geonamesId: 5909050, lat: 53.99983, lng: -125.0032, population: 5000879, timezone: "America/Vancouver" },
    { slug: "manitoba", nameFa: "مانیتوبا", nameLocal: "Manitoba", geonamesId: 6065171, lat: 55.00019, lng: -97.00049, population: 1342153, timezone: "America/Winnipeg" },
    { slug: "newfoundland-and-labrador", nameFa: "نیوفاندلند و لابرادور", nameLocal: "Newfoundland and Labrador", geonamesId: 6354959, lat: 52.0, lng: -56.0, population: 510550, timezone: "America/St_Johns" },
    { slug: "nova-scotia", nameFa: "نوا اسکوشیا", nameLocal: "Nova Scotia", geonamesId: 6091530, lat: 45.00015, lng: -62.99865, population: 969383, timezone: "America/Halifax" },
    { slug: 'ontario', nameFa: 'انتاریو', nameLocal: 'Ontario', geonamesId: 6093943, lat: 49.25014, lng: -84.49983, population: 12861940, timezone: 'America/Toronto' },
    { slug: "quebec", nameFa: "استان کبک", nameLocal: "Québec", geonamesId: 6115047, lat: 52.00017, lng: -71.99907, population: 8501840, timezone: "America/Toronto" },
    { slug: "saskatchewan", nameFa: "ساسکاچوان", nameLocal: "Saskatchewan", geonamesId: 6141242, lat: 54.0001, lng: -106.00099, population: 1132505, timezone: "America/Regina" },
  ],
  cities: [
    { slug: 'toronto', nameFa: 'تورنتو', nameLocal: 'Toronto', geonamesId: 6167865, region: 'ontario', lat: 43.70011, lng: -79.4163, population: 2600000, timezone: 'America/Toronto', launch: { status: 'waitlist', goal: 30 } },
    { slug: "montreal", nameFa: "مونترال", nameLocal: "Montréal", geonamesId: 6077243, region: "quebec", lat: 45.50884, lng: -73.58781, population: 1762949, timezone: "America/Toronto" },
    { slug: "calgary", nameFa: "کالگری", nameLocal: "Calgary", geonamesId: 5913490, region: "alberta", lat: 51.05011, lng: -114.08529, population: 1306784, timezone: "America/Edmonton" },
    { slug: "ottawa", nameFa: "اتاوا", nameLocal: "Ottawa", geonamesId: 6094817, region: "ontario", lat: 45.41117, lng: -75.69812, population: 1017449, timezone: "America/Toronto" },
    { slug: "edmonton", nameFa: "ادمونتون", nameLocal: "Edmonton", geonamesId: 5946768, region: "alberta", lat: 53.55014, lng: -113.46871, population: 1010899, timezone: "America/Edmonton" },
    { slug: "winnipeg", nameFa: "وینیپگ", nameLocal: "Winnipeg", geonamesId: 6183235, region: "manitoba", lat: 49.8844, lng: -97.14704, population: 749607, timezone: "America/Winnipeg" },
    { slug: "mississauga", nameFa: "میسیساگا", nameLocal: "Mississauga", geonamesId: 6075357, region: "ontario", lat: 43.5789, lng: -79.6583, population: 717961, timezone: "America/Toronto" },
    { slug: "vancouver", nameFa: "ونکوور", nameLocal: "Vancouver", geonamesId: 6173331, region: "british-columbia", lat: 49.24966, lng: -123.11934, population: 662248, timezone: "America/Vancouver" },
    { slug: "brampton", nameFa: "برمپتون", nameLocal: "Brampton", geonamesId: 5907364, region: "ontario", lat: 43.68341, lng: -79.76633, population: 656480, timezone: "America/Toronto" },
    { slug: "hamilton", nameFa: "همیلتون", nameLocal: "Hamilton", geonamesId: 5969782, region: "ontario", lat: 43.25011, lng: -79.84963, population: 569353, timezone: "America/Toronto" },
    { slug: "surrey", nameFa: "سوری", nameLocal: "Surrey", geonamesId: 6159905, region: "british-columbia", lat: 49.10635, lng: -122.82509, population: 568322, timezone: "America/Vancouver" },
    { slug: "quebec", nameFa: "کبک", nameLocal: "Québec", geonamesId: 6325494, region: "quebec", lat: 46.81228, lng: -71.21454, population: 531902, timezone: "America/Toronto" },
    { slug: "halifax", nameFa: "هلیفکس", nameLocal: "Halifax", geonamesId: 6324729, region: "nova-scotia", lat: 44.64269, lng: -63.57688, population: 471559, timezone: "America/Halifax" },
    { slug: "laval", nameFa: "لاوال", nameLocal: "Laval", geonamesId: 6050610, region: "quebec", lat: 45.56995, lng: -73.692, population: 438366, timezone: "America/Toronto" },
    { slug: "london-on", nameFa: "لندن", nameLocal: "London", geonamesId: 6058560, region: "ontario", lat: 42.98339, lng: -81.23304, population: 422324, timezone: "America/Toronto" },
    { slug: "markham", nameFa: "مارکام", nameLocal: "Markham", geonamesId: 6066513, region: "ontario", lat: 43.86682, lng: -79.2663, population: 338503, timezone: "America/Toronto" },
    { slug: "vaughan", nameFa: "وان", nameLocal: "Vaughan", geonamesId: 6173577, region: "ontario", lat: 43.8361, lng: -79.49827, population: 323103, timezone: "America/Toronto" },
    { slug: "gatineau", nameFa: "گاتینو", nameLocal: "Gatineau", geonamesId: 5959974, region: "quebec", lat: 45.47723, lng: -75.70164, population: 300045, timezone: "America/Toronto" },
    { slug: "victoria", nameFa: "ویکتوریا", nameLocal: "Victoria", geonamesId: 6174041, region: "british-columbia", lat: 48.4359, lng: -123.35155, population: 289625, timezone: "America/Vancouver" },
    { slug: "saskatoon", nameFa: "سسکتون", nameLocal: "Saskatoon", geonamesId: 6141256, region: "saskatchewan", lat: 52.13238, lng: -106.66892, population: 266141, timezone: "America/Regina" },
    { slug: "kitchener", nameFa: "کیچنر", nameLocal: "Kitchener", geonamesId: 5992996, region: "ontario", lat: 43.42537, lng: -80.5112, population: 256885, timezone: "America/Toronto" },
    { slug: "burnaby", nameFa: "برنابی", nameLocal: "Burnaby", geonamesId: 5911606, region: "british-columbia", lat: 49.26636, lng: -122.95263, population: 249125, timezone: "America/Vancouver" },
    { slug: "windsor", nameFa: "ویندزور", nameLocal: "Windsor", geonamesId: 6182962, region: "ontario", lat: 42.30008, lng: -83.01654, population: 229660, timezone: "America/Toronto" },
    { slug: "longueuil", nameFa: "لونگوی", nameLocal: "Longueuil", geonamesId: 6059891, region: "quebec", lat: 45.5152, lng: -73.46818, population: 229330, timezone: "America/Toronto" },
    { slug: "regina", nameFa: "رجاینا", nameLocal: "Regina", geonamesId: 6119109, region: "saskatchewan", lat: 50.45008, lng: -104.6178, population: 226404, timezone: "America/Regina" },
    { slug: "oakville", nameFa: "اوکویل", nameLocal: "Oakville", geonamesId: 6092122, region: "ontario", lat: 43.45011, lng: -79.68292, population: 213759, timezone: "America/Toronto" },
    { slug: "richmond-bc", nameFa: "ریچموند", nameLocal: "Richmond", geonamesId: 6122085, region: "british-columbia", lat: 49.17003, lng: -123.13683, population: 209937, timezone: "America/Vancouver" },
    { slug: "richmond-hill", nameFa: "ریچموند هیل", nameLocal: "Richmond Hill", geonamesId: 6122091, region: "ontario", lat: 43.87111, lng: -79.43725, population: 202022, timezone: "America/Toronto" },
    { slug: "burlington", nameFa: "برلینگتون", nameLocal: "Burlington", geonamesId: 5911592, region: "ontario", lat: 43.38621, lng: -79.83713, population: 186948, timezone: "America/Toronto" },
    { slug: "oshawa", nameFa: "اوشاوا", nameLocal: "Oshawa", geonamesId: 6094578, region: "ontario", lat: 43.90012, lng: -78.84957, population: 175383, timezone: "America/Toronto" },
    { slug: "greater-sudbury", nameFa: "سادبری", nameLocal: "Greater Sudbury", geonamesId: 5964700, region: "ontario", lat: 46.49, lng: -80.99001, population: 166004, timezone: "America/Toronto" },
    { slug: "saguenay", nameFa: "ساگنه", nameLocal: "Saguenay", geonamesId: 6137270, region: "quebec", lat: 48.41675, lng: -71.06573, population: 148886, timezone: "America/Toronto" },
    { slug: "coquitlam", nameFa: "کوکیتلام", nameLocal: "Coquitlam", geonamesId: 5927690, region: "british-columbia", lat: 49.2846, lng: -122.78217, population: 148625, timezone: "America/Vancouver" },
    { slug: "barrie", nameFa: "بری", nameLocal: "Barrie", geonamesId: 5894171, region: "ontario", lat: 44.40011, lng: -79.66634, population: 147829, timezone: "America/Toronto" },
    { slug: "kelowna", nameFa: "کلونا", nameLocal: "Kelowna", geonamesId: 5990579, region: "british-columbia", lat: 49.88307, lng: -119.48568, population: 144576, timezone: "America/Vancouver" },
    { slug: "trois-rivieres", nameFa: "تروا ریویر", nameLocal: "Trois-Rivières", geonamesId: 6169141, region: "quebec", lat: 46.34515, lng: -72.5477, population: 144472, timezone: "America/Toronto" },
    { slug: "guelph", nameFa: "گوئلف", nameLocal: "Guelph", geonamesId: 5967629, region: "ontario", lat: 43.54594, lng: -80.25599, population: 143740, timezone: "America/Toronto" },
    { slug: "levis", nameFa: "لوی", nameLocal: "Lévis", geonamesId: 6325521, region: "quebec", lat: 46.80326, lng: -71.17793, population: 143414, timezone: "America/Toronto" },
    { slug: "abbotsford", nameFa: "ابوتسفورد", nameLocal: "Abbotsford", geonamesId: 5881791, region: "british-columbia", lat: 49.05798, lng: -122.25257, population: 141397, timezone: "America/Vancouver" },
    { slug: "whitby", nameFa: "ویتبی", nameLocal: "Whitby", geonamesId: 6180170, region: "ontario", lat: 43.88342, lng: -78.93287, population: 138501, timezone: "America/Toronto" },
    { slug: "st-catharines", nameFa: "سنت کاترینز", nameLocal: "St. Catharines", geonamesId: 6155721, region: "ontario", lat: 43.17126, lng: -79.24267, population: 136803, timezone: "America/Toronto" },
    { slug: "milton", nameFa: "میلتن", nameLocal: "Milton", geonamesId: 6074377, region: "ontario", lat: 43.51681, lng: -79.88294, population: 132979, timezone: "America/Toronto" },
    { slug: "langley", nameFa: "لنگلی", nameLocal: "Langley", geonamesId: 6049429, region: "british-columbia", lat: 49.10107, lng: -122.65883, population: 132603, timezone: "America/Vancouver" },
    { slug: "kingston", nameFa: "کینگستون", nameLocal: "Kingston", geonamesId: 5992500, region: "ontario", lat: 44.22976, lng: -76.48098, population: 132485, timezone: "America/Toronto" },
    { slug: "cambridge", nameFa: "کمبریج", nameLocal: "Cambridge", geonamesId: 5913695, region: "ontario", lat: 43.3601, lng: -80.31269, population: 129920, timezone: "America/Toronto" },
    { slug: "sherbrooke", nameFa: "شربروک", nameLocal: "Sherbrooke", geonamesId: 6146143, region: "quebec", lat: 45.40008, lng: -71.89908, population: 129447, timezone: "America/Toronto" },
    { slug: "ajax", nameFa: "اجاکس", nameLocal: "Ajax", geonamesId: 5882873, region: "ontario", lat: 43.85012, lng: -79.03288, population: 119677, timezone: "America/Toronto" },
    { slug: "saanich", nameFa: "سانیچ", nameLocal: "Saanich", geonamesId: 6136944, region: "british-columbia", lat: 48.54964, lng: -123.36931, population: 117735, timezone: "America/Vancouver" },
    { slug: "terrebonne", nameFa: "تربون", nameLocal: "Terrebonne", geonamesId: 6163012, region: "quebec", lat: 45.70004, lng: -73.64732, population: 111575, timezone: "America/Toronto" },
    { slug: "st-johns", nameFa: "سنت جانز", nameLocal: "St. John's", geonamesId: 6324733, region: "newfoundland-and-labrador", lat: 47.56494, lng: -52.70931, population: 110525, timezone: "America/St_Johns" },
  ],
};
