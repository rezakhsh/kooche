'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../../../../db/drizzle';
import { clientIp } from '../../../../../lib/client-ip';
import { webEnv } from '../../../../../lib/env';
import { reportError } from '../../../../../lib/monitoring/server';
import { isIranRequest } from '../../../../../lib/region';
import { hit } from '../../../../../lib/rate-limit';
import { valkey } from '../../../../../lib/valkey';
import { useReward } from '../../../../../modules/launch/rewards';
import { requestAllowance } from '../../../../../modules/payments/allowances';
import { startListingCheckout } from '../../../../../modules/payments/checkout';
import { PAYMENT_LIMITS } from '../../../../../modules/payments/features';
import { paymentGateway } from '../../../../../modules/payments/server';
import { requireSession } from '../../../../../modules/users/server';

// Paying for a bump or featured, or using one included in a business's Pro plan or the waitlist's
// free bump. The order and the Checkout Session are made here; what is bought arrives only through
// Stripe's webhook.

const schema = z.object({ listingId: z.uuid(), product: z.string().regex(/^[a-z0-9-]{1,40}$/), waiver: z.literal('on').optional() });

export async function startPromotionAction(form: FormData): Promise<void> {
  const parsed = schema.safeParse({ listingId: form.get('listingId'), product: form.get('product'), waiver: form.get('waiver') ?? undefined });
  if (!parsed.success) redirect('/my/listings');
  const back = `/my/listings/${parsed.data.listingId}/promote`;
  const { user } = await requireSession(back);
  const limited = await hit(valkey(), [[PAYMENT_LIMITS.checkoutsPerUserHour, user.id]]);
  if (!limited.ok) redirect(`${back}?error=rate_limited`);
  const h = await headers();
  const r = await startListingCheckout(appDb(), paymentGateway(), {
    userId: user.id,
    listingId: parsed.data.listingId,
    productCode: parsed.data.product,
    waiver: parsed.data.waiver === 'on',
    appUrl: webEnv().APP_URL,
    ip: clientIp(h),
    userAgent: h.get('user-agent'),
    fromIran: isIranRequest(h),
  }).catch((e: unknown) => {
    // Stripe unreachable or refusing: the pending order (if any) expires by itself
    console.error('payments: checkout failed:', e instanceof Error ? e.message : e);
    reportError(e, { tags: { action: 'payments.checkout' } });
    return { ok: false, reason: 'failed' } as const;
  });
  if (!r.ok) redirect(`${back}?error=${r.reason}&product=${parsed.data.product}`);
  // Stripe's hosted Checkout (the CSP's form-action allows it)
  redirect(r.url);
}

const allowanceSchema = z.object({ listingId: z.uuid(), kind: z.enum(['bump', 'featured']) });

export async function useAllowanceAction(form: FormData): Promise<void> {
  const parsed = allowanceSchema.safeParse({ listingId: form.get('listingId'), kind: form.get('kind') });
  if (!parsed.success) redirect('/my/listings');
  const back = `/my/listings/${parsed.data.listingId}/promote`;
  const { user } = await requireSession(back);
  const limited = await hit(valkey(), [[PAYMENT_LIMITS.allowancesPerUserHour, user.id]]);
  if (!limited.ok) redirect(`${back}?error=rate_limited`);
  const r = await requestAllowance(appDb(), { userId: user.id, listingId: parsed.data.listingId, kind: parsed.data.kind });
  redirect(r.ok ? `${back}?requested=1` : `${back}?plan=${r.reason}`);
}

/** The waitlist's free bump (wave 2 part 9, src/modules/launch/rewards.ts) on this listing */
export async function useRewardAction(form: FormData): Promise<void> {
  const listingId = z.uuid().safeParse(form.get('listingId'));
  if (!listingId.success) redirect('/my/listings');
  const back = `/my/listings/${listingId.data}/promote`;
  const { user } = await requireSession(back);
  const limited = await hit(valkey(), [[PAYMENT_LIMITS.allowancesPerUserHour, user.id]]);
  if (!limited.ok) redirect(`${back}?error=rate_limited`);
  const r = await useReward(appDb(), { userId: user.id, listingId: listingId.data });
  redirect(`${back}?reward=${r.ok ? 'used' : r.reason}`);
}
