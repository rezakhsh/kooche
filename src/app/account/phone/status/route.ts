import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { appDb } from '../../../../db/drizzle';
import { users } from '../../../../db/schema';
import { attemptStatus } from '../../../../modules/users/phone';
import { maskPhone } from '../../../../modules/users/phone-number';
import { currentSession } from '../../../../modules/users/server';

// Polled by the phone page while the user is in the Telegram bot or in WhatsApp. Only the user's
// own attempts; once verified, the number comes back half hidden for WhatsApp's «تأیید شد» card.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await currentSession();
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
  if (!session || !id.success) return Response.json({ status: 'unknown' }, { status: 404 });
  const db = appDb();
  const status = await attemptStatus(db, session.user.id, id.data);
  let masked: string | undefined;
  if (status?.status === 'verified') {
    const [me] = await db.select({ phone: users.phoneE164 }).from(users).where(eq(users.id, session.user.id));
    if (me?.phone) masked = maskPhone(me.phone);
  }
  return Response.json(status ? { ...status, ...(masked ? { masked } : {}) } : { status: 'unknown' }, {
    status: status ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}
