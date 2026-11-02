'use client';

import { useActionState, useState } from 'react';
import { useTurnstile } from '../../components/turnstile';
import { Alert, Button, Field } from '../../components/ui';
import { fieldDir } from '../../lib/field-dir';
import { messages } from '../../messages/fa';
import { CONTACT_TOPICS } from '../../modules/users/contact-topics';
import { contactAction, type ContactState } from './actions';

/** Signed in, the account's address is the reply address and Turnstile is skipped (like the report form) */
export function ContactForm(props: { signedIn: boolean; name: string; email: string | null; turnstileSiteKey: string | null }) {
  const t = messages.contactForm;
  const [state, action, pending] = useActionState<ContactState, FormData>(contactAction, undefined);
  const turnstile = useTurnstile(props.signedIn ? null : props.turnstileSiteKey, 'contact');
  const [message, setMessage] = useState('');
  if (state && 'sent' in state) return <Alert tone="success">{t.sent}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">{t.topic}</span>
        <select name="topic" required defaultValue="support" className="block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base">
          {CONTACT_TOPICS.map((k) => (
            <option key={k} value={k}>
              {t.topics[k]}
            </option>
          ))}
        </select>
      </label>
      <Field label={t.name} name="name" defaultValue={props.name} autoComplete="name" required minLength={2} maxLength={100} data-auto-dir />
      {props.signedIn ? (
        <p className="text-sm text-neutral-700">
          {t.replyTo}{' '}
          <bdi dir="ltr" className="font-semibold">
            {props.email}
          </bdi>
        </p>
      ) : (
        <Field label={t.email} name="email" type="email" dir="ltr" inputMode="email" autoComplete="email" required maxLength={254} />
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
        <span className="mt-1 block text-xs text-neutral-500">{t.messageHint}</span>
      </label>
      {turnstile.widget}
      {state && 'error' in state && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending || !turnstile.ready} className="w-full">
        {turnstile.ready ? t.send : messages.turnstile.checking}
      </Button>
    </form>
  );
}
