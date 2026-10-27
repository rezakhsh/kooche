'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { clientIp } from '../../../lib/client-ip';
import { withdrawOrder } from '../../../modules/payments/withdrawals';
import { requireSession } from '../../../modules/users/server';

// The withdrawal button's second step, «تأیید انصراف (Widerruf bestätigen)» (§ 356a BGB). Pressing
// it again does nothing; the receipt and the refund come from the worker.

export async function withdrawAction(form: FormData): Promise<void> {
  const parsed = z.object({ orderId: z.uuid() }).safeParse({ orderId: form.get('orderId') });
  if (!parsed.success) redirect('/my/orders');
  const back = `/my/orders/${parsed.data.orderId}`;
  const { user } = await requireSession(back);
  const h = await headers();
  const r = await withdrawOrder(appDb(), { userId: user.id, orderId: parsed.data.orderId, ip: clientIp(h), userAgent: h.get('user-agent') });
  redirect(r.ok ? `${back}?withdrawn=1` : `${back}?error=${r.reason}`);
}
