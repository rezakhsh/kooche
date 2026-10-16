import postgres from 'postgres';
import { runMigrations } from '../src/db/migrate';
import { runSeed } from '../src/db/seed';

// Every test run starts from an empty database: created from the bootstrap template (which only
// has postgis), then every migration and the seed. So each run also proves that the migrations
// apply cleanly to an empty database.
//
// TEST_DATABASE_URL connects as classifieds_owner to a database whose name ends in _test.
// That database is dropped and recreated on every run.

const TEMPLATE = 'classifieds_template'; // created by src/db/bootstrap/01-classifieds.sh

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  const dbName = new URL(url).pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL must name a database ending in _test, got "${dbName}"`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${dbName}" TEMPLATE ${TEMPLATE}`);
  } finally {
    await admin.end();
  }

  await runMigrations(url);
  await runSeed(url);

  // The grant tests switch roles with SET LOCAL ROLE. The owner created these roles (migration
  // 0003), so it holds ADMIN OPTION on them and can grant itself SET (but not INHERIT).
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await db.unsafe(
      'GRANT classifieds_app, classifieds_worker, classifieds_readonly TO CURRENT_USER WITH INHERIT FALSE, SET TRUE',
    );
  } finally {
    await db.end();
  }
}
