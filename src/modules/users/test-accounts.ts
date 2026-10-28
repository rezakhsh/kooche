import { and, eq, isNotNull, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';
import type { Mail } from '../notifications/mailer';

// Test accounts (wave 2 part 1, owner Oct 28, 2026; docs/setup.md, "Test accounts"): one account
// per country in the launch plan, so the owner sees and uses the site as someone living there,
// plus the owner's own accounts kept for testing (the Iran account). Marked by users.test_account,
// which only scripts/test-accounts.ts sets.
//
// - Their listings, events, businesses and seller pages are seen only by staff and test accounts.
//   Every public query leaves them out unless the page passes `withTest` for such a viewer, so
//   forgetting it hides them rather than showing them. Sitemaps, alerts, digests, city goals and
//   the admin statistics always leave them out.
// - They can't chat with real people (staff excepted).
// - The per-country accounts have no inbox of their own: what would be emailed or sent by Telegram
//   to them goes to TEST_INBOX_EMAIL's account, marked with the account's name.

/** «آگهی آزمایشی» and the rest: the owner of this row (its user id column) is a test account */
export function testOwned(userId: AnyColumn | SQL): SQL<boolean> {
  return sql<boolean>`EXISTS (SELECT 1 FROM users tu WHERE tu.id = ${userId} AND tu.test_account IS NOT NULL)`;
}

/** The public-query condition: test content left out unless the viewer may see it */
export function hideTest(withTest: boolean | undefined, userId: AnyColumn | SQL): SQL | undefined {
  return withTest ? undefined : sql`NOT ${testOwned(userId)}`;
}

/** The same condition inside raw SQL, with `userId` a column reference such as sql`l.user_id` */
export function hideTestRaw(withTest: boolean | undefined, userId: SQL): SQL {
  return withTest ? sql`` : sql`AND NOT ${testOwned(userId)}`;
}

/** Staff and test accounts see test content */
export async function seesTestContent(db: Queryable, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const [u] = await db
    .select({ staff: users.staffRole, test: users.testAccount })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.status, 'active')));
  return !!u && (!!u.staff || !!u.test);
}

/** Whether an email belongs to a per-country test account (no inbox; the fixed code on staging) */
export async function isCountryTestEmail(db: Queryable, email: string): Promise<boolean> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), eq(users.testAccount, 'country')));
  return !!u;
}

/**
 * Whether a chat between these two would mix test and real accounts: one is a test account and
 * the other is neither a test account nor staff.
 */
export async function mixesTestAndReal(db: Queryable, a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id, staff: users.staffRole, test: users.testAccount })
    .from(users)
    .where(sql`${users.id} IN (${a}::uuid, ${b}::uuid)`);
  const x = rows.find((r) => r.id === a);
  const y = rows.find((r) => r.id === b);
  if (!x || !y) return false;
  const real = (r: typeof x) => !r.test && !r.staff;
  return (!!x.test && real(y)) || (!!y.test && real(x));
}

/** The line that marks a forwarded message: «[آزمایشی · اتریش]» (the account's display name) */
const mark = (name: string) => `[${name}]`;

/**
 * Where a per-country test account's notices go: TEST_INBOX_EMAIL's account (the owner's), by email
 * and by its Telegram. Without an inbox they are dropped. Everyone else's are left as they are.
 */
export function testInbox(db: Queryable, inboxEmail: string | undefined) {
  async function inbox() {
    if (!inboxEmail) return null;
    const [u] = await db
      .select({ email: users.email, telegramUserId: users.telegramUserId })
      .from(users)
      .where(and(eq(users.email, inboxEmail.toLowerCase()), eq(users.status, 'active')));
    return u ?? null;
  }

  return {
    /** The mail as it should go out, or null to drop it */
    async mail(m: Mail): Promise<Mail | null> {
      const [t] = await db
        .select({ name: users.displayName })
        .from(users)
        .where(and(eq(users.email, m.to.toLowerCase()), eq(users.testAccount, 'country')));
      if (!t) return m;
      const to = await inbox();
      if (!to) return null;
      return { ...m, to: to.email, subject: `${mark(t.name)} ${m.subject}` };
    },

    /** The chat and text a Telegram message should go to, or null to drop it */
    async chat(chatId: number, text: string): Promise<{ chatId: number; text: string } | null> {
      // Per-country test accounts hold a negative placeholder (real Telegram users are positive)
      if (chatId >= 0) return { chatId, text };
      const [t] = await db
        .select({ name: users.displayName })
        .from(users)
        .where(and(eq(users.telegramUserId, chatId), eq(users.testAccount, 'country'), isNotNull(users.telegramUserId)));
      if (!t) return { chatId, text };
      const to = await inbox();
      if (!to?.telegramUserId) return null;
      return { chatId: to.telegramUserId, text: `${mark(t.name)}\n${text}` };
    },
  };
}

export type TestInbox = ReturnType<typeof testInbox>;
