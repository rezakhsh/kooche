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

export type CitySeed = RegionSeed & {
  region: string;
  /**
   * The city's first launch values (round 12), applied only when the seed creates the city: after
   * that, launch is the owner's state in admin. Without it the city is `later`.
   */
  launch?: { status: 'open' | 'waitlist'; goal?: number; radiusKm?: number; with?: string };
};

export type LocationsSeed = { countryCode: string; regions: RegionSeed[]; cities: CitySeed[] };

/** One row of seed/postal/<cc>.tsv */
export type PostalPlaceSeed = { postalCode: string; placeName: string; lat: number; lng: number };

/** A city neighbourhood (seed/neighbourhoods/): its key and local name, MultiPolygon coordinates (lng, lat) */
export type NeighbourhoodSeed = { key: string; nameLocal: string; polygons: number[][][][] };

/** A field's changes in one country: CountryFieldRule in src/modules/listings/catalog.ts */
export type CountryRuleSeed = {
  label?: string;
  help?: string;
  unit?: string;
  required?: boolean;
  options?: string[];
  option_labels?: Record<string, string>;
  min?: number;
  max?: number;
};

export type AttributeType = 'number' | 'select' | 'multi_select' | 'boolean' | 'text' | 'date';

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
  /**
   * numbers: {min, max, integer}, plus {money: true} for an amount in minor units of the listing's
   * currency; text: {max_length}; multi_select: {max_items}; date: {month: true} for month and year
   * only. Any type: {optional_in: [category slugs]} makes a required field optional there;
   * {help_in: {slug: hint}} gives the field its own hint in those categories (the area of a room).
   * multi_select: {filter: 'all'} when a filter should match listings with every chosen value (a
   * checklist of features); otherwise any of them.
   * Per country (field audit item 5; read by inCountry() in src/modules/listings/catalog.ts):
   * {countries: [codes]} offers the field only there, {hidden_in: [codes]} not there, and
   * {by_country: {code: rule}} changes its label, hint, unit, required, options or limits there
   * (`*`: the countries without a rule of their own).
   */
  validation?: Record<string, number | boolean | string | string[] | Record<string, string> | Record<string, CountryRuleSeed>>;
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
