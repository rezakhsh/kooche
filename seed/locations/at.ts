import type { LocationsSeed } from '../types';

// Austria: the 9 Bundesländer (regions) and a first set of cities: the largest, plus every state
// capital (Eisenstadt, Bregenz). Coordinates, population, time zones and IDs are from GeoNames
// (CC BY 4.0, see seed/README.md); GeoNames' populations for some Austrian towns are those of the
// core settlement only (Wels, Leoben, Kapfenberg), which only affects the order in lists.
// Persian names and slugs are written by hand. Slugs use ASCII spellings (ö→oe, ä→ae, ü→ue).
// City slugs must be unique across all countries: Baden is `baden-bei-wien`.

export const austria: LocationsSeed = {
  countryCode: 'AT',
  regions: [
    { slug: "burgenland", nameFa: "بورگنلاند", nameLocal: "Burgenland", geonamesId: 2781194, lat: 47.5, lng: 16.41667, population: 301250, timezone: "Europe/Vienna" },
    { slug: "kaernten", nameFa: "کرنتن", nameLocal: "Kärnten", geonamesId: 2774686, lat: 46.75, lng: 13.83333, population: 568984, timezone: "Europe/Vienna" },
    { slug: "niederoesterreich", nameFa: "اتریش سفلی", nameLocal: "Niederösterreich", geonamesId: 2770542, lat: 48.33333, lng: 15.75, population: 1698796, timezone: "Europe/Vienna" },
    { slug: "oberoesterreich", nameFa: "اتریش علیا", nameLocal: "Oberösterreich", geonamesId: 2769848, lat: 48.25, lng: 14.0, population: 1522825, timezone: "Europe/Vienna" },
    { slug: "salzburg", nameFa: "سالزبورگ", nameLocal: "Salzburg", geonamesId: 2766823, lat: 47.41667, lng: 13.25, population: 562606, timezone: "Europe/Vienna" },
    { slug: "steiermark", nameFa: "اشتایرمارک", nameLocal: "Steiermark", geonamesId: 2764581, lat: 47.25, lng: 15.16667, population: 1265198, timezone: "Europe/Vienna" },
    { slug: "tirol", nameFa: "تیرول", nameLocal: "Tirol", geonamesId: 2763586, lat: 47.25, lng: 11.33333, population: 771304, timezone: "Europe/Vienna" },
    { slug: "vorarlberg", nameFa: "فورارلبرگ", nameLocal: "Vorarlberg", geonamesId: 2762300, lat: 47.25, lng: 9.91667, population: 401674, timezone: "Europe/Vienna" },
    { slug: "wien", nameFa: "وین", nameLocal: "Wien", geonamesId: 2761367, lat: 48.2082, lng: 16.37169, population: 2014614, timezone: "Europe/Vienna" },
  ],
  cities: [
    { slug: "wien", nameFa: "وین", nameLocal: "Wien", geonamesId: 2761369, region: "wien", lat: 48.20849, lng: 16.37208, population: 1691468, timezone: "Europe/Vienna" },
    { slug: "graz", nameFa: "گراتس", nameLocal: "Graz", geonamesId: 2778067, region: "steiermark", lat: 47.06733, lng: 15.44197, population: 303270, timezone: "Europe/Vienna" },
    { slug: "linz", nameFa: "لینتس", nameLocal: "Linz", geonamesId: 2772400, region: "oberoesterreich", lat: 48.30639, lng: 14.28611, population: 204846, timezone: "Europe/Vienna" },
    { slug: "salzburg", nameFa: "سالزبورگ", nameLocal: "Salzburg", geonamesId: 2766824, region: "salzburg", lat: 47.79941, lng: 13.04399, population: 157245, timezone: "Europe/Vienna" },
    { slug: "innsbruck", nameFa: "اینسبروک", nameLocal: "Innsbruck", geonamesId: 2775220, region: "tirol", lat: 47.26266, lng: 11.39454, population: 132493, timezone: "Europe/Vienna" },
    { slug: "klagenfurt", nameFa: "کلاگنفورت", nameLocal: "Klagenfurt am Wörthersee", geonamesId: 2774326, region: "kaernten", lat: 46.62472, lng: 14.30528, population: 100316, timezone: "Europe/Vienna" },
    { slug: "villach", nameFa: "فیلاخ", nameLocal: "Villach", geonamesId: 2762372, region: "kaernten", lat: 46.61028, lng: 13.85583, population: 58882, timezone: "Europe/Vienna" },
    { slug: "dornbirn", nameFa: "دورنبیرن", nameLocal: "Dornbirn", geonamesId: 2780741, region: "vorarlberg", lat: 47.41427, lng: 9.74195, population: 49278, timezone: "Europe/Vienna" },
    { slug: "wiener-neustadt", nameFa: "وینر نویشتات", nameLocal: "Wiener Neustadt", geonamesId: 2761353, region: "niederoesterreich", lat: 47.80485, lng: 16.23196, population: 44820, timezone: "Europe/Vienna" },
    { slug: "steyr", nameFa: "اشتایر", nameLocal: "Steyr", geonamesId: 2764359, region: "oberoesterreich", lat: 48.04274, lng: 14.42127, population: 38331, timezone: "Europe/Vienna" },
    { slug: "feldkirch", nameFa: "فلدکیرش", nameLocal: "Feldkirch", geonamesId: 2779674, region: "vorarlberg", lat: 47.23645, lng: 9.59734, population: 33420, timezone: "Europe/Vienna" },
    { slug: "bregenz", nameFa: "برگنتس", nameLocal: "Bregenz", geonamesId: 2781503, region: "vorarlberg", lat: 47.50311, lng: 9.7471, population: 29806, timezone: "Europe/Vienna" },
    { slug: "baden-bei-wien", nameFa: "بادن", nameLocal: "Baden", geonamesId: 2782067, region: "niederoesterreich", lat: 48.00543, lng: 16.23264, population: 26286, timezone: "Europe/Vienna" },
    { slug: "traun", nameFa: "تراون", nameLocal: "Traun", geonamesId: 2763423, region: "oberoesterreich", lat: 48.22086, lng: 14.23833, population: 25345, timezone: "Europe/Vienna" },
    { slug: "wolfsberg", nameFa: "ولفسبرگ", nameLocal: "Wolfsberg", geonamesId: 2760910, region: "kaernten", lat: 46.84056, lng: 14.84417, population: 25035, timezone: "Europe/Vienna" },
    { slug: "lustenau", nameFa: "لوستناو", nameLocal: "Lustenau", geonamesId: 2772173, region: "vorarlberg", lat: 47.42642, lng: 9.65851, population: 22821, timezone: "Europe/Vienna" },
    { slug: "sankt-poelten", nameFa: "سانکت پولتن", nameLocal: "Sankt Pölten", geonamesId: 2766429, region: "niederoesterreich", lat: 48.20762, lng: 15.63725, population: 21911, timezone: "Europe/Vienna" },
    { slug: "moedling", nameFa: "مودلینگ", nameLocal: "Mödling", geonamesId: 2771335, region: "niederoesterreich", lat: 48.08605, lng: 16.28921, population: 20555, timezone: "Europe/Vienna" },
    { slug: "wels", nameFa: "ولس", nameLocal: "Wels", geonamesId: 2761524, region: "oberoesterreich", lat: 48.16667, lng: 14.03333, population: 16857, timezone: "Europe/Vienna" },
    { slug: "klosterneuburg", nameFa: "کلوسترنویبورگ", nameLocal: "Klosterneuburg", geonamesId: 2773913, region: "niederoesterreich", lat: 48.30521, lng: 16.32522, population: 15614, timezone: "Europe/Vienna" },
    { slug: "amstetten", nameFa: "آمشتتن", nameLocal: "Amstetten", geonamesId: 2782555, region: "niederoesterreich", lat: 48.1229, lng: 14.87206, population: 15559, timezone: "Europe/Vienna" },
    { slug: "bludenz", nameFa: "بلودنتس", nameLocal: "Bludenz", geonamesId: 2781680, region: "vorarlberg", lat: 47.15476, lng: 9.82255, population: 15102, timezone: "Europe/Vienna" },
    { slug: "krems", nameFa: "کرمس", nameLocal: "Krems an der Donau", geonamesId: 2773549, region: "niederoesterreich", lat: 48.40921, lng: 15.61415, population: 14473, timezone: "Europe/Vienna" },
    { slug: "schwechat", nameFa: "شوشات", nameLocal: "Schwechat", geonamesId: 2765388, region: "niederoesterreich", lat: 48.13333, lng: 16.46667, population: 12351, timezone: "Europe/Vienna" },
    { slug: "kufstein", nameFa: "کوفشتاین", nameLocal: "Kufstein", geonamesId: 2773300, region: "tirol", lat: 47.58333, lng: 12.16667, population: 9848, timezone: "Europe/Vienna" },
    { slug: "eisenstadt", nameFa: "آیزن‌اشتات", nameLocal: "Eisenstadt", geonamesId: 2780190, region: "burgenland", lat: 47.84565, lng: 16.52327, population: 9217, timezone: "Europe/Vienna" },
    { slug: "leoben", nameFa: "لئوبن", nameLocal: "Leoben", geonamesId: 2772649, region: "steiermark", lat: 47.379, lng: 15.094, population: 8264, timezone: "Europe/Vienna" },
    { slug: "hallein", nameFa: "هالاین", nameLocal: "Hallein", geonamesId: 2776951, region: "salzburg", lat: 47.68333, lng: 13.1, population: 7208, timezone: "Europe/Vienna" },
    { slug: "kapfenberg", nameFa: "کاپفنبرگ", nameLocal: "Kapfenberg", geonamesId: 2774773, region: "steiermark", lat: 47.44458, lng: 15.29331, population: 3296, timezone: "Europe/Vienna" },
  ],
};
