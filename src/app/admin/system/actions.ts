'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { adminHref, requireStaffAction } from '../../../modules/admin/server';
import { dismissSoftware } from '../../../modules/admin/software';

// Admin › وضعیت سیستم › «به‌روزرسانی نرم‌افزار»: «لازم نیست» with a reason (src/modules/admin/software.ts)

export async function dismissSoftwareAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('system.view');
  const key = String(form.get('key') ?? '');
  const r = await dismissSoftware(appDb(), staff.ctx, { key, name: form.get('name'), reason: form.get('reason') });
  redirect(adminHref(r === 'ok' ? '/system#software' : `/system?dismiss=${encodeURIComponent(key)}#software`));
}
