import { z } from 'zod';
import { appDb } from '../../../../db/drizzle';
import { attemptStatus } from '../../../../modules/users/phone';
import { currentSession } from '../../../../modules/users/server';

// Polled by the phone page while the user is in the Telegram bot. Only the user's own attempts.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await currentSession();
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
  if (!session || !id.success) return Response.json({ status: 'unknown' }, { status: 404 });
  const status = await attemptStatus(appDb(), session.user.id, id.data);
  return Response.json(status ?? { status: 'unknown' }, {
    status: status ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}
