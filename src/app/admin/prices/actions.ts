'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { purgeEnv, webEnv } from '../../../lib/env';
import { purgeUrls } from '../../../modules/admin/purge';
import { adminHref, requireStaffAction } from '../../../modules/admin/server';
import { changePrice, parseEuros } from '../../../modules/payments/prices';
import { paymentGateway } from '../../../modules/payments/server';
import { reportError } from '../../../lib/monitoring/server';

// Admin › prices (wave 2 part 7): a new amount is read («۲۹»، «2,49»، «۲٫۴۹») and shown back for
// confirmation; the second form changes it (src/modules/payments/prices.ts). The Pro page is
// purged from Cloudflare at once; the other pages naming Pro's price follow within 60 seconds.

const slot = (v: FormDataEntryValue | null) => {
  const m = typeof v === 'string' ? /^([a-z0-9-]{1,40}):(month|year|once)$/.exec(v) : null;
  return m ? { code: m[1]!, interval: m[2] === 'once' ? null : (m[2] as 'month' | 'year') } : null;
};

/** The first form: back to the page with the change to confirm */
export async function askPriceAction(form: FormData): Promise<void> {
  await requireStaffAction('prices.manage');
  const s = slot(form.get('slot'));
  const amount = parseEuros(String(form.get('amount') ?? ''));
  if (!s) redirect(adminHref('/prices'));
  if (amount === null) redirect(adminHref('/prices?error=out_of_range'));
  redirect(adminHref(`/prices?confirm=${s.code}:${s.interval ?? 'once'}&amount=${amount}`));
}

export async function changePriceAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('prices.manage');
  const s = slot(form.get('slot'));
  const amount = Number(form.get('amount'));
  if (!s) redirect(adminHref('/prices'));
  let result;
  try {
    result = await changePrice(appDb(), paymentGateway(), staff.ctx, { ...s, amountMinor: amount, confirmedBig: form.get('big') === 'on' });
  } catch (e) {
    console.error('prices: change failed:', e instanceof Error ? e.message : e);
    reportError(e, { tags: { action: 'prices.change' } });
    redirect(adminHref('/prices?error=stripe'));
  }
  if (!result.ok) redirect(adminHref(result.reason === 'confirm_big' ? `/prices?confirm=${s.code}:${s.interval ?? 'once'}&amount=${amount}&error=confirm_big` : `/prices?error=${result.reason}`));
  try {
    const env = purgeEnv();
    await purgeUrls(env.CLOUDFLARE_ZONE_ID, env.CLOUDFLARE_PURGE_TOKEN, [`${webEnv().APP_URL}/pro`, `${webEnv().APP_URL}/business/compare`]);
  } catch (e) {
    console.error('prices: cache purge skipped:', e instanceof Error ? e.message : e);
  }
  redirect(adminHref(result.changed ? `/prices?done=${s.code}:${s.interval ?? 'once'}&from=${result.fromMinor}&to=${result.toMinor}` : '/prices?unchanged=1'));
}
