import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { normalizePersian } from '../../lib/normalize-persian';
import { ancestry, type Catalog, type CategoryNode } from './catalog';

// What a country's law closes or limits, in one place (Turkey plan, approved by the owner on
// Nov 5, 2026; research: docs/design-options/research/round9-turkey.md §2; docs/setup.md,
// "Country rules"). Checked by saveListing() when a listing goes out (published or sent again),
// by changeListingStatus() when it goes live again, and by the pages that list categories. Listings
// already live are never taken down by these rules. A draft is saved as usual and waits.
//
// Turkey:
// - Closed categories. EİDS, the e-Devlet ad-verification system, binds *any* platform that carries
//   property or vehicle ads, with no size threshold and no territorial limit: property by the
//   Taşınmaz Ticareti Hakkında Yönetmelik Art. 12(2) (RG 31.08.2023/32295), vehicles by the Motorlu
//   Kara Taşıtlarının Ticareti Hakkında Yönetmelik Art. 22 (RG 27.08.2024/32645), enforced since
//   16 Jun 2025 for every vehicle ad. A foreign site can't integrate with EİDS, so housing (offer
//   and wanted; rooms and sublets too) and motor vehicles are never offered in Turkey. Bicycles,
//   boats and parts are items and stay open.
// - Cats and dogs only as free adoption: Law 5199 (animal protection) as amended by Law 7332
//   (2021) forbids selling them outside permitted breeders.
// - Jobs only from verified businesses: Law 4904 Art. 17 needs an İŞKUR permit for placement over
//   the internet, unless the site shows the employer's contact to everyone, without an apply
//   button, membership or CV collection (İŞKUR FAQ). The listing page shows the business's phone
//   and email openly for Turkish jobs; Peydoo has no apply button and no CV database.
// - Services refused: visa, residence-permit (ikamet) or citizenship help, money transfer and
//   currency exchange (round 9 §2.2: "never"), by their words in services and lessons.
// - Banned items held for review: phones without IMEI registration, «yenilenmiş» (refurbished)
//   claims by private sellers (only authorised sellers may use the word since 1 Aug 2026), alcohol
//   and tobacco (Law 4250), medicines, weapons, cultural objects (Law 2863), currency and gold, SIM
//   cards and documents. A match sends a new listing to the moderation queue instead of live
//   (moderation/checks.ts keeps it there); an edit of a live one only flags it.
// - No "hide in Turkey": a Turkish removal order means the listing is deleted (owner, Nov 5, 2026).

/** Top categories or leaves closed per country (with everything under them) */
export const CLOSED_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  TR: ['real-estate', 'cars', 'motorcycles', 'campers', 'commercial-vehicles'],
};

/** Categories whose animals may only be given away for free (no price, no sale) */
export const ADOPTION_ONLY: Readonly<Record<string, readonly string[]>> = {
  TR: ['dogs', 'cats'],
};

/** Countries where job listings come only from verified businesses, with the employer's contact open to all */
export const VERIFIED_EMPLOYERS_ONLY: ReadonlySet<string> = new Set(['TR']);

/** Top categories whose listings the refused-services words are checked in */
const SERVICE_CHECKED_ROOTS = ['services', 'lessons-courses'];
const JOBS_ROOT = 'jobs';

/**
 * Words of services refused per country, matched on whole words (Persian, Turkish, English). A
 * trailing `*` matches the word's Turkish endings too («ikameti»); a final k that softens to ğ
 * before an ending («vatandaşlığa», «tüfeği») needs its own entry. Kept to words
 * that mean the service, not ones with everyday senses: «vize» alone is also a university midterm,
 * «havale» alone is any bank transfer.
 */
