import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

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
