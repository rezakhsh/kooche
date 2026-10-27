import { describe, expect, it } from 'vitest';
import { rtlLine, rtlLines } from './bidi';

describe('rtlLines', () => {
  it('marks every line right to left, but not empty lines, links or lines already marked', () => {
    expect(rtlLines('«TaskPilot» تأیید شد.\n\nhttps://peydoo.com/b/x\n‏آماده')).toBe('‏«TaskPilot» تأیید شد.\n\nhttps://peydoo.com/b/x\n‏آماده');
    expect(rtlLine('')).toBe('');
    expect(rtlLine('۲۴ € در ماه')).toBe('‏۲۴ € در ماه');
  });
});
