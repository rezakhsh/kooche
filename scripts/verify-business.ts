// Sets a business's verification (the «کسب‌وکار تأییدشده» badge) after the site owner has checked
// its legal details against the register or trade licence (roadmap step 6). Runs as
// classifieds_owner until the admin page (roadmap step 8) takes this over; writes audit_log.
//
//   MIGRATION_DATABASE_URL=… npx tsx scripts/verify-business.ts <slug> verified|rejected|unverified

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { setVerification } from '../src/modules/organizations/organizations';

const url = process.env.MIGRATION_DATABASE_URL;
const [slug, status] = process.argv.slice(2);
if (!url || !slug || !['verified', 'rejected', 'unverified'].includes(status ?? '')) {
  throw new Error('usage: MIGRATION_DATABASE_URL=… npx tsx scripts/verify-business.ts <slug> verified|rejected|unverified');
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const id = await drizzle(sql, { schema }).transaction((tx) => setVerification(tx, { slug, status: status as 'verified', byUserId: null }));
  console.log(id ? `${slug}: ${status}` : `${slug}: no such business`);
} finally {
  await sql.end();
}
