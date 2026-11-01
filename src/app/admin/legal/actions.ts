'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { LEGAL_DOCUMENTS } from '../../../db/schema';
import { webEnv } from '../../../lib/env';
import { reportError } from '../../../lib/monitoring/server';
import { adminHref, requireStaffAction } from '../../../modules/admin/server';
import { confirmNotice, discardDraft, draftById, noticeMail, saveDraft, SUMMARY_MAX } from '../../../modules/legal/notices';
import { notificationMailer } from '../../../modules/notifications/mailer';
import { currentSession } from '../../../modules/users/server';

// Admin › «خبر تغییر شرایط به همه» (src/modules/legal/notices.ts): the draft and its preview, a
// sample to the owner's own inbox, and the confirmation that sends it to every account.

const draftInput = z.object({
  documents: z.array(z.enum(LEGAL_DOCUMENTS)).min(1).max(2),
  summaryFa: z.string().max(SUMMARY_MAX + 200),
  summaryDe: z.string().max(SUMMARY_MAX + 200),
});
const idInput = z.uuid();
const back = (q = '') => adminHref(`/legal${q}`);

export async function previewNoticeAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('legal.announce');
  const parsed = draftInput.safeParse({ documents: form.getAll('documents'), summaryFa: form.get('summaryFa') ?? '', summaryDe: form.get('summaryDe') ?? '' });
  if (!parsed.success) redirect(back('?error=invalid'));
  const r = await saveDraft(appDb(), staff.ctx, parsed.data);
  redirect(back(r.ok ? `?draft=${r.id}` : `?error=${r.reason}`));
}

export async function sampleNoticeAction(form: FormData): Promise<void> {
  await requireStaffAction('legal.announce');
  const id = idInput.safeParse(form.get('id'));
  if (!id.success) redirect(back());
  const draft = await draftById(appDb(), id.data);
  const session = await currentSession();
  if (!draft || !session) redirect(back('?error=not_found'));
  const env = webEnv();
  try {
    // To the staff member's own address only; never through the test-account routing
    await notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM })(noticeMail(draft, env.APP_URL, session.user.email));
  } catch (e) {
    console.error('legal: sample failed:', e instanceof Error ? e.message : e);
    reportError(e, { tags: { action: 'legal.sample' } });
    redirect(back(`?draft=${draft.id}&error=sample`));
  }
  redirect(back(`?draft=${draft.id}&sample=1`));
}

export async function sendNoticeAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('legal.announce');
  const id = idInput.safeParse(form.get('id'));
  if (!id.success || form.get('sure') !== 'on') redirect(back());
  const r = await confirmNotice(appDb(), staff.ctx, id.data);
  redirect(back(r.ok ? '?sending=1' : `?draft=${id.data}&error=${r.reason}`));
}

export async function discardNoticeAction(form: FormData): Promise<void> {
  await requireStaffAction('legal.announce');
  const id = idInput.safeParse(form.get('id'));
  if (id.success) await discardDraft(appDb(), id.data);
  redirect(back());
}
