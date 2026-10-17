'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, LinkButton } from '../../../../components/ui';
import { messages } from '../../../../messages/fa';
import { revealPhoneAction, type PhoneState } from './actions';

// Contact box: chat is a placeholder until the chat feature exists; the phone number is fetched
// only when a signed-in visitor asks for it.

export function Contact({ token, allowPhone, returnTo }: { token: string; allowPhone: boolean; returnTo: string }) {
  const [state, setState] = useState<PhoneState>(undefined);
  const [pending, start] = useTransition();
  const t = messages.listing;

  return (
    <div className="space-y-3">
      <Button type="button" disabled className="w-full" aria-describedby="chat-soon">
        {t.contact}
      </Button>
      <p id="chat-soon" className="text-center text-xs text-neutral-500">
        {t.contactSoon}
      </p>
      {allowPhone &&
        (state?.phone ? (
          <a href={`tel:${state.phone.replace(/\s/g, '')}`} dir="ltr" className="block rounded-xl border border-brand-600 px-4 py-3 text-center font-semibold text-brand-800">
            {state.phone}
          </a>
        ) : state?.signIn ? (
          <LinkButton href={`/login?next=${encodeURIComponent(returnTo)}`} variant="secondary" className="w-full">
            {t.phoneSignIn}
          </LinkButton>
        ) : (
          <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => start(async () => setState(await revealPhoneAction(token)))}>
            {t.showPhone}
          </Button>
        ))}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-xs leading-relaxed text-neutral-500">{t.safety}</p>
    </div>
  );
}
