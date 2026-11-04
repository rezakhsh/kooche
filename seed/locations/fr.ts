import type { LocationsSeed } from '../types';

// France: its regions and its communes of 100,000+ people, without Paris's arrondissements and the
// villes nouvelles that are groups of communes (Marne-la-Vallée, Saint-Quentin-en-Yvelines).
// Postal codes join the nearest of these cities (postal-code plan, step 2, owner Nov 4, 2026).
// Coordinates, population, time zones and IDs are from GeoNames (CC BY 4.0, see seed/README.md); local
// names as the country writes them; Persian names from Wikidata's Persian labels (CC0), checked, and written
// by hand where Wikidata had none or a wrong one. City slugs appear alone in URLs, so they are unique across
// all countries: a smaller city of the same name carries its state (london-on, richmond-bc).
// launch: only Paris has launch values (its waitlist, round 12); every other city is `later`
// and opens with the country.
// Paris starts in May 2027 (round 7 calendar).

export const france: LocationsSeed = {
  countryCode: 'FR',
  regions: [
    { slug: "auvergne-rhone-alpes", nameFa: "اوورنی-رون-آلپ", nameLocal: "Auvergne-Rhône-Alpes", geonamesId: 11071625, lat: 45.482, lng: 5.37437, population: 8163884, timezone: "Europe/Paris" },
    { slug: "bourgogne-franche-comte", nameFa: "بورگونی-فرانش-کنته", nameLocal: "Bourgogne-Franche-Comté", geonamesId: 11071619, lat: 47.06981, lng: 5.04822, population: 2803977, timezone: "Europe/Paris" },
    { slug: "bretagne", nameFa: "بریتانی", nameLocal: "Bretagne", geonamesId: 3030293, lat: 48.16667, lng: -2.83333, population: 4829968, timezone: "Europe/Paris" },
    { slug: "centre-val-de-loire", nameFa: "سانتر-وال دو لوار", nameLocal: "Centre-Val de Loire", geonamesId: 3027939, lat: 47.5, lng: 1.75, population: 2573180, timezone: "Europe/Paris" },
    { slug: "grand-est", nameFa: "گران‌است", nameLocal: "Grand Est", geonamesId: 11071622, lat: 48.69821, lng: 5.8667, population: 5560079, timezone: "Europe/Paris" },
    { slug: "hauts-de-france", nameFa: "او-دو-فرانس", nameLocal: "Hauts-de-France", geonamesId: 11071624, lat: 49.61232, lng: 2.65594, population: 5998916, timezone: "Europe/Paris" },
    { slug: 'ile-de-france', nameFa: 'ایل‌دوفرانس', nameLocal: 'Île-de-France', geonamesId: 3012874, lat: 48.5, lng: 2.5, population: 11959807, timezone: 'Europe/Paris' },
    { slug: "normandie", nameFa: "نرماندی", nameLocal: "Normandie", geonamesId: 11071621, lat: 49.19906, lng: 0.49988, population: 3499280, timezone: "Europe/Paris" },
    { slug: "nouvelle-aquitaine", nameFa: "نوول-آکیتن", nameLocal: "Nouvelle-Aquitaine", geonamesId: 11071620, lat: 46.09165, lng: 1.26892, population: 6113384, timezone: "Europe/Paris" },
    { slug: "occitanie", nameFa: "اکسیتانی", nameLocal: "Occitanie", geonamesId: 11071623, lat: 44.02722, lng: 1.63559, population: 5626858, timezone: "Europe/Paris" },
    { slug: "pays-de-la-loire", nameFa: "پی دو لا لوار", nameLocal: "Pays de la Loire", geonamesId: 2988289, lat: 47.5, lng: -0.83333, population: 3879216, timezone: "Europe/Paris" },
    { slug: "provence-alpes-cote-dazur", nameFa: "پروانس آلپ-کوت دازور", nameLocal: "Provence-Alpes-Côte d'Azur", geonamesId: 2985244, lat: 43.91667, lng: 6.08333, population: 5170312, timezone: "Europe/Paris" },
  ],
  cities: [
    { slug: 'paris', nameFa: 'پاریس', nameLocal: 'Paris', geonamesId: 2988507, region: 'ile-de-france', lat: 48.85341, lng: 2.3488, population: 2138551, timezone: 'Europe/Paris', launch: { status: 'waitlist', goal: 20 } },
    { slug: "marseille", nameFa: "مارسی", nameLocal: "Marseille", geonamesId: 2995469, region: "provence-alpes-cote-dazur", lat: 43.29695, lng: 5.38107, population: 877215, timezone: "Europe/Paris" },
    { slug: "lyon", nameFa: "لیون", nameLocal: "Lyon", geonamesId: 2996944, region: "auvergne-rhone-alpes", lat: 45.74906, lng: 4.84789, population: 520774, timezone: "Europe/Paris" },
    { slug: "toulouse", nameFa: "تولوز", nameLocal: "Toulouse", geonamesId: 2972315, region: "occitanie", lat: 43.60426, lng: 1.44367, population: 511684, timezone: "Europe/Paris" },
    { slug: "nice", nameFa: "نیس", nameLocal: "Nice", geonamesId: 2990440, region: "provence-alpes-cote-dazur", lat: 43.70313, lng: 7.26608, population: 342669, timezone: "Europe/Paris" },
    { slug: "nantes", nameFa: "نانت", nameLocal: "Nantes", geonamesId: 2990969, region: "pays-de-la-loire", lat: 47.21725, lng: -1.55336, population: 325070, timezone: "Europe/Paris" },
    { slug: "strasbourg", nameFa: "استراسبورگ", nameLocal: "Strasbourg", geonamesId: 2973783, region: "grand-est", lat: 48.58392, lng: 7.74553, population: 274845, timezone: "Europe/Paris" },
    { slug: "bordeaux", nameFa: "بوردو", nameLocal: "Bordeaux", geonamesId: 3031582, region: "nouvelle-aquitaine", lat: 44.84124, lng: -0.58046, population: 265328, timezone: "Europe/Paris" },
    { slug: "montpellier", nameFa: "مونپلیه", nameLocal: "Montpellier", geonamesId: 2992166, region: "occitanie", lat: 43.61093, lng: 3.87635, population: 248252, timezone: "Europe/Paris" },
    { slug: "lille", nameFa: "لیل", nameLocal: "Lille", geonamesId: 2998324, region: "hauts-de-france", lat: 50.63391, lng: 3.05512, population: 238695, timezone: "Europe/Paris" },
    { slug: "rennes", nameFa: "رن", nameLocal: "Rennes", geonamesId: 2983990, region: "bretagne", lat: 48.11109, lng: -1.67431, population: 227830, timezone: "Europe/Paris" },
    { slug: "reims", nameFa: "رنس", nameLocal: "Reims", geonamesId: 2984114, region: "grand-est", lat: 49.26526, lng: 4.02853, population: 196565, timezone: "Europe/Paris" },
    { slug: "le-havre", nameFa: "لو اور", nameLocal: "Le Havre", geonamesId: 3003796, region: "normandie", lat: 49.49346, lng: 0.10785, population: 185972, timezone: "Europe/Paris" },
    { slug: "saint-etienne", nameFa: "سنت‌اتین", nameLocal: "Saint-Étienne", geonamesId: 2980291, region: "auvergne-rhone-alpes", lat: 45.43389, lng: 4.39, population: 176280, timezone: "Europe/Paris" },
    { slug: "toulon", nameFa: "تولون", nameLocal: "Toulon", geonamesId: 2972328, region: "provence-alpes-cote-dazur", lat: 43.12442, lng: 5.92836, population: 168701, timezone: "Europe/Paris" },
    { slug: "angers", nameFa: "آنژه", nameLocal: "Angers", geonamesId: 3037656, region: "pays-de-la-loire", lat: 47.47156, lng: -0.55202, population: 168279, timezone: "Europe/Paris" },
    { slug: "dijon", nameFa: "دیژون", nameLocal: "Dijon", geonamesId: 3021372, region: "bourgogne-franche-comte", lat: 47.31344, lng: 5.01391, population: 159941, timezone: "Europe/Paris" },
    { slug: "grenoble", nameFa: "گرونوبل", nameLocal: "Grenoble", geonamesId: 3014728, region: "auvergne-rhone-alpes", lat: 45.17869, lng: 5.71479, population: 158552, timezone: "Europe/Paris" },
    { slug: "nimes", nameFa: "نیم", nameLocal: "Nîmes", geonamesId: 2990363, region: "occitanie", lat: 43.83665, lng: 4.35788, population: 148236, timezone: "Europe/Paris" },
    { slug: "clermont-ferrand", nameFa: "کلرمون فران", nameLocal: "Clermont-Ferrand", geonamesId: 3024635, region: "auvergne-rhone-alpes", lat: 45.77969, lng: 3.08682, population: 147865, timezone: "Europe/Paris" },
    { slug: "aix-en-provence", nameFa: "اکس‌آن‌پروانس", nameLocal: "Aix-en-Provence", geonamesId: 3038354, region: "provence-alpes-cote-dazur", lat: 43.5283, lng: 5.44973, population: 146821, timezone: "Europe/Paris" },
    { slug: "brest", nameFa: "برست", nameLocal: "Brest", geonamesId: 3030300, region: "bretagne", lat: 48.39029, lng: -4.48628, population: 144899, timezone: "Europe/Paris" },
    { slug: "le-mans", nameFa: "لو مان", nameLocal: "Le Mans", geonamesId: 3003603, region: "pays-de-la-loire", lat: 48.0021, lng: 0.20251, population: 144515, timezone: "Europe/Paris" },
    { slug: "amiens", nameFa: "امیان", nameLocal: "Amiens", geonamesId: 3037854, region: "hauts-de-france", lat: 49.9, lng: 2.3, population: 143086, timezone: "Europe/Paris" },
    { slug: "tours", nameFa: "تور", nameLocal: "Tours", geonamesId: 2972191, region: "centre-val-de-loire", lat: 47.39484, lng: 0.70398, population: 141621, timezone: "Europe/Paris" },
    { slug: "limoges", nameFa: "لیموژ", nameLocal: "Limoges", geonamesId: 2998286, region: "nouvelle-aquitaine", lat: 45.83362, lng: 1.24759, population: 141176, timezone: "Europe/Paris" },
    { slug: "villeurbanne", nameFa: "ویوربن", nameLocal: "Villeurbanne", geonamesId: 2968254, region: "auvergne-rhone-alpes", lat: 45.76601, lng: 4.8795, population: 131445, timezone: "Europe/Paris" },
    { slug: "besancon", nameFa: "بزانسون", nameLocal: "Besançon", geonamesId: 3033123, region: "bourgogne-franche-comte", lat: 47.24878, lng: 6.01815, population: 128426, timezone: "Europe/Paris" },
    { slug: "metz", nameFa: "مس", nameLocal: "Metz", geonamesId: 2994160, region: "grand-est", lat: 49.11911, lng: 6.17269, population: 123914, timezone: "Europe/Paris" },
    { slug: "orleans", nameFa: "اورلئان", nameLocal: "Orléans", geonamesId: 2989317, region: "centre-val-de-loire", lat: 47.90248, lng: 1.90407, population: 116344, timezone: "Europe/Paris" },
    { slug: "rouen", nameFa: "روان", nameLocal: "Rouen", geonamesId: 2982652, region: "normandie", lat: 49.44313, lng: 1.09932, population: 116331, timezone: "Europe/Paris" },
    { slug: "mulhouse", nameFa: "مولوز", nameLocal: "Mulhouse", geonamesId: 2991214, region: "grand-est", lat: 47.75205, lng: 7.32866, population: 111430, timezone: "Europe/Paris" },
    { slug: "montreuil", nameFa: "مونتروی", nameLocal: "Montreuil", geonamesId: 2992090, region: "ile-de-france", lat: 48.86415, lng: 2.44322, population: 111240, timezone: "Europe/Paris" },
    { slug: "perpignan", nameFa: "پرپینان", nameLocal: "Perpignan", geonamesId: 2987914, region: "occitanie", lat: 42.69764, lng: 2.89541, population: 110706, timezone: "Europe/Paris" },
    { slug: "caen", nameFa: "کان", nameLocal: "Caen", geonamesId: 3029241, region: "normandie", lat: 49.18585, lng: -0.35912, population: 110624, timezone: "Europe/Paris" },
    { slug: "boulogne-billancourt", nameFa: "بولونی-بیانکور", nameLocal: "Boulogne-Billancourt", geonamesId: 3031137, region: "ile-de-france", lat: 48.83545, lng: 2.24128, population: 108782, timezone: "Europe/Paris" },
    { slug: "nancy", nameFa: "نانسی", nameLocal: "Nancy", geonamesId: 2990999, region: "grand-est", lat: 48.68439, lng: 6.18496, population: 105058, timezone: "Europe/Paris" },
    { slug: "argenteuil", nameFa: "ارژانتوی", nameLocal: "Argenteuil", geonamesId: 3037044, region: "ile-de-france", lat: 48.94788, lng: 2.24744, population: 101475, timezone: "Europe/Paris" },
  ],
};
