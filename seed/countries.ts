import type { CountrySeed } from './types';

// EU, EEA, Switzerland and the UK, plus Turkey, the US, Canada, Australia and Malaysia.
// Germany is open for listings, city by city (locations.launch_status; only the Berlin area at
// first). Austria was open from Oct 17, 2026 and is closed again since wave 0 (owner, round 7).
// Turkey is listed but closed. Opening another country: the checklist in docs/setup.md,
// "Countries". sortOrder: Germany, then Austria; the rest are sorted by Persian name in the app
// (Intl.Collator('fa')).
// slug: the country's web address (/germany). Never a two-letter code: those clash with our own
// routes (/my is Malaysia).

const ACTIVE = new Set(['DE']);
const SORT: Record<string, number> = { DE: 0, AT: 1 };

const c = (
  code: string,
  nameFa: string,
  nameLocal: string,
  defaultCurrency: string,
  phonePrefix: string,
  slug: string,
): CountrySeed => ({
  code,
  slug,
  nameFa,
  nameLocal,
  defaultCurrency,
  phonePrefix,
  isActive: ACTIVE.has(code),
  sortOrder: SORT[code] ?? 100,
});

export const countries: CountrySeed[] = [
  c('DE', 'آلمان', 'Deutschland', 'EUR', '+49', 'germany'),
  // Euro area
  c('AT', 'اتریش', 'Österreich', 'EUR', '+43', 'austria'),
  c('BE', 'بلژیک', 'België', 'EUR', '+32', 'belgium'),
  c('BG', 'بلغارستان', 'България', 'EUR', '+359', 'bulgaria'),
  c('HR', 'کرواسی', 'Hrvatska', 'EUR', '+385', 'croatia'),
  c('CY', 'قبرس', 'Κύπρος', 'EUR', '+357', 'cyprus'),
  c('EE', 'استونی', 'Eesti', 'EUR', '+372', 'estonia'),
  c('FI', 'فنلاند', 'Suomi', 'EUR', '+358', 'finland'),
  c('FR', 'فرانسه', 'France', 'EUR', '+33', 'france'),
  c('GR', 'یونان', 'Ελλάδα', 'EUR', '+30', 'greece'),
  c('IE', 'ایرلند', 'Ireland', 'EUR', '+353', 'ireland'),
  c('IT', 'ایتالیا', 'Italia', 'EUR', '+39', 'italy'),
  c('LV', 'لتونی', 'Latvija', 'EUR', '+371', 'latvia'),
  c('LT', 'لیتوانی', 'Lietuva', 'EUR', '+370', 'lithuania'),
  c('LU', 'لوکزامبورگ', 'Lëtzebuerg', 'EUR', '+352', 'luxembourg'),
  c('MT', 'مالت', 'Malta', 'EUR', '+356', 'malta'),
  c('NL', 'هلند', 'Nederland', 'EUR', '+31', 'netherlands'),
  c('PT', 'پرتغال', 'Portugal', 'EUR', '+351', 'portugal'),
  c('SK', 'اسلواکی', 'Slovensko', 'EUR', '+421', 'slovakia'),
  c('SI', 'اسلوونی', 'Slovenija', 'EUR', '+386', 'slovenia'),
  c('ES', 'اسپانیا', 'España', 'EUR', '+34', 'spain'),
  // Other currencies in Europe
  c('CH', 'سوئیس', 'Schweiz', 'CHF', '+41', 'switzerland'),
  c('LI', 'لیختن‌اشتاین', 'Liechtenstein', 'CHF', '+423', 'liechtenstein'),
  c('GB', 'بریتانیا', 'United Kingdom', 'GBP', '+44', 'united-kingdom'),
  c('SE', 'سوئد', 'Sverige', 'SEK', '+46', 'sweden'),
  c('NO', 'نروژ', 'Norge', 'NOK', '+47', 'norway'),
  c('DK', 'دانمارک', 'Danmark', 'DKK', '+45', 'denmark'),
  c('PL', 'لهستان', 'Polska', 'PLN', '+48', 'poland'),
  c('CZ', 'چک', 'Česko', 'CZK', '+420', 'czechia'),
  c('HU', 'مجارستان', 'Magyarország', 'HUF', '+36', 'hungary'),
  c('RO', 'رومانی', 'România', 'RON', '+40', 'romania'),
  c('IS', 'ایسلند', 'Ísland', 'ISK', '+354', 'iceland'),
  // Turkey: listed but closed; SMS to Turkish numbers stays off until it opens
  // (src/modules/users/phone-number.ts)
  c('TR', 'ترکیه', 'Türkiye', 'TRY', '+90', 'turkey'),
  // Outside Europe
  c('US', 'آمریکا', 'United States', 'USD', '+1', 'united-states'),
  c('CA', 'کانادا', 'Canada', 'CAD', '+1', 'canada'),
  c('AU', 'استرالیا', 'Australia', 'AUD', '+61', 'australia'),
  c('MY', 'مالزی', 'Malaysia', 'MYR', '+60', 'malaysia'),
];
