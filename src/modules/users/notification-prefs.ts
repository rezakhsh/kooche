import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';

// users.notification_prefs (jsonb, docs/schema.md section 6), validated here on every read and
// write. Two switches, each on unless turned off: notices about new chat messages, and new
// listings for saved searches (each search also has its own frequency).

const prefsSchema = z.object({ chat: z.boolean().optional(), savedSearches: z.boolean().optional() });
export type NotificationPrefs = z.infer<typeof prefsSchema>;

export function parsePrefs(value: unknown): NotificationPrefs {
  const parsed = prefsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function chatNoticesOn(value: unknown): boolean {
  return parsePrefs(value).chat !== false;
}

export function savedSearchAlertsOn(value: unknown): boolean {
  return parsePrefs(value).savedSearches !== false;
}

export async function setChatNotices(db: Queryable, userId: string, on: boolean): Promise<void> {
  await setPrefs(db, userId, { chat: on });
}

export async function setSavedSearchAlerts(db: Queryable, userId: string, on: boolean): Promise<void> {
  await setPrefs(db, userId, { savedSearches: on });
}

async function setPrefs(db: Queryable, userId: string, change: NotificationPrefs): Promise<void> {
  const value = prefsSchema.parse(change);
  await db
    .update(users)
    .set({ notificationPrefs: sql`${users.notificationPrefs} || ${JSON.stringify(value)}::jsonb` })
    .where(eq(users.id, userId));
}
