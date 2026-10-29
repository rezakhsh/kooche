import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { countries, locations, postalPlaces, users } from '../../db/schema';
import { PREPARING } from '../launch/countries';
import type { Point } from '../../db/types';
import { foldLatin } from '../../lib/fold-latin';
import { normalizePersian } from '../../lib/normalize-persian';

// Where a listing is, from our own data only (decided Oct 17, 2026: no outside address service).
// The seller types a postal code or a town, or uses the browser's location; we look it up in
// postal_places (GeoNames) and locations. A place is either a postal code with its place name or,
// for a Persian city name, one of our cities. Every place leads to one of our cities: the city the
// listing joins (postal_places.location_id, the nearest seeded city).

export type Place =
  | {
      kind: 'postal';
      id: string;
      countryCode: string;
      postalCode: string;
      placeName: string;
      locationId: string;
      center: Point;
    }
  | { kind: 'city'; id: string; countryCode: string; nameFa: string; nameLocal: string; locationId: string; center: Point };

/** What the place field shows and sends back: `p:<id>` or `c:<id>`, a label and the centre (public data) */
export type PlaceSuggestion = { value: string; label: string; center: Point };

/** "Use my location" and a chosen place must lie this close to each other, and to a postal code */
export const MAX_AREA_DISTANCE_M = 40_000;
const SUGGESTIONS = 8;

export function placeValue(p: Place): string {
  return `${p.kind === 'postal' ? 'p' : 'c'}:${p.id}`;
}

export const toSuggestion = (p: Place): PlaceSuggestion => ({ value: placeValue(p), label: placeLabel(p), center: p.center });

export function placeLabel(p: Place): string {
  return p.kind === 'postal' ? `${p.postalCode} ${p.placeName}` : `${p.nameFa} (${p.nameLocal})`;
}

const postalColumns = {
  id: postalPlaces.id,
  countryCode: postalPlaces.countryCode,
  postalCode: postalPlaces.postalCode,
  placeName: postalPlaces.placeName,
  locationId: postalPlaces.locationId,
  center: postalPlaces.center,
};

type PostalRow = { id: string; countryCode: string; postalCode: string; placeName: string; locationId: string | null; center: Point };

const toPostal = (r: PostalRow): Place | null =>
  r.locationId ? { kind: 'postal', ...r, locationId: r.locationId } : null;

const activePostal = (countryCode: string) =>
  and(eq(postalPlaces.countryCode, countryCode), eq(postalPlaces.isActive, true));

const activeCity = (countryCode: string) =>
  and(eq(locations.countryCode, countryCode), eq(locations.kind, 'city'), eq(locations.isActive, true));

