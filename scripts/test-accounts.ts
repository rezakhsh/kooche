// Creates or updates the test accounts (wave 2 part 1, owner Oct 28, 2026; docs/setup.md, "Test
// accounts"): one per country in the launch plan, <name>@<domain>, each with a verified number of
// its own country, its biggest city as home, and a negative Telegram placeholder that routes its
// Telegram messages to the owner (src/modules/users/test-accounts.ts). `--personal` marks a real
// person's own existing account as a test account too (the owner's Iran account): it keeps its own
// email, Telegram and normal sign-in. Runs as classifieds_owner; safe to run again.
//
//   MIGRATION_DATABASE_URL=… npx tsx scripts/test-accounts.ts --domain=<domain> [--personal=<email>] [--dry]

import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { normalizePersian } from '../src/lib/normalize-persian';
import { publicToken } from '../src/lib/tokens';
import { checkVerifiedNumber } from '../src/modules/users/phone-number';

/**
 * The launch plan's countries (docs/design-options.md, round 11 calendar), Turkey included as a
 * guide. Numbers: the ranges kept for films where the library knows them (US, Canada, Australia),
 * otherwise a number from an unused block; the next one is tried when a number is taken.
 */
const ACCOUNTS = [
  { name: 'germany', country: 'DE', phone: '+4915100000101' },
  { name: 'austria', country: 'AT', phone: '+436640000101' },
  { name: 'netherlands', country: 'NL', phone: '+31600000101' },
  { name: 'uk', country: 'GB', phone: '+447700000101' },
  { name: 'canada', country: 'CA', phone: '+14165550101' },
  { name: 'us', country: 'US', phone: '+12025550101' },
  { name: 'australia', country: 'AU', phone: '+61491570101' },
  { name: 'italy', country: 'IT', phone: '+393401000101' },
  { name: 'sweden', country: 'SE', phone: '+46700000101' },
  { name: 'france', country: 'FR', phone: '+33639980101' },
  { name: 'turkey', country: 'TR', phone: '+905000000101' },
] as const;

/** «آزمایشی · اتریش»: the badge and the mark on what is forwarded to the owner */
const PREFIX = 'آزمایشی';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = process.env.MIGRATION_DATABASE_URL;
const domain = arg('domain');
const personal = arg('personal')?.toLowerCase();
const dry = process.argv.includes('--dry');
if (!url || !domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
  throw new Error('usage: MIGRATION_DATABASE_URL=… npx tsx scripts/test-accounts.ts --domain=<domain> [--personal=<email>] [--dry]');
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

/** The given number, or the next free one after it (the last digits counted up) */
async function freeNumber(tx: postgres.TransactionSql, first: string, userId: string | null): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const n = `${first.slice(0, -4)}${String(Number(first.slice(-4)) + i).padStart(4, '0')}`;
    const check = checkVerifiedNumber(n);
    if (!check.ok) continue;
    const [taken] = await tx`SELECT id FROM users WHERE phone_e164 = ${n} AND id IS DISTINCT FROM ${userId}`;
    if (!taken) return n;
  }
  throw new Error(`no free number near ${first}`);
}

try {
  await sql.begin(async (tx) => {
    for (const [i, a] of ACCOUNTS.entries()) {
      const email = `${a.name}@${domain}`;
      const [country] = await tx<{ name_fa: string }[]>`SELECT name_fa FROM countries WHERE code = ${a.country}`;
      if (!country) throw new Error(`country ${a.country} is not seeded`);
      const [city] = await tx<{ id: string; name_fa: string }[]>`
        SELECT id, name_fa FROM locations WHERE country_code = ${a.country} AND kind = 'city'
        ORDER BY population DESC NULLS LAST, slug LIMIT 1`;
      const name = `${PREFIX} · ${country.name_fa}`;
      // Real Telegram user ids are positive; the worker forwards these to the owner
      const telegram = -(1000 + i);
      const [found] = await tx<{ id: string; phone_e164: string | null }[]>`SELECT id, phone_e164 FROM users WHERE email = ${email}`;

      let id = found?.id ?? null;
      if (!id) {
        const [row] = await tx<{ id: string }[]>`
          INSERT INTO users (public_token, email, email_verified, display_name, display_name_normalized, telegram_user_id, home_location_id, test_account)
          VALUES (${publicToken()}, ${email}, true, ${name}, ${normalizePersian(name)}, ${telegram}, ${city?.id ?? null}, 'country')
          RETURNING id`;
        id = row!.id;
      } else {
        await tx`
          UPDATE users SET test_account = 'country', display_name = ${name}, display_name_normalized = ${normalizePersian(name)},
            telegram_user_id = coalesce(telegram_user_id, ${telegram}), home_location_id = coalesce(home_location_id, ${city?.id ?? null}),
            updated_at = now()
          WHERE id = ${id}`;
      }

      let phone = found?.phone_e164 ?? null;
      if (!phone) {
        phone = await freeNumber(tx, a.phone, id);
        const now = new Date();
        await tx`
          INSERT INTO phone_verifications (user_id, method, status, phone_e164, link_token_hash, telegram_user_id, number_country, expires_at, verified_at)
          VALUES (${id}, 'telegram', 'verified', ${phone}, ${randomBytes(32)}, ${telegram}, ${a.country}, ${now}, ${now})`;
        await tx`UPDATE users SET phone_e164 = ${phone}, phone_verified_at = ${now}, phone_verification_method = 'telegram' WHERE id = ${id}`;
      }
      await tx`
        INSERT INTO audit_log (actor_type, action, target_type, target_id, data)
        VALUES ('system', 'user.test_account', 'user', ${id}, ${tx.json({ kind: 'country', country: a.country })})`;
      console.log(`${email}: ${found ? 'updated' : 'created'}, ${a.country}, home ${city?.name_fa ?? '—'}, number ${phone.slice(0, 4)}…${phone.slice(-2)}`);
    }

    if (personal) {
      const [u] = await tx<{ id: string }[]>`
        UPDATE users SET test_account = 'personal', updated_at = now() WHERE email = ${personal} AND status = 'active' RETURNING id`;
      if (!u) throw new Error(`no active account with the email given for --personal`);
      await tx`
        INSERT INTO audit_log (actor_type, action, target_type, target_id, data)
        VALUES ('system', 'user.test_account', 'user', ${u.id}, ${tx.json({ kind: 'personal' })})`;
      console.log(`--personal: marked as a test account (own email, Telegram and sign-in)`);
    }
    if (dry) throw new Error('dry run: rolled back');
  });
} catch (e) {
  if (!(dry && e instanceof Error && e.message === 'dry run: rolled back')) throw e;
  console.log('dry run: nothing saved');
} finally {
  await sql.end();
}
