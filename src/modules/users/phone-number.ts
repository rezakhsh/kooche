import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { countries } from '../../../seed/countries';
import { normalizePersian } from '../../lib/normalize-persian';

// Phone numbers typed by users (SMS fallback) and shared from Telegram, as E.164.

/**
 * SMS goes only to numbers in the countries we know (seed/countries.ts), against SMS-pumping fraud
 * (bots sending codes to premium numbers abroad). Telegram numbers are accepted from anywhere:
 * Telegram has already verified them and they cost nothing. Turkey is seeded but closed, and a
 * common SMS-pumping target: no SMS there until it opens for listings.
 */
const SMS_CLOSED = new Set(['TR']);
export const SMS_COUNTRIES: ReadonlySet<string> = new Set(
  countries.map((c) => c.code).filter((code) => !SMS_CLOSED.has(code)),
);

const E164 = /^\+[1-9][0-9]{6,14}$/;

export type ParsedPhone =
  | { ok: true; e164: string; country: string }
  | { ok: false; reason: 'invalid' | 'not_mobile' | 'country_not_supported' };

/** A number typed into the SMS form: Persian digits allowed, +49… or 0170… (Germany by default). */
export function parseSmsNumber(input: string, defaultCountry: CountryCode = 'DE'): ParsedPhone {
  const cleaned = normalizePersian(input).replace(/^00/, '+');
  const phone = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!phone?.isValid() || !E164.test(phone.number)) return { ok: false, reason: 'invalid' };
  const type = phone.getType();
  if (type && type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') {
    return { ok: false, reason: 'not_mobile' };
  }
  if (!phone.country || !SMS_COUNTRIES.has(phone.country)) {
    return { ok: false, reason: 'country_not_supported' };
  }
  return { ok: true, e164: phone.number, country: phone.country };
}

/** Telegram's contact.phone_number: digits, sometimes with a leading + */
export function telegramNumberToE164(raw: string): string | null {
  const e164 = `+${raw.replace(/^\+/, '').replace(/\s/g, '')}`;
  return E164.test(e164) ? e164 : null;
}

/** +491•••••••67: enough to recognize your own number. Shown left-to-right. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 4)}${'•'.repeat(Math.max(0, e164.length - 6))}${e164.slice(-2)}`;
}
