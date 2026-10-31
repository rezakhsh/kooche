import { describe, expect, it } from 'vitest';
import { cutAtWord, rtlLine, rtlLines } from './bidi';

describe('rtlLines', () => {
  it('marks every line right to left, but not empty lines, links or lines already marked', () => {
    expect(rtlLines('«TaskPilot» تأیید شد.\n\nhttps://peydoo.com/b/x\n‏آماده')).toBe('‏«TaskPilot» تأیید شد.\n\nhttps://peydoo.com/b/x\n‏آماده');
    expect(rtlLine('')).toBe('');
    expect(rtlLine('۲۴ € در ماه')).toBe('‏۲۴ € در ماه');
  });
});

describe('cutAtWord', () => {
  it('keeps short titles and cuts long ones at a word, with «…» at the end', () => {
    expect(cutAtWord('سه‌تار دست‌ساز', 40)).toBe('سه‌تار دست‌ساز');
    expect(cutAtWord('اتاق مبله در WG، نزدیک Hermannplatz', 26)).toBe('اتاق مبله در WG، نزدیک…');
  });
});
