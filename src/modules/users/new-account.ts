// Accounts in their first 7 days get tighter limits (docs/setup.md, "Bot protection"): fewer
// listings, events, photos and new chats, and no links or IBANs in chat. Counted from
// users.created_at, the same rule everywhere.

export const NEW_ACCOUNT_DAYS = 7;

const DAY_MS = 86_400_000;

export function isNewAccount(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < NEW_ACCOUNT_DAYS * DAY_MS;
}
