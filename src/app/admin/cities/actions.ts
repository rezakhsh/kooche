'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { purgeEnv, webEnv } from '../../../lib/env';
import { purgeUrls } from '../../../modules/admin/purge';
import { adminHref, requireStaffAction } from '../../../modules/admin/server';
import { changeCityLaunch, openCountry, type LaunchChange } from '../../../modules/launch/waitlist';
import { browsePath } from '../../../modules/search/paths';

// Countries and cities (round 12): the owner opens a city or the whole country, moves a city to
// the waitlist with its goal, or changes the goal. Every change is in audit_log; the changed
// cities' pages are purged from Cloudflare at once (else they follow within 60 seconds).

const uuid = (v: FormDataEntryValue | null) => (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : null);

async function purge(country: string, slugs: string[]): Promise<void> {
  try {
    const env = purgeEnv();
    const appUrl = webEnv().APP_URL;
    await purgeUrls(env.CLOUDFLARE_ZONE_ID, env.CLOUDFLARE_PURGE_TOKEN, [browsePath(country, null, null), ...slugs.map((s) => browsePath(country, s, null))].slice(0, 30).map((p) => `${appUrl}${p}`));
  } catch (e) {
    console.error('cities: cache purge skipped:', e instanceof Error ? e.message : e);
  }
}

export async function cityLaunchAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const id = uuid(form.get('cityId'));
  const country = String(form.get('country') ?? '').slice(0, 2);
  const kind = form.get('change');
  const goal = Number(form.get('goal'));
  const change: LaunchChange | null =
    kind === 'open' ? { kind: 'open' } : kind === 'later' ? { kind: 'later' } : kind === 'waitlist' ? { kind: 'waitlist', goal } : kind === 'goal' ? { kind: 'goal', goal } : null;
  if (!id || !change) redirect(adminHref(`/cities?country=${country}`));
  const r = await appDb().transaction((tx) => changeCityLaunch(tx, staff.ctx, id, change));
  if (r) await purge(r.country, r.slugs);
  redirect(adminHref(`/cities?country=${country}&${r ? 'done=1' : 'error=1'}`));
}

export async function openCountryAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const code = String(form.get('country') ?? '');
  if (!/^[A-Z]{2}$/.test(code)) redirect(adminHref('/cities'));
  await appDb().transaction((tx) => openCountry(tx, staff.ctx, code));
  redirect(adminHref(`/cities?country=${code}&done=1`));
}
