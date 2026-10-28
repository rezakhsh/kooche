'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '../db/drizzle';
import { auditLog, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { clientIp } from '../lib/client-ip';
import { webEnv } from '../lib/env';
import { adminAddress } from '../modules/admin/gate';
import { readViewAs, VIEW_AS_COOKIE } from '../modules/admin/view-as';
import { auth } from '../modules/users/server';

/**
 * «پایان» on the view-as banner (src/modules/admin/view-as.ts): removes the cookie and goes back to
 * the admin page. Posted from a public page, where currentSession() hides the account, so it asks
 * Better Auth for the real one. Removing the cookie needs nothing; the audit row needs staff.
 */
export async function endViewAsAction(): Promise<void> {
  const env = webEnv();
  const jar = await cookies();
  const country = readViewAs(jar.get(VIEW_AS_COOKIE)?.value, env.AUTH_SECRET);
  jar.delete(VIEW_AS_COOKIE);
  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  const db = appDb();
  const [staff] = session ? await db.select({ role: users.staffRole }).from(users).where(eq(users.id, session.user.id)) : [];
  if (!session || !staff?.role || !env.ADMIN_PATH) redirect('/');
  if (country) {
    await db.insert(auditLog).values({
      actorType: 'staff',
      actorUserId: session.user.id,
      action: 'staff.view_as_ended',
      ipAddress: clientIp(h),
      userAgent: h.get('user-agent'),
      data: { country },
    });
  }
  redirect(adminAddress(env.ADMIN_PATH, '/users/view-as'));
}
