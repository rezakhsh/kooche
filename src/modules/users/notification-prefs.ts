import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';

// users.notification_prefs (jsonb, docs/schema.md section 6), validated here on every read and
// write. Today one switch: notices about new chat messages, on unless turned off.

const prefsSchema = z.object({ chat: z.boolean().optional() });
export type NotificationPrefs = z.infer<typeof prefsSchema>;

export function parsePrefs(value: unknown): NotificationPrefs {
  const parsed = prefsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function chatNoticesOn(value: unknown): boolean {
  return parsePrefs(value).chat !== false;
}

export async function setChatNotices(db: Queryable, userId: string, on: boolean): Promise<void> {
  const value = prefsSchema.parse({ chat: on });
  await db
    .update(users)
    .set({ notificationPrefs: sql`${users.notificationPrefs} || ${JSON.stringify(value)}::jsonb` })
    .where(eq(users.id, userId));
}
