import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { appSql } from './client';

// Drizzle on top of the app's postgres.js pool (src/db/client.ts). Module code takes a `Db` as a
// parameter, so the same functions run in the web app, the worker and the tests.

export type Db = PostgresJsDatabase<typeof schema>;
/** A database or a transaction: anything that can run queries */
export type Queryable = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

const globalForDrizzle = globalThis as typeof globalThis & { appDb?: Db };

/** The Next.js app's Drizzle instance, as classifieds_app. Server code only. */
export function appDb(): Db {
  return (globalForDrizzle.appDb ??= drizzle(appSql(), { schema }));
}
