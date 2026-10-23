'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTurnstile } from '../../components/turnstile';
import { Alert, Button, Field } from '../../components/ui';
import { fieldDir } from '../../lib/field-dir';
import { messages } from '../../messages/fa';
import { reportAction, type ReportFormState } from './actions';

// The "illegal" fields open with CSS (peer-checked), so the form works without JavaScript too
export function ReportForm(props: { kind: string; refId: string; back: string; reasons: string[]; signedIn: boolean; turnstileSiteKey: string | null }) {
  const [state, action, pending] = useActionState<ReportFormState, FormData>(reportAction, undefined);
  const turnstile = useTurnstile(props.signedIn ? null : props.turnstileSiteKey, 'report');
  const { reset } = turnstile;
  useEffect(() => {
    if (state) reset();
  }, [state, reset]);
  const [details, setDetails] = useState('');
  const t = messages.report;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={props.kind} />
      <input type="hidden" name="ref" value={props.refId} />
      <input type="hidden" name="back" value={props.back} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">{t.reason}</legend>
        <div className="space-y-2">
          {props.reasons.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name="reason" value={r} required />
              {t.reasons[r]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">{t.details}</span>
        <textarea
          name="details"
          rows={4}
          maxLength={2000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          dir={fieldDir(details)}
          className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
        <span className="mt-1 block text-xs text-neutral-500">{t.detailsHint}</span>
      </label>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-4 text-sm">
        <input id="report-illegal" type="checkbox" name="illegal" className="peer mt-1" />
        <label htmlFor="report-illegal" className="min-w-0 flex-1">{t.illegal}</label>
        <div className="hidden w-full space-y-4 peer-checked:block">
          <Field label={t.legalReference} name="legalReference" maxLength={300} />
          {props.signedIn && (
            <label className="flex items-start gap-2">
              <input type="checkbox" name="goodFaith" className="mt-1" />
              {t.goodFaith}
            </label>
          )}
        </div>
      </div>
      {!props.signedIn && (
        <div className="space-y-4 rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm text-neutral-700">{t.signedOut}</p>
          <Field label={t.name} name="name" autoComplete="name" required minLength={2} maxLength={100} data-auto-dir />
          <Field label={t.email} name="email" type="email" dir="ltr" inputMode="email" autoComplete="email" required maxLength={254} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="goodFaith" className="mt-1" required />
            {t.goodFaith}
          </label>
        </div>
      )}
      {turnstile.widget}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending || !turnstile.ready} className="w-full">
        {turnstile.ready ? t.send : messages.turnstile.checking}
      </Button>
    </form>
  );
}
