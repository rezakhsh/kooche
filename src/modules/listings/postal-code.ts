import { normalizePersian } from '../../lib/normalize-persian';

// The one reader of typed postal codes (postal codes step 3, Nov 4, 2026). Whatever someone types
// in a place field or the postal-code filter ("SW1A 1AA", "m5v3l9", "۱۲۰۴۵ Berlin", "Sydney 2000")
// becomes the code as postal_places stores it, plus the place name typed with it. Every caller
// (places.ts for the posting form, account place and business address; search/filters.ts for the
// browse filter and saved searches) goes through here, never a regex of its own.
//
// Stored forms (decided from practice, docs/progress.md "Postal codes: step 1"): no street-level
// code is ever stored, so a full code is cut to its area part:
//   DE, FR, IT, TR, US 5 digits ("90210-1234" → "90210"); AT, AU 4 digits;
//   GB outward code ("SW1A 1AA" → "SW1A"); CA forward sortation area ("M5V 3L9" → "M5V");
//   NL 4 digits ("1012 AB" → "1012"); SE "123 45" ("12345" → "123 45").
// Every stored form passes the database check `^[0-9A-Z][0-9A-Z -]{1,9}$` (PATTERNS.postalCode).

export type PostalRead = {
  /** The code as stored (a prefix of one with `partial`), or null when the text holds no code */
  code: string | null;
  /** The rest of the text, normalized (lowercase): the place name typed before or after the code */
  rest: string;
};

type Rule = {
  /** A whole code at the start of the text (case-insensitive); `store` gives the stored form */
  full: RegExp;
  /** The start of a code, while someone types; matches every whole code too */
  partial: RegExp;
  store: (m: RegExpExecArray) => string;
  /** Letters in the code: the phone shows a letter keyboard, not the number pad */
  letters?: boolean;
};

const digits = (n: number): Rule => ({
  full: new RegExp(`^(\\d{${n}})`),
  partial: new RegExp(`^(\\d{1,${n}})`),
  store: (m) => m[1]!,
});

const RULES: Record<string, Rule> = {
  DE: digits(5),
  AT: digits(4),
  FR: digits(5),
  IT: digits(5),
  TR: digits(5),
  AU: digits(4),
  // ZIP+4 ("90210-1234", "90210 1234", "902101234") is cut to the ZIP
  US: { full: /^(\d{5})(?:[- ]?\d{4})?/, partial: /^(\d{1,5})(?:[- ]?\d{0,4})?/, store: (m) => m[1]! },
  // "123 45"; "12345" is the same code. Typing "1234" looks for "123 4…"
  SE: {
    full: /^(\d{3}) ?(\d{2})/,
    partial: /^(?:(\d{3}) ?(\d{1,2})|(\d{1,3}))/,
    store: (m) => (m[3] ? m[3] : `${m[1]} ${m[2]}`),
  },
  // Outward code (A9, A99, A9A, AA9, AA99, AA9A) and an optional inward part (digit + 2 letters)
  GB: {
    full: /^([a-z]{1,2}\d[a-z\d]?)(?: ?\d[a-z]{2})?/i,
    partial: /^([a-z]{1,2}\d[a-z\d]?)(?: ?\d[a-z]{0,2})?/i,
    store: (m) => m[1]!.toUpperCase(),
    letters: true,
  },
  // Forward sortation area (letter digit letter) and an optional local unit (digit letter digit)
  CA: {
    full: /^([a-z]\d[a-z])(?: ?\d[a-z]\d)?/i,
    partial: /^(?:([a-z]\d[a-z])(?: ?\d(?:[a-z]\d?)?)?|([a-z]\d))/i,
    store: (m) => (m[1] ?? m[2]!).toUpperCase(),
    letters: true,
  },
  // 4 digits and two letters ("1012 AB"). "1012 De Bilt": a place name starting with "De" is
  // not the letters
  NL: {
    full: /^(\d{4})(?: ?(?!de )[a-z]{2})?/i,
    partial: /^(?:(\d{4})(?: ?(?!de )[a-z]{1,2})?|(\d{1,3}))/i,
    store: (m) => m[1] ?? m[2]!,
    letters: true,
  },
};

/** Countries without postal data keep the old reading: a token that starts with a digit */
const OTHER: Rule = { full: /^(\d[\da-z]{1,9})/i, partial: /^(\d[\da-z]*)/i, store: (m) => m[1]!.toUpperCase(), letters: true };

