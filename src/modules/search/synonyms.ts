import { normalizePersian } from '../../lib/normalize-persian';

// Words people use for the same thing (docs/architecture.md, "Search"). Each group is two-way:
// a search for any word finds listings with any other. Written as people type them; every word is
// normalized at load, like the indexed text and the query. A native speaker can extend this file;
// keep groups to true equivalents. A word with a second everyday meaning floods the results:
// «کار» (also "used" in «کم کار کرده»), «هندی» (Handy, but also "Indian"), «موتور» (also an engine).
//
// Spacing and ZWNJ variants («لپ‌تاپ», «لپتاپ», «لپ تاپ») need no group: Meilisearch already joins
// and splits them (tests/keyword-search.test.ts).

export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Vehicles
  ['ماشین', 'خودرو', 'اتومبیل', 'اتوموبیل'],
  ['موتورسیکلت', 'موتور سیکلت', 'motorrad'],
  ['دوچرخه', 'بایک', 'بایسیکل'],
  ['لاستیک', 'تایر'],
  ['ون', 'مینی بوس'],
  ['کاروان', 'کمپر'],
  ['بنز', 'مرسدس', 'mercedes', 'benz'],
  ['ب ام و', 'بی ام و', 'bmw'],
  ['فولکس', 'فولکس واگن', 'volkswagen', 'vw'],
  ['تویوتا', 'toyota'],
  ['آئودی', 'آودی', 'audi'],
  // Phones and computers
  ['موبایل', 'گوشی', 'تلفن همراه'],
  ['آیفون', 'ایفون', 'iphone'],
  ['سامسونگ', 'samsung'],
  ['لپ تاپ', 'نوت بوک', 'laptop', 'notebook'],
  ['کامپیوتر', 'رایانه', 'pc'],
  ['تبلت', 'آیپد', 'ipad', 'tablet'],
  ['هدفون', 'هدست', 'هندزفری'],
  ['شارژر', 'آداپتور'],
  ['پلی استیشن', 'playstation'],
  ['تلویزیون', 'تی وی', 'tv'],
  // Home
  ['مبل', 'کاناپه', 'مبلمان'],
  ['یخچال', 'یخچال فریزر'],
  ['ماشین لباسشویی', 'لباسشویی'],
  ['ماشین ظرفشویی', 'ظرفشویی'],
  ['تخت', 'تختخواب'],
  ['کمد', 'گنجه'],
  ['فرش', 'قالی', 'قالیچه'],
  ['میز تحریر', 'میز کار'],
  ['جاروبرقی', 'جارو برقی'],
  // Housing
  ['آپارتمان', 'apartment', 'wohnung'],
  ['اتاق', 'روم', 'zimmer'],
  ['اجاره', 'کرایه'],
  ['ودیعه', 'کاوشن', 'kaution'],
  ['wg', 'خانه اشتراکی', 'وه گه'],
  // Jobs and services
  ['شغل', 'استخدام', 'کاریابی'],
  ['مینی جاب', 'minijob'],
  ['تدریس', 'آموزش خصوصی', 'معلم خصوصی'],
  ['اسباب کشی', 'اثاث کشی', 'جابجایی'],
  ['تعمیر', 'تعمیرات'],
  ['ترجمه', 'مترجم'],
  ['آرایشگاه', 'آرایشگر', 'سالن زیبایی'],
  // Kids and clothes
  ['کالسکه', 'کالسکه بچه'],
  ['اسباب بازی', 'اسباببازی'],
  ['کفش', 'کتونی'],
  ['کیف', 'ساک'],
];

/** Meilisearch's synonyms setting: every normalized word mapped to the rest of its group */
export function synonymSettings(groups: readonly (readonly string[])[] = SYNONYM_GROUPS): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const group of groups) {
    const words = [...new Set(group.map(normalizePersian).filter(Boolean))];
    for (const w of words) {
      const others = words.filter((x) => x !== w);
      out[w] ??= new Set();
      for (const o of others) out[w].add(o);
    }
  }
  return Object.fromEntries(
    Object.entries(out)
      .filter(([, s]) => s.size > 0)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([w, s]) => [w, [...s].sort()]),
  );
}

/** The other words of a word's groups (the PostgreSQL fallback expands each query word with these) */
export function synonymsOf(word: string, settings: Record<string, string[]> = synonymSettings()): string[] {
  return settings[normalizePersian(word)] ?? [];
}

// Words too common to help ranking; Meilisearch ignores them in queries (never in phrases)
export const STOP_WORDS = ['و', 'در', 'به', 'از', 'با', 'برای', 'را', 'که', 'این', 'آن', 'یک', 'تا', 'هم', 'یا', 'بر', 'ها', 'های'].map(normalizePersian);
