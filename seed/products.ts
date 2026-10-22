import type { PlanFeatures } from '../src/modules/payments/features';

// What can be bought (docs/schema.md, section 12; prices decided by the owner Oct 22, 2026). Not
// loaded by the seed: `scripts/stripe-setup.ts` creates each product and price in Stripe (found
// again by its lookup key) and then writes `products` and `product_prices` with Stripe's price ids,
// so the rows always match the Stripe account of that environment.
//
// Prices are never edited (section 12): to change one, change it here and run the script again.
// It creates a new Stripe price and a new row, and marks the old ones inactive. Amounts are final
// prices: the owner uses the small-business VAT exemption (§19 UStG), so no VAT is added.

export type ProductPriceSeed = { currency: 'EUR'; amountMinor: number; interval: 'month' | 'year' | null };

export type ProductSeed = {
  code: string;
  nameFa: string;
  descriptionFa: string;
  kind: 'one_time' | 'subscription';
  entitlementType: 'bump' | 'featured' | 'pro_plan';
  appliesTo: 'listing' | 'organization';
  durationDays: number | null;
  bumpCount: number | null;
  /** Pro plans only: the limits copied onto each pro_plan entitlement */
  features: PlanFeatures | Record<string, never>;
  sortOrder: number;
  prices: ProductPriceSeed[];
};

export const products: ProductSeed[] = [
  {
    code: 'bump-1',
    nameFa: 'نردبان',
    descriptionFa: 'آگهی همین حالا به بالای فهرست می‌رود.',
    kind: 'one_time',
    entitlementType: 'bump',
    appliesTo: 'listing',
    durationDays: null,
    bumpCount: 1,
    features: {},
    sortOrder: 10,
    prices: [{ currency: 'EUR', amountMinor: 199, interval: null }],
  },
  {
    code: 'bump-3',
    nameFa: 'سه نردبان در یک هفته',
    descriptionFa: 'آگهی سه بار به بالای فهرست می‌رود: امروز، سه روز بعد و شش روز بعد.',
    kind: 'one_time',
    entitlementType: 'bump',
    appliesTo: 'listing',
    durationDays: 7,
    bumpCount: 3,
    features: {},
    sortOrder: 20,
    prices: [{ currency: 'EUR', amountMinor: 449, interval: null }],
  },
  {
    code: 'featured-7d',
    nameFa: 'آگهی ویژه، ۷ روز',
    descriptionFa: 'آگهی هفت روز با نشان «ویژه» و در ردیف آگهی‌های ویژه بالای صفحه‌ها دیده می‌شود.',
    kind: 'one_time',
    entitlementType: 'featured',
    appliesTo: 'listing',
    durationDays: 7,
    bumpCount: null,
    features: {},
    sortOrder: 30,
    prices: [{ currency: 'EUR', amountMinor: 699, interval: null }],
  },
  {
    code: 'featured-event',
    nameFa: 'رویداد ویژه',
    descriptionFa: 'رویداد تا پایان آخرین تاریخش (حداکثر ۳۰ روز) بالای فهرست رویدادها و با نشان «ویژه» دیده می‌شود.',
    kind: 'one_time',
    entitlementType: 'featured',
    appliesTo: 'listing',
    durationDays: 30,
    bumpCount: null,
    features: {},
    sortOrder: 40,
    prices: [{ currency: 'EUR', amountMinor: 999, interval: null }],
  },
  {
    code: 'pro',
    nameFa: 'پرو',
    descriptionFa: '۲۵ آگهی فعال، ۳ نردبان در ماه، یک همکار.',
    kind: 'subscription',
    entitlementType: 'pro_plan',
    appliesTo: 'organization',
    durationDays: null,
    bumpCount: null,
    features: { activeListings: 25, bumpsPerMonth: 3, featuredSlots: 0, staffSeats: 1 },
    sortOrder: 50,
    prices: [
      { currency: 'EUR', amountMinor: 2400, interval: 'month' },
      { currency: 'EUR', amountMinor: 24000, interval: 'year' },
    ],
  },
  {
    code: 'pro-plus',
    nameFa: 'پرو پلاس',
    descriptionFa: '۱۰۰ آگهی فعال، ۱۵ نردبان در ماه، ۲ آگهی ویژه هم‌زمان، پنج همکار.',
    kind: 'subscription',
    entitlementType: 'pro_plan',
    appliesTo: 'organization',
    durationDays: null,
    bumpCount: null,
    features: { activeListings: 100, bumpsPerMonth: 15, featuredSlots: 2, staffSeats: 5 },
    sortOrder: 60,
    prices: [
      { currency: 'EUR', amountMinor: 5900, interval: 'month' },
      { currency: 'EUR', amountMinor: 59000, interval: 'year' },
    ],
  },
];

/** The free launch Pro (decided Oct 16 and Oct 22, 2026): 100% off for 6 months */
export const launchCoupon = { id: 'peydoo-launch-6m', percentOff: 100, durationInMonths: 6, name: 'Peydoo launch: 6 months free' };
