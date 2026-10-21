import { carBrands, carModels } from './car-models';
import type { AttributeSeed, CategorySeed, OptionSeed } from './types';

// Starter category tree: Divar's top-level grouping and Persian names, merged with
// Kleinanzeigen's European structure (two levels, separate roots for children, pets and
// lessons, Germany-specific leaves such as WG rooms, tires, Ausbildung and Minijobs).
// Approved Oct 16, 2026: 13 roots, 115 leaves. Oct 18, 2026: the events section added (14 roots,
// 127 leaves).
//
// Fields per category (approved Oct 18, 2026): what Kleinanzeigen's posting forms and filters ask
// in each category, with Divar's Persian wording. Few fields are required; the rest are optional so
// posting stays quick. Rent: the price is the cold rent, with extra costs and deposit as amounts
// (the listing page adds up the warm rent); a WG room's price is its total rent.
//
// "Free" and "exchange" (Kleinanzeigen's Verschenken & Tauschen) are price types and «درخواستی»
// (wanted) is a listing kind, so they are filters in every category, not categories. Shipping is
// a listing column (`shipping_offered`), not an attribute.
// Left out on purpose: currency exchange and money transfers to Iran (EU sanctions, AML),
// carrying luggage to Iran, matchmaking, property in Iran, medicines, weapons, tobacco.
//
// priceMode, listingDurationDays, maxImages, requiresReview and businessOnly are inherited from
// the parent unless a category sets its own.
// Attribute definitions apply to their category and all descendants. A key is never reused
// with a different meaning, and is unique along each path (checked by the seed checks).
// Adding a category or attribute: edit this file and run `npm run db:seed`. Removing one: delete
// it here, and the seed sets it inactive (listings may still use it, and keep their values).

// ---------------------------------------------------------------------------
// Shared attribute definitions
// ---------------------------------------------------------------------------

const options = (pairs: [string, string][]): OptionSeed[] =>
  pairs.map(([value, labelFa]) => ({ value, labelFa }));

const condition: AttributeSeed = {
  key: 'condition',
  type: 'select',
  labelFa: 'وضعیت',
  isRequired: true,
  isFilterable: true,
  showOnCard: true,
  options: options([
    ['new', 'نو'],
    ['like_new', 'در حد نو'],
    ['used', 'کارکرده'],
    ['for_parts', 'نیاز به تعمیر'],
  ]),
};

const year = (labelFa = 'سال ساخت', isRequired = false): AttributeSeed => ({
  key: 'year',
  type: 'number',
  labelFa,
  validation: { min: 1950, max: 2030, integer: true },
  isRequired,
  isFilterable: true,
  showOnCard: true,
});

const mileageKm = (isRequired = false): AttributeSeed => ({
  key: 'mileage_km',
  type: 'number',
  labelFa: 'کارکرد',
  unitFa: 'کیلومتر',
  validation: { min: 0, max: 2_000_000, integer: true },
  isRequired,
  isFilterable: true,
  showOnCard: true,
});

const colorOptions = options([
  ['black', 'مشکی'],
  ['white', 'سفید'],
  ['silver', 'نقره‌ای'],
  ['grey', 'خاکستری'],
  ['blue', 'آبی'],
  ['red', 'قرمز'],
  ['green', 'سبز'],
  ['brown', 'قهوه‌ای'],
  ['beige', 'بژ'],
  ['yellow', 'زرد'],
  ['orange', 'نارنجی'],
  ['gold', 'طلایی'],
  ['pink', 'صورتی'],
  ['purple', 'بنفش'],
  ['multicolor', 'چندرنگ'],
  ['other', 'سایر'],
]);

const color: AttributeSeed = {
  key: 'color',
  type: 'select',
  labelFa: 'رنگ',
  isFilterable: true,
  options: colorOptions,
};

/** An amount in the listing's currency (minor units), like the price */
const money = (key: string, labelFa: string, extra: Partial<AttributeSeed> = {}): AttributeSeed => ({
  key,
  type: 'number',
  labelFa,
  validation: { money: true },
  ...extra,
});

const powerHp: AttributeSeed = {
  key: 'power_hp',
  type: 'number',
  labelFa: 'قدرت موتور',
  unitFa: 'اسب بخار (PS)',
  validation: { min: 1, max: 2000, integer: true },
  isFilterable: true,
};

const fuel = (isRequired = false): AttributeSeed => ({
  key: 'fuel',
  type: 'select',
  labelFa: 'سوخت',
  isRequired,
  isFilterable: true,
  showOnCard: true,
  options: options([
    ['petrol', 'بنزین'],
    ['diesel', 'دیزل'],
    ['electric', 'برقی'],
    ['hybrid', 'هیبرید'],
    ['plugin_hybrid', 'هیبرید پلاگین'],
    ['lpg', 'گاز مایع (LPG)'],
    ['cng', 'گاز طبیعی (CNG)'],
  ]),
});

const gearbox = (isRequired = false): AttributeSeed => ({
  key: 'gearbox',
  type: 'select',
  labelFa: 'گیربکس',
  isRequired,
  isFilterable: true,
  options: options([
    ['manual', 'دستی'],
    ['automatic', 'اتوماتیک'],
    ['semi_automatic', 'نیمه‌اتوماتیک'],
  ]),
});

const inspectionUntil: AttributeSeed = {
  key: 'inspection_until',
  type: 'date',
  labelFa: 'معاینه فنی (TÜV/HU یا Pickerl) تا',
  helpFa: 'ماه و سالی که روی برچسب معاینه فنی نوشته شده',
  validation: { month: true },
  isFilterable: true,
};

const rooms = (isRequired = false): AttributeSeed => ({
  key: 'rooms',
  type: 'number',
  labelFa: 'تعداد اتاق',
  helpFa: 'مثل آگهی‌های آلمانی: نیم‌اتاق هم حساب می‌شود (۲٫۵)',
  validation: { min: 0, max: 20, integer: false },
  isRequired,
  isFilterable: true,
  showOnCard: true,
});

const floor: AttributeSeed = {
  key: 'floor',
  type: 'number',
  labelFa: 'طبقه',
  helpFa: 'همکف = ۰',
  validation: { min: -2, max: 60, integer: true },
  isFilterable: true,
};

const furnished: AttributeSeed = {
  key: 'furnished',
  type: 'boolean',
  labelFa: 'مبله',
  isFilterable: true,
};

const balcony: AttributeSeed = {
  key: 'balcony',
  type: 'boolean',
  labelFa: 'بالکن یا تراس',
  isFilterable: true,
};

const elevator: AttributeSeed = {
  key: 'elevator',
  type: 'boolean',
  labelFa: 'آسانسور',
  isFilterable: true,
};

const extraCosts = (isRequired: boolean): AttributeSeed =>
  money('extra_costs', 'هزینه‌های جانبی ماهانه (Nebenkosten)', {
    helpFa: 'مبلغ آگهی، اجاره سرد (Kaltmiete) است. هزینه‌های جانبی را اینجا بنویسید تا اجاره گرم خودکار نشان داده شود.',
    isRequired,
  });

const heatingIncluded: AttributeSeed = {
  key: 'heating_included',
  type: 'boolean',
  labelFa: 'گرمایش جزو هزینه‌های جانبی است',
};

const deposit = money('deposit', 'ودیعه (Kaution)');

const availableFrom = (labelFa = 'قابل سکونت از'): AttributeSeed => ({
  key: 'available_from',
  type: 'date',
  labelFa,
  isFilterable: true,
});

const availableUntil: AttributeSeed = {
  key: 'available_until',
  type: 'date',
  labelFa: 'تا تاریخ',
  helpFa: 'برای اجاره موقت. اگر نامحدود است، خالی بگذارید.',
};

const yearBuilt: AttributeSeed = {
  key: 'year_built',
  type: 'number',
  labelFa: 'سال ساخت بنا',
  validation: { min: 1800, max: 2030, integer: true },
  isFilterable: true,
};

const apartmentType: AttributeSeed = {
  key: 'apartment_type',
  type: 'select',
  labelFa: 'نوع آپارتمان',
  isFilterable: true,
  options: options([
    ['floor_flat', 'طبقه‌ای (Etagenwohnung)'],
    ['ground_floor', 'همکف (Erdgeschoss)'],
    ['attic', 'زیرشیروانی (Dachgeschoss)'],
    ['maisonette', 'دوبلکس (Maisonette)'],
    ['penthouse', 'پنت‌هاوس'],
    ['loft', 'لافت'],
    ['souterrain', 'نیم‌طبقه زیرزمین (Souterrain)'],
    ['other', 'سایر'],
  ]),
};

