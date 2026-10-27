// The country a listing is posted in (decided Oct 17, 2026): the seller doesn't choose it in the
// form. A listing that has a country keeps it for good; a new one takes the country the visitor
// chose on the home page (the `country` cookie), else the country of the account's saved place.
// Without either, the only open country when there is just one (wave 1: Germany while it is the
// only one), else the seller is asked to choose a country first. Used by the posting pages to
// show it and by the save action to decide it on the server; saveListing() refuses any other.

export function postingCountry({
  listingCountry,
  chosen,
  saved,
  open,
}: {
  /** The listing's own country, once it has one */
  listingCountry: string | null;
  /** The country chosen on the home page, if still open */
  chosen: string | null;
  /** The country of the account's saved place */
  saved: string | null;
  /** Codes of the open countries */
  open: readonly string[];
}): string | null {
  if (listingCountry) return listingCountry;
  const isOpen = (code: string | null) => (code && open.includes(code) ? code : null);
  return isOpen(chosen) ?? isOpen(saved) ?? (open.length === 1 ? open[0]! : null);
}
