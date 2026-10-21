import { appDb } from '../../../../db/drizzle';
import { auditLog } from '../../../../db/schema';
import { clientIp } from '../../../../lib/client-ip';
import { webEnv } from '../../../../lib/env';
import { hit } from '../../../../lib/rate-limit';
import { valkey } from '../../../../lib/valkey';
import { exportUserData } from '../../../../modules/users/export';
import { EXPORT_LIMIT, sameOrigin } from '../../../../modules/users/export-request';
import { auth } from '../../../../modules/users/server';

// POST /account/data/export: the signed-in user's own data as a JSON download (GDPR). The user
// comes from the session only; a form on another site is refused by the Origin check.

export async function POST(request: Request): Promise<Response> {
  const env = webEnv();
  if (!sameOrigin(request.headers, env.APP_URL)) return new Response(null, { status: 403 });
  const session = await auth().api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(new URL('/login?next=/account/data', env.APP_URL), 303);
  const userId = session.user.id;
  const limited = await hit(valkey(), [[EXPORT_LIMIT, userId]]);
  if (!limited.ok) return Response.redirect(new URL('/account/data?error=rate_limited', env.APP_URL), 303);

  const db = appDb();
  const now = new Date();
  const data = await exportUserData(db, userId, env.APP_URL, now);
  await db.insert(auditLog).values({
    actorType: 'user',
    actorUserId: userId,
    action: 'user.data_exported',
    targetType: 'user',
    targetId: userId,
    sessionId: session.session.id,
    ipAddress: clientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="peydoo-data-${now.toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
