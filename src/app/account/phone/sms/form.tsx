'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, Field } from '../../../../components/ui';
import { messages } from '../../../../messages/fa';
import { smsAction, type SmsState } from '../actions';

export function SmsVerify() {
  const [state, action, pending] = useActionState<SmsState, FormData>(smsAction, { step: 'number' });
  const t = messages.sms;

  if (state.step === 'done') {
    return (
      <div className="space-y-3">
        <Alert tone="success">{messages.phone.done}</Alert>
        <Link href="/account/phone" className="text-sm text-emerald-800 underline">
          {messages.phone.title}
        </Link>
      </div>
    );
  }

  if (state.step === 'code') {
    return (
      <form action={action} className="space-y-4">
        <p className="text-sm text-neutral-600">{t.codeIntro('⁦' + state.masked + '⁩')}</p>
        <input type="hidden" name="intent" value="check" />
        <input type="hidden" name="verificationId" value={state.verificationId} />
        <input type="hidden" name="masked" value={state.masked} />
        <Field
          key={state.verificationId}
          label={t.codeLabel}
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          className="text-center tracking-[0.5em]"
        />
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {t.submit}
        </Button>
        <a href="/account/phone/sms" className="block text-center text-sm text-emerald-800 underline">
          {t.otherNumber}
        </a>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="intent" value="send" />
      <Field
        label={t.numberLabel}
        hint={t.numberHint}
        name="phone"
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
        required
        autoFocus
      />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {t.send}
      </Button>
    </form>
  );
}
