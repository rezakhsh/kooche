import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';
import type { Db, Queryable } from '../../db/drizzle';
import type { Point } from '../../db/types';
import { auditLog, countries, organizationMembers, organizations } from '../../db/schema';
import { BUSINESS_LANGUAGES, BUSINESS_TYPES, type OpeningHours } from '../../db/schema/organizations';
import { normalizePersian } from '../../lib/normalize-persian';
import { RESERVED_SLUGS } from '../../db/seed-checks';
import { pinFromAddress } from '../maps/geocode';
import { pinField, pinNear } from '../maps/pin';
import { staffAudit, type StaffContext } from '../admin/audit';
import { placeByValue, resolvePlace } from '../listings/places';
import { canPostListing, loadActor, type Denied } from '../users/permissions';
import { validHours } from './hours';
import { ownLogoUpload, queueLogo, removeLogo } from './logo';
import { queueBusinessNotice } from './notices';
import { testOwned } from '../users/test-accounts';

// Businesses (docs/schema.md, section 7; roadmap step 6). A business has a public page /b/{slug}
// with the legal details German law asks of traders (§5 DDG), its members with roles, and a plan
// read from entitlements. Whether it is Pro is never a column.

export type Role = (typeof organizationMembers.$inferSelect)['role'];
type Organization = typeof organizations.$inferSelect;

/** At most this many businesses per person (each needs its own legal details anyway) */
export const MAX_BUSINESSES_PER_USER = 3;


const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const text = (max: number) => z.string().max(max * 4).transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim());
const optionalText = (min: number, max: number) =>
  text(max).pipe(z.union([z.literal('').transform(() => null), z.string().min(min).max(max)]));

