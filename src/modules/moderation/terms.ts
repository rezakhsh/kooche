import { normalizePersian } from '../../lib/normalize-persian';

// Words and phrases that take a listing down at once (decided Oct 17, 2026): items the category
// tree leaves out on purpose because they are illegal or against our terms (seed/categories.ts):
// weapons, drugs, currency exchange and money transfers to Iran (EU sanctions, AML).
//
// Kept to unambiguous terms, because a match takes the listing down without a person looking:
// "تفنگ" alone would hit toy guns, "ارز" alone would hit «ارزان», "شیشه" is also glass. Matching
// is on whole words of the normalized text, so «صرافی» doesn't match inside another word.
// The AI review (phase 4) catches what a word list can't.

export const BANNED_TERMS: Record<string, readonly string[]> = {
  weapons: ['اسلحه گرم', 'کلت کمری', 'کلاشینکف', 'نارنجک', 'مهمات جنگی', 'kalashnikov', 'ammunition'],
  drugs: ['حشیش', 'تریاک', 'کوکائین', 'هروئین', 'ماریجوانا', 'ماری جوانا', 'شیشه کریستال', 'cocaine', 'heroin', 'mdma'],
  money_transfer: [
    'حواله ارزی',
    'صرافی',
    'تبدیل ارز',
    'خرید ارز',
    'فروش ارز',
    'انتقال پول به ایران',
    'ارسال پول به ایران',
    'حواله به ایران',
  ],
};

/**
 * Sections of the terms of use (fa.ts and legal-de.ts) that the automatic checks cite as
 * moderation_decisions.policy_ground (decided Oct 21, 2026; before that `terms-prohibited-items`
 * and the like, which older rows keep). tests/legal.test.ts checks that each exists.
 */
export const BANNED_TERM_SECTION: Record<string, string> = { weapons: '5.2', drugs: '5.3', money_transfer: '5.4' };
export const OWN_PHOTOS_SECTION = '4.3';
export const EVENT_LINKS_SECTION = '4.6';

export const policyGround = (section: string) => `terms-${section}`;

/** The ground for a banned-term match: its group's section, else 5.1 (anything illegal) */
export const bannedTermGround = (group: string) => policyGround(BANNED_TERM_SECTION[group] ?? '5.1');

/** The section a policy_ground names, or null for a legal ground or an older placeholder */
export function groundSection(ground: string | null | undefined): string | null {
  return ground?.match(/^terms-(\d+(?:\.\d+)?)$/)?.[1] ?? null;
}

/** Normalized text as a list of words (letters and digits; ZWNJ, spaces and punctuation split) */
export function words(text: string): string[] {
  return normalizePersian(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const PHRASES = Object.entries(BANNED_TERMS).flatMap(([group, list]) =>
  list.map((term) => ({ group, term, words: words(term) })),
);

/** The first banned phrase found in the text, as whole consecutive words */
export function findBannedTerm(text: string): { group: string; term: string } | null {
  const w = words(text);
  for (const p of PHRASES) {
    for (let i = 0; i + p.words.length <= w.length; i++) {
      if (p.words.every((x, j) => w[i + j] === x)) return { group: p.group, term: p.term };
    }
  }
  return null;
}
