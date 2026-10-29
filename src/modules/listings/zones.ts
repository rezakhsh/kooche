import { sql, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { businessVerified, SERVICE_ROOTS } from '../organizations/limits';
import { isNewAccount } from '../users/new-account';
import { countries } from '../../../seed/countries';
import { checkVerifiedNumber } from '../users/phone-number';
import { ancestry, type Catalog } from './catalog';

// Posting across borders (wave 2 part 5, round 6; the zone rule, owner Oct 29, 2026; docs/setup.md,
// "Posting across borders"). A listing's country is where the thing is; the zone of the poster's
// verified number decides what may go out there:
// - the same zone (a German number in Austria): everything; a private listing shows «شمارهٔ آلمان»
//   and a rental's safety note starts with it (Kleinanzeigen reportedly takes any EU number);
// - another zone (a Turkish number in Germany): wanted posts, events, a verified business's
//   listings and online services; renting out, selling and job offers only after verifying a
//   number from the zone ("the landlord is abroad" is the classic deposit scam, EVZ);
// - in the account's first 7 days, one listing outside the number's own country;
// - listings from another zone show in admin «آگهی‌های تازه» whatever the account's age.
// Checked when a listing goes live (published, sent again, renewed, resumed), like the limits in
// ../organizations/limits.ts; listings already live are never taken down by it.

/** Europe is the EU, the EEA, Switzerland and the UK; every other seeded country is its own zone */
export const ZONES = {
  europe: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH', 'GB'],
  north_america: ['US', 'CA'],
  australia: ['AU'],
  turkey: ['TR'],
} as const;

const ZONE_OF = new Map<string, string>(Object.entries(ZONES).flatMap(([zone, codes]) => codes.map((c) => [c, zone] as const)));

export function zoneOf(country: string): string {
  return ZONE_OF.get(country) ?? country;
}

/** The same in SQL, for a country-code column */
export function zoneSql(column: SQL): SQL {
  const cases = Object.entries(ZONES).map(([zone, codes]) => sql`WHEN ${column} IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)}) THEN ${zone}`);
  return sql`(CASE ${sql.join(cases, sql` `)} ELSE ${column} END)`;
}

/** The country of a verified number (users.phone_e164); null without one */
export function numberCountry(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const check = checkVerifiedNumber(e164);
  return check.country;
}

/** A service or lesson the seller offers online («امکان انجام آنلاین», or a lesson held online) */
export function isOnlineService(catalog: Catalog, categoryId: string, attributes: unknown): boolean {
  const root = ancestry(catalog, categoryId)[0]?.slug;
  if (!root || !(SERVICE_ROOTS as readonly string[]).includes(root)) return false;
  const a = attributes && typeof attributes === 'object' ? (attributes as Record<string, unknown>) : {};
  return a.online_possible === true || a.lesson_format === 'online' || a.lesson_format === 'both';
}

export type BorderRefusal =
  /** Offers that need someone on the spot, from a number of another zone */
  | 'zone_number_required'
  /** A second listing outside the number's country in the account's first 7 days */
  | 'abroad_first_week';

export async function borderRefusal(
  db: Queryable,
  catalog: Catalog,
  l: { id: string; userId: string; organizationId: string | null; categoryId: string; kind: 'offer' | 'wanted'; attributes?: unknown; countryCode: string },
  poster: { phoneE164?: string | null; createdAt: Date },
  now: Date = new Date(),
): Promise<BorderRefusal | null> {
  const from = numberCountry(poster.phoneE164);
  if (!from || from === l.countryCode) return null;
  if (zoneOf(from) !== zoneOf(l.countryCode) && !(await openAcrossZones(db, catalog, l))) return 'zone_number_required';
  if (isNewAccount(poster.createdAt, now)) {
    // Every other listing that went out from a number of another country, whatever happened to it
    // since (deleting and posting again doesn't reset it); events aren't counted
    const [row] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM listings l
      WHERE l.user_id = ${l.userId} AND l.id <> ${l.id} AND l.published_at IS NOT NULL
        AND l.number_country IS NOT NULL AND l.number_country <> l.country_code
        AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)`);
    if ((row?.n ?? 0) >= 1) return 'abroad_first_week';
  }
  return null;
}

/** What a number from another zone may post: wanted posts, online services, a verified business's */
async function openAcrossZones(db: Queryable, catalog: Catalog, l: { organizationId: string | null; categoryId: string; kind: 'offer' | 'wanted'; attributes?: unknown }): Promise<boolean> {
  if (l.kind === 'wanted') return true;
  if (isOnlineService(catalog, l.categoryId, l.attributes)) return true;
  return !!l.organizationId && (await businessVerified(db, l.organizationId));
}

/** A seeded country's Persian name (any country a number can come from) */
export function countryNameFa(code: string): string {
  return COUNTRY_FA.get(code) ?? code;
}
const COUNTRY_FA = new Map(countries.map((c) => [c.code, c.nameFa]));