const houseType: AttributeSeed = {
  key: 'house_type',
  type: 'select',
  labelFa: 'نوع خانه',
  isFilterable: true,
  options: options([
    ['detached', 'تک‌خانواری (Einfamilienhaus)'],
    ['semi_detached', 'دوقلو (Doppelhaushälfte)'],
    ['terraced', 'ردیفی (Reihenhaus)'],
    ['multi_family', 'چندخانواری (Mehrfamilienhaus)'],
    ['bungalow', 'بنگالو'],
    ['villa', 'ویلا'],
    ['other', 'سایر'],
  ]),
};

const features: AttributeSeed = {
  key: 'features',
  type: 'multi_select',
  labelFa: 'امکانات',
  // A checklist: a filter for balcony and lift means both
  validation: { filter: 'all' },
  isFilterable: true,
  options: options([
    ['fitted_kitchen', 'آشپزخانه مجهز (Einbauküche)'],
    ['cellar', 'انباری یا زیرزمین (Keller)'],
    ['garden', 'باغچه یا استفاده از حیاط'],
    ['parking', 'پارکینگ یا گاراژ'],
    ['bathtub', 'وان'],
    ['guest_wc', 'سرویس بهداشتی دوم (Gäste-WC)'],
    ['step_free', 'بدون پله'],
    ['floor_heating', 'گرمایش از کف'],
    ['old_building', 'ساختمان قدیمی (Altbau)'],
    ['new_building', 'نوساز (Neubau)'],
  ]),
};

const petsAllowed: AttributeSeed = {
  key: 'pets_allowed',
  type: 'boolean',
  labelFa: 'حیوان خانگی مجاز است',
  isFilterable: true,
};

const wbsRequired: AttributeSeed = {
  key: 'wbs_required',
  type: 'boolean',
  labelFa: 'نیاز به WBS (فقط آلمان)',
  helpFa: 'برای آپارتمان‌هایی که فقط با مجوز مسکن اجتماعی (Wohnberechtigungsschein) اجاره داده می‌شوند',
  isFilterable: true,
};

const energyClass: AttributeSeed = {
  key: 'energy_class',
  type: 'select',
  labelFa: 'کلاس انرژی (Energieausweis)',
  isFilterable: true,
  options: options([
    ['a_plus', 'A+'],
    ['a', 'A'],
    ['b', 'B'],
    ['c', 'C'],
    ['d', 'D'],
    ['e', 'E'],
    ['f', 'F'],
    ['g', 'G'],
    ['h', 'H'],
  ]),
};

const roomType = (isRequired: boolean, showOnCard: boolean): AttributeSeed => ({
  key: 'room_type',
  type: 'select',
  labelFa: 'نوع جا',
  isRequired,
  isFilterable: true,
  showOnCard,
  options: options([
    ['private_room', 'اتاق خصوصی'],
    ['shared_room', 'اتاق مشترک'],
    ['entire_place', 'کل واحد'],
  ]),
});

const propertyUse: AttributeSeed = {
  key: 'property_use',
  type: 'select',
  labelFa: 'نوع کاربری',
  isRequired: true,
  isFilterable: true,
  showOnCard: true,
  options: options([
    ['office', 'دفتر'],
    ['shop', 'مغازه'],
    ['gastronomy', 'رستوران و کافه'],
    ['warehouse', 'انبار و سالن'],
    ['practice', 'مطب'],
    ['other', 'سایر'],
  ]),
};

/** `showOnCard: false` where titles name the make anyway (cars, motorcycles; approved Oct 21, 2026) */
const brand = (pairs: [string, string][], isRequired = false, showOnCard = true): AttributeSeed => ({
  key: 'brand',
  type: 'select',
  labelFa: 'برند',
  isRequired,
  isFilterable: true,
  showOnCard,
  options: options([...pairs, ['other', 'سایر']]),
});

const deviceModel: AttributeSeed = {
  key: 'device_model',
  type: 'text',
  labelFa: 'مدل دقیق',
  helpFa: 'مثلاً «iPhone 13 Pro» یا «Galaxy S23»',
  validation: { max_length: 60 },
  isSearchable: true,
  showOnCard: true,
};

const storageGb: AttributeSeed = {
  key: 'storage_gb',
  type: 'number',
  labelFa: 'حافظه داخلی',
  unitFa: 'گیگابایت',
  validation: { min: 1, max: 16_384, integer: true },
  isFilterable: true,
  showOnCard: true,
};

const ramGb = (showOnCard: boolean): AttributeSeed => ({
  key: 'ram_gb',
  type: 'number',
  labelFa: 'رم',
  unitFa: 'گیگابایت',
  validation: { min: 1, max: 512, integer: true },
  isFilterable: true,
  showOnCard,
});

const cpu: AttributeSeed = {
  key: 'cpu',
  type: 'text',
  labelFa: 'پردازنده',
  helpFa: 'مثلاً «Intel Core i5» یا «Apple M2»',
  validation: { max_length: 60 },
  isSearchable: true,
};

const screenInch = (showOnCard: boolean): AttributeSeed => ({
  key: 'screen_inch',
  type: 'number',
  labelFa: 'اندازه صفحه',
  unitFa: 'اینچ',
  validation: { min: 5, max: 150, integer: false },
  isFilterable: true,
  showOnCard,
});

const fashionBrand: AttributeSeed = {
  key: 'fashion_brand',
  type: 'text',
  labelFa: 'برند',
  validation: { max_length: 60 },
  isSearchable: true,
};

const genderFit: AttributeSeed = {
  key: 'gender_fit',
  type: 'select',
  labelFa: 'مناسب برای',
  isFilterable: true,
  options: options([
    ['women', 'زنانه'],
    ['men', 'مردانه'],
    ['unisex', 'یونیسکس'],
  ]),
};

const languageOptions = options([
  ['persian', 'فارسی'],
  ['german', 'آلمانی'],
  ['english', 'انگلیسی'],
  ['french', 'فرانسوی'],
  ['arabic', 'عربی'],
  ['turkish', 'ترکی'],
  ['other', 'سایر'],
]);

const instrumentOptions = options([
  ['tar', 'تار'],
  ['setar', 'سه‌تار'],
  ['santur', 'سنتور'],
  ['kamancheh', 'کمانچه'],
  ['tombak', 'تنبک'],
  ['daf', 'دف'],
  ['oud', 'عود'],
  ['ney', 'نی'],
  ['piano', 'پیانو و کیبورد'],
  ['guitar', 'گیتار'],
  ['violin', 'ویولن'],
  ['drums', 'درامز'],
  ['other', 'سایر'],
]);

const instrument: AttributeSeed = {
  key: 'instrument',
  type: 'select',
  labelFa: 'ساز',
  isFilterable: true,
  showOnCard: true,
  options: instrumentOptions,
};

const lessonFormat: AttributeSeed = {
  key: 'lesson_format',
  type: 'select',
  labelFa: 'نحوه برگزاری',
  isFilterable: true,
  showOnCard: true,
  options: options([
    ['in_person', 'حضوری'],
    ['online', 'آنلاین'],
    ['both', 'حضوری و آنلاین'],
  ]),
};

const onlinePossible: AttributeSeed = {
  key: 'online_possible',
  type: 'boolean',
  labelFa: 'امکان انجام آنلاین',
  isFilterable: true,
};

const homeVisit: AttributeSeed = {
  key: 'home_visit',
  type: 'boolean',
  labelFa: 'امکان مراجعه به منزل',
  isFilterable: true,
};

const priceUnit = (pairs: [string, string][]): AttributeSeed => ({
  key: 'price_unit',
  type: 'select',
  labelFa: 'واحد قیمت',
  helpFa: 'اگر قیمت نوشته‌اید، برای چه مقدار است',
  showOnCard: true,
  options: options(pairs),
});

/** A checklist of what a service provider offers */
const offers = (key: string, labelFa: string, pairs: [string, string][], showOnCard = false): AttributeSeed => ({
  key,
  type: 'multi_select',
  labelFa,
  isFilterable: true,
  showOnCard,
  options: options(pairs),
});

/** A plain "kind of item" select, each with its own key (a key keeps one meaning) */
const kind = (key: string, labelFa: string, pairs: [string, string][], extra: Partial<AttributeSeed> = {}): AttributeSeed => ({
  key,
  type: 'select',
  labelFa,
  isFilterable: true,
  showOnCard: true,
  options: options(pairs),
  ...extra,
});

const carModel: AttributeSeed = {
  key: 'model',
  type: 'select',
  labelFa: 'مدل',
  dependsOn: 'brand',
  isRequired: true,
  isFilterable: true,
  // Titles name the model (approved Oct 21, 2026)
  showOnCard: false,
  options: carModels,
};

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

const leaf = (slug: string, nameFa: string, extra: Partial<CategorySeed> = {}): CategorySeed => ({
  slug,
  nameFa,
  ...extra,
});

