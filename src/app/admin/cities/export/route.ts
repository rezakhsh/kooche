import { appDb } from '../../../../db/drizzle';
import { auditLog } from '../../../../db/schema';
import { webEnv } from '../../../../lib/env';
import { requireStaff } from '../../../../modules/admin/server';
import { exportWaitlist } from '../../../../modules/launch/waitlist';

// The confirmed emails of a city's waitlist, for the owner's opening email (round 12: the owner
// sends it himself). Each row carries the person's leave link. Admin only; every download is
// written to audit_log. Never cached.

export async function GET(request: Request): Promise<Response> {
  const staff = await requireStaff('cities.manage');
  const city = new URL(request.url).searchParams.get('city') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(city)) return new Response('not found', { status: 404 });
  const rows = await exportWaitlist(appDb(), city, { appUrl: webEnv().APP_URL });
  await appDb().insert(auditLog).values({
    actorType: 'staff',
    actorUserId: staff.ctx.userId,
    action: 'waitlist.exported',
    targetType: 'location',
    targetId: city,
    sessionId: staff.ctx.sessionId,
    ipAddress: staff.ctx.ip,
    data: { rows: rows.length },
  });
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = ['email,role,confirmed_at,leave_url', ...rows.map((r) => [q(r.email), r.role, r.confirmedAt.toISOString(), q(r.leaveUrl)].join(','))].join('\n');
  return new Response(`﻿${csv}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="waitlist.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
