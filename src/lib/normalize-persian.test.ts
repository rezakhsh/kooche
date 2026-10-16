import { describe, expect, it } from 'vitest';
import { normalizePersian } from './normalize-persian';

const ZWNJ = '‌';

describe('normalizePersian', () => {
  it('maps Arabic yeh, alef maksura and kaf to their Persian forms', () => {
    expect(normalizePersian('علي')).toBe('علی');
    expect(normalizePersian('موسى')).toBe('موسی');
    expect(normalizePersian('كتاب')).toBe('کتاب');
  });

  it('turns Persian and Arabic-Indic digits into Latin digits', () => {
    expect(normalizePersian('۱۴۰۵')).toBe('1405');
    expect(normalizePersian('٢٠٢٦')).toBe('2026');
  });

  it('removes diacritics and tatweel', () => {
    expect(normalizePersian('مُحَمَّد')).toBe('محمد');
    expect(normalizePersian('کتـــاب')).toBe('کتاب');
    expect(normalizePersian('حتماً')).toBe('حتما');
  });

  it('keeps a ZWNJ between letters and makes it consistent', () => {
    expect(normalizePersian(`خانه${ZWNJ}ها`)).toBe(`خانه${ZWNJ}ها`);
    expect(normalizePersian(`خانه${ZWNJ}${ZWNJ}ها`)).toBe(`خانه${ZWNJ}ها`);
    expect(normalizePersian(`خانه​ها`)).toBe('خانهها');
    expect(normalizePersian(`خانه${ZWNJ} ها`)).toBe('خانه ها');
    expect(normalizePersian(`${ZWNJ}خانه${ZWNJ}`)).toBe('خانه');
  });

  it('folds Arabic presentation forms', () => {
    expect(normalizePersian('ﻣﻨ')).toBe('من');
  });

  it('collapses whitespace and lowercases Latin text', () => {
    expect(normalizePersian('  iPhone  15   Pro ')).toBe('iphone 15 pro');
  });

  it('is idempotent', () => {
    const once = normalizePersian(`  كتابِ ۲ جلدي${ZWNJ}${ZWNJ}ها  `);
    expect(normalizePersian(once)).toBe(once);
  });
});
