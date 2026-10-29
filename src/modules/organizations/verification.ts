import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { auditLog, organizations } from '../../db/schema';
import type { ObjectStorage, PresignedPut } from '../media/storage';
import { legalComplete, VERIFICATION_DOC_KEEP_DAYS } from './organizations';

// Business verification levels (wave 2 part 4, round 11; docs/setup.md, "Private or business"):
// - 0: self-declared (unverified): a page, drafts, 3 listings once the Impressum is complete;
// - 1: «تأییدشده»: the owner asks with one document (trade registration, register extract, or the
//   licence for a licensed service) and staff decide with the free register checks: VIES for EU
//   VAT numbers automatically (VIES_URL), links to the national registers for the rest;
// - 2: level 1 plus a sanctions check, required for Turkey and the risky business types (legal and
//   finance, estate agents) before they can be verified.
// The document is uploaded straight to R2 under uploads/ (presigned PUT, like a logo), copied to a
// private key under verification/ that nothing serves publicly (staff read it through the admin
// page), and deleted 7 days after the decision. Peydoo keeps no ID copies.

export const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const DOC_KEEP_DAYS = VERIFICATION_DOC_KEEP_DAYS;
const UPLOAD_URL_SECONDS = 300;

/** EU VAT prefixes VIES knows (Greece is EL), from the business's country */
const VIES_PREFIX: Record<string, string> = {
  AT: 'AT', BE: 'BE', BG: 'BG', HR: 'HR', CY: 'CY', CZ: 'CZ', DK: 'DK', EE: 'EE', FI: 'FI', FR: 'FR', DE: 'DE', GR: 'EL', HU: 'HU', IE: 'IE', IT: 'IT', LV: 'LV',
  LT: 'LT', LU: 'LU', MT: 'MT', NL: 'NL', PL: 'PL', PT: 'PT', RO: 'RO', SK: 'SK', SI: 'SI', ES: 'ES', SE: 'SE',
};

/** Where staff check a business in its country's register (free official sources, round 11) */
export const REGISTERS: Record<string, string> = {
  DE: 'https://www.handelsregister.de/',
  AT: 'https://www.gisa.gv.at/abfrage',
  NL: 'https://www.kvk.nl/zoeken/',
  GB: 'https://find-and-update.company-information.service.gov.uk/',
  FR: 'https://annuaire-entreprises.data.gouv.fr/',
  SE: 'https://www.skatteverket.se/',
  IT: 'https://www.registroimprese.it/',
  CA: 'https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html',
  US: 'https://www.sec.gov/edgar/search/',
  AU: 'https://abr.business.gov.au/',
  TR: 'https://www.ticaretsicil.gov.tr/',
};

export type VerificationLevel = 0 | 1 | 2;

export function verificationLevel(o: { verificationStatus: string; sanctionsCheckedAt: Date | null }): VerificationLevel {
  if (o.verificationStatus !== 'verified') return 0;
  return o.sanctionsCheckedAt ? 2 : 1;
}

/** Whether verifying this business needs the sanctions check (level 2) */
export function sanctionsRequired(o: { countryCode: string; businessType: string | null }): boolean {
  return o.countryCode === 'TR' || o.businessType === 'legal_finance' || o.businessType === 'real_estate';
}

/** A one-time upload URL for the document, valid for 5 minutes */
export async function requestDocumentUpload(
  storage: ObjectStorage,
  opts: { userId: string; contentType: string; size: number },
): Promise<{ ok: true; key: string; upload: PresignedPut } | { ok: false; reason: 'bad_type' | 'too_large' }> {
  if (!(DOC_TYPES as readonly string[]).includes(opts.contentType)) return { ok: false, reason: 'bad_type' };
  if (!Number.isSafeInteger(opts.size) || opts.size <= 0 || opts.size > MAX_DOC_BYTES) return { ok: false, reason: 'too_large' };
  const key = `uploads/verification/${opts.userId}/${randomUUID()}`;
  const upload = await storage.presignPut(key, { contentType: opts.contentType, contentLength: opts.size, expiresSeconds: UPLOAD_URL_SECONDS });
  return { ok: true, key, upload };
}

const uploadPattern = (userId: string) => new RegExp(`^uploads/verification/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`);

/** The file's own type from its first bytes (the browser's Content-Type isn't trusted) */
export function sniffDocument(b: Buffer): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

export type VatCheck = { valid: boolean | null; name: string | null; checkedAt: string };

/**
 * VIES (the EU's VAT number check) for a business's VAT ID; null when it isn't an EU number or
 * VIES isn't configured. `valid: null` when VIES didn't answer (it is often down for a country).
 */