/** An Instagram or Telegram handle, typed as @name, name or a link to the profile */
const handle = (site: RegExp, valid: RegExp) =>
  z
    .string()
    .max(200)
    .transform((s) => s.trim().replace(site, '').replace(/^@/, '').replace(/[/?#].*$/, ''))
    .pipe(z.union([z.literal('').transform(() => null), z.string().regex(valid)]));

/**
 * What the business form sends (create and edit; wave 1, mockups final/business-new and
 * business-legal). Step 1: name, address of the page, what it does, where, logo. Step 2: contact,
 * hours, languages, about. Step 3: the legal details, which can wait: all of them or none, and
 * the full set is needed for the «تأییدشده» badge and for payments (legalComplete).
 */
export const businessInputSchema = z.object({
  name: text(80).pipe(z.string().min(2).max(80)),
  slug: z.string().max(60).transform((s) => s.trim().toLowerCase()).pipe(z.string().min(3).max(40).regex(SLUG)),
  businessType: z.enum(BUSINESS_TYPES),
  tagline: optionalText(2, 100),
  /** A postal code or place, resolved in the business's country like a listing's place */
  place: text(120).pipe(z.string().min(2)),
  placeValue: z.string().max(40).default(''),
  /** The shop's exact spot on the street map, "lat,lng" (src/modules/maps/pin.ts); "" for none */
  pin: pinField,
  servesOnline: z.boolean().default(false),
  languages: z.array(z.enum(BUSINESS_LANGUAGES)).max(BUSINESS_LANGUAGES.length).default([]),
  description: z.string().max(20_000).transform((s) => s.normalize('NFC').replace(/\r\n?/g, '\n').trim()).pipe(z.string().max(5000)),
  phone: z.string().max(40).transform((s) => s.trim()).default(''),
  email: z
    .string()
    .max(200)
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.union([z.literal('').transform(() => null), z.email()])),
  website: z
    .string()
    .max(300)
    .transform((s) => s.trim())
    .pipe(z.union([z.literal('').transform(() => null), z.url({ protocol: /^https$/ })])),
  instagram: handle(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, /^[A-Za-z0-9._]{1,30}$/),
  telegram: handle(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, /^[A-Za-z][A-Za-z0-9_]{4,31}$/),
  hours: z.custom<OpeningHours | null>((v) => v === null || validHours(v)).default(null),
  legalName: optionalText(2, 120),
  legalForm: optionalText(1, 80),
  representativeName: optionalText(2, 120),
  addressLine1: optionalText(3, 120),
  addressLine2: optionalText(1, 120),
  /** Step 3's postal code: when given, it is the business's place (more exact than step 1's town) */
  legalPostal: z.string().max(20).transform((s) => s.trim()).default(''),
  registerCourt: optionalText(2, 120),
  registrationNumber: optionalText(2, 60),
  vatId: z
    .string()
    .max(30)
    .transform((s) => s.replace(/\s+/g, '').toUpperCase())
    .pipe(z.union([z.literal('').transform(() => null), z.string().regex(/^[A-Z]{2}[0-9A-Z]{2,13}$/)])),
  imprintExtra: optionalText(1, 2000),
  /** «بعداً تکمیل می‌کنم» while creating: the legal fields are left empty */
  legalLater: z.boolean().default(false),
  /** A logo the browser uploaded (./logo.ts), or removing the logo */
  logoUpload: z.string().max(200).default(''),
  removeLogo: z.boolean().default(false),
});
export type BusinessInput = z.input<typeof businessInputSchema>;

export type BusinessError =
  | Denied
  | 'invalid'
  | 'slug_taken'
  | 'slug_reserved'
  | 'vat_taken'
  | 'too_many'
  | 'not_found'
  | 'place_not_found'
  | 'phone_invalid'
  | 'register_incomplete'
  | 'legal_incomplete'
  | 'postal_required'
  | 'pin_far';

const LEGAL_FIELDS = ['legalName', 'legalForm', 'representativeName', 'addressLine1', 'addressLine2', 'registerCourt', 'registrationNumber', 'vatId', 'imprintExtra'] as const;

/** Everything the Impressum, the «تأییدشده» badge and a payment need */
export function legalComplete(org: { legalName?: string | null; legalForm?: string | null; addressLine1?: string | null; postalCode?: string | null; email?: string | null }): boolean {
  return !!(org.legalName && org.legalForm && org.addressLine1 && org.postalCode && org.email);
}

/** Field → what is wrong with it, from Zod's issues */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.code === 'too_small' ? 'too_short' : issue.code === 'too_big' ? 'too_long' : 'invalid';
  return out;
}

type ColumnsResult = { error: BusinessError; fields?: Record<string, string> } | { values: Omit<typeof organizations.$inferInsert, 'slug' | 'countryCode' | 'createdByUserId'> };

async function columns(db: Queryable, countryCode: string, raw: z.output<typeof businessInputSchema>, pinFound = false): Promise<ColumnsResult> {
  const input = raw.legalLater ? { ...raw, ...Object.fromEntries(LEGAL_FIELDS.map((k) => [k, null])), legalPostal: '' } : raw;
  const place = input.legalPostal
    ? await resolvePlace(db, countryCode, input.legalPostal)
    : (input.placeValue && (await placeByValue(db, countryCode, input.placeValue))) || (await resolvePlace(db, countryCode, input.place));
  if (!place || typeof place === 'string') return { error: 'place_not_found', fields: { [input.legalPostal ? 'legalPostal' : 'place']: 'place_not_found' } };
  // A pin found from the address that lands far away was a wrong match: left out, not refused
  if (input.pin && !pinNear(input.pin, place.center)) {
    if (!pinFound) return { error: 'pin_far', fields: { pin: 'pin_far' } };
    input.pin = null;
  }
  let phone: string | null = null;
  if (input.phone) {
    const parsed = parsePhoneNumberFromString(input.phone, countryCode as 'DE');
    if (!parsed?.isValid()) return { error: 'phone_invalid' };
    phone = parsed.number;
  }
  // A registration number means nothing without its court, and the other way round
  if (!input.registerCourt !== !input.registrationNumber) return { error: 'register_incomplete' };
  // The legal details are all there or not at all: half an Impressum helps nobody
  if (LEGAL_FIELDS.some((k) => input[k])) {
    const missing = Object.fromEntries((['legalForm', 'legalName', 'addressLine1'] as const).filter((k) => !input[k]).map((k) => [k, 'required']));
    if (Object.keys(missing).length) return { error: 'legal_incomplete', fields: missing };
    if (place.kind !== 'postal') return { error: 'postal_required', fields: { legalPostal: 'required' } };
    if (!input.email) return { error: 'legal_incomplete', fields: { email: 'required' } };
  }
  return {
    values: {
      name: input.name,
      nameNormalized: normalizePersian(input.name),
      businessType: input.businessType,
      tagline: input.tagline,
      servesOnline: input.servesOnline,
      languages: [...new Set(input.languages)].sort((a, b) => BUSINESS_LANGUAGES.indexOf(a) - BUSINESS_LANGUAGES.indexOf(b)),
      openingHours: input.hours,
      legalName: input.legalName,
      legalForm: input.legalForm,
      representativeName: input.representativeName,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      postalCode: place.kind === 'postal' ? place.postalCode : null,
      placeName: place.kind === 'postal' ? place.placeName : null,
      locationId: place.locationId,
      point: place.center,
      pin: input.pin,
      phoneE164: phone,
      email: input.email,
      website: input.website,
      instagram: input.instagram,
      telegram: input.telegram,
      registerCourt: input.registerCourt,
      registrationNumber: input.registrationNumber,
      vatId: input.vatId,
      imprintExtra: input.imprintExtra,
      description: input.description,
      descriptionNormalized: normalizePersian(input.description),
    },
  };
}

function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const code = err.cause?.code ?? err.code;
  return code === '23505' ? (err.cause?.constraint_name ?? err.constraint_name ?? 'unique') : null;
}

