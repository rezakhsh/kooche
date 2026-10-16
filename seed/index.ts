import { categories } from './categories';
import { countries } from './countries';
import { currencies } from './currencies';
import { germany } from './locations/de';
import type { LocationsSeed } from './types';

export { categories, countries, currencies };

/** One entry per country whose regions and cities are seeded */
export const locations: LocationsSeed[] = [germany];
