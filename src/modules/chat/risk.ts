import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { RISK_FLAGS } from '../../db/schema/chat';
import { normalizePersian } from '../../lib/normalize-persian';

// The scam detector (docs/setup.md, "Chat"): sets messages.risk_flags when a message is sent. The
// receiver sees a Persian warning per flag; accounts younger than 7 days can't send `link` or
// `iban` at all (conversations.ts). It works on the normalized text, so Persian digits, Arabic
// letters and stray ZWNJs can't hide a number or a word. Pure functions, no I/O.

export type RiskFlag = (typeof RISK_FLAGS)[number];

/** Flags that a new account may not send */
export const BLOCKED_FOR_NEW_ACCOUNTS: readonly RiskFlag[] = ['link', 'iban'];

const ZWNJ = /‌/g;

// Common top-level domains of links people paste, plus the messenger short links
const TLDS =
  'com|net|org|info|biz|de|at|ch|eu|uk|nl|fr|it|es|se|ir|me|io|ly|gl|co|to|tk|ru|tr|app|xyz|link|shop|online|site|store|page|click|live|top|cc|ws|in|us';
const URL_SCHEME = /\b(?:https?|ftp):\/\/|\bwww\./i;
const DOMAIN = new RegExp(`(?:^|[^a-z0-9@._-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLDS})(?![a-z0-9-])`, 'i');
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const HANDLE = /(?:^|\s)@[a-z][a-z0-9_]{3,31}\b/i;
// Messenger links are a link and off-platform contact at once
const MESSENGER_LINK = /\b(?:t|wa|telegram)\.me\/|\bchat\.whatsapp\.com\b|\bsignal\.me\b/i;

// Persian and Latin words (normalized: lower case, Latin digits, ZWNJ read as a space)
const PAYMENT_WORDS = [
  'بیعانه',
  'پیش پرداخت',
  'پیشپرداخت',
  'واریز',
  'کارت به کارت',
  'شماره کارت',
  'شماره حساب',
  'شبا',
  'حواله',
  'پی پال',
  'پیپال',
  'paypal',
  'friends and family',
  'western union',
  'وسترن یونیون',
  'moneygram',
  'gift card',
  'giftcard',
  'گیفت کارت',
  'بیت کوین',
  'بیتکوین',
  'bitcoin',
  'crypto',
  'کریپتو',
  'تتر',
  'usdt',
  'ووچر',
  'voucher',
  'paysafecard',
];
const CONTACT_WORDS = [
  'تلگرام',
  'telegram',
  'واتساپ',
  'واتس اپ',
  'واتس آپ',
  'whatsapp',
  'سیگنال',
  'signal',
  'وایبر',
  'viber',
  'اینستاگرام',
  'اینستا',
  'instagram',
  'دایرکت',
  'ایمیل',
  'email',
  'e-mail',
  'جیمیل',
  'gmail',
];

function hasWord(text: string, words: readonly string[]): boolean {
  return words.some((w) => {
    // Whole words for Latin ("signal" inside "signaling" still counts; "tether" doesn't match "تتر")
    const latin = /^[a-z -]+$/.test(w);
    if (!latin) return text.includes(w);
    return new RegExp(`(?:^|[^a-z])${w.replace(/[-]/g, '\\-')}(?:$|[^a-z])`).test(text);
  });
}

/** ISO 13616 check: move the first four characters to the end, letters to numbers, mod 97 = 1 */
export function isValidIban(candidate: string): boolean {
  const iban = candidate.toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const c of moved) {
    const v = c >= 'A' ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

function findIban(text: string): boolean {
  // Up to 34 characters, written in groups of four or in one piece
  const re = /\b[a-z]{2}\d{2}(?:[ -]?[a-z0-9]){11,32}/gi;
  for (const m of text.matchAll(re)) {
    const compact = m[0].replace(/[ -]/g, '');
    // The match may run into the next word: try shorter prefixes, longest first
    for (let len = Math.min(compact.length, 34); len >= 15; len--) {
      if (isValidIban(compact.slice(0, len))) return true;
    }
  }
  return false;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// Runs of digits with the separators people put inside numbers
const DIGIT_RUN = /(?:\+|\b00)?\d(?:[\d \-()/.]*\d)?/g;

function digitRuns(text: string): Array<{ raw: string; digits: string; plus: boolean }> {
  return [...text.matchAll(DIGIT_RUN)].map((m) => ({
    raw: m[0],
    digits: m[0].replace(/\D/g, ''),
    plus: m[0].startsWith('+') || m[0].startsWith('00'),
  }));
}

/** A 16-digit card number that passes Luhn (Iranian bank cards are 16 digits) */
function findCardNumber(text: string): boolean {
  return digitRuns(text).some((r) => r.digits.length === 16 && /^[\d -]+$/.test(r.raw) && luhn(r.digits));
}

const HOME_COUNTRIES: CountryCode[] = ['DE', 'AT', 'IR'];

function findPhoneNumber(text: string): boolean {
  return digitRuns(text).some(({ digits, plus }) => {
    if (digits.length < 8 || digits.length > 15) return false;
    if (plus) {
      const n = parsePhoneNumberFromString(`+${digits.replace(/^00/, '')}`);
      return !!n?.isPossible();
    }
    // National numbers start with 0 (prices, postal codes and years don't)
    if (!digits.startsWith('0')) return false;
    return HOME_COUNTRIES.some((cc) => parsePhoneNumberFromString(digits, cc)?.isValid());
  });
}

/** The risk flags of a message body, in the order of RISK_FLAGS */
export function detectRisks(body: string): RiskFlag[] {
  const text = normalizePersian(body).replace(ZWNJ, ' ');
  const flags = new Set<RiskFlag>();

  const emails = text.match(EMAIL) ?? [];
  const withoutEmails = text.replace(EMAIL, ' ');
  if (URL_SCHEME.test(withoutEmails) || DOMAIN.test(withoutEmails)) flags.add('link');

  const iban = findIban(text);
  if (iban) flags.add('iban');
  if (hasWord(text, PAYMENT_WORDS) || findCardNumber(text)) flags.add('payment_request');
  if (emails.length || HANDLE.test(withoutEmails) || MESSENGER_LINK.test(text) || hasWord(text, CONTACT_WORDS)) {
    flags.add('off_platform_contact');
  }
  // An IBAN's digits are not also a phone number
  const withoutIban = iban ? text.replace(/\b[a-z]{2}\d{2}(?:[ -]?[a-z0-9]){11,32}/gi, ' ') : text;
  if (findPhoneNumber(withoutIban)) flags.add('phone_number');

  return RISK_FLAGS.filter((f) => flags.has(f));
}
