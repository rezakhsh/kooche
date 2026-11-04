// Search form of a Latin place name, so "München", "Muenchen" and "MÜNCHEN" all match: lowercase,
// German umlauts and ß written out, Turkish ı as i, other accents removed, anything but letters and digits as one
// space. Stored in postal_places.place_search by the seed and applied to what the seller types.
// Persian text goes through normalizePersian() instead.

export function foldLatin(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Turkish dotless ı: GeoNames writes "Kadiköy", people type "Kadıköy" (İ loses its dot below)
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
