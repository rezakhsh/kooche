'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, LinkButton } from '../../../../components/ui';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';
import { revealPhoneAction, type PhoneState } from './actions';

// Contact box: chat first (approved Oct 18, 2026); the phone number only when the seller chose to
// show it, fetched when a signed-in visitor with a verified phone asks for it.

export function Contact({
  token,
  allowPhone,
  returnTo,
  chat,
}: {
  token: string;
  allowPhone: boolean;
  returnTo: string;
  chat: { href: string; label: string };
}) {
  const [state, setState] = useState<PhoneState>(undefined);
  const [pending, start] = useTransition();
  const t = messages.listing;

  return (
    <div className="space-y-3">
      <LinkButton href={chat.href} className="w-full">
        <Icon name="chat" className="size-5" />
        {chat.label}
      </LinkButton>
      {allowPhone &&
        (state?.phone ? (
          <a href={`tel:${state.phone.replace(/\s/g, '')}`} dir="ltr" className="block rounded-xl border border-brand-600 px-4 py-3 text-center font-semibold text-brand-800">
            {state.phone}
          </a>
        ) : state?.signIn ? (
          <LinkButton href={`/login?next=${encodeURIComponent(returnTo)}`} variant="secondary" className="w-full">
            {t.phoneSignIn}
          </LinkButton>
        ) : state?.verify ? (
          <LinkButton href="/account/phone" variant="secondary" className="w-full">
            {t.phoneVerify}
          </LinkButton>
        ) : (
          <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => start(async () => setState(await revealPhoneAction(token)))}>
            <Icon name="phone" className="size-5" />
            {t.showPhone}
          </Button>
        ))}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-xs leading-relaxed text-neutral-500">{t.safety}</p>
    </div>
  );
}
