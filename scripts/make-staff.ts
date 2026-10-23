// Makes an account staff, or takes the role away (roadmap step 8; docs/setup.md, "Admin page").
// The only way to make an admin. Runs as classifieds_owner and writes audit_log
// (staff.role_changed). The person sets up two-factor on their first visit to the admin page.
//
//   MIGRATION_DATABASE_URL=… npx tsx scripts/make-staff.ts <email> admin|moderator|none
//   MIGRATION_DATABASE_URL=… npx tsx scripts/make-staff.ts <email> --reset-2fa   (lost phone and backup codes)

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { resetTwoFactor, setStaffRole } from '../src/modules/admin/staff';

const url = process.env.MIGRATION_DATABASE_URL;
const [email, role] = process.argv.slice(2);
if (url && email && role === '--reset-2fa') {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const r = await drizzle(sql, { schema }).transaction((tx) => resetTwoFactor(tx, email));
    console.log(r.ok ? `${email}: two-factor reset; set it up again on the next visit to the admin page` : `${email}: no account with this email`);
    if (!r.ok) process.exitCode = 1;
  } finally {
    await sql.end();
  }
  process.exit();
}
if (!url || !email || !['admin', 'moderator', 'none'].includes(role ?? '')) {
  throw new Error('usage: MIGRATION_DATABASE_URL=… npx tsx scripts/make-staff.ts <email> admin|moderator|none');
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const result = await drizzle(sql, { schema }).transaction((tx) =>
    setStaffRole(tx, { email, role: role === 'none' ? null : (role as 'admin' | 'moderator'), by: null }),
  );
  if (!result.ok) {
    console.error(`${email}: ${{ not_found: 'no account with this email', inactive: 'account is not active', not_allowed: 'not allowed', unchanged: 'already has this role' }[result.reason]}`);
    process.exitCode = 1;
  } else {
    console.log(`${email}: ${result.from ?? 'none'} → ${result.to ?? 'none'}`);
    if (result.to) console.log('Next: open the admin page (https://<host>/<ADMIN_PATH>) signed in as this account and set up two-factor.');
  }
} finally {
  await sql.end();
}
