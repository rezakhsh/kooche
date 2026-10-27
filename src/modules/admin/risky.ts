// Phrases that often mark a scam in a listing (wave 1, mockup admin-item: «عبارت‌های قرمز در
// فهرست نشانه‌های کلاهبرداری هستند»): money before seeing, keys or goods by post, the owner
// abroad, payment outside the usual ways. Only highlighted for the moderator; nothing is decided
// on them. The text is matched as written: Arabic ي and ك, ZWNJ and spaces may differ.

export const RISKY_PHRASES = [
  'بیعانه',
  'پیش پرداخت',
  'اول واریز',
  'واریز کنید',
  'کارت به کارت',
  'شماره کارت',
  'وسترن یونیون',
  'western union',
  'moneygram',
  'gift card',
  'گیفت کارت',
  'paysafecard',
  'friends and family',
  'بیت کوین',
  'bitcoin',
  'usdt',
  'تتر',
  'کلید را پست',
  'کلید را می‌فرستم',
  'با پست می‌فرستم',
  'پست می‌کنم',
  'airbnb',
  'خارج از کشور هستم',
  'خودم در ترکیه',
  'فعلاً در ترکیه',
  'خودم ایران هستم',
  'بدون دیدن',
  'قبل از دیدن',
  'پیش از دیدن',
  'فقط واتساپ',
  'فقط تلگرام',
] as const;

const LETTER: Record<string, string> = { ی: '[یيى]', ک: '[کك]', ه: '[هة]', ' ': '[\\s‌]*', '‌': '[\\s‌]*' };

function pattern(phrase: string): string {
  return [...phrase].map((c) => LETTER[c] ?? c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
}

const RISKY = new RegExp(`(${RISKY_PHRASES.map(pattern).join('|')})`, 'giu');

/** The text cut into plain and risky parts, in order; joined back they are the text */
export function riskyParts(text: string): Array<{ text: string; risky: boolean }> {
  const parts: Array<{ text: string; risky: boolean }> = [];
  let at = 0;
  for (const m of text.matchAll(RISKY)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), risky: false });
    parts.push({ text: m[0], risky: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), risky: false });
  return parts;
}
