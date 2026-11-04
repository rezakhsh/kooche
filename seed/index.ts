import { categories } from './categories';
import { countries } from './countries';
import { currencies } from './currencies';
import { austria } from './locations/at';
import { germany } from './locations/de';
import { australia } from './locations/au';
import { canada } from './locations/ca';
import { france } from './locations/fr';
import { unitedKingdom } from './locations/gb';
import { italy } from './locations/it';
import { netherlands } from './locations/nl';
import { sweden } from './locations/se';
import { turkey } from './locations/tr';
import { unitedStates } from './locations/us';
import type { LocationsSeed } from './types';

export { categories, countries, currencies };

/** One entry per country whose regions and cities are seeded */
export const locations: LocationsSeed[] = [germany, austria, canada, unitedStates, australia, unitedKingdom, netherlands, italy, sweden, france, turkey];

export { POSTAL_COUNTRIES, postalPlaces } from './postal';
export { NEIGHBOURHOOD_CITIES, neighbourhoods } from './neighbourhoods';
export { POSTAL_AREA_COUNTRIES, postalAreas } from './postal-areas';