export const REFUSED_SERVICE_TERMS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  TR: {
    visa_residence: [
      'ویزا', 'روادید', 'وقت سفارت', 'کارت اقامت', 'اخذ اقامت', 'گرفتن اقامت', 'تمدید اقامت', 'اقامت ترکیه', 'اقامت توریستی', 'اقامت کاری',
      'اقامت دانشجویی', 'تابعیت', 'شهروندی', 'پاسپورت ترکیه',
      'ikamet*', 'oturma izni', 'oturma izin*', 'vatandaşlık*', 'vatandaşlığ*', 'vize başvuru*', 'vize işlem*', 'vize randevu*', 'schengen',
      'visa', 'residence permit*', 'citizenship',
    ],
    money: [
      'حواله', 'حواله ارزی', 'انتقال پول', 'ارسال پول', 'تبدیل ارز', 'صرافی', 'خرید ارز', 'فروش ارز', 'تتر',
      'para transfer*', 'döviz*', 'havale hizmet*', 'western union', 'money transfer', 'currency exchange', 'usdt',
    ],
  },
};

/**
 * Words of items held for review per country. Each group is a line of the country's section of
 * the terms (17.3); `privateOnly` groups apply to private sellers only.
 */
export const HELD_TERMS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  TR: {
    unregistered_phones: [
      'بدون رجیستری', 'بدون رجیستر', 'رجیستر نشده', 'رجیستری نشده', 'imei ثبت نشده',
      'kayıtsız*', 'kayıt dışı', 'kayıtdışı', 'imei kaydı yok*', 'imeisiz', 'unregistered', 'no imei',
    ],
    refurbished: ['yenilenmiş*', 'refurbished', 'ریفربیش', 'ریفربیشد', 'رفربیش'],
    alcohol: [
      'مشروب', 'مشروبات', 'مشروب الکلی', 'مشروبات الکلی', 'شراب', 'ودکا', 'ویسکی', 'آبجو', 'عرق سگی', 'عرق کشمش', 'الکل', 'الکلی',
      'alkol*', 'rakı', 'rakısı', 'şarap*', 'bira', 'biralar', 'birası', 'votka*', 'viski*', 'wine', 'vodka', 'whisky', 'whiskey', 'beer', 'alcohol',
    ],
    tobacco: [
      'سیگار', 'سیگار الکترونیکی', 'تنباکو', 'توتون', 'ویپ', 'پاد سیگار',
      'sigara*', 'tütün*', 'puro', 'elektronik sigara*', 'vape*', 'tobacco', 'cigarette*', 'cigar', 'cigars',
    ],
    medicines: [
      'دارو', 'داروی', 'داروها', 'قرص', 'قرص‌ها', 'آمپول', 'آنتی بیوتیک', 'انسولین',
      'ilaç*', 'reçeteli', 'antibiyotik*', 'insülin*', 'medicine', 'medication', 'pills',
    ],
    weapons: [
      'اسلحه', 'سلاح', 'تفنگ', 'کلت', 'شوکر', 'اسپری فلفل', 'چاقوی ضامن دار',
      'silah*', 'tabanca*', 'tüfek*', 'tüfeğ*', 'şok cihazı', 'biber gazı', 'pistol', 'rifle', 'taser',
    ],
    cultural_objects: [
      'عتیقه', 'عتیقه جات', 'سکه قدیمی', 'سکه عتیقه', 'نسخه خطی', 'آثار باستانی',
      'tarihi eser*', 'antika*', 'sikke*', 'arkeolojik', 'el yazması', 'fosil*', 'antique*', 'artifact*',
    ],
    currency_gold: [
      'ارز', 'طلا', 'سکه طلا', 'سکه بهار آزادی', 'شمش', 'صرافی', 'تتر', 'خرید دلار', 'فروش دلار', 'خرید یورو', 'فروش یورو',
      'döviz*', 'altın', 'altını', 'altınlar', 'çeyrek altın', 'gram altın', 'dolar bozdurma', 'gold', 'bitcoin', 'usdt',
    ],
    sim_cards: ['سیم کارت', 'سیمکارت', 'sim kart*', 'simkart*', 'hat satılık', 'faturasız hat', 'sim card*', 'esim'],
    documents: [
      'پاسپورت', 'گذرنامه', 'کارت اقامت', 'کارت شناسایی', 'مدرک جعلی', 'گواهینامه رانندگی',
      'pasaport*', 'kimlik kart*', 'nüfus cüzdan*', 'ehliyet*', 'ikamet kart*', 'sahte diploma', 'passport*',
    ],
  },
};