/** LIKE pattern for a prefix; the text is ours after folding, but % and _ are escaped anyway */
const prefix = (s: string) => `${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** "12045 Berlin" → { code: "12045", rest: "berlin" }; "Graz" → { code: "", rest: "graz" } */
function split(text: string): { code: string; rest: string } {
  const t = normalizePersian(text).trim();
  const m = /^([0-9][0-9A-Za-z]*)\s*(.*)$/.exec(t);
  return m ? { code: m[1]!.toUpperCase(), rest: foldLatin(m[2]!) } : { code: '', rest: foldLatin(t) };
}

/** Cities whose Persian or local name is (or starts with) the text */
async function citiesByName(db: Queryable, countryCode: string, text: string, exact: boolean) {
  const fa = normalizePersian(text).trim();
  const latin = foldLatin(text);
  if (!fa && !latin) return [];
  const rows = await db
    .select({ id: locations.id, nameFa: locations.nameFa, nameLocal: locations.nameLocal, center: locations.center, faNorm: locations.nameFaNormalized })
    .from(locations)
    .where(activeCity(countryCode))
    .orderBy(sql`coalesce(${locations.population}, 0) DESC`);
  return rows
    .filter((r) => {
      const local = foldLatin(r.nameLocal);
      return exact ? r.faNorm === fa || local === latin : (fa && r.faNorm.startsWith(fa)) || (latin && local.startsWith(latin));
    })
    .map((r): Place => ({ kind: 'city', id: r.id, countryCode, nameFa: r.nameFa, nameLocal: r.nameLocal, locationId: r.id, center: r.center }));
}

/** Suggestions while the seller types: postal codes by prefix, towns and cities by name */
export async function searchPlaces(db: Queryable, countryCode: string, text: string): Promise<PlaceSuggestion[]> {
  const { code, rest } = split(text.slice(0, 100));
  let places: Place[] = [];
  if (code) {
    const rows = await db
      .select(postalColumns)
      .from(postalPlaces)
      .where(
        and(
          activePostal(countryCode),
          sql`${postalPlaces.postalCode} LIKE ${prefix(code)}`,
          rest ? sql`${postalPlaces.placeSearch} LIKE ${prefix(rest)}` : undefined,
        ),
      )
      .orderBy(asc(postalPlaces.postalCode), asc(postalPlaces.placeName))
      .limit(SUGGESTIONS);
    places = rows.map(toPostal).filter((p) => p !== null);
  } else if (text.trim().length >= 2) {
    const cities = (await citiesByName(db, countryCode, text, false)).slice(0, 3);
    const rows = rest
      ? await db
          .select(postalColumns)
          .from(postalPlaces)
          .where(and(activePostal(countryCode), sql`${postalPlaces.placeSearch} LIKE ${prefix(rest)}`))
          // The town itself before its districts, then shorter names, then by code
          .orderBy(sql`${postalPlaces.placeSearch} = ${rest} DESC`, sql`char_length(${postalPlaces.placeName})`, asc(postalPlaces.postalCode))
          .limit(SUGGESTIONS)
      : [];
    places = [...cities, ...rows.map(toPostal).filter((p) => p !== null)].slice(0, SUGGESTIONS);
  }
  return places.map(toSuggestion);
}

/** The place of a suggestion the seller picked (`p:<id>` / `c:<id>`), in this country */
export async function placeByValue(db: Queryable, countryCode: string, value: string): Promise<Place | null> {
  const m = /^([pc]):([0-9a-f-]{36})$/.exec(value);
  if (!m) return null;
  if (m[1] === 'p') {
    const [row] = await db
      .select(postalColumns)
      .from(postalPlaces)
      .where(and(activePostal(countryCode), eq(postalPlaces.id, m[2]!)));
    return row ? toPostal(row) : null;
  }
  const [row] = await db
    .select({ id: locations.id, nameFa: locations.nameFa, nameLocal: locations.nameLocal, center: locations.center })
    .from(locations)
    .where(and(activeCity(countryCode), eq(locations.id, m[2]!)));
  return row ? { kind: 'city', countryCode, locationId: row.id, ...row } : null;
}

/**
 * What the seller typed without picking a suggestion (no JavaScript, or typed and sent): a postal
 * code ("8010", "12045 Berlin") or a town or city name ("Graz", «وین»). A code with several places
 * takes the one whose name matches the rest of the text, else the one nearest its city's centre
 * (8010 is "Graz, Innere Stadt", not a village on the edge). `ambiguous`: a town name that exists
 * in several places, which needs the postal code.
 */
export async function resolvePlace(db: Queryable, countryCode: string, text: string): Promise<Place | 'not_found' | 'ambiguous'> {
  const { code, rest } = split(text.slice(0, 100));
  const nearestToCity = sql`${postalPlaces.center} <-> (SELECT l.center FROM locations l WHERE l.id = ${postalPlaces.locationId})`;
  if (code) {
    const rows = await db
      .select(postalColumns)
      .from(postalPlaces)
      .where(and(activePostal(countryCode), eq(postalPlaces.postalCode, code)))
      .orderBy(
        ...(rest ? [sql`${postalPlaces.placeSearch} = ${rest} DESC`, sql`${postalPlaces.placeSearch} LIKE ${prefix(rest)} DESC`] : []),
        nearestToCity,
        asc(postalPlaces.placeName),
      );
    const place = rows.map(toPostal).find((p) => p !== null);
    return place ?? 'not_found';
  }
  if (!text.trim()) return 'not_found';
  const [city] = await citiesByName(db, countryCode, text, true);
  if (city) return city;
  const rows = await db
    .select(postalColumns)
    .from(postalPlaces)
    .where(and(activePostal(countryCode), eq(postalPlaces.placeSearch, rest)))
    .orderBy(nearestToCity, asc(postalPlaces.placeName));
  const places = rows.map(toPostal).filter((p) => p !== null);
  if (places.length === 0) return 'not_found';
  // One town with several postal codes is fine (any of them is right); one name in several towns isn't
  const towns = new Set(places.map((p) => p.locationId));
  return towns.size === 1 ? places[0]! : 'ambiguous';
}

/** The postal code nearest a (snapped) point, within MAX_AREA_DISTANCE_M, in this country */
export async function nearestPostalPlace(db: Queryable, countryCode: string, point: Point): Promise<Place | null> {
  const p = sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;
  const [row] = await db
    .select(postalColumns)
    .from(postalPlaces)
    .where(and(activePostal(countryCode), sql`ST_DWithin(${postalPlaces.center}, ${p}, ${MAX_AREA_DISTANCE_M})`))
    .orderBy(sql`${postalPlaces.center} <-> ${p}`)
    .limit(1);
  return row ? toPostal(row) : null;
}

/** The place a saved listing has, to show it again in the form */
export async function placeOfListing(
  db: Queryable,
  l: { countryCode: string | null; locationId: string | null; postalCode: string | null; placeName: string | null },
): Promise<Place | null> {
  if (!l.countryCode || !l.locationId) return null;
  if (l.postalCode && l.placeName) {
    const [row] = await db
      .select(postalColumns)
      .from(postalPlaces)
      .where(and(eq(postalPlaces.countryCode, l.countryCode), eq(postalPlaces.postalCode, l.postalCode), eq(postalPlaces.placeName, l.placeName)));
    // The listing keeps its own city even if the postal data moved on
    if (row) return { kind: 'postal', ...row, locationId: l.locationId };
  }
  return placeByValue(db, l.countryCode, `c:${l.locationId}`);
}

const MAX_DISTRICT = 60;

/**
 * Saves the account's place (users.home_*) from the "my location" form: a country, a postal code
 * or town, and an optional district. Only the postal code, place name, city and district are
 * kept, never a position.
 */
export async function setSavedPlace(
  db: Queryable,
  userId: string,
  input: { countryCode: string; placeValue: string; place: string; district: string },
): Promise<{ ok: true } | { ok: false; errors: Partial<Record<'countryCode' | 'place' | 'district', 'required' | 'invalid' | 'not_found' | 'ambiguous' | 'too_long'>> }> {
  const country = input.countryCode.toUpperCase();
  // Open and prestart countries (drafts there pre-fill it too; src/modules/launch/countries.ts)
  const [open] = await db.select({ code: countries.code }).from(countries).where(and(eq(countries.code, country), inArray(countries.mode, [...PREPARING])));
  if (!open) return { ok: false, errors: { countryCode: 'invalid' } };
  const district = input.district.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (district.length > MAX_DISTRICT) return { ok: false, errors: { district: 'too_long' } };
  const text = input.place.normalize('NFC').replace(/\s+/g, ' ').trim();
  let place = input.placeValue ? await placeByValue(db, country, input.placeValue) : null;
  if (!place) {
    if (!text) return { ok: false, errors: { place: 'required' } };
    const r = await resolvePlace(db, country, text);
    if (typeof r === 'string') return { ok: false, errors: { place: r } };
    place = r;
  }
  await db
    .update(users)
    .set({
      homeLocationId: place.locationId,
      homePostalCode: place.kind === 'postal' ? place.postalCode : null,
      homePlaceName: place.kind === 'postal' ? place.placeName : null,
      homeDistrict: district || null,
    })
    .where(eq(users.id, userId));
  return { ok: true };
}

export async function clearSavedPlace(db: Queryable, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ homeLocationId: null, homePostalCode: null, homePlaceName: null, homeDistrict: null })
    .where(eq(users.id, userId));
}
