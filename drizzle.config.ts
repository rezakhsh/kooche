import { defineConfig } from 'drizzle-kit';

// Migrations run as classifieds_owner, never as the app or worker role.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
