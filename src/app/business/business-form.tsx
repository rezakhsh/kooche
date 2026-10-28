'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../components/icons';
import { MapPinField } from '../../components/map-pin-field';
import { PlaceField, type PlaceFieldValue } from '../../components/place-field';
import { Alert } from '../../components/ui';
import { fieldDir } from '../../lib/field-dir';
import { messages } from '../../messages/fa';
import { suggestSlug } from '../../modules/organizations/slug';
import { logoUploadAction } from './actions';

// The business form (wave 1, mockups final/business-new and business-legal; step 2 designed in the
// same style). A new business is made in three steps in one form: about it, contact and hours, the
// legal details (which can wait: «بعداً تکمیل می‌کنم»). Nothing is saved until the last step, so
// «ادامه» only checks the step's own fields in the browser. Editing shows the three parts at once.
// Plain fields: without JavaScript every step shows (NoScriptSteps) and the server checks it all.
// Typed values come back with the server's errors, so nothing is lost.

export type BusinessFormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> } | undefined;
type Values = Record<string, string>;
type Step = 1 | 2 | 3;

const t = messages.business;
const w = t.wizard;

const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
const TYPES = ['translation', 'repairs', 'beauty', 'education', 'real_estate', 'auto', 'food', 'legal_finance', 'health', 'moving', 'shop', 'other'] as const;
const LANGUAGES = ['fa', 'de', 'en', 'tr', 'ar', 'fr', 'other'] as const;
/** The forms the mockup offers as chips; anything else is typed under «دیگر» */
const LEGAL_FORM_CHIPS = ['Einzelunternehmen', 'GmbH', 'UG (haftungsbeschränkt)', 'GbR'] as const;
const COMPANY_FORMS = new Set(['GmbH', 'UG (haftungsbeschränkt)']);
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`).concat('24:00');

const STEP_OF: Record<string, Step> = {
  name: 1, slug: 1, businessType: 1, place: 1, pin: 1, servesOnline: 1,
  phone: 2, email: 2, website: 2, instagram: 2, telegram: 2, languages: 2, tagline: 2, description: 2,
};
const stepOf = (field: string): Step => STEP_OF[field] ?? (field.startsWith('hours.') ? 2 : 3);

const inputClass = 'block h-12 w-full rounded-xl border border-neutral-400 bg-white px-4 text-base outline-none focus:border-2 focus:border-brand-600 aria-invalid:border-red-600';
const pill =
  'flex h-10 items-center rounded-full border border-neutral-300 px-3.5 text-sm peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40';
const selectClass = 'h-10 rounded-lg border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-brand-600';
const faDigits = (s: string) => s.replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!);

function Err({ code }: { code?: string }) {
  if (!code) return null;
  return <span className="mt-1 block text-xs text-red-700">{t.errors[code as keyof typeof t.errors] ?? t.errors.invalid}</span>;
}

function Label({ children, optional = false, htmlFor }: { children: ReactNode; optional?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mt-5 mb-1.5 block text-sm font-bold">
      {children}
      {optional && <span className="ms-1 font-normal text-neutral-600">{w.optional}</span>}
    </label>
  );
}

function TextField({ name, label, v, f, optional = false, ltr = false, hint, ...props }: { name: string; label: string; v: Values; f: Values; optional?: boolean; ltr?: boolean; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={`b-${name}`} optional={optional}>
        {label}
      </Label>
      <input id={`b-${name}`} name={name} defaultValue={v[name] ?? ''} aria-invalid={!!f[name]} dir={ltr ? 'ltr' : fieldDir(v[name])} className={`${inputClass} ${ltr ? 'text-start' : ''}`} {...props} />
      {hint && <span className="mt-1 block text-xs text-neutral-600">{hint}</span>}
      <Err code={f[name]} />
    </div>
  );
}

/** The logo tile: picks a photo, uploads it straight to storage, keeps its key for the save */
function LogoPicker({ current, initialKey, onBusy }: { current: string | null; initialKey: string; onBusy: (busy: boolean) => void }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [key, setKey] = useState(initialKey);
  const [state, setState] = useState<'idle' | 'uploading' | 'ready' | 'failed'>(initialKey ? 'ready' : 'idle');
  const [removed, setRemoved] = useState(false);
  async function pick(file: File | undefined) {
    if (!file) return;
    setState('uploading');
    onBusy(true);
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const ticket = await logoUploadAction(file.type, file.size);
      if (!ticket.ok) throw new Error('refused');
      const res = await fetch(ticket.url, { method: 'PUT', body: file, headers: ticket.headers });
      if (!res.ok) throw new Error('upload');
      setKey(ticket.key);
      setRemoved(false);
      setState('ready');
    } catch {
      setPreview(current);
      setKey('');
      setState('failed');
    } finally {
      onBusy(false);
    }
  }
  return (
    <div className="mt-5 flex items-center gap-4">
      <input type="hidden" name="logoUpload" value={key} />
      {removed && <input type="hidden" name="removeLogo" value="on" />}
      <label className="relative flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-xs font-bold text-brand-800 focus-within:ring-2 focus-within:ring-brand-600/40">
        {preview && !removed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <Icon name="camera" className="size-6" />
            {w.logo}
          </>
        )}
        {state === 'uploading' && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px]">{w.logoUploading}</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={preview && !removed ? w.logoChange : w.logo} onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      <div className="min-w-0 text-xs leading-6">
        <p className={state === 'failed' ? 'text-red-700' : 'text-neutral-600'}>{state === 'failed' ? w.logoFailed : state === 'ready' ? w.logoReady : w.logoHint}</p>
        {preview && !removed && state !== 'uploading' && (
          <button
            type="button"
            onClick={() => {
              setRemoved(true);
              setKey('');
              setState('idle');
            }}
            className="font-bold text-neutral-700 underline"
          >
            {w.logoRemove}
          </button>
        )}
      </div>
    </div>
  );
}

/** A day's row: a switch, then from–to once it is on (shown by CSS, so it works without JavaScript) */
function HoursRow({ day, v, error }: { day: (typeof WEEKDAYS)[number]; v: Values; error?: string }) {
  const open = v[`hours.${day}.open`] === 'on';
  const time = (part: 'from' | 'to', fallback: string) => (
    <select name={`hours.${day}.${part}`} defaultValue={v[`hours.${day}.${part}`] || fallback} aria-label={`${t.days[day]} ${part === 'from' ? w.from : w.to}`} dir="ltr" className={selectClass}>
      {TIMES.map((x) => (
        <option key={x} value={x}>
          {faDigits(x)}
        </option>
      ))}
    </select>
  );
  return (
    <li className="group flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
      <label className="flex w-32 cursor-pointer items-center gap-2.5 text-sm font-bold">
        <span className="relative inline-flex shrink-0">
          <input type="checkbox" name={`hours.${day}.open`} defaultChecked={open} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
          <span aria-hidden className="inline-flex h-6 w-10 items-center justify-start rounded-full bg-neutral-300 px-0.5 peer-checked:justify-end peer-checked:bg-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2">
            <i className="block size-5 rounded-full bg-white shadow" />
          </span>
        </span>
        {t.days[day]}
      </label>
      <span className="text-sm text-neutral-500 group-has-[input:checked]:hidden">{w.closed}</span>
      <span className="hidden items-center gap-2 text-sm group-has-[input:checked]:flex">
        {time('from', '09:00')}
        <span className="text-neutral-500">–</span>
        {time('to', '18:00')}
      </span>
      {error && (
        <span className="w-full text-xs text-red-700">
          <Err code={error} />
        </span>
      )}
    </li>
  );
}

export function BusinessForm({
  action,
  initial,
  mode,
  country,
  place,
  logoUrl,
  host,
  legalCountry,
  mapVersion,
}: {
  action: (state: BusinessFormState, form: FormData) => Promise<BusinessFormState>;
  initial: Values;
  mode: 'create' | 'edit';
  country: { code: string; nameFa: string };
  place: PlaceFieldValue;
  logoUrl: string | null;
  /** «peydoo.com», for the page address */
  host: string;
  /** Germany and Austria: the Impressum, by that name */
  legalCountry: boolean;
  /** The street map's version for the shop's pin; null without a map file */
  mapVersion: string | null;
}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const v = state?.values ?? initial;
  const f = state?.fields ?? {};
  const wizard = mode === 'create';
  const [step, setStep] = useState<Step>(1);
  const [slug, setSlug] = useState(v.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit' || !!v.slug);
  const [slugOpen, setSlugOpen] = useState(!!f.slug);
  const [legalForm, setLegalForm] = useState(v.legalForm ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const [pinPlace, setPinPlace] = useState({ value: place.placeValue, center: place.center });
  const formRef = useRef<HTMLFormElement>(null);
  const names: readonly string[] = w.steps;

  // A refusal from the server: back to the first step with something to fix
  useEffect(() => {
    if (!state?.fields) return;
    const steps = Object.keys(state.fields).map(stepOf);
    if (steps.length) setStep(Math.min(...steps) as Step);
    if (state.fields.slug) setSlugOpen(true);
    window.scrollTo({ top: 0 });
  }, [state]);

  /** The step's own required fields, checked in the browser before moving on */
  function stepValid(n: Step): boolean {
    const section = formRef.current?.querySelector(`[data-step="${n}"]`);
    if (!section) return true;
    if (n === 1 && slug.length < 3) setSlugOpen(true);
    for (const el of section.querySelectorAll<HTMLInputElement>('input, select, textarea')) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (wizard && submitter?.value === 'next') {
      if (stepValid(step)) {
        setStep((step + 1) as Step);
        window.scrollTo({ top: 0 });
      }
      return;
    }
    const data = new FormData(ev.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  const section = (n: Step) => ({ 'data-step': wizard ? n : undefined, className: !wizard || step === n ? 'block' : 'hidden' });
  const heading = (n: Step, title: string, lead?: string) => (
    <>
      {wizard ? <h1 className="mt-5 text-2xl font-extrabold">{title}</h1> : <h2 className="text-xl font-extrabold">{names[n - 1]}</h2>}
      {lead && <p className="mt-1 text-sm text-neutral-600">{lead}</p>}
    </>
  );
  const sole = legalForm === 'Einzelunternehmen';
  const company = COMPANY_FORMS.has(legalForm);
  const otherForm = legalForm === 'other' || (!!legalForm && !(LEGAL_FORM_CHIPS as readonly string[]).includes(legalForm));
  const languages = (v.languages ?? '').split(',').filter(Boolean);

  return (
    <form ref={formRef} action={dispatch} onSubmit={onSubmit} noValidate className={wizard ? 'pb-28 lg:pb-0' : 'space-y-10 pb-28 lg:pb-0'}>
      {wizard && (
        <div data-step-bar>
          <ol className="grid grid-cols-3 gap-1.5" aria-hidden>
            {names.map((n, i) => (
              <li key={n} className={`h-1.5 rounded-full ${i < step ? 'bg-brand-700' : 'bg-neutral-200'}`} />
            ))}
          </ol>
          <p className="mt-2 text-xs font-bold text-brand-800">{w.of(step, names.length, names[step - 1]!)}</p>
        </div>
      )}
      {state?.error && (
        <div className="mt-4">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}

      {/* 1. About the business */}
      <section {...section(1)}>
        {heading(1, w.aboutHeading, wizard ? w.aboutLead : undefined)}
        <LogoPicker current={v.logoPreview || logoUrl} initialKey={v.logoUpload ?? ''} onBusy={setLogoBusy} />
        <Label htmlFor="b-name">{w.name}</Label>
        <input
          id="b-name"
          name="name"
          defaultValue={v.name ?? ''}
          required
          minLength={2}
          maxLength={80}
          aria-invalid={!!f.name}
          dir={fieldDir(v.name)}
          data-auto-dir=""
          onChange={(e) => {
            if (!slugTouched) setSlug(suggestSlug(e.target.value));
          }}
          className={`${inputClass} focus:border-2`}
        />
        <Err code={f.name} />
        {mode === 'edit' ? (
          <p className="mt-1 text-xs text-neutral-600">
            {w.pageAddress}{' '}
            <bdi dir="ltr" className="font-bold text-neutral-800">
              {host}/b/{slug}
            </bdi>
            <input type="hidden" name="slug" value={slug} />
          </p>
        ) : (
          <div className="mt-1">
            <p className={`text-xs text-neutral-600 ${slugOpen ? 'hidden' : ''}`}>
              {w.pageAddress}{' '}
              <bdi dir="ltr" className="font-bold text-neutral-800">
                {host}/b/{slug || '…'}
              </bdi>{' '}
              <button type="button" onClick={() => setSlugOpen(true)} className="font-bold text-brand-800">
                {w.slugChange}
              </button>
            </p>
            <label className={slugOpen ? 'mt-2 block' : 'sr-only'}>
              <span className="mb-1.5 block text-xs text-neutral-600">{w.pageAddress}</span>
              <span className="flex h-11 items-center rounded-xl border border-neutral-400 bg-white px-3 text-sm focus-within:border-2 focus-within:border-brand-600" dir="ltr">
                <span className="text-neutral-500">{host}/b/</span>
                <input
                  name="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase());
                    setSlugTouched(true);
                  }}
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  autoCapitalize="none"
                  aria-invalid={!!f.slug}
                  className="h-full min-w-0 flex-1 bg-transparent outline-none"
                />
              </span>
              <span className="mt-1 block text-xs text-neutral-600">{w.slugHint}</span>
            </label>
            <Err code={f.slug} />
          </div>
        )}
        <Label>{w.type}</Label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((x, i) => (
            <label key={x} className="relative cursor-pointer">
              <input type="radio" name="businessType" value={x} defaultChecked={v.businessType === x} required={i === 0} className="peer sr-only" />
              <span className={pill}>{t.types[x]}</span>
            </label>
          ))}
        </div>
        <Err code={f.businessType} />
        <div className="mt-5">
          <PlaceField
            compact
            label={w.where}
            countries={[country]}
            initial={place}
            fixed={{ hint: '', changeHref: null }}
            showDistrict={false}
            allowArea={false}
            errors={f.place ? { place: t.errors[f.place as keyof typeof t.errors] ?? t.errors.invalid } : {}}
            onPlaceChange={setPinPlace}
          />
          <MapPinField version={mapVersion} place={pinPlace} initial={v.pin ?? ''} error={f.pin ? (t.errors[f.pin as keyof typeof t.errors] ?? t.errors.invalid) : undefined} />
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="servesOnline" defaultChecked={v.servesOnline === 'on'} className="size-5 shrink-0 accent-brand-700" />
          {w.online}
        </label>
      </section>

      {/* 2. Contact, languages, hours, about */}
      <section {...section(2)}>
        {heading(2, w.contactHeading, w.contactLead)}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField name="phone" label={w.phone} v={v} f={f} optional ltr type="tel" maxLength={40} autoComplete="tel" />
          <TextField name="email" label={w.email} v={v} f={f} optional ltr type="email" maxLength={200} autoComplete="email" hint={w.emailHint} />
          <TextField name="website" label={w.website} v={v} f={f} optional ltr type="url" maxLength={300} placeholder="https://" />
          <TextField name="instagram" label={w.instagram} v={v} f={f} optional ltr maxLength={200} placeholder="@" hint={w.handleHint} />
          <TextField name="telegram" label={w.telegram} v={v} f={f} optional ltr maxLength={200} placeholder="@" hint={w.handleHint} />
        </div>
        <Label optional>{w.languages}</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((x) => (
            <label key={x} className="relative cursor-pointer">
              <input type="checkbox" name="languages" value={x} defaultChecked={languages.includes(x)} className="peer sr-only" />
              <span className={pill}>{t.languages[x]}</span>
            </label>
          ))}
        </div>
        <Label optional>{w.hours}</Label>
        <p className="text-xs text-neutral-600">{w.hoursHint}</p>
        <ul className="mt-1 divide-y divide-neutral-200">
          {WEEKDAYS.map((d) => (
            <HoursRow key={d} day={d} v={v} error={f[`hours.${d}`]} />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            const form = formRef.current;
            if (!form) return;
            const open = WEEKDAYS.filter((d) => form.querySelector<HTMLInputElement>(`[name="hours.${d}.open"]`)?.checked);
            const first = open[0];
            if (!first) return;
            for (const part of ['from', 'to'] as const) {
              const value = form.querySelector<HTMLSelectElement>(`[name="hours.${first}.${part}"]`)?.value ?? '';
              for (const d of open) {
                const el = form.querySelector<HTMLSelectElement>(`[name="hours.${d}.${part}"]`);
                if (el) el.value = value;
              }
            }
          }}
          className="mt-1 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-brand-800 hover:bg-brand-50"
        >
          <Icon name="clock" className="size-4" />
          {w.sameHours}
        </button>
        <TextField name="tagline" label={w.tagline} v={v} f={f} optional minLength={2} maxLength={100} hint={w.taglineHint} data-auto-dir="" />
        <Label htmlFor="b-description" optional>
          {w.about}
        </Label>
        <textarea
          id="b-description"
          name="description"
          defaultValue={v.description ?? ''}
          maxLength={5000}
          rows={5}
          dir={fieldDir(v.description)}
          data-auto-dir=""
          className="block w-full rounded-xl border border-neutral-400 px-4 py-3 text-base outline-none focus:border-2 focus:border-brand-600"
        />
        <span className="mt-1 block text-xs text-neutral-600">{w.aboutHint}</span>
        <Err code={f.description} />
      </section>

      {/* 3. Legal details: all or none, now or later */}
      <section {...section(3)}>
        {heading(3, w.legalHeading)}
        <div className="mt-3 flex gap-3 rounded-2xl bg-brand-50 p-3.5 text-sm leading-7">
          <Icon name="shield" className="mt-1 size-5 shrink-0 text-brand-700" />
          <span>{legalCountry ? w.legalBox : w.legalBoxOther}</span>
        </div>
        <Label>{w.legalForm}</Label>
        <div className="flex flex-wrap gap-2">
          {[...LEGAL_FORM_CHIPS, 'other'].map((x) => (
            <label key={x} className="relative cursor-pointer">
              <input
                type="radio"
                name="legalForm"
                value={x}
                defaultChecked={x === 'other' ? otherForm : legalForm === x}
                onChange={() => setLegalForm(x)}
                className="peer sr-only"
              />
              <span className={pill} dir={x === 'other' ? undefined : 'ltr'}>
                {x === 'other' ? w.legalFormOther : x.replace(' (haftungsbeschränkt)', '')}
              </span>
            </label>
          ))}
        </div>
        <Err code={f.legalForm} />
        {otherForm && (
          <TextField name="legalFormOther" label={w.legalFormOtherLabel} v={{ ...v, legalFormOther: v.legalFormOther || (legalForm !== 'other' ? legalForm : '') }} f={f} ltr maxLength={80} list="legal-forms" />
        )}
        <datalist id="legal-forms">
          {['e.K.', 'Freiberufler', 'OHG', 'KG', 'GmbH & Co. KG', 'AG', 'e.V.', 'e.U.', 'OG'].map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <TextField name="legalName" label={sole ? w.legalNameSole : company ? w.legalNameCompany : t.fields.legalName} v={v} f={f} ltr maxLength={120} autoComplete={sole ? 'name' : 'organization'} />
        {(company || otherForm) && <TextField name="representativeName" label={w.representative} v={v} f={f} optional ltr maxLength={120} />}
        <TextField name="addressLine1" label={w.street} v={v} f={f} ltr maxLength={120} autoComplete="address-line1" placeholder="Kantstraße 1" />
        <div className="grid grid-cols-[8rem_1fr] gap-x-3">
          <TextField name="legalPostal" label={w.postal} v={v} f={f} ltr maxLength={20} autoComplete="postal-code" inputMode="numeric" />
          <TextField name="addressLine2" label={w.street2} v={v} f={f} optional ltr maxLength={120} autoComplete="address-line2" />
        </div>
        {(company || otherForm) && (
          <div className="grid gap-x-3 sm:grid-cols-2">
            <TextField name="registerCourt" label={w.registerCourt} v={v} f={f} optional ltr maxLength={120} placeholder="Amtsgericht Charlottenburg" />
            <TextField name="registrationNumber" label={w.registrationNumber} v={v} f={f} optional ltr maxLength={60} placeholder="HRB 123456" />
          </div>
        )}
        <TextField name="vatId" label={w.vatId} v={v} f={f} optional ltr maxLength={30} placeholder="DE123456789" />
        <details className="mt-5 rounded-xl border border-neutral-200 px-4 py-3" open={!!v.imprintExtra || !!f.imprintExtra}>
          <summary className="cursor-pointer text-sm font-bold">
            {w.imprintExtra} <span className="font-normal text-neutral-600">{w.optional}</span>
          </summary>
          <textarea name="imprintExtra" defaultValue={v.imprintExtra ?? ''} maxLength={2000} rows={3} dir="ltr" aria-label={w.imprintExtra} className="mt-3 block w-full rounded-xl border border-neutral-400 px-4 py-3 text-base outline-none focus:border-2 focus:border-brand-600" />
          <Err code={f.imprintExtra} />
        </details>
        <p className="mt-4 text-xs leading-6 text-neutral-600">{w.legalAllOrNone}</p>
        {wizard && (
          <button type="submit" name="intent" value="later" disabled={pending || logoBusy} className="mt-4 flex h-11 w-full items-center justify-center text-sm font-bold text-brand-800 disabled:opacity-60">
            {w.later}
          </button>
        )}
      </section>

      {/* Without JavaScript, and when editing: one plain button */}
      <div data-noscript-actions className={wizard ? 'hidden' : 'fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0'}>
        <button type="submit" name="intent" value="save" disabled={pending || logoBusy} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60">
          {wizard ? w.create : t.save}
        </button>
      </div>

      {/* The steps' bar, within thumb reach */}
      {wizard && (
        <div data-step-bar className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0">
          <div className="mx-auto flex max-w-2xl gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => {
                  setStep((step - 1) as Step);
                  window.scrollTo({ top: 0 });
                }}
                className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-5 font-bold text-neutral-800"
              >
                {w.previous}
              </button>
            )}
            {step < 3 ? (
              <button type="submit" name="intent" value="next" className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800">
                {w.continueTo(names[step]!)}
              </button>
            ) : (
              <button type="submit" name="intent" value="save" disabled={pending || logoBusy} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60">
                {w.create}
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