/** Groups of HELD_TERMS that apply to private sellers only (a business may be an authorised refurbisher) */
const PRIVATE_ONLY = new Set(['refurbished']);

export type CountryRuleRefusal =
  /** A category the country's law closes (Turkey: housing and motor vehicles) */
  | 'closed_in_country'
  /** Cats and dogs only as free adoption */
  | 'adoption_only'
  /** Jobs only from a verified business */
  | 'verified_employer_required'
  /** A service the country refuses (visa or residence help, money transfer) */
  | 'service_not_allowed';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Whether the country closes any category */
export const hasClosedCategories = (country: string | null | undefined): boolean => !!country && (CLOSED_CATEGORIES[country]?.length ?? 0) > 0;

/** Whether a category (or one above it) is closed in the country */
export function isClosedIn(catalog: Catalog, categoryId: string, country: string | null | undefined): boolean {
  const closed = country ? CLOSED_CATEGORIES[country] : undefined;
  if (!closed?.length) return false;
  return ancestry(catalog, categoryId).some((c) => closed.includes(c.slug));
}

const perCountry = new WeakMap<Catalog, Map<string, Catalog>>();

/**
 * The catalog as a country sees it: its closed categories (and everything under them) inactive and
 * left out of their parents' children, so the category grid, the posting picker, browse addresses,
 * filters, suggestions and saved searches all skip them (an address answers 404). The catalog
 * itself when the country closes nothing. Cached per catalog object.
 */
