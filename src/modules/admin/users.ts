import { and, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { listings, organizations, outboxEvents, sessions, users } from '../../db/schema';
import { normalizePersian } from '../../lib/normalize-persian';
import { describeDevice } from '../../lib/user-agent';
import { staffAudit, type StaffContext } from './audit';

// Users, listings and businesses on the admin page (roadmap step 8): search, details, sessions,
// signing someone out everywhere and releasing a phone number (docs/schema.md, decision 16.4:
// support can free a number another account verified, so its new owner can verify it).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[0-9a-hjkmnp-tv-z]{10}$/;

/** Persian and Arabic digits to Latin */
const latin = (s: string) => s.replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) - (d >= '۰' ? 0x06f0 : 0x0660)));

/** `testOnly`: only test accounts (src/modules/users/test-accounts.ts), all of them without a query */
export async function searchUsers(db: Queryable, q: string, opts: { withContact: boolean; testOnly?: boolean }) {
  const text = latin(q.trim());
  const conds: SQL[] = [];
  if (UUID.test(text)) conds.push(eq(users.id, text));
  if (TOKEN.test(text)) conds.push(eq(users.publicToken, text));
  // Email and phone only for those who may see them (admins)
  if (opts.withContact && text.includes('@')) conds.push(ilike(users.email, `%${text.replace(/[%_\\]/g, '')}%`));
  const digits = text.replace(/[\s()-]/g, '');
  if (opts.withContact && /^\+?\d{6,15}$/.test(digits)) conds.push(ilike(users.phoneE164, `%${digits.replace(/^\+/, '').replace(/^0+/, '')}`));
  if (text.length >= 2) conds.push(ilike(users.displayNameNormalized, `%${normalizePersian(text).replace(/[%_\\]/g, '')}%`));
  return db
    .select({
      id: users.id,
      name: users.displayName,
      email: users.email,
      status: users.status,
      staffRole: users.staffRole,
      testAccount: users.testAccount,
      createdAt: users.createdAt,
      phoneVerified: sql<boolean>`${users.phoneVerifiedAt} IS NOT NULL`,
      live: sql<number>`(SELECT count(*)::int FROM listings l WHERE l.user_id = ${users.id} AND l.status = 'active')`,
    })
    .from(users)
    .where(and(conds.length ? or(...conds) : sql`true`, opts.testOnly ? isNotNull(users.testAccount) : undefined))
    .orderBy(desc(users.createdAt))
    .limit(50);
}

export async function sessionsOf(db: Queryable, userId: string) {
  const rows = await db
    .select({ id: sessions.id, createdAt: sessions.createdAt, updatedAt: sessions.updatedAt, expiresAt: sessions.expiresAt, ip: sessions.ipAddress, userAgent: sessions.userAgent, staffVerifiedAt: sessions.staffVerifiedAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), sql`${sessions.expiresAt} > now()`))
    .orderBy(desc(sessions.updatedAt));
  return rows.map((r) => ({ ...r, device: describeDevice(r.userAgent) }));
}

export async function signOutEverywhere(db: Db, staff: StaffContext, userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const gone = await tx.delete(sessions).where(eq(sessions.userId, userId)).returning({ id: sessions.id });
    await staffAudit(tx, staff, 'user.signed_out', { type: 'user', id: userId }, { sessions: gone.length });
    return gone.length;
  });
}

/** Frees the account's verified number; the person is told by email (outbox `user.phone_released`) */
export async function releasePhone(db: Db, staff: StaffContext, userId: string, note: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ phone: users.phoneE164 }).from(users).where(eq(users.id, userId)).for('update');
    if (!u?.phone) return false;
    await tx.update(users).set({ phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null }).where(eq(users.id, userId));
    // The number itself stays out of the audit row; its last digits are enough to find it again
    await staffAudit(tx, staff, 'user.phone_released', { type: 'user', id: userId }, { last4: u.phone.slice(-4), note: note.trim() || null });
    await tx.insert(outboxEvents).values({ eventType: 'user.phone_released', aggregateType: 'user', aggregateId: userId, payload: {} });
    return true;
  });
}

/** Viewing someone's email and phone is written down (staff.contact_viewed) */
export async function contactViewed(db: Db, staff: StaffContext, userId: string): Promise<void> {
  await db.transaction((tx) => staffAudit(tx, staff, 'staff.contact_viewed', { type: 'user', id: userId }));
}

export function recentListingsOf(db: Queryable, userId: string) {
  return db
    .select({ id: listings.id, title: listings.title, status: listings.status, refNumber: listings.refNumber, createdAt: listings.createdAt, organizationId: listings.organizationId })
    .from(listings)
    .where(eq(listings.userId, userId))
    .orderBy(desc(listings.createdAt))
    .limit(30);
}

