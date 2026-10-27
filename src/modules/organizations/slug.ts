// The page address suggested from the business's name (mockup final/business-new: «نشانی صفحه:
// peydoo.com/b/…»): Latin letters kept, Persian written in simple Finglish, everything else a dash.
// Only a suggestion; the owner can change it before creating, and the server checks it again.
// A separate file without server code, so the form can use it.

const FINGLISH: Record<string, string> = {
  ا: 'a', آ: 'a', أ: 'a', إ: 'e', ب: 'b', پ: 'p', ت: 't', ث: 's', ج: 'j', چ: 'ch', ح: 'h', خ: 'kh', د: 'd', ذ: 'z', ر: 'r', ز: 'z', ژ: 'zh',
  س: 's', ش: 'sh', ص: 's', ض: 'z', ط: 't', ظ: 'z', ع: '', غ: 'gh', ف: 'f', ق: 'gh', ک: 'k', ك: 'k', گ: 'g', ل: 'l', م: 'm', ن: 'n', و: 'v',
  ه: 'h', ة: 'h', ی: 'i', ي: 'i', ئ: 'i', ء: '', ؤ: 'o', '\u200c': '',
};

export function suggestSlug(name: string): string {
  const latin = [...name.normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '').toLowerCase()]
    .map((c, i, all) => {
      if (/[a-z0-9]/.test(c)) return c;
      if (/[۰-۹]/.test(c)) return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
      if (c === 'ß') return 'ss';
      // و between consonants reads as "o" or "u" more often than "v": کوچه, روز
      if (c === 'و' && i > 0 && FINGLISH[all[i - 1]!] && all[i - 1] !== 'ا') return 'o';
      return FINGLISH[c] ?? '-';
    })
    .join('');
  return latin
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
}
