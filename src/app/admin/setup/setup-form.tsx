'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '../../../components/ui';
import { admin } from '../../../messages/fa';
import { confirmSetupAction, startSetupAction, type SetupState } from '../two-factor-actions';

export function SetupForm() {
  const [started, start, starting] = useActionState<SetupState, FormData>(startSetupAction, undefined);
  const [confirmed, confirm, confirming] = useActionState<SetupState, FormData>(confirmSetupAction, undefined);
  const t = admin.setup;
  if (!started?.qr) {
    return (
      <form action={start}>
        <Button type="submit" disabled={starting}>{t.start}</Button>
      </form>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm">{t.scan}</p>
        <svg viewBox={`0 0 ${started.qr.size} ${started.qr.size}`} role="img" aria-label={t.qrLabel} shapeRendering="crispEdges" className="size-56 rounded-xl border border-neutral-200 bg-white text-neutral-900">
          <path d={started.qr.d} fill="currentColor" />
        </svg>
        <p className="mt-3 text-sm">{t.manual}</p>
        <p dir="ltr" className="mt-1 break-all rounded-lg bg-neutral-100 px-3 py-2 text-start font-mono text-sm">{started.secret}</p>
      </div>
      <div>
        <h2 className="mb-2 font-bold">{t.backupTitle}</h2>
        <p className="mb-3 text-sm text-neutral-700">{t.backupIntro}</p>
        <ul dir="ltr" className="grid grid-cols-2 gap-2 font-mono text-sm">
          {started.backupCodes?.map((c) => <li key={c} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-center">{c}</li>)}
        </ul>
      </div>
      {confirmed?.error && <Alert tone="error">{confirmed.error}</Alert>}
      <form action={confirm} className="space-y-4">
        <Field label={t.codeLabel} name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required pattern="[0-9۰-۹ ]{6,7}" />
        <Button type="submit" disabled={confirming} className="w-full">{t.confirm}</Button>
      </form>
    </div>
  );
}
