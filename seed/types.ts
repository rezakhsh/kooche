// Shapes of the seed files. The loader is src/db/seed.ts.

export type CurrencySeed = { code: string; minorUnit: number; nameFa: string; symbol: string };

export type CountrySeed = {
  code: string;
  /** Web address: /germany. Lowercase Latin, unique, never one of our own route names. */
  slug: string;
  nameFa: string;
  nameLocal: string;
  defaultCurrency: string;
  phonePrefix: string;
  /** Open for listings. Opening a country also needs its regions and cities seeded. */
  isActive: boolean;
  sortOrder: number;
};

export type RegionSeed = {
  slug: string;
  nameFa: string;
  nameLocal: string;
  geonamesId: number;
  lat: number;
  lng: number;
  population: number | null;
  timezone: string;
};

export type CitySeed = RegionSeed & { region: string };

export type LocationsSeed = { countryCode: string; regions: RegionSeed[]; cities: CitySeed[] };

/** One row of seed/postal/<cc>.tsv */
export type PostalPlaceSeed = { postalCode: string; placeName: string; lat: number; lng: number };

export type AttributeType = 'number' | 'select' | 'multi_select' | 'boolean' | 'text';

export type OptionSeed = {
  value: string;
  labelFa: string;
  /** Value of the option this one belongs to in the attribute named by dependsOn (e.g. brand) */
  parent?: string;
};

export type AttributeSeed = {
  key: string;
  type: AttributeType;
  labelFa: string;
  unitFa?: string;
  helpFa?: string;
  /** numbers: {min, max, integer}, text: {max_length}, multi_select: {max_items} */
  validation?: Record<string, number | boolean>;
  /** Key of an attribute on the same category or an ancestor (model depends on brand) */
  dependsOn?: string;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  showOnCard?: boolean;
  options?: OptionSeed[];
};

export type CategorySeed = {
  slug: string;
  nameFa: string;
  descriptionFa?: string;
  icon?: string;
  priceMode?: 'required' | 'optional' | 'none';
  listingDurationDays?: number;
  maxImages?: number;
  requiresReview?: boolean;
  businessOnly?: boolean;
  /** Apply to this category and all its descendants */
  attributes?: AttributeSeed[];
  /** A category without children is a leaf: the only kind listings may use */
  children?: CategorySeed[];
};
