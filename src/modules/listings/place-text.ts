// How a listing's place reads on cards and the listing page: the postal code and place name as
// written locally ("12045 Berlin", "8010 Graz, Innere Stadt"), "near <city>" when the place isn't
// the city the listing belongs to, and the seller's district text. Listings from before postal
// codes (or chosen by Persian city name) show the city.

export type PlaceParts = {
  /** Latin, shown left to right: "12045 Berlin" */
  local: string | null;
  /** Persian: the city, or "near <city>" */
  city: string | null;
  district: string | null;
};

export function placeParts(l: {
  postalCode: string | null;
  placeName: string | null;
  district: string | null;
  cityFa: string | null;
  cityLocal: string | null;
}, near: (city: string) => string): PlaceParts {
  const local = l.postalCode && l.placeName ? `${l.postalCode} ${l.placeName}` : null;
  // "Graz, Innere Stadt" belongs to Graz; "Gießen" doesn't belong to Frankfurt
  const town = l.placeName?.split(',')[0]?.trim();
  const sameCity = !!town && !!l.cityLocal && town === l.cityLocal;
  const city = l.cityFa ? (local && !sameCity ? near(l.cityFa) : l.cityFa) : null;
  return { local, city, district: l.district };
}