export async function checkVat(
  viesUrl: string | undefined,
  o: { countryCode: string; vatId: string | null },
  fetchFn: typeof fetch = fetch,
  now = new Date(),
): Promise<VatCheck | null> {
  const prefix = VIES_PREFIX[o.countryCode];
  if (!viesUrl || !prefix || !o.vatId) return null;
  const raw = o.vatId.replace(/[\s.-]/g, '').toUpperCase();
  const number = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!/^[0-9A-Z+*]{2,13}$/.test(number)) return { valid: false, name: null, checkedAt: now.toISOString() };
  try {
    const res = await fetchFn(viesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ countryCode: prefix, vatNumber: number }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { valid: null, name: null, checkedAt: now.toISOString() };
    const j = (await res.json()) as { valid?: unknown; name?: unknown };
    const name = typeof j.name === 'string' && j.name.trim() && j.name.trim() !== '---' ? j.name.trim().slice(0, 200) : null;
    return { valid: typeof j.valid === 'boolean' ? j.valid : null, name, checkedAt: now.toISOString() };
  } catch {
    return { valid: null, name: null, checkedAt: now.toISOString() };
  }
}

export type SubmitResult = { ok: true } | { ok: false; reason: 'not_owner' | 'legal_missing' | 'already_verified' | 'bad_file' };

/** The owner asks for verification with the uploaded document: pending, the file kept privately, VIES checked */
export async function submitVerification(
  db: Queryable,
  storage: ObjectStorage,
  opts: { userId: string; organizationId: string; uploadKey: string; viesUrl?: string; fetchFn?: typeof fetch },
  now = new Date(),
): Promise<SubmitResult> {
  const [row] = await db.execute<{ role: string | null }>(sql`
    SELECT m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id
    WHERE m.organization_id = ${opts.organizationId} AND m.user_id = ${opts.userId} AND o.status = 'active'`);
  if (row?.role !== 'owner') return { ok: false, reason: 'not_owner' };
  const [org] = await db.select().from(organizations).where(eq(organizations.id, opts.organizationId));
  if (!org) return { ok: false, reason: 'not_owner' };
  if (org.verificationStatus === 'verified') return { ok: false, reason: 'already_verified' };
  if (!legalComplete(org)) return { ok: false, reason: 'legal_missing' };
  if (!uploadPattern(opts.userId).test(opts.uploadKey)) return { ok: false, reason: 'bad_file' };
  const bytes = await storage.get(opts.uploadKey, MAX_DOC_BYTES).catch(() => null);
  const type = bytes ? sniffDocument(bytes) : null;
  if (!bytes || !type) return { ok: false, reason: 'bad_file' };
  const key = `verification/${org.id}/${randomUUID()}`;
  await storage.put(key, bytes, type);
  await storage.delete(opts.uploadKey).catch(() => undefined);
  if (org.verificationDocumentKey) await storage.delete(org.verificationDocumentKey).catch(() => undefined);
  const vat = await checkVat(opts.viesUrl, org, opts.fetchFn, now);
  await db
    .update(organizations)
    .set({ verificationStatus: 'pending', verificationDocumentKey: key, verificationRequestedAt: now, verificationDocumentDeleteAt: null, ...(vat ? { vatCheck: vat } : {}) })
    .where(eq(organizations.id, org.id));
  await db.insert(auditLog).values({ actorType: 'user', actorUserId: opts.userId, action: 'organization.verification_requested', targetType: 'organization', targetId: org.id, data: { vies: vat?.valid ?? null } });
  return { ok: true };
}

/** Admin: the document's bytes and type, while it is kept */
export async function verificationDocument(db: Queryable, storage: ObjectStorage, organizationId: string): Promise<{ bytes: Buffer; type: string } | null> {
  const [o] = await db.select({ key: organizations.verificationDocumentKey }).from(organizations).where(eq(organizations.id, organizationId));
  if (!o?.key) return null;
  const bytes = await storage.get(o.key, MAX_DOC_BYTES).catch(() => null);
  const type = bytes ? sniffDocument(bytes) : null;
  return bytes && type ? { bytes, type } : null;
}

/** Worker, daily: documents whose 7 days after the decision are over are deleted */
export async function deleteDecidedDocuments(db: Queryable, storage: ObjectStorage, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: organizations.id, key: organizations.verificationDocumentKey })
    .from(organizations)
    .where(and(isNotNull(organizations.verificationDocumentKey), lt(organizations.verificationDocumentDeleteAt, now)))
    .limit(500);
  for (const d of due) {
    await storage.delete(d.key!);
    await db.update(organizations).set({ verificationDocumentKey: null, verificationDocumentDeleteAt: null }).where(eq(organizations.id, d.id));
  }
  return due.length;
}
