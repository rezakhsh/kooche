'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { adminHref, requireStaffAction } from '../../../modules/admin/server';
import { archiveRefCode, createRefCode } from '../../../modules/stats/visits';

// Admin › «آمار بازدید»: the owner's ref links (src/modules/stats/visits.ts)

export async function createRefCodeAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('stats.view');
  const r = await createRefCode(appDb(), staff.ctx, { code: form.get('code'), label: form.get('label') });
  redirect(adminHref(r.ok ? '/stats?created=1#links' : `/stats?error=${r.reason}#links`));
}

export async function archiveRefCodeAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('stats.view');
  const id = String(form.get('id') ?? '');
  if (/^[0-9a-f-]{36}$/.test(id)) await archiveRefCode(appDb(), staff.ctx, id);
  redirect(adminHref('/stats#links'));
}