/** The shop's pin: the owner's own, or one found from the street address (src/modules/maps/geocode.ts) */
async function withShopPin(input: z.output<typeof businessInputSchema>, countryCode: string, saved: { street: string | null; pin: Point | null } | null) {
  const found = await pinFromAddress({ pin: input.pin, street: input.legalLater ? null : input.addressLine1, place: input.legalPostal || input.place, countryCode, saved });
  return { input: { ...input, pin: found.pin }, pinFound: found.fromAddress };
}

/** A person with a verified phone creates a business in the country they post in, and owns it */
export async function createBusiness(
  db: Db,
  opts: { userId: string; countryCode: string; input: BusinessInput },
): Promise<{ ok: true; slug: string; id: string } | { ok: false; reason: BusinessError; fields?: Record<string, string> }> {
  const parsed = businessInputSchema.safeParse(opts.input);
  if (!parsed.success) return { ok: false, reason: 'invalid', fields: fieldErrors(parsed.error) };
  if (RESERVED_SLUGS.includes(parsed.data.slug)) return { ok: false, reason: 'slug_reserved', fields: { slug: 'reserved' } };
  const shop = await withShopPin(parsed.data, opts.countryCode, null);
  try {
    return await db.transaction(async (tx) => {
      const allowed = canPostListing(await loadActor(tx, opts.userId));
      if (!allowed.ok) return allowed;
      const [country] = await tx.select({ code: countries.code }).from(countries).where(and(eq(countries.code, opts.countryCode), eq(countries.isActive, true)));
      if (!country) return { ok: false, reason: 'invalid' };
      const [owned] = await tx
        .select({ n: count() })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(and(eq(organizationMembers.userId, opts.userId), eq(organizationMembers.role, 'owner'), ne(organizations.status, 'deleted')));
      if ((owned?.n ?? 0) >= MAX_BUSINESSES_PER_USER) return { ok: false, reason: 'too_many' };
      const built = await columns(tx, country.code, shop.input, shop.pinFound);
      if ('error' in built) return { ok: false, reason: built.error, fields: built.fields };
      const [org] = await tx
        .insert(organizations)
        .values({ ...built.values, slug: parsed.data.slug, countryCode: country.code, createdByUserId: opts.userId })
        .returning({ id: organizations.id, slug: organizations.slug });
      await tx.insert(organizationMembers).values({ organizationId: org!.id, userId: opts.userId, role: 'owner' });
      if (parsed.data.logoUpload && ownLogoUpload(opts.userId, parsed.data.logoUpload)) await queueLogo(tx, org!.id, parsed.data.logoUpload);
      await tx.insert(auditLog).values({ actorType: 'user', actorUserId: opts.userId, action: 'organization.created', targetType: 'organization', targetId: org!.id });
      return { ok: true, slug: org!.slug, id: org!.id };
    });
  } catch (e) {
    const constraint = uniqueViolation(e);
    if (constraint?.includes('slug')) return { ok: false, reason: 'slug_taken', fields: { slug: 'taken' } };
    if (constraint?.includes('vat')) return { ok: false, reason: 'vat_taken', fields: { vatId: 'taken' } };
    throw e;
  }
}

