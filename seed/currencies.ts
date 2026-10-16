import type { CurrencySeed } from './types';

// ISO 4217. minor_unit is the ISO number of decimal places (formatting and Stripe amounts).
export const currencies: CurrencySeed[] = [
  { code: 'EUR', minorUnit: 2, nameFa: 'یورو', symbol: '€' },
  { code: 'GBP', minorUnit: 2, nameFa: 'پوند بریتانیا', symbol: '£' },
  { code: 'CHF', minorUnit: 2, nameFa: 'فرانک سوئیس', symbol: 'CHF' },
  { code: 'SEK', minorUnit: 2, nameFa: 'کرون سوئد', symbol: 'kr' },
  { code: 'NOK', minorUnit: 2, nameFa: 'کرون نروژ', symbol: 'kr' },
  { code: 'DKK', minorUnit: 2, nameFa: 'کرون دانمارک', symbol: 'kr' },
  { code: 'PLN', minorUnit: 2, nameFa: 'زلوتی لهستان', symbol: 'zł' },
  { code: 'CZK', minorUnit: 2, nameFa: 'کرون چک', symbol: 'Kč' },
  { code: 'HUF', minorUnit: 2, nameFa: 'فورینت مجارستان', symbol: 'Ft' },
  { code: 'RON', minorUnit: 2, nameFa: 'لئو رومانی', symbol: 'lei' },
  // ISO 4217 gives the Icelandic króna no minor unit
  { code: 'ISK', minorUnit: 0, nameFa: 'کرون ایسلند', symbol: 'kr' },
  { code: 'USD', minorUnit: 2, nameFa: 'دلار آمریکا', symbol: '$' },
  { code: 'CAD', minorUnit: 2, nameFa: 'دلار کانادا', symbol: 'CA$' },
  { code: 'AUD', minorUnit: 2, nameFa: 'دلار استرالیا', symbol: 'A$' },
  { code: 'MYR', minorUnit: 2, nameFa: 'رینگیت مالزی', symbol: 'RM' },
];
