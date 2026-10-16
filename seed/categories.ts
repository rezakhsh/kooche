import type { AttributeSeed, CategorySeed, OptionSeed } from './types';

// Starter category tree: Divar's top-level grouping and Persian names, merged with
// Kleinanzeigen's European structure (two levels, separate roots for children, pets and
// lessons, Germany-specific leaves such as WG rooms, tires, Ausbildung and Minijobs).
// Approved Oct 16, 2026: 13 roots, 115 leaves.
//
// "Free" and "exchange" (Kleinanzeigen's Verschenken & Tauschen) are price types and «درخواستی»
// (wanted) is a listing kind, so they are filters in every category, not categories.
// Left out on purpose: currency exchange and money transfers to Iran (EU sanctions, AML),
// carrying luggage to Iran, matchmaking, property in Iran, medicines, weapons, tobacco.
//
// priceMode, listingDurationDays, maxImages, requiresReview and businessOnly are inherited from
// the parent unless a category sets its own.
// Attribute definitions apply to their category and all descendants. A key is never reused
// with a different meaning, and is unique along each path (checked by the seed checks).
// Adding a category or attribute: edit this file and run `npm run db:seed`. Removing one: delete
// it here, and the seed sets it inactive (listings may still use it).

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

const year = (labelFa = 'سال ساخت'): AttributeSeed => ({
  key: 'year',
  type: 'number',
  labelFa,
  validation: { min: 1950, max: 2030, integer: true },
  isFilterable: true,
  showOnCard: true,
});

const mileageKm: AttributeSeed = {
  key: 'mileage_km',
  type: 'number',
  labelFa: 'کارکرد',
  unitFa: 'کیلومتر',
  validation: { min: 0, max: 2_000_000, integer: true },
  isFilterable: true,
  showOnCard: true,
};

const rooms: AttributeSeed = {
  key: 'rooms',
  type: 'number',
  labelFa: 'تعداد اتاق',
  helpFa: 'مثل آگهی‌های آلمانی: نیم‌اتاق هم حساب می‌شود (۲٫۵)',
  validation: { min: 0, max: 20, integer: false },
  isFilterable: true,
  showOnCard: true,
};

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

const rentType: AttributeSeed = {
  key: 'rent_type',
  type: 'select',
  labelFa: 'نوع اجاره',
  helpFa: 'اجاره سرد بدون هزینه‌های جانبی، اجاره گرم با هزینه‌های جانبی',
  isRequired: true,
  isFilterable: true,
  showOnCard: true,
  options: options([
    ['cold', 'اجاره سرد (Kaltmiete)'],
    ['warm', 'اجاره گرم (Warmmiete)'],
  ]),
};

const brand = (pairs: [string, string][], isRequired = false): AttributeSeed => ({
  key: 'brand',
  type: 'select',
  labelFa: 'برند',
  isRequired,
  isFilterable: true,
  showOnCard: true,
  options: options([...pairs, ['other', 'سایر']]),
});