/** The owner edits the business's details. The slug stays (links to the page keep working). */
export async function updateBusiness(
  db: Db,
  opts: { userId: string; organizationId: string; input: BusinessInput },
): Promise<{ ok: true } | { ok: false; reason: BusinessError; fields?: Record<string, string> }> {
  const parsed = businessInputSchema.safeParse(opts.input);
  if (!parsed.success) return { ok: false, reason: 'invalid', fields: fieldErrors(parsed.error) };
  const [saved] = await db.select({ countryCode: organizations.countryCode, street: organizations.addressLine1, pin: organizations.pin }).from(organizations).where(eq(organizations.id, opts.organizationId));
  if (!saved) return { ok: false, reason: 'not_found' };
  const shop = await withShopPin(parsed.data, saved.countryCode, saved);
  try {
    return await db.transaction(async (tx) => {
      const org = await lockAs(tx, opts.userId, opts.organizationId, ['owner']);
      if (!org) return { ok: false, reason: 'not_found' };
      const built = await columns(tx, org.countryCode, { ...shop.input, legalLater: false }, shop.pinFound);
      if ('error' in built) return { ok: false, reason: built.error, fields: built.fields };
      // Once complete, the Impressum stays: the business's live listings depend on it (./limits.ts)
      if (legalComplete(org) && !legalComplete(built.values)) return { ok: false, reason: 'legal_incomplete', fields: { legalName: 'required' } };
      // Changing the legal details sends a verified business back to unverified
      const legalChanged = org.legalName !== built.values.legalName || org.registrationNumber !== built.values.registrationNumber || org.vatId !== built.values.vatId;
      await tx
        .update(organizations)
        .set({ ...built.values, ...(legalChanged && org.verificationStatus === 'verified' ? { verificationStatus: 'unverified' as const, verifiedAt: null, verifiedByUserId: null } : {}) })
        .where(eq(organizations.id, org.id));
      if (parsed.data.logoUpload && ownLogoUpload(opts.userId, parsed.data.logoUpload)) await queueLogo(tx, org.id, parsed.data.logoUpload);
      else if (parsed.data.removeLogo) await removeLogo(tx, org);
      return { ok: true };
    });
  } catch (e) {
    if (uniqueViolation(e)?.includes('vat')) return { ok: false, reason: 'vat_taken', fields: { vatId: 'taken' } };
    throw e;
  }
}

/** The business, locked, if the user is a member with one of these roles and it is active */
export async function lockAs(tx: Queryable, userId: string, organizationId: string, roles: readonly Role[]): Promise<Organization | null> {
  const [row] = await tx
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizations)
    .innerJoin(organizationMembers, and(eq(organizationMembers.organizationId, organizations.id), eq(organizationMembers.userId, userId)))
    .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'active')))
    .for('update', { of: organizations });
  return row && roles.includes(row.role) ? row.org : null;
}

