'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, Field } from '../../components/ui';
import { fieldDir } from '../../lib/field-dir';
import { messages } from '../../messages/fa';
import { LEGAL_FORMS } from '../../modules/organizations/legal-forms';

// The business form (create and edit). Typed values come back with the errors, so nothing is lost
// when the server refuses something. Works without JavaScript like the other forms.

export type BusinessFormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> } | undefined;
type Values = Record<string, string>;

const t = messages.business;

function Err({ code }: { code?: string }) {
  if (!code) return null;
  return <span className="mt-1 block text-xs text-red-700">{t.errors[code as keyof typeof t.errors] ?? t.errors.invalid}</span>;
}

export function BusinessForm({
  action,
  initial,
  slugLocked,
  submit,
}: {
  action: (state: BusinessFormState, form: FormData) => Promise<BusinessFormState>;
  initial: Values;
  slugLocked: boolean;
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.values ?? initial;
  const f = state?.fields ?? {};
  const field = (name: string, props: Omit<React.ComponentProps<typeof Field>, 'label' | 'name'> & { label: string; 'data-pattern-message'?: string; 'data-auto-dir'?: string }) => (
    <div>
      <Field name={name} defaultValue={v[name] ?? ''} aria-invalid={!!f[name]} {...props} />
      <Err code={f[name]} />
    </div>
  );
  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Card className="space-y-4">
        {field('name', { label: t.fields.name, required: true, minLength: 2, maxLength: 80, dir: fieldDir(v.name), 'data-auto-dir': '' })}
        {slugLocked ? (
          <p className="text-sm text-neutral-600">
            {t.fields.slug}: <bdi dir="ltr">/b/{v.slug}</bdi>
            <input type="hidden" name="slug" value={v.slug} />
          </p>
        ) : (
          field('slug', { label: t.fields.slug, hint: t.fields.slugHint, required: true, minLength: 3, maxLength: 40, pattern: '[a-z0-9]+(-[a-z0-9]+)*', 'data-pattern-message': t.fields.slugHint, dir: 'ltr', autoCapitalize: 'none' })
        )}
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.fields.description}</span>
            <textarea name="description" defaultValue={v.description ?? ''} maxLength={5000} rows={5} dir={fieldDir(v.description)} data-auto-dir="" className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
          </label>
          <Err code={f.description} />
        </div>
      </Card>
      <Card className="space-y-4">
        {field('addressLine1', { label: t.fields.addressLine1, required: true, maxLength: 120, dir: fieldDir(v.addressLine1), 'data-auto-dir': '', autoComplete: 'address-line1' })}
        {field('addressLine2', { label: t.fields.addressLine2, maxLength: 120, dir: fieldDir(v.addressLine2), 'data-auto-dir': '', autoComplete: 'address-line2' })}
        {field('place', { label: t.fields.place, required: true, maxLength: 120, dir: fieldDir(v.place), 'data-auto-dir': '', autoComplete: 'postal-code' })}
        {field('phone', { label: t.fields.phone, type: 'tel', maxLength: 40, dir: 'ltr', autoComplete: 'tel' })}
        {field('email', { label: t.fields.email, type: 'email', required: true, maxLength: 200, dir: 'ltr', autoComplete: 'email' })}
        {field('website', { label: t.fields.website, type: 'url', maxLength: 300, dir: 'ltr', placeholder: 'https://' })}
      </Card>
      <Card className="space-y-4">
        <p className="text-sm text-neutral-600">{t.createIntro}</p>
        {field('legalName', { label: t.fields.legalName, required: true, maxLength: 120, dir: 'ltr' })}
        <div>
          <Field name="legalForm" label={t.fields.legalForm} hint={t.fields.legalFormHint} defaultValue={v.legalForm ?? ''} required maxLength={80} dir="ltr" list="legal-forms" />
          <datalist id="legal-forms">
            {LEGAL_FORMS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <Err code={f.legalForm} />
        </div>
        {field('representativeName', { label: t.fields.representativeName, maxLength: 120, dir: 'ltr' })}
        {field('registerCourt', { label: t.fields.registerCourt, maxLength: 120, dir: 'ltr' })}
        {field('registrationNumber', { label: t.fields.registrationNumber, maxLength: 60, dir: 'ltr' })}
        {field('vatId', { label: t.fields.vatId, maxLength: 30, dir: 'ltr' })}
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.fields.imprintExtra}</span>
            <textarea name="imprintExtra" defaultValue={v.imprintExtra ?? ''} maxLength={2000} rows={3} dir={fieldDir(v.imprintExtra)} data-auto-dir="" className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
          </label>
          <Err code={f.imprintExtra} />
        </div>
      </Card>
      <Button type="submit" disabled={pending} className="w-full">
        {submit}
      </Button>
    </form>
  );
}
