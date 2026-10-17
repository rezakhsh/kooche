import { sql, type SQL } from 'drizzle-orm';
import { jsonb, timestamp, uuid, type PgColumn } from 'drizzle-orm/pg-core';

// Shared column builders and CHECK helpers (docs/schema.md, section 2).
// Every column is NOT NULL unless the doc marks it null, so each builder below ends in .notNull()
// or is explicitly left nullable.

export const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const id = () => uuid('id').primaryKey().default(sql`uuidv7()`);
export const createdAt = () => tstz('created_at').notNull().defaultNow();
/** Kept current by the set_updated_at() trigger (migration 0002), not by Drizzle. */
export const updatedAt = () => tstz('updated_at').notNull().defaultNow();

/** id, created_at, updated_at */
export const standardColumns = () => ({ id: id(), createdAt: createdAt(), updatedAt: updatedAt() });
/** id, created_at, for tables the doc marks "no updated_at" */
export const insertOnlyColumns = () => ({ id: id(), createdAt: createdAt() });

export const jsonObject = (name: string) => jsonb(name).notNull().default(sql`'{}'::jsonb`);

/** A SQL string literal. Only for constants written in this codebase, never for input. */
export function lit(value: string): SQL {
  return sql.raw(`'${value.replaceAll("'", "''")}'`);
}

export function isIn(column: PgColumn, values: readonly string[]): SQL {
  return sql`${column} IN (${sql.join(values.map(lit), sql`, `)})`;
}

export function matches(column: PgColumn, regex: string): SQL {
  return sql`${column} ~ ${lit(regex)}`;
}

export function isObject(column: PgColumn): SQL {
  return sql`jsonb_typeof(${column}) = 'object'`;
}

export function textArrayWithin(column: PgColumn, values: readonly string[]): SQL {
  return sql`${column} <@ ARRAY[${sql.join(values.map(lit), sql`, `)}]::text[]`;
}

export const PATTERNS = {
  /** 10 characters of lowercase Crockford base32 */
  publicToken: '^[0-9a-hjkmnp-tv-z]{10}$',
  slug: '^[a-z0-9]+(-[a-z0-9]+)*$',
  /** Postal codes as GeoNames writes them: 12045 (DE), 1100 (AT), SW1A 1AA (GB) */
  postalCode: '^[0-9A-Z][0-9A-Z -]{1,9}$',
  phone: '^\\+[1-9][0-9]{6,14}$',
  attributeKey: '^[a-z][a-z0-9_]{0,39}$',
  /** Same as attributeKey, hyphens allowed */
  optionValue: '^[a-z][a-z0-9_-]{0,39}$',
  /** listing.published, staff.role_changed */
  dottedName: '^[a-z_]+\\.[a-z_]+$',
} as const;
