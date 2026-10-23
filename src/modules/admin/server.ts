import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { appDb } from '../../db/drizzle';
import { clientIp } from '../../lib/client-ip';
import { webEnv } from '../../lib/env';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { currentSession } from '../users/server';
import { can, STAFF_LIMITS, staffState, type StaffAction, type StaffRole, type StaffState } from './access';
import type { StaffContext } from './audit';
import { ADMIN_GATE_HEADER, adminAddress, gateOpen } from './gate';

// The Next.js side of the admin page's access rules (./access.ts). Every admin page and every
// admin server action calls requireStaff() or requireStaffAction() itself: a layout doesn't
// protect server actions, which can be posted to any address. Server code only.

export class AdminRateLimited extends Error {
  constructor() {
    super('admin: too many requests');
  }
}

/** The public address of an admin page ('/queue' → /<ADMIN_PATH>/queue) */
export function adminHref(path = ''): string {
  const adminPath = webEnv().ADMIN_PATH;
  if (!adminPath) notFound();
  return adminAddress(adminPath, path);
}

export type StaffSession = { ctx: Omit<StaffContext, 'role'>; state: Exclude<StaffState, { kind: 'none' }> };

/** The gate, a session and a staff role; anything missing is a 404. Cached per request. */
export const staffSession = cache(async (): Promise<StaffSession> => {
  const h = await headers();
  const env = webEnv();
  if (!env.ADMIN_PATH || !gateOpen(h.get(ADMIN_GATE_HEADER), env.AUTH_SECRET)) notFound();
  const session = await currentSession();
  if (!session) notFound();
  const state = await staffState(appDb(), session.user.id, session.session.id);
  if (state.kind === 'none') notFound();
  return {
    state,
    ctx: { userId: session.user.id, sessionId: session.session.id, ip: clientIp(h), userAgent: h.get('user-agent') },
  };
});

export type Staff = { ctx: StaffContext; role: StaffRole; name: string };

async function staff(action: StaffAction, limit: 'view' | 'act'): Promise<Staff | 'setup' | 'verify'> {
  const { state, ctx } = await staffSession();
  if (state.kind !== 'ok') return state.kind;
  if (!can(state.role, action)) notFound();
  const limited = await hit(valkey(), [[limit === 'view' ? STAFF_LIMITS.viewsPerUser : STAFF_LIMITS.actionsPerUser, ctx.userId]]);
  if (!limited.ok) throw new AdminRateLimited();
  return { ctx: { ...ctx, role: state.role }, role: state.role, name: state.name };
}

/** For admin pages: staff who passed the TOTP check and may do `action`, else set-up, check or 404 */
export async function requireStaff(action: StaffAction = 'overview.view'): Promise<Staff> {
  const s = await staff(action, 'view');
  if (s === 'setup') redirect(adminHref('/setup'));
  if (s === 'verify') redirect(adminHref('/verify'));
  return s;
}

/** For admin server actions that change something: as requireStaff(), counted against the action limit */
export async function requireStaffAction(action: StaffAction): Promise<Staff> {
  const s = await staff(action, 'act');
  if (s === 'setup' || s === 'verify') redirect(adminHref(`/${s}`));
  return s;
}

/** Whether the signed-in staff member may do `action` (for showing or hiding parts of a page) */
export async function staffCan(action: StaffAction): Promise<boolean> {
  const { state } = await staffSession();
  return state.kind === 'ok' && can(state.role, action);
}
