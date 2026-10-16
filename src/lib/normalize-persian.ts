// The one Persian text normalizer (CLAUDE.md: "Normalize with the shared function, never ad hoc").
// Every *_normalized column is written with it. It is deliberately not reimplemented in SQL.

const ZWNJ = '‌';

const CHAR_MAP: Record<string, string> = {
  'ي': 'ی', // ي Arabic yeh → ی Persian yeh
  'ى': 'ی', // ى alef maksura → ی
  'ك': 'ک', // ك Arabic kaf → ک Persian kaf
};

// Persian (۰–۹) and Arabic-Indic (٠–٩) digits → Latin
for (let i = 0; i < 10; i++) {
  CHAR_MAP[String.fromCharCode(0x06f0 + i)] = String(i);
  CHAR_MAP[String.fromCharCode(0x0660 + i)] = String(i);
}

const MAPPED = new RegExp(`[${Object.keys(CHAR_MAP).join('')}]`, 'g');
// Harakat, tanwin, shadda, sukun and other combining marks, superscript alef, tatweel (kashida)
const DIACRITICS = /[ً-ٰٟـ]/g;
// Invisible characters that keyboards and copy-paste produce instead of, or next to, ZWNJ
const INVISIBLES = /[​‍⁠﻿­]/g;
const ZWNJ_RUN = /‌{2,}/g;
// A ZWNJ is meaningful only between two letters: drop it next to spaces, punctuation or the ends
const ZWNJ_STRAY = /(^|[^\p{L}])‌+|‌+(?=[^\p{L}]|$)/gu;
const WHITESPACE = /\s+/g;

/**
 * Normalizes Persian text for search and matching:
 * Unicode NFKC (also folds Arabic presentation forms), ي/ى→ی, ك→ک, Persian and Arabic digits →
 * Latin, diacritics and tatweel removed, ZWNJ kept but made consistent, whitespace collapsed,
 * Latin letters lowercased.
 */
export function normalizePersian(input: string): string {
  return input
    .normalize('NFKC')
    .replace(MAPPED, (c) => CHAR_MAP[c] ?? c)
    .replace(DIACRITICS, '')
    .replace(INVISIBLES, '')
    .replace(ZWNJ_RUN, ZWNJ)
    .replace(ZWNJ_STRAY, '$1')
    .replace(WHITESPACE, ' ')
    .trim()
    .toLowerCase();
}
