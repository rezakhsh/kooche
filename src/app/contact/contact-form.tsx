'use client';

import { useActionState, useState } from 'react';
import { useTurnstile } from '../../components/turnstile';
import { Alert, Button, Field } from '../../components/ui';
import { fieldDir } from '../../lib/field-dir';
import { messages } from '../../messages/fa';
import { FORM_TIME_FIELD, HONEYPOT_FIELD, type ContactTopic } from '../../modules/users/contact-topics';
import { contactAction, type ContactState } from './actions';

/**
 * The form for one topic (src/app/contact/page.tsx). Signed in, the account's address is the reply
 * address and Turnstile is skipped (like the report form). Guests carry a trap field nobody sees
 * and the signed time the form was drawn.
 */
export function ContactForm(props: { topic: ContactTopic; signedIn: boolean; name: string; email: string | null; turnstileSiteKey: string | null; formTime: string }) {
  const t = messages.contactForm;
  const [state, action, pending] = useActionState<ContactState, FormData>(contactAction, undefined);
  const turnstile = useTurnstile(props.signedIn ? null : props.turnstileSiteKey, 'contact');
  const [message, setMessage] = useState('');
  if (state && 'sent' in state) return <Alert tone="success">{state.sent === 'confirm' ? t.sentConfirm : props.topic === 'login' ? t.sentLogin : t.sent}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="topic" value={props.topic} />
      {!props.signedIn && (
        <>
          <input type="hidden" name={FORM_TIME_FIELD} value={props.formTime} />
          {/* For bots only: hidden from people and screen readers, skipped by the keyboard */}
          <div aria-hidden className="absolute -start-[9999px] size-px overflow-hidden">
            <label>
              Website
              <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
        </>
      )}
      <Field label={t.name} name="name" defaultValue={props.name} autoComplete="name" required minLength={2} maxLength={100} data-auto-dir />
      {props.signedIn ? (
        <p className="text-sm text-neutral-700">
          {t.replyTo}{' '}
          <bdi dir="ltr" className="font-semibold">
            {props.email}
          </bdi>
        </p>
      ) : (
        <Field
          label={props.topic === 'login' ? t.accountEmail : t.email}
          name="email"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      )}
      {props.topic === 'illegal' && (
        <Field label={t.link} name="link" type="url" dir="ltr" inputMode="url" required maxLength={500} placeholder="https://peydoo.com/…" />
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">{t.message}</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          dir={fieldDir(message)}
          className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
        <span className="mt-1 block text-xs text-neutral-500">{props.signedIn ? t.messageHint : t.messageHintGuest}</span>
      </label>
      {props.topic === 'illegal' && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="goodFaith" className="mt-1" required />
          {t.goodFaith}
        </label>
      )}
      {turnstile.widget}
      {state && 'error' in state && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending || !turnstile.ready} className="w-full">
        {turnstile.ready ? t.send : messages.turnstile.checking}
      </Button>
      <p className="text-xs text-neutral-500">{t.answerTime}</p>
    </form>
  );
}
