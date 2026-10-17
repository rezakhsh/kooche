import { normalizePersian } from '../../lib/normalize-persian';

// Prices are integers in minor units (CLAUDE.md). Sellers type amounts in Persian or Latin digits,
// with Persian (٫ ٬), English (1,200.50) or German (1.200,50) separators. Parsing works on the
// digit string, never through a float.

/** 10 billion in major units: well above any real listing, far below 2^53 */
export const MAX_PRICE_MINOR = 1_000_000_000_000;

/**
 * Parses a typed amount into minor units, or null if it isn't a valid amount.
 * A separator followed by exactly three digits is a thousands separator; the last separator
 * followed by one or two digits (up to `minorUnit`) is the decimal point. "1.200" is 1200.
 */
export function parseAmount(input: string, minorUnit: number): number | null {
  let s = normalizePersian(input).replace(/[\s'٬_]/g, '').replace(/٫/g, '.');
  if (!/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null;

  let fraction = '';
  const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (last >= 0) {
    const tail = s.slice(last + 1);
    if (tail.length !== 3) {
      if (tail.length > minorUnit) return null;
      const decimalPoint = s[last]!;
      fraction = tail;
      s = s.slice(0, last);
      // The decimal point can't also group thousands: "12.345.6"
      if (s.includes(decimalPoint)) return null;
    }
  }
  // Whatever separators remain must group thousands: 1,200,000 or 1.200.000
  const groups = s.split(/[.,]/);
  if (groups.length > 1 && (groups[0]!.length > 3 || groups.slice(1).some((g) => g.length !== 3))) {
    return null;
  }
  if (new Set(s.match(/[.,]/g) ?? []).size > 1) return null;

  const whole = groups.join('');
  const digits = `${whole}${fraction.padEnd(minorUnit, '0')}`.replace(/^0+(?=\d)/, '');
  if (digits.length > 16) return null;
  const minor = Number(digits);
  return Number.isSafeInteger(minor) && minor <= MAX_PRICE_MINOR ? minor : null;
}

/** The amount for an input field: Latin digits, no grouping, "." only when there is a fraction */
export function amountInputValue(minor: number, minorUnit: number): string {
  const s = String(minor).padStart(minorUnit + 1, '0');
  const whole = s.slice(0, s.length - minorUnit) || '0';
  const fraction = minorUnit ? s.slice(-minorUnit) : '';
  return /^0*$/.test(fraction) ? whole : `${whole}.${fraction}`;
}

/** Display only: «۱۲۰٫۵۰ €». The integer is exact; Intl gets a number just to format it. */
export function formatPrice(minor: number, currency: string, minorUnit: number): string {
  const hasFraction = minor % 10 ** minorUnit !== 0;
  return new Intl.NumberFormat('fa-IR', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: hasFraction ? minorUnit : 0,
    maximumFractionDigits: minorUnit,
  }).format(minor / 10 ** minorUnit);
}
