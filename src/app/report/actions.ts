'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '../../db/drizzle';
import { clientIp } from '../../lib/client-ip';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { createReport } from '../../modules/moderation/public-reports';
import { checkTurnstile } from '../../modules/security/server';
import { currentSession, safeNext } from '../../modules/users/server';

export type ReportFormState = { error?: string; fields?: string[]; at?: number } | undefined;

/** A report from the report page. Signed out it needs Turnstile, a name, an email and the good-faith tick. */
export async function reportAction(_prev: ReportFormState, form: FormData): Promise<ReportFormState> {
  const session = await currentSession();
  const t = messages.report;
  if (!session) {
    const refused = await checkTurnstile(form, 'report');
    if (refused) return { error: refused, at: Date.now() };
  }
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const result = await createReport(
    appDb(),
    valkey(),
    session ? { userId: session.user.id } : { userId: null, ip: clientIp(await headers()) },
    {
      kind: form.get('kind'),
      ref: form.get('ref'),
      reason: form.get('reason') ?? '',
      details: text('details'),
      illegal: form.get('illegal') === 'on',
      legalReference: text('legalReference'),
      goodFaith: form.get('goodFaith') === 'on',
      name: session ? undefined : text('name'),
      email: session ? undefined : text('email'),
    },
  );
  if (!result.ok) {
    if (result.reason === 'rate_limited') return { error: messages.rateLimited(Math.ceil((result.retryAfterSeconds ?? 60) / 60)), at: Date.now() };
    if (result.reason === 'invalid') {
      const first = result.fields?.find((f) => f in t.errors) as keyof typeof t.errors | undefined;
      return { error: first ? t.errors[first] : t.errors.invalid, fields: result.fields, at: Date.now() };
    }
    return { error: t.errors[result.reason], at: Date.now() };
  }
  redirect(`/report/sent?${new URLSearchParams({ ...(result.already ? { already: '1' } : {}), back: safeNext(form.get('back')) })}`);
}
