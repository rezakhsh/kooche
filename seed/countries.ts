import type { CountrySeed } from './types';

// EU, EEA, Switzerland and the UK, plus the US, Canada, Australia and Malaysia.
// Only Germany is open for listings at launch. Opening another country: seed its regions and
// cities in seed/locations/, set isActive, and run `npm run db:seed`.
// sortOrder: Germany first, the rest are sorted by Persian name in the app (Intl.Collator('fa')).

const c = (
  code: string,
  nameFa: string,
  nameLocal: string,
  defaultCurrency: string,
  phonePrefix: string,
): CountrySeed => ({
  code,
  nameFa,
  nameLocal,
  defaultCurrency,
  phonePrefix,
  isActive: code === 'DE',
  sortOrder: code === 'DE' ? 0 : 100,
});

export const countries: CountrySeed[] = [
  c('DE', 'آلمان', 'Deutschland', 'EUR', '+49'),
  // Euro area
  c('AT', 'اتریش', 'Österreich', 'EUR', '+43'),
  c('BE', 'بلژیک', 'België', 'EUR', '+32'),
  c('BG', 'بلغارستان', 'България', 'EUR', '+359'),
  c('HR', 'کرواسی', 'Hrvatska', 'EUR', '+385'),
  c('CY', 'قبرس', 'Κύπρος', 'EUR', '+357'),
  c('EE', 'استونی', 'Eesti', 'EUR', '+372'),
  c('FI', 'فنلاند', 'Suomi', 'EUR', '+358'),
  c('FR', 'فرانسه', 'France', 'EUR', '+33'),
  c('GR', 'یونان', 'Ελλάδα', 'EUR', '+30'),
  c('IE', 'ایرلند', 'Ireland', 'EUR', '+353'),
  c('IT', 'ایتالیا', 'Italia', 'EUR', '+39'),
  c('LV', 'لتونی', 'Latvija', 'EUR', '+371'),
  c('LT', 'لیتوانی', 'Lietuva', 'EUR', '+370'),
  c('LU', 'لوکزامبورگ', 'Lëtzebuerg', 'EUR', '+352'),
  c('MT', 'مالت', 'Malta', 'EUR', '+356'),
  c('NL', 'هلند', 'Nederland', 'EUR', '+31'),
  c('PT', 'پرتغال', 'Portugal', 'EUR', '+351'),
  c('SK', 'اسلواکی', 'Slovensko', 'EUR', '+421'),
  c('SI', 'اسلوونی', 'Slovenija', 'EUR', '+386'),
  c('ES', 'اسپانیا', 'España', 'EUR', '+34'),
  // Other currencies in Europe
  c('CH', 'سوئیس', 'Schweiz', 'CHF', '+41'),
  c('LI', 'لیختن‌اشتاین', 'Liechtenstein', 'CHF', '+423'),
  c('GB', 'بریتانیا', 'United Kingdom', 'GBP', '+44'),
  c('SE', 'سوئد', 'Sverige', 'SEK', '+46'),
  c('NO', 'نروژ', 'Norge', 'NOK', '+47'),
  c('DK', 'دانمارک', 'Danmark', 'DKK', '+45'),
  c('PL', 'لهستان', 'Polska', 'PLN', '+48'),
  c('CZ', 'چک', 'Česko', 'CZK', '+420'),
  c('HU', 'مجارستان', 'Magyarország', 'HUF', '+36'),
  c('RO', 'رومانی', 'România', 'RON', '+40'),
  c('IS', 'ایسلند', 'Ísland', 'ISK', '+354'),
  // Outside Europe
  c('US', 'آمریکا', 'United States', 'USD', '+1'),
  c('CA', 'کانادا', 'Canada', 'CAD', '+1'),
  c('AU', 'استرالیا', 'Australia', 'AUD', '+61'),
  c('MY', 'مالزی', 'Malaysia', 'MYR', '+60'),
];
