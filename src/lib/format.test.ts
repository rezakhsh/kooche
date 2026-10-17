import { describe, expect, it } from 'vitest';
import { formatAgo, formatDate, formatMonth } from './format';

describe('formatDate', () => {
  it('shows the Jalali date with Persian digits', () => {
    // 16 Oct 2026 = 24 Mehr 1405
    expect(formatDate(new Date('2026-10-16T12:00:00Z'), 'Europe/Berlin')).toBe('۲۴ مهر ۱۴۰۵');
  });

  it('uses the given time zone, not UTC', () => {
    // 23:30 UTC on 20 March is already 21 March (Nowruz, 1 Farvardin) in Berlin
    expect(formatDate(new Date('2026-03-20T23:30:00Z'), 'Europe/Berlin')).toBe('۱ فروردین ۱۴۰۵');
  });
});

describe('formatAgo and formatMonth (listing cards and the seller box)', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const ago = (ms: number) => formatAgo(new Date(now.getTime() - ms), 'Europe/Berlin', now);
  it('minutes, hours, yesterday and weeks in Persian; a date after two months', () => {
    expect(ago(30_000)).toBe('۱ دقیقه پیش');
    expect(ago(2 * 3_600_000)).toBe('۲ ساعت پیش');
    expect(ago(26 * 3_600_000)).toBe('دیروز');
    expect(ago(21 * 86_400_000)).toBe('۳ هفته پیش');
    expect(ago(90 * 86_400_000)).toBe('۲۸ تیر ۱۴۰۵');
  });
  it('the month a member joined', () => {
    expect(formatMonth(new Date('2026-10-16T12:00:00Z'), 'Europe/Berlin')).toBe('مهر ۱۴۰۵');
  });
});