export function businessesOf(db: Queryable, userId: string) {
  return db.execute<{ id: string; name: string; slug: string; status: string; role: string }>(sql`
    SELECT o.id, o.name, o.slug, o.status, m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ${userId}`);
}

/** The listings search: a code, a token, a pasted address, or words of the title */
export async function searchListingsAdmin(db: Queryable, opts: { q: string; status: string | null; country: string | null; events: boolean | null }) {
  const text = latin(opts.q.trim());
  const token = text.match(/([0-9a-hjkmnp-tv-z]{10})(?:[/?#].*)?$/)?.[1];
  const conds: SQL[] = [];
  if (/^\d{9}$/.test(text)) conds.push(eq(listings.refNumber, Number(text)));
  else if (token && (TOKEN.test(text) || text.includes('/'))) conds.push(eq(listings.publicToken, token));
  else if (UUID.test(text)) conds.push(eq(listings.id, text));
  else if (text) conds.push(ilike(listings.titleNormalized, `%${normalizePersian(text).replace(/[%_\\]/g, '')}%`));
  if (opts.status) conds.push(eq(listings.status, opts.status as 'active'));
  if (opts.country) conds.push(eq(listings.countryCode, opts.country));
  if (opts.events !== null) conds.push(sql`${opts.events ? sql`` : sql`NOT`} EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`);
  return db
    .select({
      id: listings.id,
      title: listings.title,
      status: listings.status,
      refNumber: listings.refNumber,
      countryCode: listings.countryCode,
      createdAt: listings.createdAt,
      seller: users.displayName,
      openReports: sql<number>`(SELECT count(*)::int FROM reports r WHERE r.listing_id = ${listings.id} AND r.status IN ('open', 'in_review'))`,
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(and(sql`${listings.status} <> 'draft'`, ...conds))
    .orderBy(desc(listings.createdAt))
    .limit(50);
}

/** Businesses waiting for verification (legal details given, not verified), oldest first; or all */
export function businessesAdmin(db: Queryable, opts: { waiting: boolean; q: string }) {
  const q = normalizePersian(opts.q.trim()).replace(/[%_\\]/g, '');
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      verification: organizations.verificationStatus,
      legalName: organizations.legalName,
      legalForm: organizations.legalForm,
      registerCourt: organizations.registerCourt,
      registrationNumber: organizations.registrationNumber,
      vatId: organizations.vatId,
      representative: organizations.representativeName,
      address: sql<string>`concat_ws(', ', ${organizations.addressLine1}, ${organizations.addressLine2}, concat_ws(' ', ${organizations.postalCode}, ${organizations.placeName}))`,
      countryCode: organizations.countryCode,
      website: organizations.website,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      foundingOfferedAt: organizations.foundingOfferedAt,
      businessType: organizations.businessType,
      hasDocument: sql<boolean>`${organizations.verificationDocumentKey} IS NOT NULL`,
      requestedAt: organizations.verificationRequestedAt,
      vatCheck: organizations.vatCheck,
      sanctionsCheckedAt: organizations.sanctionsCheckedAt,
    })
    .from(organizations)
    .where(
      and(
        sql`${organizations.status} <> 'deleted'`,
        opts.waiting
          ? or(
              eq(organizations.verificationStatus, 'pending'),
              and(eq(organizations.verificationStatus, 'unverified'), sql`num_nonnulls(${organizations.legalName}, ${organizations.registrationNumber}, ${organizations.vatId}) > 0`),
            )
          : sql`true`,
        q ? or(ilike(organizations.nameNormalized, `%${q}%`), ilike(organizations.slug, `%${q}%`)) : sql`true`,
      ),
    )
    // Waiting: those who asked with a document first (oldest request first), then the rest
    .orderBy(...(opts.waiting ? [sql`${organizations.verificationRequestedAt} ASC NULLS LAST`, organizations.updatedAt] : [desc(organizations.createdAt)]))
    .limit(100);
}

/**
 * The test accounts for admin › users › «دیدن سایت از نگاه دیگران» (src/modules/users/test-accounts.ts):
 * the country accounts first, in the order of their country's home city, then personal ones. The
 * email only with `withContact` (a personal test account is a real person's).
 */
export async function testAccountsAdmin(db: Queryable, opts: { withContact: boolean }) {
  const rows = await db.execute<{ id: string; name: string; email: string; kind: 'country' | 'personal'; phone: string | null; city: string | null; country: string | null }>(sql`
    SELECT u.id, u.display_name AS name, u.email, u.test_account AS kind, u.phone_e164 AS phone, c.name_fa AS city, c.country_code AS country
    FROM users u LEFT JOIN locations c ON c.id = u.home_location_id
    WHERE u.test_account IS NOT NULL AND u.status = 'active'
    ORDER BY u.test_account, u.created_at, u.id`);
  return rows.map((r) => ({ ...r, email: opts.withContact || r.kind === 'country' ? r.email : null }));
}