export function countryCatalog(catalog: Catalog, country: string | null | undefined): Catalog {
  if (!country || !hasClosedCategories(country)) return catalog;
  let byCountry = perCountry.get(catalog);
  if (!byCountry) perCountry.set(catalog, (byCountry = new Map()));
  const cached = byCountry.get(country);
  if (cached) return cached;
  const closed = new Set([...catalog.byId.values()].filter((c) => isClosedIn(catalog, c.id, country)).map((c) => c.id));
  const byId = new Map<string, CategoryNode>();
  for (const [id, c] of catalog.byId) {
    byId.set(id, closed.has(id) ? { ...c, isActive: false, childIds: [] } : { ...c, childIds: c.childIds.filter((x) => !closed.has(x)) });
  }
  const bySlug = new Map([...catalog.bySlug].map(([slug, c]) => [slug, byId.get(c.id)!] as const));
  const view: Catalog = { ...catalog, byId, bySlug, rootIds: catalog.rootIds.filter((id) => !closed.has(id)) };
  byCountry.set(country, view);
  return view;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * Text as words for these lists: the shared Persian normalizer, then Turkish and Persian marks
 * folded (İ/ı → i, ş → s, ü → u, آ → ا), so «İkamet», «IKAMET» and «ikamet» are one word.
 */
export function foldedWords(text: string): string[] {
  return normalizePersian(text)
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

type Phrase = { group: string; term: string; words: string[]; prefix: boolean };

function phrases(lists: Readonly<Record<string, readonly string[]>> | undefined): Phrase[] {
  return Object.entries(lists ?? {}).flatMap(([group, terms]) =>
    terms.map((term) => ({ group, term, prefix: term.endsWith('*'), words: foldedWords(term.replace(/\*$/, '')) })),
  );
}

const compiled = new Map<object, Phrase[]>();
function compiledOf(lists: Readonly<Record<string, readonly string[]>> | undefined): Phrase[] {
  if (!lists) return [];
  let p = compiled.get(lists);
  if (!p) compiled.set(lists, (p = phrases(lists)));
  return p;
}

function find(list: Phrase[], text: string, skip: (group: string) => boolean = () => false): { group: string; term: string } | null {
  const w = foldedWords(text);
  for (const p of list) {
    if (skip(p.group) || p.words.length === 0) continue;
    const last = p.words.length - 1;
    for (let i = 0; i + p.words.length <= w.length; i++) {
      if (p.words.every((x, j) => (j === last && p.prefix ? w[i + j]!.startsWith(x) : w[i + j] === x))) return { group: p.group, term: p.term };
    }
  }
  return null;
}

/** The first refused-service phrase of the country in the text */
export function refusedServiceTerm(country: string, text: string): { group: string; term: string } | null {
  return find(compiledOf(REFUSED_SERVICE_TERMS[country]), text);
}

/** The first held-item phrase of the country in the text; `business`: the refurbished group doesn't apply */
export function heldTerm(country: string | null | undefined, text: string, opts: { business: boolean }): { group: string; term: string } | null {
  if (!country) return null;
  return find(compiledOf(HELD_TERMS[country]), text, (g) => opts.business && PRIVATE_ONLY.has(g));
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * What the country's law refuses for a listing going out, or null. For anyone, from any number;
 * events aren't checked here (they have no category of these).
 */
export async function countryRuleRefusal(
  db: Queryable,
  catalog: Catalog,
  l: {
    categoryId: string;
    countryCode: string;
    kind: 'offer' | 'wanted';
    priceType: string;
    organizationId: string | null;
    title: string;
    description: string;
  },
): Promise<CountryRuleRefusal | null> {
  const country = l.countryCode;
  if (isClosedIn(catalog, l.categoryId, country)) return 'closed_in_country';
  const chain = ancestry(catalog, l.categoryId).map((c) => c.slug);
  if (chain.some((s) => ADOPTION_ONLY[country]?.includes(s)) && l.priceType !== 'free') return 'adoption_only';
  if (VERIFIED_EMPLOYERS_ONLY.has(country) && chain[0] === JOBS_ROOT) {
    if (!l.organizationId) return 'verified_employer_required';
    const [row] = await db.execute<{ yes: boolean }>(sql`SELECT verification_status = 'verified' AS yes FROM organizations WHERE id = ${l.organizationId}`);
    if (!row?.yes) return 'verified_employer_required';
  }
  if (chain[0] && SERVICE_CHECKED_ROOTS.includes(chain[0]) && refusedServiceTerm(country, `${l.title}\n${l.description}`)) return 'service_not_allowed';
  return null;
}

/** Price kinds offered in the form for this category and country (cats and dogs in Turkey: free only) */
export function allowedPriceTypes<T extends string>(catalog: Catalog, categoryId: string, country: string | null | undefined, types: readonly T[]): T[] {
  const adoption = country ? ADOPTION_ONLY[country] : undefined;
  if (adoption && ancestry(catalog, categoryId).some((c) => adoption.includes(c.slug))) return types.filter((t) => t === 'free');
  return [...types];
}

/** Whether job listings in this country show the employer's contact openly (and come only from verified businesses) */
export const opensEmployerContact = (country: string | null | undefined, rootSlug: string | null | undefined): boolean =>
  !!country && VERIFIED_EMPLOYERS_ONLY.has(country) && rootSlug === JOBS_ROOT;

export type FormNote = 'closed' | 'adoption' | 'workPermit' | 'jobs' | 'screening';

/** The country notes the posting form shows for a category (keys of messages.countryRules.notes) */
export function formNotes(catalog: Catalog, categoryId: string, country: string | null | undefined): FormNote[] {
  if (!country || !(country in HELD_TERMS || country in CLOSED_CATEGORIES)) return [];
  const chain = ancestry(catalog, categoryId).map((c) => c.slug);
  const notes: FormNote[] = [];
  if (chain.some((s) => ADOPTION_ONLY[country]?.includes(s))) notes.push('adoption');
  if (VERIFIED_EMPLOYERS_ONLY.has(country) && chain[0] === JOBS_ROOT) notes.push('jobs');
  if (chain[0] && SERVICE_CHECKED_ROOTS.includes(chain[0])) notes.push('workPermit');
  if (country in HELD_TERMS) notes.push('screening');
  return notes;
}