const rentHome = (typeField: AttributeSeed): AttributeSeed[] => [
  extraCosts(true),
  heatingIncluded,
  deposit,
  availableFrom(),
  rooms(true),
  floor,
  typeField,
  furnished,
  balcony,
  elevator,
  features,
  petsAllowed,
  wbsRequired,
  yearBuilt,
  energyClass,
];

const saleHome = (typeField: AttributeSeed, extra: AttributeSeed[]): AttributeSeed[] => [
  rooms(true),
  floor,
  typeField,
  yearBuilt,
  furnished,
  balcony,
  elevator,
  features,
  energyClass,
  ...extra,
  {
    key: 'rented_out',
    type: 'boolean',
    labelFa: 'اجاره داده شده',
    helpFa: 'ملک در حال حاضر مستأجر دارد (فروش برای سرمایه‌گذاری)',
    isFilterable: true,
  },
  {
    key: 'commission_free',
    type: 'boolean',
    labelFa: 'بدون کمیسیون مشاور (provisionsfrei)',
    isFilterable: true,
  },
];

export const categories: CategorySeed[] = [
  {
    slug: 'real-estate',
    nameFa: 'املاک',
    icon: 'home',
    attributes: [
      {
        key: 'area_m2',
        type: 'number',
        labelFa: 'متراژ',
        unitFa: 'متر مربع',
        helpFa: 'برای اتاق در خانه اشتراکی، متراژ خود اتاق؛ برای زمین، متراژ زمین',
        validation: { min: 1, max: 100_000, integer: true, optional_in: ['parking-garages'] },
        isRequired: true,
        isFilterable: true,
        showOnCard: true,
      },
    ],
    children: [
      leaf('apartments-rent', 'اجاره آپارتمان', { attributes: rentHome(apartmentType) }),
      leaf('houses-rent', 'اجاره خانه', { attributes: rentHome(houseType) }),
      leaf('shared-rooms', 'اتاق و خانه اشتراکی (WG)', {
        attributes: [
          roomType(true, true),
          {
            key: 'flatmates',
            type: 'number',
            labelFa: 'تعداد هم‌خانه',
            validation: { min: 1, max: 20, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
          {
            key: 'flatmate_preference',
            type: 'select',
            labelFa: 'ترجیح هم‌خانه',
            isFilterable: true,
            options: options([
              ['any', 'فرقی نمی‌کند'],
              ['women_only', 'فقط خانم'],
              ['men_only', 'فقط آقا'],
            ]),
          },
          availableFrom(),
          availableUntil,
          furnished,
          deposit,
        ],
      }),
      leaf('short-term-rent', 'اجاره موقت و کوتاه‌مدت', {
        attributes: [
          {
            key: 'rent_period',
            type: 'select',
            labelFa: 'واحد قیمت',
            isRequired: true,
            showOnCard: true,
            options: options([
              ['night', 'شبانه'],
              ['week', 'هفتگی'],
              ['month', 'ماهانه'],
            ]),
          },
          roomType(false, true),
          rooms(),
          furnished,
          availableFrom(),
          availableUntil,
          deposit,
        ],
      }),
      leaf('apartments-sale', 'فروش آپارتمان', {
        attributes: saleHome(apartmentType, [money('owner_fee', 'شارژ ماهانه (Hausgeld)')]),
      }),
      leaf('houses-sale', 'فروش خانه', {
        attributes: saleHome(houseType, [
          {
            key: 'plot_m2',
            type: 'number',
            labelFa: 'متراژ زمین',
            unitFa: 'متر مربع',
            validation: { min: 1, max: 1_000_000, integer: true },
            isFilterable: true,
          },
        ]),
      }),
      leaf('land-gardens', 'زمین و باغچه', {
        attributes: [
          kind('land_type', 'نوع زمین', [
            ['building_plot', 'زمین ساختمانی'],
            ['allotment', 'باغچه (Kleingarten)'],
            ['agricultural', 'کشاورزی یا جنگلی'],
            ['other', 'سایر'],
          ], { isRequired: true }),
        ],
      }),
      leaf('commercial-rent', 'اجاره ملک تجاری و اداری', {
        attributes: [propertyUse, extraCosts(false), deposit, availableFrom('قابل استفاده از')],
      }),
      leaf('commercial-sale', 'فروش ملک تجاری و اداری', { attributes: [propertyUse, yearBuilt] }),
      leaf('parking-garages', 'گاراژ و جای پارک', {
        attributes: [
          kind('deal_type', 'اجاره یا فروش', [
            ['rent', 'اجاره'],
            ['sale', 'فروش'],
          ], { isRequired: true }),
          kind('parking_type', 'نوع جای پارک', [
            ['garage', 'گاراژ'],
            ['underground', 'پارکینگ زیرزمینی'],
            ['outdoor', 'جای پارک روباز'],
            ['other', 'سایر'],
          ]),
        ],
      }),
    ],
  },
  {
    slug: 'vehicles',
    nameFa: 'وسایل نقلیه',
    icon: 'car',
    children: [
      leaf('cars', 'خودرو', {
        attributes: [
          brand(carBrands, true, false),
          carModel,
          {
            key: 'trim',
            type: 'text',
            labelFa: 'تیپ و نسخه',
            helpFa: 'مثلاً «320d Touring» یا «GTI»',
            validation: { max_length: 60 },
            isSearchable: true,
          },
          year('سال ساخت', true),
          mileageKm(true),
          fuel(true),
          gearbox(true),
          {
            key: 'body_type',
            type: 'select',
            labelFa: 'نوع بدنه',
            isFilterable: true,
            options: options([
              ['small', 'کوچک شهری'],
              ['sedan', 'سدان'],
              ['hatchback', 'هاچ‌بک'],
              ['station_wagon', 'استیشن'],
              ['suv', 'شاسی‌بلند'],
              ['coupe', 'کوپه'],
              ['convertible', 'کروک'],
              ['van', 'ون'],
              ['pickup', 'وانت'],
            ]),
          },
          powerHp,
          {
            key: 'damage',
            type: 'select',
            labelFa: 'وضعیت بدنه و تصادف',
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['accident_free', 'بدون تصادف'],
              ['repaired', 'تصادفی، تعمیرشده'],
              ['damaged', 'آسیب‌دیده یا نیاز به تعمیر'],
            ]),
          },
          inspectionUntil,
          { ...color, labelFa: 'رنگ بدنه' },
          {
            key: 'previous_owners',
            type: 'number',
            labelFa: 'تعداد مالکان قبلی',
            validation: { min: 0, max: 20, integer: true },
            isFilterable: true,
          },
          {
            key: 'service_history',
            type: 'boolean',
            labelFa: 'دفترچه سرویس کامل (Scheckheft)',
            isFilterable: true,
          },
          {
            key: 'doors',
            type: 'select',
            labelFa: 'تعداد در',
            isFilterable: true,
            options: options([
              ['d2_3', '۲ یا ۳'],
              ['d4_5', '۴ یا ۵'],
              ['d6_7', '۶ یا ۷'],
            ]),
          },
          {
            key: 'emission_class',
            type: 'select',
            labelFa: 'استاندارد آلایندگی',
            helpFa: 'از روی مدارک خودرو (Schadstoffklasse)',
            isFilterable: true,
            options: options([
              ['euro1', 'Euro 1'],
              ['euro2', 'Euro 2'],
              ['euro3', 'Euro 3'],
              ['euro4', 'Euro 4'],
              ['euro5', 'Euro 5'],
              ['euro6', 'Euro 6'],
            ]),
          },
          {
            key: 'car_extras',
            type: 'multi_select',
            labelFa: 'امکانات',
            validation: { filter: 'all' },
            isFilterable: true,
            options: options([
              ['air_con', 'کولر'],
              ['navigation', 'ناوبری'],
              ['parking_sensors', 'سنسور پارک'],
              ['rear_camera', 'دوربین عقب'],
              ['seat_heating', 'گرمکن صندلی'],
              ['cruise_control', 'کروز کنترل'],
              ['tow_bar', 'قلاب یدک‌کش'],
              ['alloy_wheels', 'رینگ آلومینیومی'],
              ['panorama_roof', 'سقف پانوراما'],
              ['led_lights', 'چراغ LED یا زنون'],
              ['carplay', 'CarPlay یا Android Auto'],
              ['non_smoker', 'غیرسیگاری'],
            ]),
          },
        ],
      }),
      leaf('motorcycles', 'موتورسیکلت و اسکوتر', {
        attributes: [
          {
            key: 'motorcycle_type',
            type: 'select',
            labelFa: 'نوع',
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['motorcycle', 'موتورسیکلت'],
              ['scooter', 'اسکوتر'],
              ['moped', 'موتور گازی'],
              ['cruiser', 'کروزر و چاپر'],
              ['enduro', 'کراس و اندورو'],
              ['sport', 'اسپرت'],
              ['touring', 'تورینگ'],
              ['quad', 'چهارچرخ (Quad)'],
            ]),
          },
          brand([
            ['honda', 'هوندا'],
            ['yamaha', 'یاماها'],
            ['kawasaki', 'کاوازاکی'],
            ['suzuki', 'سوزوکی'],
            ['bmw', 'ب‌ام‌و'],
            ['ktm', 'KTM'],
            ['ducati', 'دوکاتی'],
            ['harley_davidson', 'هارلی‌دیویدسون'],
            ['piaggio', 'وسپا و پیاجو'],
            ['triumph', 'تریومف'],
          ], false, false),
          year(),
          mileageKm(),
          {
            key: 'engine_cc',
            type: 'number',
            labelFa: 'حجم موتور',
            unitFa: 'سی‌سی',
            validation: { min: 1, max: 3000, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
          powerHp,
          {
            key: 'licence_class',
            type: 'select',
            labelFa: 'گواهینامه لازم',
            isFilterable: true,
            options: options([
              ['am', 'AM'],
              ['a1', 'A1 (یا B196)'],
              ['a2', 'A2'],
              ['a', 'A'],
            ]),
          },
          inspectionUntil,
        ],
      }),
      leaf('bicycles', 'دوچرخه و اسکوتر برقی', {
        attributes: [
          condition,
          {
            key: 'bike_type',
            type: 'select',
            labelFa: 'نوع',
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['city', 'شهری'],
              ['trekking', 'تورینگ'],
              ['mountain', 'کوهستان'],
              ['road', 'کورسی'],
              ['e_bike', 'دوچرخه برقی'],
              ['e_scooter', 'اسکوتر برقی'],
              ['kids', 'کودک'],
              ['cargo', 'باری'],
              ['bmx', 'BMX'],
              ['folding', 'تاشو'],
            ]),
          },
          genderFit,
          {
            key: 'frame_size_cm',
            type: 'number',
            labelFa: 'اندازه بدنه',
            unitFa: 'سانتی‌متر',
            validation: { min: 20, max: 80, integer: true },
            isFilterable: true,
          },
          {
            key: 'wheel_inch',
            type: 'number',
            labelFa: 'سایز چرخ',
            unitFa: 'اینچ',
            validation: { min: 8, max: 32, integer: false },
            isFilterable: true,
          },
        ],
      }),
      leaf('campers', 'کاروان و کمپر', {
        attributes: [
          kind('camper_type', 'نوع', [
            ['caravan', 'کاروان (Wohnwagen)'],
            ['motorhome', 'اتوکاروان (Wohnmobil)'],
            ['other', 'سایر'],
          ], { isRequired: true }),
          {
            key: 'berths',
            type: 'number',
            labelFa: 'تعداد تخت',
            validation: { min: 1, max: 12, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
          year(),
          mileageKm(),
          inspectionUntil,
        ],
      }),
      leaf('commercial-vehicles', 'خودروی تجاری و تریلر', {
        attributes: [
          kind('vehicle_kind', 'نوع', [
            ['cargo_van', 'ون باری'],
            ['passenger_van', 'ون مسافری'],
            ['truck', 'کامیون'],
            ['trailer', 'تریلر و یدک'],
            ['machinery', 'ماشین‌آلات راهسازی و کشاورزی'],
            ['other', 'سایر'],
          ], { isRequired: true }),
          year(),
          mileageKm(),
          { ...fuel(), showOnCard: false },
          gearbox(),
          inspectionUntil,
        ],
      }),
      leaf('boats', 'قایق', {
        attributes: [
          kind('boat_type', 'نوع', [
            ['motor', 'موتوری'],
            ['sail', 'بادبانی'],
            ['inflatable', 'بادی'],
            ['paddle', 'کایاک و قایق پارویی'],
            ['other', 'سایر'],
          ]),
          {
            key: 'length_m',
            type: 'number',
            labelFa: 'طول',
            unitFa: 'متر',
            validation: { min: 1, max: 100, integer: false },
            isFilterable: true,
          },
          year(),
        ],
      }),
      leaf('car-parts', 'قطعات و لوازم خودرو', {
        attributes: [
          condition,
          kind('car_part_type', 'نوع قطعه', [
            ['engine', 'موتور و گیربکس'],
            ['body', 'بدنه و شیشه'],
            ['interior', 'داخل خودرو'],
            ['electrics', 'برق و چراغ'],
            ['brakes', 'ترمز و جلوبندی'],
            ['multimedia', 'صوتی و تصویری'],
            ['accessories', 'باربند و لوازم جانبی'],
            ['other', 'سایر'],
          ], { showOnCard: false }),
          {
            key: 'fits_brand',
            type: 'select',
            labelFa: 'مناسب برای خودروی',
            isFilterable: true,
            showOnCard: true,
            options: options([...carBrands, ['other', 'سایر']]),
          },
        ],
      }),
      leaf('tires-rims', 'لاستیک و رینگ', {
        attributes: [
          kind('wheel_item', 'چه چیزی', [
            ['tires', 'فقط لاستیک'],
            ['rims', 'فقط رینگ'],
            ['wheels', 'چرخ کامل (لاستیک با رینگ)'],
          ], { isRequired: true }),
          condition,
          {
            key: 'tire_season',
            type: 'select',
            labelFa: 'نوع لاستیک',
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['summer', 'تابستانی'],
              ['winter', 'زمستانی'],
              ['all_season', 'چهارفصل'],
            ]),
          },
          {
            key: 'tire_width_mm',
            type: 'number',
            labelFa: 'پهنای لاستیک',
            unitFa: 'میلی‌متر',
            helpFa: 'عدد اول روی لاستیک، مثلاً ۲۰۵ در 205/55 R16',
            validation: { min: 100, max: 400, integer: true },
            isFilterable: true,
          },
          {
            key: 'tire_aspect',
            type: 'number',
            labelFa: 'نسبت ارتفاع',
            helpFa: 'عدد دوم، مثلاً ۵۵ در 205/55 R16',
            validation: { min: 20, max: 100, integer: true },
            isFilterable: true,
          },
          {
            key: 'rim_inch',
            type: 'number',
            labelFa: 'سایز رینگ',
            unitFa: 'اینچ',
            validation: { min: 10, max: 24, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
          {
            key: 'piece_count',
            type: 'number',
            labelFa: 'تعداد',
            validation: { min: 1, max: 8, integer: true },
            showOnCard: true,
          },
          {
            key: 'tread_mm',
            type: 'number',
            labelFa: 'عمق آج',
            unitFa: 'میلی‌متر',
            validation: { min: 0, max: 20, integer: false },
          },
        ],
      }),
      leaf('motorcycle-parts', 'قطعات و لوازم موتورسیکلت', { attributes: [condition] }),
    ],
  },
  {
    slug: 'electronics',
    nameFa: 'کالای دیجیتال',
    icon: 'smartphone',
    attributes: [condition],
    children: [
      leaf('mobile-phones', 'گوشی موبایل', {
        attributes: [
          brand([
            ['apple', 'اپل'],
            ['samsung', 'سامسونگ'],
            ['xiaomi', 'شیائومی'],
            ['google', 'گوگل'],
            ['huawei', 'هواوی'],
            ['oneplus', 'وان‌پلاس'],
            ['motorola', 'موتورولا'],
            ['nokia', 'نوکیا'],
            ['sony', 'سونی'],
            ['realme', 'ریلمی'],
            ['oppo', 'اوپو'],
            ['nothing', 'ناتینگ'],
            ['fairphone', 'فرفون'],
          ]),
          deviceModel,
          storageGb,
          ramGb(false),
          color,
          {
            key: 'battery_health',
            type: 'select',
            labelFa: 'سلامت باتری',
            isFilterable: true,
            options: options([
              ['p100', '۱۰۰٪'],
              ['p95', '۹۵ تا ۹۹٪'],
              ['p85', '۸۵ تا ۹۴٪'],
              ['p80', '۸۰ تا ۸۴٪'],
              ['below80', 'زیر ۸۰٪'],
              ['broken', 'خراب'],
            ]),
          },
          {
            key: 'warranty',
            type: 'boolean',
            labelFa: 'گارانتی دارد',
            isFilterable: true,
          },
          {
            key: 'has_receipt',
            type: 'boolean',
            labelFa: 'فاکتور خرید دارد',
          },
        ],
      }),
      leaf('tablets', 'تبلت و کتاب‌خوان', {
        attributes: [
          brand([
            ['apple', 'اپل'],
            ['samsung', 'سامسونگ'],
            ['amazon', 'آمازون'],
            ['lenovo', 'لنوو'],
          ]),
          deviceModel,
          storageGb,
          {
            key: 'cellular',
            type: 'boolean',
            labelFa: 'سیم‌کارت‌خور (LTE/5G)',
            isFilterable: true,
          },
        ],
      }),
      leaf('phone-accessories', 'لوازم جانبی موبایل'),
      leaf('wearables', 'ساعت هوشمند و پوشیدنی', {
        attributes: [
          brand([
            ['apple', 'اپل'],
            ['samsung', 'سامسونگ'],
            ['garmin', 'گارمین'],
            ['fitbit', 'فیت‌بیت'],
            ['huawei', 'هواوی'],
            ['xiaomi', 'شیائومی'],
          ]),
          deviceModel,
        ],
      }),
      leaf('laptops', 'لپ‌تاپ', {
        attributes: [
          brand([
            ['apple', 'اپل'],
            ['lenovo', 'لنوو'],
            ['hp', 'اچ‌پی'],
            ['dell', 'دل'],
            ['asus', 'ایسوس'],
            ['acer', 'ایسر'],
            ['microsoft', 'مایکروسافت'],
          ]),
          { ...deviceModel, helpFa: 'مثلاً «MacBook Air M2» یا «ThinkPad T14»' },
          ramGb(true),
          storageGb,
          screenInch(false),
          cpu,
        ],
      }),
      leaf('desktop-computers', 'رایانه رومیزی', { attributes: [ramGb(true), storageGb, cpu] }),
      leaf('computer-parts', 'قطعات رایانه', {
        attributes: [
          kind('pc_part_type', 'نوع قطعه', [
            ['cpu', 'پردازنده'],
            ['gpu', 'کارت گرافیک'],
            ['motherboard', 'مادربرد'],
            ['ram', 'رم'],
            ['storage', 'هارد و SSD'],
            ['psu', 'پاور'],
            ['case', 'کیس'],
            ['cooling', 'خنک‌کننده'],
            ['other', 'سایر'],
          ]),
        ],
      }),
      leaf('computer-accessories', 'پرینتر، شبکه و لوازم جانبی', {
        attributes: [
          kind('accessory_type', 'نوع', [
            ['printer', 'پرینتر و اسکنر'],
            ['monitor', 'مانیتور'],
            ['network', 'مودم و شبکه'],
            ['input', 'کیبورد و ماوس'],
            ['other', 'سایر'],
          ], { showOnCard: false }),
        ],
      }),
      leaf('gaming', 'کنسول و بازی ویدیویی', {
        attributes: [
          {
            key: 'platform',
            type: 'select',
            labelFa: 'پلتفرم',
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['playstation', 'پلی‌استیشن'],
              ['xbox', 'ایکس‌باکس'],
              ['nintendo', 'نینتندو'],
              ['pc', 'کامپیوتر'],
              ['other', 'سایر'],
            ]),
          },
          kind('gaming_item', 'نوع', [
            ['console', 'کنسول'],
            ['game', 'بازی'],
            ['controller', 'دسته و لوازم جانبی'],
            ['vr', 'واقعیت مجازی (VR)'],
          ]),
        ],
      }),
      leaf('tv-video', 'تلویزیون و پروژکتور', {
        attributes: [
          screenInch(true),
          {
            ...brand([
              ['samsung', 'سامسونگ'],
              ['lg', 'ال‌جی'],
              ['sony', 'سونی'],
              ['philips', 'فیلیپس'],
              ['panasonic', 'پاناسونیک'],
              ['tcl', 'TCL'],
              ['hisense', 'هایسنس'],
            ]),
            showOnCard: false,
          },
        ],
      }),
      leaf('audio', 'صوتی و هدفون', {
        attributes: [
          kind('audio_type', 'نوع', [
            ['headphones', 'هدفون'],
            ['speakers', 'اسپیکر و ساندبار'],
            ['hifi', 'سیستم صوتی (Hi-Fi)'],
            ['turntable', 'گرامافون'],
            ['other', 'سایر'],
          ], { showOnCard: false }),
        ],
      }),
      leaf('cameras', 'دوربین عکاسی و فیلم‌برداری', {
        attributes: [
          {
            ...brand([
              ['canon', 'کانن'],
              ['nikon', 'نیکون'],
              ['sony', 'سونی'],
              ['fujifilm', 'فوجی‌فیلم'],
              ['panasonic', 'پاناسونیک'],
              ['gopro', 'گوپرو'],
              ['dji', 'دی‌جی‌آی'],
              ['leica', 'لایکا'],
              ['olympus', 'المپوس'],
            ]),
            showOnCard: false,
          },
          kind('camera_type', 'نوع', [
            ['dslr', 'DSLR'],
            ['mirrorless', 'بدون آینه'],
            ['compact', 'کامپکت'],
            ['action', 'ورزشی'],
            ['drone', 'پهپاد'],
            ['lens', 'لنز'],
            ['video', 'فیلم‌برداری'],
            ['other', 'سایر'],
          ]),
        ],
      }),
      leaf('other-electronics', 'سایر کالای دیجیتال'),
    ],
  },
  {
    slug: 'home-garden',
    nameFa: 'خانه و آشپزخانه',
    icon: 'sofa',
    children: [
      leaf('living-room', 'مبلمان پذیرایی و نشیمن', {
        attributes: [
          condition,
          kind('living_item', 'نوع', [
            ['sofa', 'مبل و کاناپه'],
            ['armchair', 'صندلی راحتی'],
            ['table', 'میز'],
            ['shelf', 'کتابخانه و قفسه'],
            ['tv_furniture', 'میز تلویزیون'],
            ['other', 'سایر'],
          ]),
        ],
      }),
      leaf('bedroom', 'اتاق خواب، تخت و کمد', {
        attributes: [
          condition,
          kind('bedroom_item', 'نوع', [
            ['bed', 'تخت'],
            ['mattress', 'تشک'],
            ['wardrobe', 'کمد'],
            ['dresser', 'دراور و پاتختی'],
            ['set', 'سرویس کامل'],
            ['other', 'سایر'],
          ]),
        ],
      }),
      leaf('kitchen-dining', 'آشپزخانه و ناهارخوری', {
        attributes: [
          condition,
          {
            key: 'fitted_kitchen',
            type: 'boolean',
            labelFa: 'آشپزخانه کامل (Einbauküche)',
            isFilterable: true,
            showOnCard: true,
          },
        ],
      }),
      leaf('home-appliances', 'لوازم خانگی برقی', {
        attributes: [
          condition,
          kind('appliance_type', 'نوع', [
            ['washing_machine', 'ماشین لباسشویی'],
            ['fridge', 'یخچال و فریزر'],
            ['dishwasher', 'ماشین ظرفشویی'],
            ['oven', 'اجاق و فر'],
            ['dryer', 'خشک‌کن'],
            ['microwave', 'مایکروویو'],
            ['vacuum', 'جاروبرقی'],
            ['coffee', 'قهوه‌ساز'],
            ['other', 'سایر'],
          ]),
          {
            ...brand([
              ['bosch', 'بوش'],
              ['siemens', 'زیمنس'],
              ['miele', 'میله'],
              ['aeg', 'AEG'],
              ['samsung', 'سامسونگ'],
              ['lg', 'ال‌جی'],
              ['bauknecht', 'باکنشت'],
            ]),
            showOnCard: false,
          },
        ],
      }),
      leaf('cookware', 'ظروف و لوازم آشپزخانه', { attributes: [condition] }),
      leaf('carpets-rugs', 'فرش، گلیم و تابلوفرش', {
        attributes: [
          condition,
          {
            key: 'carpet_type',
            type: 'select',
            labelFa: 'نوع',
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['handmade', 'دستباف'],
              ['machine_made', 'ماشینی'],
              ['kilim', 'گلیم'],
              ['gabbeh', 'گبه'],
              ['tableau', 'تابلوفرش'],
            ]),
          },
          {
            key: 'carpet_origin',
            type: 'select',
            labelFa: 'محل بافت',
            isFilterable: true,
            options: options([
              ['tabriz', 'تبریز'],
              ['kashan', 'کاشان'],
              ['isfahan', 'اصفهان'],
              ['qom', 'قم'],
              ['nain', 'نائین'],
              ['kerman', 'کرمان'],
              ['mashhad', 'مشهد'],
              ['heriz', 'هریس'],
              ['bijar', 'بیجار'],
              ['shiraz', 'شیراز و قشقایی'],
              ['ardabil', 'اردبیل'],
              ['hamedan', 'همدان'],
              ['non_iranian', 'غیرایرانی'],
              ['other', 'سایر'],
            ]),
          },
          {
            key: 'carpet_material',
            type: 'select',
            labelFa: 'جنس',
            isFilterable: true,
            options: options([
              ['wool', 'پشم'],
              ['silk', 'ابریشم'],
              ['wool_silk', 'پشم و ابریشم (گل‌ابریشم)'],
              ['synthetic', 'نخ و الیاف مصنوعی'],
            ]),
          },
          {
            key: 'width_cm',
            type: 'number',
            labelFa: 'عرض',
            unitFa: 'سانتی‌متر',
            validation: { min: 1, max: 2000, integer: true },
          },
          {
            key: 'length_cm',
            type: 'number',
            labelFa: 'طول',
            unitFa: 'سانتی‌متر',
            validation: { min: 1, max: 3000, integer: true },
          },
        ],
      }),
      leaf('lighting', 'روشنایی', { attributes: [condition] }),
      leaf('decor', 'دکوراسیون', { attributes: [condition] }),
      leaf('home-textiles', 'پرده و منسوجات خانگی', { attributes: [condition] }),
      leaf('garden-plants', 'باغ، گل و گیاه'),
      leaf('diy-tools', 'ابزار و تعمیرات', { attributes: [condition] }),
      leaf('food-drinks', 'خوراکی و نوشیدنی'),
      leaf('other-home', 'سایر لوازم خانه', { attributes: [condition] }),
    ],
  },
  {
    slug: 'fashion-beauty',
    nameFa: 'پوشاک و آرایشی',
    icon: 'shirt',
    attributes: [condition],
    children: [
      leaf('women-clothing', 'لباس زنانه', {
        attributes: [
          clothingSize([
            ['xs', 'XS (34)'],
            ['s', 'S (36)'],
            ['m', 'M (38)'],
            ['l', 'L (40)'],
            ['xl', 'XL (42)'],
            ['xxl', 'XXL (44)'],
            ['xxxl', '3XL (46) و بزرگ‌تر'],
          ]),
          garmentType(true),
          fashionBrand,
          color,
        ],
      }),
      leaf('men-clothing', 'لباس مردانه', {
        attributes: [
          clothingSize([
            ['xs', 'XS (44)'],
            ['s', 'S (46)'],
            ['m', 'M (48–50)'],
            ['l', 'L (52)'],
            ['xl', 'XL (54)'],
            ['xxl', 'XXL (56)'],
            ['xxxl', '3XL (58) و بزرگ‌تر'],
          ]),
          garmentType(false),
          fashionBrand,
          color,
        ],
      }),
      leaf('shoes', 'کفش', {
        attributes: [
          {
            key: 'shoe_size_eu',
            type: 'number',
            labelFa: 'سایز (اروپایی)',
            validation: { min: 15, max: 52, integer: false },
            isFilterable: true,
            showOnCard: true,
          },
          genderFit,
          fashionBrand,
          color,
        ],
      }),
      leaf('bags-accessories', 'کیف و اکسسوری', { attributes: [genderFit, fashionBrand] }),
      leaf('jewelry-watches', 'زیورآلات و ساعت', {
        attributes: [
          kind('jewelry_material', 'جنس', [
            ['gold', 'طلا'],
            ['silver', 'نقره'],
            ['platinum', 'پلاتین'],
            ['costume', 'بدلیجات'],
            ['other', 'سایر'],
          ]),
          {
            key: 'gold_karat',
            type: 'select',
            labelFa: 'عیار',
            dependsOn: 'jewelry_material',
            isFilterable: true,
            options: (
              [
                ['k18', '۱۸ عیار'],
                ['k21', '۲۱ عیار'],
                ['k22', '۲۲ عیار'],
                ['k24', '۲۴ عیار'],
                ['k14', '۱۴ عیار'],
              ] as [string, string][]
            ).map(([value, labelFa]) => ({ value, labelFa, parent: 'gold' })),
          },
          {
            key: 'weight_g',
            type: 'number',
            labelFa: 'وزن',
            unitFa: 'گرم',
            validation: { min: 0.01, max: 10_000, integer: false },
            showOnCard: true,
          },
        ],
      }),
      leaf('beauty-care', 'آرایشی و بهداشتی'),
    ],
  },
  {
    slug: 'kids-baby',
    nameFa: 'کودک و نوزاد',
    icon: 'baby',
    attributes: [condition],
    children: [
      leaf('kids-clothing', 'لباس و کفش کودک', {
        attributes: [
          {
            key: 'kids_size_cm',
            type: 'number',
            labelFa: 'سایز',
            unitFa: 'سانتی‌متر',
            helpFa: 'سایز آلمانی بر اساس قد، مثل ۹۲ یا ۱۱۶',
            validation: { min: 44, max: 188, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
          {
            key: 'kids_gender',
            type: 'select',
            labelFa: 'برای',
            isFilterable: true,
            options: options([
              ['girl', 'دختر'],
              ['boy', 'پسر'],
              ['unisex', 'هر دو'],
            ]),
          },
        ],
      }),
      leaf('strollers', 'کالسکه و کریر', {
        attributes: [
          kind('stroller_type', 'نوع', [
            ['pram', 'کالسکه نوزاد'],
            ['buggy', 'کالسکه سبک (Buggy)'],
            ['combi', 'کالسکه چندکاره'],
            ['twin', 'دوقلو'],
            ['carrier', 'آغوشی و کریر'],
          ]),
        ],
      }),
      leaf('car-seats', 'صندلی ماشین کودک', {
        attributes: [
          kind('car_seat_group', 'گروه سنی و وزنی', [
            ['infant', 'نوزاد (تا ۱۳ کیلو)'],
            ['group1', 'گروه ۱ (۹ تا ۱۸ کیلو)'],
            ['group23', 'گروه ۲ و ۳ (۱۵ تا ۳۶ کیلو)'],
            ['multi', 'چندگروهی'],
          ]),
          {
            key: 'isofix',
            type: 'boolean',
            labelFa: 'ایزوفیکس (Isofix)',
            isFilterable: true,
          },
        ],
      }),
      leaf('kids-furniture', 'سرویس خواب و مبلمان کودک'),
      leaf('toys', 'اسباب‌بازی', {
        attributes: [
          kind('toy_age', 'مناسب برای سن', [
            ['age0_1', '۰ تا ۱ سال'],
            ['age1_3', '۱ تا ۳ سال'],
            ['age3_6', '۳ تا ۶ سال'],
            ['age6_10', '۶ تا ۱۰ سال'],
            ['age10_plus', '۱۰ سال به بالا'],
          ]),
        ],
      }),
      leaf('baby-gear', 'سایر لوازم نوزاد'),
    ],
  },
  {
    slug: 'pets',
    nameFa: 'حیوانات',
    icon: 'paw-print',
    children: [
      leaf('dogs', 'سگ', { attributes: [...animal('نژاد'), ...animalHealth()] }),
      leaf('cats', 'گربه', { attributes: [...animal('نژاد'), ...animalHealth()] }),
      leaf('birds', 'پرنده', { attributes: animal('نژاد یا گونه') }),
      leaf('fish-aquariums', 'ماهی و آکواریوم'),
      leaf('small-animals', 'حیوانات کوچک', { attributes: animal('نژاد یا گونه') }),
      leaf('pet-supplies', 'لوازم حیوانات', { attributes: [condition] }),
      leaf('pet-care', 'نگهداری و آموزش حیوانات', { priceMode: 'optional' }),
    ],
  },
  {
    slug: 'leisure-hobbies',
    nameFa: 'سرگرمی و فراغت',
    icon: 'book-open',
    children: [
      leaf('books', 'کتاب و مجله', {
        attributes: [
          condition,
          {
            key: 'book_language',
            type: 'select',
            labelFa: 'زبان',
            isFilterable: true,
            showOnCard: true,
            options: languageOptions,
          },
          kind('book_type', 'نوع کتاب', [
            ['fiction', 'رمان و داستان'],
            ['poetry', 'شعر'],
            ['textbook', 'درسی و دانشگاهی'],
            ['children', 'کودک و نوجوان'],
            ['non_fiction', 'غیرداستانی'],
            ['language', 'آموزش زبان'],
            ['cooking', 'آشپزی'],
            ['comics', 'کمیک'],
            ['other', 'سایر'],
          ]),
        ],
      }),
      leaf('music-movies', 'فیلم و موسیقی', {
        attributes: [
          condition,
          kind('media_format', 'قالب', [
            ['cd', 'CD'],
            ['vinyl', 'صفحه گرامافون'],
            ['dvd', 'DVD و بلوری'],
            ['cassette', 'کاست'],
            ['other', 'سایر'],
          ], { showOnCard: false }),
        ],
      }),
      leaf('musical-instruments', 'آلات موسیقی', { attributes: [condition, instrument] }),
      leaf('tickets', 'بلیت کنسرت و رویداد', {
        attributes: [
          {
            key: 'event_date',
            type: 'date',
            labelFa: 'تاریخ رویداد',
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
          },
          kind('ticket_type', 'نوع', [
            ['concert', 'کنسرت'],
            ['theatre', 'تئاتر و کمدی'],
            ['sports', 'ورزشی'],
            ['festival', 'جشنواره'],
            ['other', 'سایر'],
          ]),
          {
            key: 'ticket_count',
            type: 'number',
            labelFa: 'تعداد بلیت',
            validation: { min: 1, max: 20, integer: true },
            showOnCard: true,
          },
        ],
      }),
      leaf('sports', 'ورزش و تناسب اندام', { attributes: [condition] }),
      leaf('outdoor-camping', 'کوهنوردی و کمپینگ', { attributes: [condition] }),
      leaf('collectibles', 'کلکسیون و عتیقه', { attributes: [condition] }),
      leaf('art-handicrafts', 'هنر و صنایع دستی', { attributes: [condition] }),
    ],
  },
  {
    slug: 'services',
    nameFa: 'خدمات',
    icon: 'wrench',
    priceMode: 'optional',
    attributes: [
      priceUnit([
        ['hour', 'ساعتی'],
        ['job', 'هر کار (ثابت)'],
        ['day', 'روزانه'],
        ['m2', 'هر متر مربع'],
      ]),
    ],
    children: [
      leaf('moving-transport', 'اسباب‌کشی و حمل‌ونقل', {
        attributes: [
          offers('moving_services', 'خدمات', [
            ['moving', 'اسباب‌کشی'],
            ['van_transport', 'حمل بار با ون'],
            ['clearance', 'تخلیه و دورریزی (Entrümpelung)'],
            ['assembly', 'مونتاژ مبلمان'],
            ['packing', 'بسته‌بندی'],
          ]),
        ],
      }),
      leaf('home-repairs', 'تعمیرات و خدمات ساختمانی', {
        attributes: [
          offers('trades', 'تخصص', [
            ['painting', 'نقاشی'],
            ['electrical', 'برق‌کاری'],
            ['plumbing', 'لوله‌کشی'],
            ['tiling', 'کاشی و کف‌پوش'],
            ['carpentry', 'نجاری'],
            ['renovation', 'بازسازی کامل'],
            ['gardening', 'باغبانی'],
            ['installation', 'نصب کابینت و مبلمان'],
            ['other', 'سایر'],
          ], true),
        ],
      }),
      leaf('cleaning', 'نظافت', {
        attributes: [
          offers('cleaning_types', 'نوع نظافت', [
            ['home', 'منزل'],
            ['office', 'اداری'],
            ['move_out', 'نظافت تحویل خانه (Endreinigung)'],
            ['carpet_sofa', 'فرش و مبل'],
            ['windows', 'پنجره'],
          ]),
        ],
      }),
      leaf('beauty-services', 'آرایشگری و زیبایی', {
        attributes: [
          offers('beauty_services', 'خدمات', [
            ['hair', 'مو'],
            ['nails', 'ناخن'],
            ['lashes_brows', 'مژه و ابرو'],
            ['makeup', 'آرایش'],
            ['skin', 'پوست'],
            ['hair_removal', 'اپیلاسیون و لیزر'],
          ], true),
          homeVisit,
        ],
      }),
      leaf('car-services', 'خدمات خودرو', {
        attributes: [
          offers('car_services', 'خدمات', [
            ['mechanic', 'تعمیر مکانیکی'],
            ['bodywork', 'صافکاری و نقاشی'],
            ['tires', 'تعویض لاستیک'],
            ['inspection_prep', 'آماده‌سازی معاینه فنی'],
            ['cleaning', 'کارواش و صفرشویی'],
            ['towing', 'یدک‌کش'],
            ['other', 'سایر'],
          ]),
        ],
      }),
      leaf('it-services', 'خدمات رایانه و موبایل', {
        attributes: [onlinePossible],
      }),
      leaf('translation', 'ترجمه', {
        attributes: [
          onlinePossible,
          {
            key: 'languages',
            type: 'multi_select',
            labelFa: 'زبان‌ها',
            validation: { max_items: 7 },
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
            options: languageOptions,
          },
          {
            key: 'certified',
            type: 'boolean',
            labelFa: 'ترجمه رسمی (beglaubigt)',
            isFilterable: true,
            showOnCard: true,
          },
        ],
      }),
      leaf('paperwork-help', 'کمک در کارهای اداری و فرم‌ها', {
        attributes: [onlinePossible],
      }),
      leaf('tax-accounting', 'مالیات و حسابداری', {
        businessOnly: true,
        attributes: [onlinePossible],
      }),
      leaf('catering-events', 'پذیرایی و مراسم'),
      leaf('photography', 'عکاسی و فیلم‌برداری', {
        attributes: [
          offers('photo_services', 'خدمات', [
            ['wedding', 'عروسی و مراسم'],
            ['portrait', 'پرتره'],
            ['commercial', 'تبلیغاتی و محصول'],
            ['video', 'فیلم‌برداری'],
            ['passport', 'عکس پرسنلی و پاسپورت'],
          ]),
        ],
      }),
      leaf('childcare', 'مراقبت از کودک'),
      leaf('elderly-care', 'مراقبت از سالمند'),
      leaf('other-services', 'سایر خدمات'),
    ],
  },
  {
    slug: 'lessons-courses',
    nameFa: 'آموزش و کلاس',
    icon: 'graduation-cap',
    priceMode: 'optional',
    attributes: [
      lessonFormat,
      priceUnit([
        ['hour', 'هر ساعت'],
        ['session', 'هر جلسه'],
        ['month', 'ماهانه'],
        ['course', 'کل دوره'],
      ]),
      {
        key: 'audience',
        type: 'multi_select',
        labelFa: 'مناسب برای',
        isFilterable: true,
        options: options([
          ['children', 'کودکان'],
          ['teens', 'نوجوانان'],
          ['adults', 'بزرگسالان'],
        ]),
      },
      {
        key: 'trial_lesson',
        type: 'boolean',
        labelFa: 'جلسه آزمایشی رایگان',
        isFilterable: true,
      },
    ],
    children: [
      leaf('tutoring', 'تدریس خصوصی دروس', {
        attributes: [
          {
            ...offers('subjects', 'درس‌ها', [
              ['math', 'ریاضی'],
              ['physics', 'فیزیک'],
              ['chemistry', 'شیمی'],
              ['biology', 'زیست'],
              ['german', 'آلمانی (درسی)'],
              ['english', 'انگلیسی'],
              ['persian', 'فارسی'],
              ['computer', 'کامپیوتر'],
              ['other', 'سایر'],
            ], true),
            isRequired: true,
          },
          offers('school_levels', 'مقطع', [
            ['primary', 'دبستان'],
            ['secondary', 'راهنمایی و دبیرستان'],
            ['abitur', 'آبیتور یا ماتورا'],
            ['university', 'دانشگاه'],
          ]),
        ],
      }),
      leaf('language-courses', 'زبان', {
        attributes: [
          {
            key: 'language',
            type: 'select',
            labelFa: 'زبان',
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
            options: languageOptions,
          },
          offers('course_levels', 'سطح', [
            ['a1', 'A1'],
            ['a2', 'A2'],
            ['b1', 'B1'],
            ['b2', 'B2'],
            ['c1', 'C1'],
            ['c2', 'C2'],
          ]),
          {
            key: 'exam_prep',
            type: 'boolean',
            labelFa: 'آمادگی آزمون (Goethe، telc، TestDaF، ÖSD)',
            isFilterable: true,
            showOnCard: true,
          },
        ],
      }),
      leaf('music-lessons', 'آموزش موسیقی', { attributes: [instrument] }),
      leaf('sports-courses', 'کلاس ورزشی'),
      leaf('computer-courses', 'کامپیوتر و برنامه‌نویسی'),
      leaf('art-courses', 'هنر و صنایع دستی'),
      leaf('other-courses', 'سایر کلاس‌ها'),
    ],
  },
  {
    slug: 'jobs',
    nameFa: 'استخدام و کاریابی',
    descriptionFa: 'آگهی استخدام، یا آگهی «درخواستی» برای کسانی که دنبال کار هستند',
    icon: 'briefcase',
    priceMode: 'none',
    maxImages: 4,
    attributes: [
      {
        key: 'employment_type',
        type: 'select',
        labelFa: 'نوع همکاری',
        isRequired: true,
        isFilterable: true,
        showOnCard: true,
        options: options([
          ['full_time', 'تمام‌وقت'],
          ['part_time', 'پاره‌وقت'],
          ['minijob', 'مینی‌جاب'],
          ['werkstudent', 'ورک‌استودنت (Werkstudent)'],
          ['ausbildung', 'آوسبیلدونگ (Ausbildung)'],
          ['internship', 'کارآموزی'],
          ['freelance', 'فریلنس'],
        ]),
      },
      {
        key: 'work_mode',
        type: 'select',
        labelFa: 'محل کار',
        isFilterable: true,
        showOnCard: true,
        options: options([
          ['on_site', 'حضوری'],
          ['hybrid', 'ترکیبی'],
          ['remote', 'دورکاری'],
        ]),
      },
      {
        key: 'german_level',
        type: 'select',
        labelFa: 'سطح زبان آلمانی',
        isFilterable: true,
        options: options([
          ['none', 'لازم نیست'],
          ['a1', 'A1'],
          ['a2', 'A2'],
          ['b1', 'B1'],
          ['b2', 'B2'],
          ['c1', 'C1'],
          ['c2', 'C2'],
        ]),
      },
      money('salary', 'حقوق', { helpFa: 'اختیاری. ناخالص (Brutto)', showOnCard: true }),
      {
        key: 'salary_period',
        type: 'select',
        labelFa: 'دوره پرداخت حقوق',
        options: options([
          ['hour', 'ساعتی'],
          ['month', 'ماهانه'],
          ['year', 'سالانه'],
        ]),
      },
      {
        key: 'experience_years',
        type: 'number',
        labelFa: 'سابقه کار لازم',
        unitFa: 'سال',
        helpFa: '۰ یعنی بدون نیاز به سابقه',
        validation: { min: 0, max: 40, integer: true },
        isFilterable: true,
      },
      {
        key: 'persian_speaking',
        type: 'boolean',
        labelFa: 'فارسی‌زبان',
        helpFa: 'کار به زبان فارسی نیاز دارد یا همکاران فارسی‌زبان هستند',
        isFilterable: true,
        showOnCard: true,
      },
      {
        key: 'visa_support',
        type: 'boolean',
        labelFa: 'کمک به ویزا و اجازه کار',
        isFilterable: true,
      },
      {
        key: 'driving_licence',
        type: 'boolean',
        labelFa: 'گواهینامه رانندگی لازم است',
        isFilterable: true,
      },
      {
        key: 'start_date',
        type: 'date',
        labelFa: 'تاریخ شروع',
      },
    ],
    children: [
      leaf('hospitality', 'رستوران و هتلداری'),
      leaf('retail-sales', 'فروش و خرده‌فروشی'),
      leaf('office-admin', 'اداری و دفتری'),
      leaf('it-jobs', 'فناوری اطلاعات'),
      leaf('construction-trades', 'ساختمان و فنی'),
      leaf('logistics', 'حمل‌ونقل و انبار'),
      leaf('healthcare-care', 'درمانی و مراقبتی (Pflege)'),
      leaf('beauty-jobs', 'آرایشگری و زیبایی'),
      leaf('cleaning-jobs', 'نظافت و خدمات'),
      leaf('education-jobs', 'آموزشی'),
      leaf('apprenticeships', 'آوسبیلدونگ (Ausbildung)'),
      leaf('mini-jobs', 'مینی‌جاب و پاره‌وقت'),
      leaf('internships', 'کارآموزی'),
      leaf('other-jobs', 'سایر مشاغل'),
    ],
  },
  {
    slug: 'community',
    nameFa: 'اجتماعی',
    icon: 'users',
    priceMode: 'optional',
    children: [
      leaf('rideshare', 'همسفری', {
        attributes: [
          {
            key: 'from_place',
            type: 'text',
            labelFa: 'مبدأ',
            validation: { max_length: 80 },
            isRequired: true,
            isSearchable: true,
          },
          {
            key: 'to_place',
            type: 'text',
            labelFa: 'مقصد',
            validation: { max_length: 80 },
            isRequired: true,
            isSearchable: true,
            showOnCard: true,
          },
          {
            key: 'travel_date',
            type: 'date',
            labelFa: 'تاریخ سفر',
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
          },
          {
            key: 'seats',
            type: 'number',
            labelFa: 'تعداد جای خالی',
            validation: { min: 1, max: 8, integer: true },
            showOnCard: true,
          },
        ],
      }),
      leaf('volunteering', 'کمک همسایگی و داوطلبانه', { priceMode: 'none' }),
      leaf('lost-found', 'گمشده‌ها (اشیا و حیوانات)', {
        priceMode: 'none',
        attributes: [
          {
            key: 'lost_or_found',
            type: 'select',
            labelFa: 'گم شده یا پیدا شده',
            isRequired: true,
            isFilterable: true,
            showOnCard: true,
            options: options([
              ['lost', 'گم شده'],
              ['found', 'پیدا شده'],
            ]),
          },
          {
            key: 'lost_found_date',
            type: 'date',
            labelFa: 'تاریخ',
            helpFa: 'روزی که گم یا پیدا شد',
          },
        ],
      }),
    ],
  },
  {
    // The events section («رویدادها», decided Oct 18, 2026): its own pages and form
    // (src/modules/events/), sorted by the event's date and ended after its last date. Event
    // fields are columns of event_details, not attributes. Replaces community › events.
    slug: 'events-calendar',
    nameFa: 'رویدادها',
    icon: 'calendar',
    priceMode: 'optional',
    maxImages: 10,
    children: [
      leaf('event-concerts', 'کنسرت و موسیقی'),
      leaf('event-parties', 'پارتی و شب‌نشینی'),
      leaf('event-celebrations', 'جشن‌ها و مناسبت‌ها', {
        descriptionFa: 'نوروز، چهارشنبه‌سوری، سیزده‌بدر، یلدا و دیگر جشن‌ها',
      }),
      leaf('event-theatre', 'تئاتر و نمایش'),
      leaf('event-film', 'سینما و فیلم'),
      leaf('event-readings', 'کتاب‌خوانی و شب شعر'),
      leaf('event-talks', 'سخنرانی، نشست و وبینار'),
      leaf('event-workshops', 'کلاس و کارگاه'),
      leaf('event-meetups', 'دورهمی و آشنایی', { descriptionFa: 'دورهمی‌های محلی، دانشجویی و تازه‌واردها' }),
      leaf('event-family', 'کودک و خانواده'),
      leaf('event-sports', 'ورزش و طبیعت‌گردی'),
      leaf('event-religious', 'مراسم مذهبی و آیینی'),
      leaf('event-other', 'سایر رویدادها'),
    ],
  },
  {
    slug: 'business-equipment',
    nameFa: 'تجهیزات و صنعتی',
    icon: 'factory',
    attributes: [condition],
    children: [
      leaf('shop-equipment', 'تجهیزات فروشگاه و رستوران'),
      leaf('office-equipment', 'تجهیزات اداری'),
      leaf('building-materials', 'مصالح ساختمانی'),
      leaf('machinery', 'ماشین‌آلات و ابزار صنعتی'),
    ],
  },
];

function clothingSize(sizes: [string, string][]): AttributeSeed {
  return {
    key: 'clothing_size',
    type: 'select',
    labelFa: 'سایز',
    isFilterable: true,
    showOnCard: true,
    options: options([...sizes, ['one_size', 'فری‌سایز']]),
  };
}

function garmentType(women: boolean): AttributeSeed {
  return kind('garment_type', 'نوع لباس', [
    ['coats_jackets', 'کت و مانتو'],
    ['dresses_skirts', 'پیراهن و دامن'],
    ['tops', 'تاپ و تی‌شرت'],
    ['shirts', women ? 'بلوز و شومیز' : 'پیراهن'],
    ['trousers', 'شلوار و جین'],
    ['knitwear', 'بافتنی'],
    ['suits', 'کت‌وشلوار'],
    ['sportswear', 'ورزشی'],
    ['formal', 'لباس مجلسی'],
    ['wedding', 'لباس عروس و داماد'],
    ...(women ? ([['maternity', 'لباس بارداری']] as [string, string][]) : []),
    ['other', 'سایر'],
  ]);
}

function animal(breedLabel: string): AttributeSeed[] {
  return [
    {
      key: 'breed',
      type: 'text',
      labelFa: breedLabel,
      validation: { max_length: 60 },
      isSearchable: true,
      showOnCard: true,
    },
    {
      key: 'age_months',
      type: 'number',
      labelFa: 'سن',
      unitFa: 'ماه',
      validation: { min: 0, max: 300, integer: true },
      isFilterable: true,
    },
    {
      key: 'animal_sex',
      type: 'select',
      labelFa: 'جنس',
      isFilterable: true,
      options: options([
        ['male', 'نر'],
        ['female', 'ماده'],
      ]),
    },
  ];
}

function animalHealth(): AttributeSeed[] {
  const yesNo = (key: string, labelFa: string): AttributeSeed => ({ key, type: 'boolean', labelFa, isFilterable: true });
  return [
    yesNo('vaccinated', 'واکسینه شده'),
    yesNo('microchipped', 'میکروچیپ دارد'),
    yesNo('neutered', 'عقیم شده'),
    yesNo('pedigree', 'شناسنامه نژاد دارد'),
  ];
}
