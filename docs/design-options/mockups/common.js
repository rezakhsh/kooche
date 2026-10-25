// Shared content for the design-direction mockups: real category names from seed/categories.ts,
// two real staging listings (room, rug) and example listings for Berlin. Seller names are invented.
const fa = (n) => Number(n).toLocaleString('fa-IR').replace(/,/g, '٬');
const I = (name, cls = 'size-5', sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls} shrink-0">${window.ICONS[name] || ''}</svg>`;

const CATS = [
  { slug: 'real-estate', fa: 'املاک', short: 'املاک', icon: 'building', n: 142 },
  { slug: 'vehicles', fa: 'وسایل نقلیه', short: 'وسایل نقلیه', icon: 'car', n: 38 },
  { slug: 'electronics', fa: 'کالای دیجیتال', short: 'دیجیتال', icon: 'phone', n: 96 },
  { slug: 'home-garden', fa: 'خانه و آشپزخانه', short: 'خانه', icon: 'sofa', n: 121 },
  { slug: 'services', fa: 'خدمات', short: 'خدمات', icon: 'wrench', n: 64 },
  { slug: 'jobs', fa: 'استخدام و کاریابی', short: 'استخدام', icon: 'briefcase', n: 27 },
  { slug: 'lessons-courses', fa: 'آموزش و کلاس', short: 'آموزش', icon: 'book', n: 31 },
  { slug: 'fashion-beauty', fa: 'پوشاک و آرایشی', short: 'پوشاک', icon: 'shirt', n: 45 },
  { slug: 'kids-baby', fa: 'کودک و نوزاد', short: 'کودک', icon: 'baby', n: 22 },
  { slug: 'leisure-hobbies', fa: 'سرگرمی و فراغت', short: 'سرگرمی', icon: 'ball', n: 40 },
  { slug: 'pets', fa: 'حیوانات', short: 'حیوانات', icon: 'paw', n: 9 },
  { slug: 'community', fa: 'اجتماعی', short: 'اجتماعی', icon: 'people', n: 14 },
  { slug: 'business-equipment', fa: 'تجهیزات و صنعتی', short: 'صنعتی', icon: 'gear', n: 6 },
];
const REAL_ESTATE_SUBS = [
  ['اجاره آپارتمان', 58], ['اتاق و خانه اشتراکی (WG)', 41], ['اجاره موقت و کوتاه‌مدت', 23], ['اجاره خانه', 7],
  ['فروش آپارتمان', 5], ['اجاره ملک تجاری و اداری', 4], ['گاراژ و جای پارک', 4],
];

const IMG = (n) => `../img/${n}`;
const LISTINGS = [
  { id: 'room', title: 'اجاره خانه در ودینگ', price: 870, unit: 'اجاره سرد ماهانه', warm: 1020, cat: 'اجاره آپارتمان', root: 'املاک', place: 'ودینگ', facts: ['۶۵ متر', '۲ اتاق', 'Anmeldung ممکن'], ago: 'هفتهٔ گذشته', img: IMG('room1.webp'), photos: 9, anmeldung: true, seller: 'آرش ک.', since: 'اکتبر ۲۰۲۶' },
  { id: 'wg', title: 'اتاق مبله در WG، نزدیک Hermannplatz', price: 590, unit: 'گرم، ماهانه', cat: 'اتاق و خانه اشتراکی (WG)', root: 'املاک', place: 'نویکلن', facts: ['۱۴ متر', 'از ۱ دسامبر', 'Anmeldung ممکن'], ago: '۲ ساعت پیش', img: IMG('room5.webp'), photos: 6, anmeldung: true, seller: 'مهسا ر.' },
  { id: 'rug', title: 'فرش نو ابریشمی ایرانی قم ۱۵۵×۲۵۵', price: 160, cat: 'فرش، گلیم و تابلوفرش', root: 'خانه و آشپزخانه', place: 'موابیت', facts: ['نو', 'ماشینی', 'ابریشم'], ago: 'پریروز', img: IMG('rug1.webp'), photos: 3, seller: 'نیلوفر ا.' },
  { id: 'car', title: 'پژو ۲۰۸ GT-Line، مدل ۲۰۲۱', price: 16900, cat: 'خودرو', root: 'وسایل نقلیه', place: 'اشپانداو', facts: ['۲۰۲۱', '۴۸٬۰۰۰ کیلومتر', 'اتوماتیک'], ago: 'دیروز', img: IMG('car.jpg'), photos: 12, seller: 'رضا م.', verified: true },
  { id: 'translate', title: 'ترجمه رسمی مدارک فارسی به آلمانی، مترجم قسم‌خورده', price: 35, from: true, cat: 'ترجمه', root: 'خدمات', place: 'شارلوتنبورگ', facts: ['حضوری و آنلاین', 'تحویل ۳ روزه'], ago: 'امروز', img: null, tile: 'ترجمه', business: 'دارالترجمه پارسیان', verified: true },
  { id: 'phone', title: 'آیفون ۱۳ پرو، ۲۵۶ گیگ، باتری ۸۹٪', price: 520, cat: 'گوشی موبایل', root: 'کالای دیجیتال', place: 'شارلوتنبورگ', facts: ['کارکرده', '۲۵۶ گیگ', 'با فاکتور'], ago: '۴ ساعت پیش', img: IMG('phone.jpg'), photos: 5, seller: 'سینا ج.' },
  { id: 'setar', title: 'سه‌تار دست‌ساز با کیف و مضراب', price: 450, cat: 'آلات موسیقی', root: 'سرگرمی و فراغت', place: 'کرویتسبرگ', facts: ['کارکرده', 'توت', 'ارسال پستی'], ago: 'دیروز', img: IMG('setar.jpg'), photos: 4, seller: 'کاوه ن.', ships: true },
  { id: 'german', title: 'کلاس خصوصی آلمانی B1 با معلم فارسی‌زبان', price: 25, unit: 'هر ساعت', cat: 'زبان', root: 'آموزش و کلاس', place: 'آنلاین', facts: ['آنلاین', 'جلسهٔ اول رایگان'], ago: 'دیروز', img: null, tile: 'Deutsch B1', seller: 'لیلا ف.' },
  { id: 'desk', title: 'میز تحریر چوبی و صندلی، تمیز', price: 60, cat: 'مبلمان پذیرایی و نشیمن', root: 'خانه و آشپزخانه', place: 'ودینگ', facts: ['در حد نو'], ago: '۳ روز پیش', img: IMG('room3.webp'), photos: 2, seller: 'آرش ک.' },
];
const L = Object.fromEntries(LISTINGS.map((l) => [l.id, l]));
const EVENT = { title: 'جشن شب یلدا با موسیقی زنده', date: 'شنبه ۲۰ دسامبر', time: '۱۹:۰۰', place: 'برلین، Kulturhaus', price: 'از ۲۵ €', img: IMG('yalda.jpg') };

const price = (l) => (l.from ? 'از ' : '') + fa(l.price) + ' €';

/** Writes `html` into #app and adds the shared @font-face; called by each mockup page */
function mount(html) {
  document.getElementById('app').innerHTML = html;
}
/** Persian digits without separators, for codes and years */
const faDigits = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
