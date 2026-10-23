'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { appealDecision } from '../../../modules/moderation/appeals';
import { requireSession } from '../../../modules/users/server';

export type AppealState = { error?: string } | undefined;

export async function appealAction(_prev: AppealState, form: FormData): Promise<AppealState> {
  const { user } = await requireSession('/account/notices');
  const r = await appealDecision(appDb(), valkey(), user.id, String(form.get('decisionId') ?? ''), String(form.get('body') ?? ''));
  if (!r.ok) {
    if (r.reason === 'rate_limited') return { error: messages.rateLimited(Math.ceil((r.retryAfterSeconds ?? 60) / 60)) };
    return { error: messages.notices.errors[r.reason] };
  }
  redirect('/account/notices?sent=1');
}