const storageGb: AttributeSeed = {
  key: 'storage_gb',
  type: 'number',
  labelFa: 'حافظه داخلی',
  unitFa: 'گیگابایت',
  validation: { min: 1, max: 16_384, integer: true },
  isFilterable: true,
  showOnCard: true,
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

// ---------------------------------------------------------------------------
// Car brands and models (model depends on brand)
// ---------------------------------------------------------------------------

const carBrands: [string, string][] = [
  ['volkswagen', 'فولکس‌واگن'],
  ['mercedes_benz', 'مرسدس بنز'],
  ['bmw', 'ب‌ام‌و'],
  ['audi', 'آئودی'],
  ['opel', 'اوپل'],
  ['ford', 'فورد'],
  ['skoda', 'اشکودا'],
  ['seat', 'سئات'],
  ['renault', 'رنو'],
  ['peugeot', 'پژو'],
  ['toyota', 'تویوتا'],
  ['hyundai', 'هیوندای'],
  ['kia', 'کیا'],
  ['fiat', 'فیات'],
  ['tesla', 'تسلا'],
  ['volvo', 'ولوو'],
  ['mazda', 'مزدا'],
  ['nissan', 'نیسان'],
  ['porsche', 'پورشه'],
  ['mini', 'مینی'],
];

const carModels: Record<string, [string, string][]> = {
  volkswagen: [
    ['vw-golf', 'گلف'],
    ['vw-polo', 'پولو'],
    ['vw-passat', 'پاسات'],
    ['vw-tiguan', 'تیگوان'],
    ['vw-touran', 'توران'],
    ['vw-id-3', 'ID.3'],
    ['vw-id-4', 'ID.4'],
  ],
  mercedes_benz: [
    ['mercedes-a-class', 'کلاس A'],
    ['mercedes-c-class', 'کلاس C'],
    ['mercedes-e-class', 'کلاس E'],
    ['mercedes-glc', 'GLC'],
  ],
  bmw: [
    ['bmw-1-series', 'سری ۱'],
    ['bmw-3-series', 'سری ۳'],
    ['bmw-5-series', 'سری ۵'],
    ['bmw-x1', 'X1'],
    ['bmw-x3', 'X3'],
    ['bmw-x5', 'X5'],
  ],
  audi: [
    ['audi-a3', 'A3'],
    ['audi-a4', 'A4'],
    ['audi-a6', 'A6'],
    ['audi-q3', 'Q3'],
    ['audi-q5', 'Q5'],
  ],
  opel: [
    ['opel-corsa', 'کورسا'],
    ['opel-astra', 'آسترا'],
  ],
  ford: [
    ['ford-fiesta', 'فیستا'],
    ['ford-focus', 'فوکوس'],
    ['ford-kuga', 'کوگا'],
  ],
  toyota: [
    ['toyota-yaris', 'یاریس'],
    ['toyota-corolla', 'کرولا'],
    ['toyota-rav4', 'RAV4'],
  ],
  tesla: [
    ['tesla-model-3', 'مدل ۳'],
    ['tesla-model-y', 'مدل Y'],
  ],
};

const carModel: AttributeSeed = {
  key: 'model',
  type: 'select',
  labelFa: 'مدل',
  dependsOn: 'brand',
  isFilterable: true,
  showOnCard: true,
  options: Object.entries(carModels).flatMap(([brandValue, models]) =>
    models.map(([value, labelFa]) => ({ value, labelFa, parent: brandValue })),
  ),
};

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

const leaf = (slug: string, nameFa: string, extra: Partial<CategorySeed> = {}): CategorySeed => ({
  slug,
  nameFa,
  ...extra,
});

const residential = [rooms, floor, furnished, balcony, elevator];

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
        validation: { min: 1, max: 100_000, integer: true },
        isRequired: true,
        isFilterable: true,
        showOnCard: true,
      },
    ],
    children: [
      leaf('apartments-rent', 'اجاره آپارتمان', { attributes: [rentType, ...residential] }),
      leaf('houses-rent', 'اجاره خانه', { attributes: [rentType, ...residential] }),
      leaf('shared-rooms', 'اتاق و خانه اشتراکی (WG)', {
        attributes: [
          rentType,
          furnished,
          {
            key: 'flatmates',
            type: 'number',
            labelFa: 'تعداد هم‌خانه',
            validation: { min: 1, max: 20, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
        ],
      }),
      leaf('short-term-rent', 'اجاره موقت و کوتاه‌مدت', {
        attributes: [rentType, rooms, furnished],
      }),
      leaf('apartments-sale', 'فروش آپارتمان', { attributes: residential }),
      leaf('houses-sale', 'فروش خانه', { attributes: residential }),
      leaf('land-gardens', 'زمین و باغچه'),
      leaf('commercial-rent', 'اجاره ملک تجاری و اداری', { attributes: [rentType] }),
      leaf('commercial-sale', 'فروش ملک تجاری و اداری'),
      leaf('parking-garages', 'گاراژ و جای پارک'),
    ],
  },
  {
    slug: 'vehicles',
    nameFa: 'وسایل نقلیه',
    icon: 'car',
    children: [
      leaf('cars', 'خودرو', {
        attributes: [
          brand(carBrands, true),
          carModel,
          year(),
          mileageKm,
          {
            key: 'fuel',
            type: 'select',
            labelFa: 'سوخت',
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
          },
          {
            key: 'gearbox',
            type: 'select',
            labelFa: 'گیربکس',
            isFilterable: true,
            options: options([
              ['manual', 'دستی'],
              ['automatic', 'اتوماتیک'],
            ]),
          },
          {
            key: 'body_type',
            type: 'select',
            labelFa: 'نوع بدنه',
            isFilterable: true,
            options: options([
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
          {
            key: 'power_hp',
            type: 'number',
            labelFa: 'قدرت موتور',
            unitFa: 'اسب بخار',
            validation: { min: 1, max: 2000, integer: true },
            isFilterable: true,
          },
        ],
      }),
      leaf('motorcycles', 'موتورسیکلت و اسکوتر', {
        attributes: [
          {
            key: 'motorcycle_type',
            type: 'select',
            labelFa: 'نوع',
            isFilterable: true,
            options: options([
              ['motorcycle', 'موتورسیکلت'],
              ['scooter', 'اسکوتر'],
              ['moped', 'موتور گازی'],
            ]),
          },
          year(),
          mileageKm,
          {
            key: 'engine_cc',
            type: 'number',
            labelFa: 'حجم موتور',
            unitFa: 'سی‌سی',
            validation: { min: 1, max: 3000, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
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
              ['mountain', 'کوهستان'],
              ['road', 'کورسی'],
              ['e_bike', 'دوچرخه برقی'],
              ['e_scooter', 'اسکوتر برقی'],
              ['kids', 'کودک'],
              ['cargo', 'باری'],
            ]),
          },
        ],
      }),
      leaf('campers', 'کاروان و کمپر', { attributes: [year(), mileageKm] }),
      leaf('commercial-vehicles', 'خودروی تجاری و تریلر', { attributes: [year(), mileageKm] }),
      leaf('boats', 'قایق', { attributes: [year()] }),
      leaf('car-parts', 'قطعات و لوازم خودرو', { attributes: [condition] }),
      leaf('tires-rims', 'لاستیک و رینگ', {
        attributes: [
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
            key: 'rim_inch',
            type: 'number',
            labelFa: 'سایز رینگ',
            unitFa: 'اینچ',
            validation: { min: 10, max: 24, integer: true },
            isFilterable: true,
            showOnCard: true,
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
          ]),
          storageGb,
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
          storageGb,
        ],
      }),
      leaf('phone-accessories', 'لوازم جانبی موبایل'),
      leaf('wearables', 'ساعت هوشمند و پوشیدنی'),
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
          {
            key: 'ram_gb',
            type: 'number',
            labelFa: 'رم',
            unitFa: 'گیگابایت',
            validation: { min: 1, max: 512, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
          storageGb,
        ],
      }),
      leaf('desktop-computers', 'رایانه رومیزی'),
      leaf('computer-parts', 'قطعات رایانه'),
      leaf('computer-accessories', 'پرینتر، شبکه و لوازم جانبی'),
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
        ],
      }),
      leaf('tv-video', 'تلویزیون و پروژکتور', {
        attributes: [
          {
            key: 'screen_inch',
            type: 'number',
            labelFa: 'اندازه صفحه',
            unitFa: 'اینچ',
            validation: { min: 10, max: 150, integer: true },
            isFilterable: true,
            showOnCard: true,
          },
        ],
      }),
      leaf('audio', 'صوتی و هدفون'),
      leaf('cameras', 'دوربین عکاسی و فیلم‌برداری'),
      leaf('other-electronics', 'سایر کالای دیجیتال'),
    ],
  },
  {
    slug: 'home-garden',
    nameFa: 'خانه و آشپزخانه',
    icon: 'sofa',
    children: [
      leaf('living-room', 'مبلمان پذیرایی و نشیمن', { attributes: [condition] }),
      leaf('bedroom', 'اتاق خواب، تخت و کمد', { attributes: [condition] }),
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
      leaf('home-appliances', 'لوازم خانگی برقی', { attributes: [condition] }),
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
              ['other', 'سایر'],
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
      leaf('women-clothing', 'لباس زنانه', { attributes: [clothingSize()] }),
      leaf('men-clothing', 'لباس مردانه', { attributes: [clothingSize()] }),
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
        ],
      }),
      leaf('bags-accessories', 'کیف و اکسسوری'),
      leaf('jewelry-watches', 'زیورآلات و ساعت'),
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
      leaf('strollers', 'کالسکه و کریر'),
      leaf('car-seats', 'صندلی ماشین کودک'),
      leaf('kids-furniture', 'سرویس خواب و مبلمان کودک'),
      leaf('toys', 'اسباب‌بازی'),
      leaf('baby-gear', 'سایر لوازم نوزاد'),
    ],
  },
  {
    slug: 'pets',
    nameFa: 'حیوانات',
    icon: 'paw-print',
    children: [
      leaf('dogs', 'سگ', { attributes: animal() }),
      leaf('cats', 'گربه', { attributes: animal() }),
      leaf('birds', 'پرنده'),
      leaf('fish-aquariums', 'ماهی و آکواریوم'),
      leaf('small-animals', 'حیوانات کوچک'),
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
        ],
      }),
      leaf('music-movies', 'فیلم و موسیقی', { attributes: [condition] }),
      leaf('musical-instruments', 'آلات موسیقی', {
        attributes: [
          condition,
          {
            key: 'instrument',
            type: 'select',
            labelFa: 'ساز',
            isFilterable: true,
            showOnCard: true,
            options: options([
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
            ]),
          },
        ],
      }),
      leaf('tickets', 'بلیت کنسرت و رویداد', {
        attributes: [
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
    children: [
      leaf('moving-transport', 'اسباب‌کشی و حمل‌ونقل'),
      leaf('home-repairs', 'تعمیرات و خدمات ساختمانی'),
      leaf('cleaning', 'نظافت'),
      leaf('beauty-services', 'آرایشگری و زیبایی'),
      leaf('car-services', 'خدمات خودرو'),
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
      leaf('photography', 'عکاسی و فیلم‌برداری'),
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
    attributes: [lessonFormat],
    children: [
      leaf('tutoring', 'تدریس خصوصی دروس'),
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
        ],
      }),
      leaf('music-lessons', 'آموزش موسیقی'),
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
      leaf('events', 'رویداد و دورهمی'),
      leaf('rideshare', 'همسفری', {
        attributes: [
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
        ],
      }),
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

function clothingSize(): AttributeSeed {
  return {
    key: 'clothing_size',
    type: 'select',
    labelFa: 'سایز',
    isFilterable: true,
    showOnCard: true,
    options: options([
      ['xs', 'XS'],
      ['s', 'S'],
      ['m', 'M'],
      ['l', 'L'],
      ['xl', 'XL'],
      ['xxl', 'XXL'],
      ['xxxl', '3XL و بزرگ‌تر'],
    ]),
  };
}

function animal(): AttributeSeed[] {
  return [
    {
      key: 'breed',
      type: 'text',
      labelFa: 'نژاد',
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
