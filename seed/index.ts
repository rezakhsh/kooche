import { categories } from './categories';
import { countries } from './countries';
import { currencies } from './currencies';
import { austria } from './locations/at';
import { germany } from './locations/de';
import { australia, canada, france, italy, netherlands, sweden, turkey, unitedKingdom, unitedStates } from './locations/first-cities';
import type { LocationsSeed } from './types';

export { categories, countries, currencies };

/** One entry per country whose regions and cities are seeded */
export const locations: LocationsSeed[] = [germany, austria, canada, unitedStates, australia, unitedKingdom, netherlands, italy, sweden, france, turkey];

export { POSTAL_COUNTRIES, postalPlaces } from './postal';
export { NEIGHBOURHOOD_CITIES, neighbourhoods } from './neighbourhoods';
export { POSTAL_AREA_COUNTRIES, postalAreas } from './postal-areas';
