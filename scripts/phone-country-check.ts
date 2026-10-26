// Counts the verified numbers that the wave 0 country rule (checkVerifiedNumber() in
// src/modules/users/phone-number.ts) would refuse today: +98, +888 and countries outside
// seed/countries.ts. Read-only, and prints countries and counts only, never a number. A refused
// number stays on its account; what to do with one is the owner's decision.
//
//   DATABASE_URL=… npx tsx scripts/phone-country-check.ts      (classifieds_readonly is enough)

import postgres from 'postgres';
import { checkVerifiedNumber } from '../src/modules/users/phone-number';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('usage: DATABASE_URL=… npx tsx scripts/phone-country-check.ts');
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const rows = await sql<{ phone: string }[]>`
    SELECT phone_e164 AS phone FROM users WHERE phone_e164 IS NOT NULL AND status <> 'deleted'`;
  const refused = new Map<string, number>();
  for (const { phone } of rows) {
    const check = checkVerifiedNumber(phone);
    if (check.ok) continue;
    const key = `${check.reason} ${check.country ?? '-'}`;
    refused.set(key, (refused.get(key) ?? 0) + 1);
  }
  console.log(`verified numbers: ${rows.length}, refused by the country rule: ${[...refused.values()].reduce((a, b) => a + b, 0)}`);
  for (const [key, n] of [...refused].sort()) console.log(`  ${key}: ${n}`);
} finally {
  await sql.end();
}
