import { describe, expect, it } from 'vitest';
import { formatAgo, formatDate, formatMonth } from './format';

describe('formatDate', () => {
  it('shows the Gregorian date with Persian month names and digits (owner, Oct 2026)', () => {
    expect(formatDate(new Date('2026-10-16T12:00:00Z'), 'Europe/Berlin')).toBe('۱۶ اکتبر ۲۰۲۶');
  });

  it('uses the given time zone, not UTC', () => {
    // 23:30 UTC on 20 March is already 21 March in Berlin
    expect(formatDate(new Date('2026-03-20T23:30:00Z'), 'Europe/Berlin')).toBe('۲۱ مارس ۲۰۲۶');
  });
});

describe('formatAgo and formatMonth (listing cards and the seller box)', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const ago = (ms: number) => formatAgo(new Date(now.getTime() - ms), 'Europe/Berlin', now);
  it('minutes, hours, yesterday and days in Persian for a week; then the date', () => {
    expect(ago(30_000)).toBe('۱ دقیقه پیش');
    expect(ago(2 * 3_600_000)).toBe('۲ ساعت پیش');
    expect(ago(26 * 3_600_000)).toBe('دیروز');
    expect(ago(3 * 86_400_000)).toBe('۳ روز پیش');
    expect(ago(21 * 86_400_000)).toBe('۲۶ سپتامبر');
    expect(ago(300 * 86_400_000)).toBe('۲۱ دسامبر ۲۰۲۵');
  });
  it('the month a member joined', () => {
    expect(formatMonth(new Date('2026-10-16T12:00:00Z'), 'Europe/Berlin')).toBe('اکتبر ۲۰۲۶');
  });
});
