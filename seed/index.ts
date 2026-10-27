import { categories } from './categories';
import { countries } from './countries';
import { currencies } from './currencies';
import { austria } from './locations/at';
import { germany } from './locations/de';
import type { LocationsSeed } from './types';

export { categories, countries, currencies };

/** One entry per country whose regions and cities are seeded */
export const locations: LocationsSeed[] = [germany, austria];

export { POSTAL_COUNTRIES, postalPlaces } from './postal';
export { NEIGHBOURHOOD_CITIES, neighbourhoods } from './neighbourhoods';
