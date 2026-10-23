'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '../../../components/ui';
import { admin } from '../../../messages/fa';
import { verifyCodeAction, type CodeState } from '../two-factor-actions';

export function CodeForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCodeAction, undefined);
  const t = admin.verify;
  return (
    <div className="space-y-6">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="kind" value="totp" />
        <Field label={t.codeLabel} name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required pattern="[0-9۰-۹ ]{6,7}" autoFocus />
        <Button type="submit" disabled={pending} className="w-full">{t.submit}</Button>
      </form>
      <details className="rounded-xl border border-neutral-200 p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.backupSummary}</summary>
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="kind" value="backup" />
          <Field label={t.backupLabel} hint={t.backupHint} name="code" autoComplete="off" dir="ltr" required />
          <Button type="submit" variant="secondary" disabled={pending} className="w-full">{t.backupSubmit}</Button>
        </form>
      </details>
    </div>
  );
}
