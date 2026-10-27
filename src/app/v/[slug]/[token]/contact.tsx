'use client';

import Link from 'next/link';
import { useState, useTransition, type ReactNode } from 'react';
import { Alert, Button, LinkButton } from '../../../../components/ui';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';
import { revealPhoneAction, type PhoneState } from './actions';

// Contact box: chat first (approved Oct 18, 2026); the phone number only when the seller chose to
// show it, fetched when a signed-in visitor with a verified phone asks for it. `bar` (wave 1,
// mockup final/listing): the fixed bar at the bottom of a phone screen, chat, a phone button and
// the ♡ (`save`) side by side; the safety advice is in the page's safety box there.

export function Contact({
  token,
  allowPhone,
  returnTo,
  chat,
  layout = 'box',
  save,
}: {
  token: string;
  allowPhone: boolean;
  returnTo: string;
  chat: { href: string; label: string };
  layout?: 'box' | 'bar';
  /** The ♡ button, in the bar */
  save?: ReactNode;
}) {
  const [state, setState] = useState<PhoneState>(undefined);
  const [pending, start] = useTransition();
  const t = messages.listing;
  const reveal = () => start(async () => setState(await revealPhoneAction(token)));

  if (layout === 'bar') {
    const square = 'flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 font-bold text-neutral-800';
    return (
      <div className="space-y-2">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <div className="flex gap-2">
          <Link href={chat.href} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 font-bold text-white hover:bg-brand-800">
            <Icon name="chat" className="size-5 shrink-0" />
            <span className="truncate">{chat.label}</span>
          </Link>
          {allowPhone &&
            (state?.phone ? (
              <a href={`tel:${state.phone.replace(/\s/g, '')}`} dir="ltr" className={`${square} border-brand-600 text-brand-800`}>
                {state.phone}
              </a>
            ) : state?.signIn ? (
              <Link href={`/login?next=${encodeURIComponent(returnTo)}`} aria-label={t.phoneSignIn} title={t.phoneSignIn} className={square}>
                <Icon name="phone" className="size-5" />
              </Link>
            ) : state?.verify ? (
              <Link href="/account/phone" aria-label={t.phoneVerify} title={t.phoneVerify} className={square}>
                <Icon name="phone" className="size-5" />
              </Link>
            ) : (
              <button type="button" aria-label={t.showPhone} title={t.showPhone} disabled={pending} onClick={reveal} className={square}>
                <Icon name="phone" className="size-5" />
              </button>
            ))}
          {save}
        </div>
      </div>
    );
  }

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
          <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={reveal}>
            <Icon name="phone" className="size-5" />
            {t.showPhone}
          </Button>
        ))}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-xs leading-relaxed text-neutral-500">{t.safety}</p>
    </div>
  );
}
