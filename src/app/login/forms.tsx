'use client';

import { useActionState, useEffect } from 'react';
import { useTurnstile } from '../../components/turnstile';
import { Alert, Button, Field } from '../../components/ui';
import type { FormState } from '../../lib/form';
import { messages } from '../../messages/fa';
import { requestCode, resendCode, verifyCode } from './actions';

export function EmailForm({ next, turnstileSiteKey }: { next: string; turnstileSiteKey: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestCode, undefined);
  const turnstile = useTurnstile(turnstileSiteKey, 'login');
  const { reset } = turnstile;
  // A refused request may have spent the token: fetch a new one
  useEffect(() => {
    if (state) reset();
  }, [state, reset]);
  const t = messages.login;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field
        label={t.emailLabel}
        name="email"
        type="email"
        dir="ltr"
        inputMode="email"
        autoComplete="email"
        placeholder={t.emailPlaceholder}
        required
        autoFocus
      />
      {turnstile.widget}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending || !turnstile.ready} className="w-full">
        {turnstile.ready ? t.submit : messages.turnstile.checking}
      </Button>
    </form>
  );
}

export function CodeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyCode, undefined);
  const [resendState, resend, resending] = useActionState<FormState>(resendCode, undefined);
  const t = messages.code;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <Field
          label={t.codeLabel}
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9۰-۹]{6}"
          maxLength={6}
          required
          autoFocus
          className="text-center tracking-[0.5em]"
        />
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {t.submit}
        </Button>
      </form>
      <form action={resend}>
        {resendState?.error && <Alert tone="error">{resendState.error}</Alert>}
        {resendState?.notice && <Alert tone="success">{resendState.notice}</Alert>}
        <Button type="submit" variant="secondary" disabled={resending} className="mt-2 w-full">
          {t.resend}
        </Button>
      </form>
    </div>
  );
}
