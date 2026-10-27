import { describe, expect, it } from 'vitest';
import { distanceMeters, snapToGrid } from '../../lib/geo';
import { findBannedTerm } from '../moderation/terms';
import { amountInputValue, formatPrice, parseAmount } from './price';
import { titleSlug } from './slug';

describe('parseAmount (minor units, no floats)', () => {
  it.each([
    ['250', 25_000],
    ['۲۵۰', 25_000],
    ['۱۲۰٫۵۰', 12_050],
    ['12.5', 1_250],
    ['1.200', 120_000],
    ['12.555', 1_255_500],
    ['1,200.50', 120_050],
    ['1.200,50', 120_050],
    ['۱٬۲۰۰٬۰۰۰', 120_000_000],
    ['0', 0],
    [' 99 ', 9_900],
  ])('%s → %i', (input, minor) => expect(parseAmount(input, 2)).toBe(minor));

  it.each(['', 'abc', '12.345.6', '1,2,3', '12.', '-5', '1.200,000', '1.200.5'])('refuses %j', (input) =>
    expect(parseAmount(input, 2)).toBeNull(),
  );

  it('refuses absurd amounts', () => expect(parseAmount('99999999999999', 2)).toBeNull());

  it('round-trips into the form field', () => {
    expect(amountInputValue(120_050, 2)).toBe('1200.50');
    expect(amountInputValue(45_000, 2)).toBe('450');
    expect(amountInputValue(5, 2)).toBe('0.05');
  });

  it('formats in Persian, the amount before the symbol', () => {
    expect(formatPrice(45_000, 'EUR', 2)).toBe('۴۵۰\u00a0€');
    expect(formatPrice(125_000, 'EUR', 2)).toBe('۱٬۲۵۰\u00a0€');
    expect(formatPrice(12_050, 'EUR', 2)).toBe('۱۲۰٫۵۰\u00a0€');
    expect(formatPrice(87_000, 'USD', 2)).toBe('۸۷۰\u00a0$');
  });
});

describe('snapToGrid (~500 m, never the exact point)', () => {
  it('moves a point to its cell centre, at most ~400 m away', () => {
    const exact = { lat: 52.516_275, lng: 13.377_704 };
    const s = snapToGrid(exact);
    expect(s).not.toEqual(exact);
    expect(distanceMeters(exact, s)).toBeLessThan(400);
  });

  it('is stable: snapping twice changes nothing, and neighbours share a cell', () => {
    const s = snapToGrid({ lat: 52.5163, lng: 13.3777 });
    expect(snapToGrid(s)).toEqual(s);
    expect(snapToGrid({ lat: 52.5164, lng: 13.3778 })).toEqual(s);
  });

  it('refuses nonsense', () => expect(() => snapToGrid({ lat: Number.NaN, lng: 0 })).toThrow());
});

describe('titleSlug', () => {
  it('keeps Persian, joins words with hyphens', () => {
    expect(titleSlug('  دوچرخه شهری، ۲۸ اینچ! ')).toBe('دوچرخه-شهری-28-اینچ');
    expect(titleSlug('می‌فروشم')).toBe('می-فروشم');
    expect(titleSlug('!!!')).toBe('آگهی');
  });
});

describe('banned terms (whole words of the normalized text)', () => {
  it('finds unambiguous terms, also with Arabic letters or extra spaces', () => {
    expect(findBannedTerm('فروش تریاک')).toMatchObject({ group: 'drugs' });
    expect(findBannedTerm('خدمات  صرافي و حواله')).toMatchObject({ term: 'صرافی' });
    expect(findBannedTerm('انتقال پول به ایران با بهترین نرخ')).toMatchObject({ group: 'money_transfer' });
  });

  it('leaves ordinary listings alone', () => {
    expect(findBannedTerm('مبل ارزان و تمیز')).toBeNull();
    expect(findBannedTerm('تفنگ آب‌پاش اسباب‌بازی')).toBeNull();
    expect(findBannedTerm('شیشه پنجره')).toBeNull();
    expect(findBannedTerm('Heroine costume for kids')).toBeNull();
  });
});