/** The user's role in the business, or null (also for a suspended or deleted business) */
export async function roleIn(db: Queryable, userId: string, organizationId: string): Promise<Role | null> {
  const [row] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId), eq(organizations.status, 'active')));
  return row?.role ?? null;
}

/** The businesses the user belongs to, for the "post as" choice and /business */
export async function myBusinesses(db: Queryable, userId: string) {
  return db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      role: organizationMembers.role,
      verificationStatus: organizations.verificationStatus,
      countryCode: organizations.countryCode,
      // The Impressum is complete: its listings may go live (./limits.ts)
      legal: sql<boolean>`(${organizations.legalName} IS NOT NULL AND ${organizations.legalForm} IS NOT NULL AND ${organizations.addressLine1} IS NOT NULL AND ${organizations.postalCode} IS NOT NULL AND ${organizations.email} IS NOT NULL)`,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.userId, userId), eq(organizations.status, 'active')))
    .orderBy(asc(organizations.name));
}

/** A business by its slug, for its page; suspended and deleted ones aren't found */
export async function businessBySlug(db: Queryable, slug: string) {
  if (!SLUG.test(slug)) return null;
  const [org] = await db
    .select({
      org: organizations,
      cityFa: sql<string | null>`(SELECT name_fa FROM locations c WHERE c.id = ${organizations.locationId})`,
      // The town of the postal code (the Impressum is in German), else the city's local name
      cityLocal: sql<string | null>`coalesce(${organizations.placeName}, (SELECT name_local FROM locations c WHERE c.id = ${organizations.locationId}))`,
      // The page's «الان باز است» is read in the city's time; «شارلوتنبورگ، برلین» from the point
      timeZone: sql<string | null>`(SELECT timezone FROM locations c WHERE c.id = ${organizations.locationId})`,
      neighbourhood: sql<string | null>`(SELECT n.name_fa FROM neighbourhoods n
        WHERE n.location_id = ${organizations.locationId} AND n.is_active AND ${organizations.postalCode} IS NOT NULL AND ST_Covers(n.boundary, ${organizations.point})
        ORDER BY n.key LIMIT 1)`,
      /** Made by a test account: the page shows it only to staff and test accounts */
      testOwner: testOwned(organizations.createdByUserId),
    })
    .from(organizations)
    .where(and(eq(organizations.slug, slug), eq(organizations.status, 'active')));
  return org ?? null;
}

/**
 * Verification (the «تأییدشده» badge) is set by the site owner only: today by
 * scripts/verify-business.ts as classifieds_owner, later from the admin page (roadmap step 8).
 * Never by the business itself; editing the legal details clears it again.
 */
export async function setVerification(db: Queryable, opts: { slug: string; status: 'verified' | 'rejected' | 'unverified'; byUserId: string | null; staff?: StaffContext; note?: string }) {
  const [org] = await db
    .update(organizations)
    .set({ verificationStatus: opts.status, verifiedAt: opts.status === 'verified' ? new Date() : null, verifiedByUserId: opts.status === 'verified' ? opts.byUserId : null })
    .where(eq(organizations.slug, opts.slug))
    .returning({ id: organizations.id });
  if (!org) return null;
  // From the admin page with the session and IP; from the script as the owner
  if (opts.staff) await staffAudit(db, opts.staff, 'organization.verification', { type: 'organization', id: org.id }, { status: opts.status, ...(opts.note ? { note: opts.note } : {}) });
  else await db.insert(auditLog).values({ actorType: 'staff', actorUserId: opts.byUserId, action: 'organization.verification', targetType: 'organization', targetId: org.id, data: { status: opts.status } });
  // The owner is always told, both ways (./notices.ts)
  await queueBusinessNotice(db, org.id, opts.status);
  return org.id;
}
