import { and, eq, sql, TransactionRollbackError } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomInt } from 'node:crypto';
import { afterAll, expect } from 'vitest';
import { normalizePersian } from '../src/lib/normalize-persian';
import * as schema from '../src/db/schema';

// Test helpers: one connection to the test database (as classifieds_owner), transactions that
// always roll back, role switching and small fixtures.

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is not set');

export const client = postgres(url, { max: 2, onnotice: () => {} });
export const db = drizzle(client, { schema });
afterAll(() => client.end());

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Role = 'classifieds_app' | 'classifieds_worker' | 'classifieds_readonly';

/** Runs fn in a transaction that is always rolled back, so tests never leave rows behind. */
export async function rollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (e) {
    if (!(e instanceof TransactionRollbackError)) throw e;
  }
}

export async function setRole(tx: Tx, role: Role): Promise<void> {
  await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`));
}

/** The SQLSTATE of a database error, unwrapping Drizzle's query error */
export function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.cause?.code ?? err?.code;
}

/** Expects the statement to fail with the given SQLSTATE. The transaction is aborted afterwards. */
export async function expectError(promise: PromiseLike<unknown>, code: string): Promise<void> {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, `expected SQLSTATE ${code}, but the statement succeeded`).toBeDefined();
  expect(pgCode(error), String((error as Error)?.message)).toBe(code);
}

export const INSUFFICIENT_PRIVILEGE = '42501';
export const CHECK_VIOLATION = '23514';
export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';
export const RESTRICT_VIOLATION = '23001';
export const RAISE_EXCEPTION = 'P0001';

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
export function publicToken(): string {
  return Array.from({ length: 10 }, () => CROCKFORD[randomInt(32)]).join('');
}

export async function makeUser(tx: Tx, values: Partial<typeof schema.users.$inferInsert> = {}) {
  const token = publicToken();
  const displayName = values.displayName ?? 'کاربر آزمایشی';
  const [user] = await tx
    .insert(schema.users)
    .values({
      publicToken: token,
      email: `user-${token}@example.test`,
      displayName,
      displayNameNormalized: normalizePersian(displayName),
      ...values,
    })
    .returning();
  return user!;
}

/** A location by slug. A city and its Land can share a slug (berlin), so the kind matters. */
export async function location(tx: Tx, slug: string, kind: 'city' | 'region' = 'city') {
  const [row] = await tx
    .select()
    .from(schema.locations)
    .where(and(eq(schema.locations.slug, slug), eq(schema.locations.kind, kind)));
  if (!row) throw new Error(`No location ${slug}`);
  return row;
}

export async function category(tx: Tx, slug: string) {
  const [row] = await tx.select().from(schema.categories).where(eq(schema.categories.slug, slug));
  if (!row) throw new Error(`No category ${slug}`);
  return row;
}

/** An active listing for a phone in Berlin, unless values say otherwise */
export async function makeListing(
  tx: Tx,
  userId: string,
  values: Partial<typeof schema.listings.$inferInsert> = {},
) {
  const berlin = await location(tx, 'berlin');
  const phones = await category(tx, 'mobile-phones');
  const now = new Date();
  const [listing] = await tx
    .insert(schema.listings)
    .values({
      publicToken: publicToken(),
      userId,
      categoryId: phones.id,
      title: 'گوشی آزمایشی',
      titleNormalized: normalizePersian('گوشی آزمایشی'),
      priceType: 'fixed',
      priceMinor: 25_000,
      currency: 'EUR',
      countryCode: 'DE',
      locationId: berlin.id,
      point: berlin.center,
      locationPrecision: 'city',
      status: 'active',
      publishedAt: now,
      rankedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
      ...values,
    })
    .returning();
  return listing!;
}

export async function makeOrganization(tx: Tx, ownerUserId: string) {
  const slug = `org-${publicToken()}`;
  const [org] = await tx
    .insert(schema.organizations)
    .values({
      slug,
      name: 'کسب‌وکار آزمایشی',
      nameNormalized: normalizePersian('کسب‌وکار آزمایشی'),
      countryCode: 'DE',
      createdByUserId: ownerUserId,
    })
    .returning();
  await tx
    .insert(schema.organizationMembers)
    .values({ organizationId: org!.id, userId: ownerUserId, role: 'owner' });
  return org!;
}

/** A one-time product with an active EUR price */
export async function makeProduct(tx: Tx) {
  const [product] = await tx
    .insert(schema.products)
    .values({
      code: `bump-${publicToken()}`,
      nameFa: 'نردبان',
      descriptionFa: 'آگهی به بالای فهرست می‌رود',
      kind: 'one_time',
      entitlementType: 'bump',
      appliesTo: 'listing',
      bumpCount: 1,
    })
    .returning();
  const [price] = await tx
    .insert(schema.productPrices)
    .values({
      productId: product!.id,
      currency: 'EUR',
      amountMinor: 299,
      providerPriceId: `price_${publicToken()}`,
    })
    .returning();
  return { product: product!, price: price! };
}
