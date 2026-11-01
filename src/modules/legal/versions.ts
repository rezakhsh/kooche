import type { LegalDocument } from '../../db/schema';
import { pages } from '../../messages/fa';
import { legalDe } from '../../messages/legal-de';
import type { LegalDoc } from '../../messages/legal-types';
import { addDays, formatLocalDate, localParts, parseLocalDate, zonedToUtc } from '../events/time';

// Versions of the terms of use and the privacy policy (Check B, Nov 1, 2026). A new version goes
// in the code next to the current one, with the day it starts (00:00 Berlin): until then the pages
// show the current text with a link to the new one (/terms/next, /privacy/next), and admin ›
// «خبر تغییر شرایط به همه» emails every account about it (./notices.ts; terms 12: at least four
// weeks ahead). On its day the pages switch by themselves. Oldest first; old versions stay listed.

export type LegalVersion = { readonly from: string; readonly fa: LegalDoc; readonly de: LegalDoc };

export const LEGAL_VERSIONS: Record<LegalDocument, readonly LegalVersion[]> = {
  terms: [{ from: '2026-10-31', fa: pages.terms, de: legalDe.terms }],
  privacy: [{ from: '2026-10-31', fa: pages.privacy, de: legalDe.privacy }],
};

export const LEGAL_ZONE = 'Europe/Berlin';
/** Terms 12: the email goes out at least four weeks before a change of the terms of use */
export const TERMS_NOTICE_DAYS = 28;

/** 00:00 Berlin on a day `YYYY-MM-DD` */
export function dayStart(day: string): Date {
  const d = parseLocalDate(day);
  if (!d) throw new Error(`legal: bad day ${day}`);
  return zonedToUtc({ ...d, h: 0, mi: 0 }, LEGAL_ZONE);
}

/** Today in Berlin, `YYYY-MM-DD` */
export function berlinToday(now: Date = new Date()): string {
  return formatLocalDate(localParts(now, LEGAL_ZONE));
}

/** The earliest day a terms change emailed today may start */
export function earliestTermsDay(now: Date = new Date()): string {
  return formatLocalDate(addDays(localParts(now, LEGAL_ZONE), TERMS_NOTICE_DAYS));
}

/** The version in force now (the first one before anything started) */
export function currentVersion(doc: LegalDocument, now: Date = new Date(), versions = LEGAL_VERSIONS): LegalVersion {
  const list = versions[doc];
  return list.filter((v) => dayStart(v.from) <= now).at(-1) ?? list[0]!;
}

/** The next version waiting for its day, if one is in the code */
export function nextVersion(doc: LegalDocument, now: Date = new Date(), versions = LEGAL_VERSIONS): LegalVersion | null {
  return versions[doc].find((v) => dayStart(v.from) > now) ?? null;
}

/** "۱ دسامبر ۲۰۲۶" for a day `YYYY-MM-DD` */
export function dayFa(day: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { dateStyle: 'long', timeZone: LEGAL_ZONE }).format(dayStart(day));
}

/** "1. Dezember 2026" */
export function dayDe(day: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: LEGAL_ZONE }).format(dayStart(day));
}