const STORED = /^[0-9A-Z][0-9A-Z -]{1,9}$/;
/** A code ends at the end of the text, a space or a comma ("12045 Berlin", "12045, Berlin") */
const END = '(?=$|[\\s,،;])';
const SEPARATORS = /^[\s,،;-]+|[\s,،;-]+$/g;
const ended = new Map<RegExp, RegExp>();
/** The rule's pattern, ending where a code ends (inside the pattern, so "E11AA" backtracks to E1 + 1AA) */
const withEnd = (re: RegExp) => ended.get(re) ?? ended.set(re, new RegExp(re.source + END, re.flags.includes('i') ? re.flags : `${re.flags}i`)).get(re)!;

const ruleOf = (country: string) => RULES[country.toUpperCase()] ?? OTHER;

/**
 * Letters some people put before a code: the ISO country code ("NL-1012", "SE-123 45") or the old
 * European one on letters ("D-10115", "A-1010", "F-75001", "I-00184", "S-123 45")
 */
const LETTER_PREFIXES: Record<string, string[]> = { DE: ['D'], AT: ['A'], FR: ['F'], IT: ['I'], SE: ['S'], GB: ['UK'] };
const prefixes = new Map<string, RegExp>();
/** The prefix and its dash, where a code follows (a digit within its first three characters: "D-Mark" stays) */
const prefixOf = (country: string) => {
  const cc = country.toUpperCase();
  const names = [cc, ...(LETTER_PREFIXES[cc] ?? [])].filter((n) => /^[A-Z]{1,3}$/.test(n));
  return prefixes.get(cc) ?? prefixes.set(cc, new RegExp(`(^|[\\s,،;])(?:${names.join('|')})-\\s?(?=[a-z]{0,2}\\d)`, 'gi')).get(cc)!;
};

/** A code at the start of `t`: its stored form and where it ends. `partial` covers every whole code too */
function leading(rule: Rule, t: string, partial: boolean): { code: string; end: number } | null {
  const m = withEnd(partial ? rule.partial : rule.full).exec(t);
  if (!m) return null;
  const code = rule.store(m);
  // A partial code is only looked up by prefix; a whole one must fit the database
  return partial || STORED.test(code) ? { code, end: m[0].length } : null;
}

/**
 * Reads a postal code from typed text, in a country. The code may come first ("12045 Berlin",
 * "SW1A 1AA London"), after a label's area («Neukölln، 12045 Berlin», as the place field shows a
 * suggestion), or last, as people in the UK, US, Canada and Australia write it ("Sydney 2000",
 * "Beverly Hills, CA 90210"). Persian and Arabic digits, case and extra spaces don't matter.
 * A country prefix ("D-10115", "SE-123 45") and long dashes ("90210–1234") are read too.
 * `partial`: the start of a code also counts ("120", "SW1", "M5"), for suggestions while typing;
 * a code at the end must still be whole.
 */
export function normalizePostalCode(country: string, text: string, opts: { partial?: boolean } = {}): PostalRead {
  const rule = ruleOf(country);
  const partial = !!opts.partial;
  // Long dashes as a plain one ("90210–1234"); a country prefix before the code dropped ("D-10115")
  const t = normalizePersian(text.replace(/[\u2066-\u2069]/g, '').replace(/[\u2010-\u2015\u2212]/g, '-')).replace(prefixOf(country), '$1');
  const tidy = (s: string) => s.replace(SEPARATORS, '');

  const first = leading(rule, t, partial);
  if (first) return { code: first.code, rest: tidy(t.slice(first.end)) };

  // A label read back: the area, a Persian comma, then the code and town
  const comma = t.indexOf('،');
  if (comma > 0) {
    const after = t.slice(comma + 1).trimStart();
    const m = leading(rule, after, partial);
    if (m) return { code: m.code, rest: tidy(after.slice(m.end)) };
  }

  // The code last: the longest tail after a space or comma that is one whole code
  for (let i = 1; i < t.length; i++) {
    if (!/[\s,،;]/.test(t[i - 1]!) || /[\s,،;]/.test(t[i]!)) continue;
    const tail = t.slice(i);
    const m = leading(rule, tail, false);
    if (m && m.end === tail.length) return { code: m.code, rest: tidy(t.slice(0, i)) };
  }
  return { code: null, rest: tidy(t) };
}

/**
 * The browse filter's postal code: the stored code (a town typed after it is dropped). Text that
 * is no code here but looks like one ("1234" in Germany) is kept, upper-cased, so the page can say
 * «این کد پستی پیدا نشد» instead of dropping it silently; anything else is null.
 */
export function postalFilterCode(country: string, text: string): string | null {
  const code = normalizePostalCode(country, text).code;
  if (code) return code;
  const t = normalizePersian(text).toUpperCase();
  return STORED.test(t) ? t : null;
}

/** The phone keyboard for a postal-code box: digits only where codes have no letters */
export function postalInputMode(country: string): 'numeric' | 'text' {
  return ruleOf(country).letters ? 'text' : 'numeric';
}
