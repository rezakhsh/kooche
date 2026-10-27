import { describe, expect, it } from 'vitest';
import { dateFromForm } from './date-parts';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('dateFromForm (the day / month / year field)', () => {
  it('joins the three parts into an ISO day', () => {
    expect(dateFromForm(form({ 'd.day': '1', 'd.month': '12', 'd.year': '2026' }), 'd')).toBe('2026-12-01');
    // Persian digits, as some keyboards send them
    expect(dateFromForm(form({ 'd.day': '۹', 'd.month': '۳', 'd.year': '۲۰۲۷' }), 'd')).toBe('2027-03-09');
  });
  it('a missing part stays visible as invalid; nothing typed is nothing', () => {
    expect(dateFromForm(form({ 'd.day': '', 'd.month': '12', 'd.year': '2026' }), 'd')).toBe('2026-12-');
    expect(dateFromForm(form({ 'd.day': '', 'd.month': '', 'd.year': '' }), 'd')).toBeUndefined();
  });
  it('still reads a plain ISO field', () => {
    expect(dateFromForm(form({ d: '2026-12-01' }), 'd')).toBe('2026-12-01');
  });
});
