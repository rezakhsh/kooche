import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('./migrations', import.meta.url));

/**
 * Applies all pending migrations as classifieds_owner, in one transaction. Returns the tags of
 * the migrations it applied (empty when the database was already up to date).
 */
export async function runMigrations(url: string): Promise<string[]> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const before = await appliedCount(client);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    const after = await appliedCount(client);
    const journal = JSON.parse(readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8')) as {
      entries: { tag: string }[];
    };
    return journal.entries.slice(before, after).map((e) => e.tag);
  } finally {
    await client.end();
  }
}

/** Rows in Drizzle's bookkeeping table; 0 before the first migration creates it. */
async function appliedCount(client: postgres.Sql): Promise<number> {
  const [table] = await client`SELECT to_regclass('drizzle.__drizzle_migrations') AS t`;
  if (!table?.t) return 0;
  const [row] = await client<{ n: number }[]>`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
  return row?.n ?? 0;
}

// `npm run db:migrate`, and the `migrate` Docker target (bundled to migrate.js, docs/setup.md).
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set');
  const applied = await runMigrations(url);
  console.log(applied.length ? `Migrations applied: ${applied.join(', ')}` : 'No pending migrations');
}
