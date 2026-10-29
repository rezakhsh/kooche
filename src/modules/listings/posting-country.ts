// The country a listing is posted in (decided Oct 17, 2026): the seller doesn't choose it in the
// form. A listing that has a country keeps it for good; a new one takes the country the visitor
// chose on the home page (the `country` cookie), else the country of the account's saved place.
// Without either, the only open country when there is just one (wave 1: Germany while it is the
// only one), else the seller is asked to choose a country first. A country preparing to open
// (prestart) counts too: drafts are saved there, published from its opening day (wave 2 part 8). Used by the posting pages to
// show it and by the save action to decide it on the server; saveListing() refuses any other.

export function postingCountry({
  listingCountry,
  chosen,
  saved,
  countries,
}: {
  /** The listing's own country, once it has one */
  listingCountry: string | null;
  /** The country chosen on the home page, if still allowed */
  chosen: string | null;
  /** The country of the account's saved place */
  saved: string | null;
  /** The countries one may post in, open or preparing to open (preparingCountries) */
  countries: readonly { code: string; mode: string }[];
}): string | null {
  if (listingCountry) return listingCountry;
  const ok = (code: string | null) => (code && countries.some((c) => c.code === code) ? code : null);
  const open = countries.filter((c) => c.mode === 'open');
  return ok(chosen) ?? ok(saved) ?? (open.length === 1 ? open[0]!.code : null);
}
