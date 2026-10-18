'use client';

import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { PlaceField, type PlaceFieldValue } from '../../components/place-field';
import { Alert, Button, Card, Field } from '../../components/ui';
import { messages } from '../../messages/fa';
import type { FieldError } from '../../modules/listings/listings';
import { saveEventAction, type EventSaveState } from './actions';

// The event form (mobile first). Plain fields, so it also posts without JavaScript; with
// JavaScript the submit is intercepted so React keeps what was typed when the server sends errors
// back. Dates are typed as the browser's Gregorian date fields, with the Jalali date shown below.

type Attendance = 'in_person' | 'online' | 'hybrid';
type EventPrice = 'free' | 'fixed' | 'on_request';
type Language = 'fa' | 'de' | 'en' | 'other';

export type EventFormProps = {
  /** null: a new event nobody saved yet; the first save starts the draft */
  listingId: string | null;
  status: string;
  /** The event types (leaf categories of the events section) */
  types: { id: string; nameFa: string }[];
  countries: { code: string; nameFa: string; currencySymbol: string }[];
  needsName: boolean;
  values: {
    categoryId: string;
    title: string;
    description: string;
    priceType: EventPrice;
    amount: string;
    place: PlaceFieldValue;
    allowPhoneContact: boolean;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    repeat: 'none' | 'weekly' | 'monthly';
    repeatUntil: string;
    attendance: Attendance;
    venueName: string;
    streetAddress: string;
    onlineUrl: string;
    ticketUrl: string;
    organizerName: string;
    languages: Language[];
    minAge: string;
    scheduleStatus: 'scheduled' | 'postponed' | 'cancelled';
    timeZone: string;
  };
};

const t = messages.form;
const e = messages.events.form;

const selectClass =
  'block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20';

const AGES = ['', '6', '12', '16', '18', '21'];

function ErrorText({ code }: { code?: FieldError }) {
  if (!code) return null;
  return <span className="mt-1 block text-xs text-red-700">{t.errors[code] ?? t.errors.invalid}</span>;
}

/** The Jalali reading of a typed Gregorian day, under the date field */
function JalaliHint({ value }: { value: string }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  // Weekday and date apart: asked for both, Intl puts the weekday after the year
  const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', timeZone: 'UTC' }).format(date);
  const text = `${weekday} ${new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long', timeZone: 'UTC' }).format(date)}`;
  return <span className="mt-1 block text-xs text-emerald-800">{e.jalali(text)}</span>;
}

function DateField({ label, name, value, onChange, error, hint }: { label: string; name: string; value: string; onChange: (v: string) => void; error?: FieldError; hint?: ReactNode }) {
  return (
    <div>
      <Field label={label} name={name} type="date" value={value} onChange={(ev) => onChange(ev.target.value)} min="2020-01-01" max="2100-12-31" dir="ltr" className="text-end" />
      <JalaliHint value={value} />
      {hint}
      <ErrorText code={error} />
    </div>
  );
}

export function EventForm(
  props: EventFormProps & { onDraftCreated?: (listingId: string) => void; onTypeChange?: (categoryId: string) => void },
) {
  const [state, dispatch, pending] = useActionState<EventSaveState, FormData>(saveEventAction, undefined);
  const { onDraftCreated, onTypeChange } = props;
  useEffect(() => {
    if (state?.listingId) onDraftCreated?.(state.listingId);
  }, [state?.listingId, onDraftCreated]);
  const v = props.values;
  const errors = state?.errors ?? {};
  const [priceType, setPriceType] = useState<EventPrice>(v.priceType);
  const [attendance, setAttendance] = useState<Attendance>(v.attendance);
  const [repeat, setRepeat] = useState(v.repeat);
  const [startDate, setStartDate] = useState(v.startDate);
  const [endDate, setEndDate] = useState(v.endDate);
  const [repeatUntil, setRepeatUntil] = useState(v.repeatUntil);
  const [countryCode, setCountryCode] = useState(v.place.countryCode || props.countries[0]?.code || '');
  const currencySymbol = props.countries.find((c) => c.code === countryCode)?.currencySymbol ?? '';
  const placeError = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.errors.invalid) : undefined);

  const draft = props.status === 'draft';
  const rejected = props.status === 'rejected';
  const languages = new Set(v.languages);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(ev.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  return (
    <form action={dispatch} onSubmit={onSubmit} className="space-y-6" noValidate>
      {props.listingId && <input type="hidden" name="listingId" value={props.listingId} />}
      <Card className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{e.type} *</span>
          <select
            name="categoryId"
            defaultValue={v.categoryId}
            disabled={!draft}
            onChange={(ev) => onTypeChange?.(ev.target.value)}
            className={selectClass}
          >
            <option value="">{e.chooseType}</option>
            {props.types.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFa}
              </option>
            ))}
          </select>
          <ErrorText code={errors.categoryId} />
        </label>
        <div>
          <Field label={`${t.titleLabel} *`} hint={e.titleHint} name="title" defaultValue={v.title} maxLength={90} required />
          <ErrorText code={errors.title} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.descriptionLabel} *</span>
          <textarea
            name="description"
            defaultValue={v.description}
            rows={6}
            maxLength={5000}
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
          <span className="mt-1 block text-xs text-neutral-500">{e.descriptionHint}</span>
          <ErrorText code={errors.description} />
        </label>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">{e.when}</h2>
          <p className="text-xs text-neutral-500">{e.whenHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label={`${e.startDate} *`} name="startDate" value={startDate} onChange={setStartDate} error={errors.startDate} />
          <div>
            <Field label={`${e.startTime} *`} name="startTime" type="time" defaultValue={v.startTime} dir="ltr" className="text-end" />
            <ErrorText code={errors.startTime} />
          </div>
          <DateField label={e.endDate} name="endDate" value={endDate} onChange={setEndDate} error={errors.endDate} />
          <div>
            <Field label={`${e.endTime} *`} name="endTime" type="time" defaultValue={v.endTime} hint={e.endHint} dir="ltr" className="text-end" />
            <ErrorText code={errors.endTime} />
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{e.repeat}</span>
          <select name="repeat" value={repeat} onChange={(ev) => setRepeat(ev.target.value as typeof repeat)} className={selectClass}>
            {(['none', 'weekly', 'monthly'] as const).map((r) => (
              <option key={r} value={r}>
                {e.repeatOptions[r]}
              </option>
            ))}
          </select>
        </label>
        {repeat !== 'none' && (
          <DateField
            label={`${e.repeatUntil} *`}
            name="repeatUntil"
            value={repeatUntil}
            onChange={setRepeatUntil}
            error={errors.repeatUntil}
            hint={<span className="mt-1 block text-xs text-neutral-500">{e.repeatHint}</span>}
          />
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{e.where}</h2>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-700">{e.attendance}</legend>
          <div className="flex flex-wrap gap-4">
            {(['in_person', 'online', 'hybrid'] as const).map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <input type="radio" name="attendance" value={a} checked={attendance === a} onChange={() => setAttendance(a)} />
                {messages.events.attendance[a]}
              </label>
            ))}
          </div>
        </fieldset>
        {attendance !== 'online' && (
          <>
            <div>
              <Field label={`${e.venueName} *`} hint={e.venueHint} name="venueName" defaultValue={v.venueName} maxLength={100} />
              <ErrorText code={errors.venueName} />
            </div>
            <div>
              <Field label={e.streetAddress} hint={e.streetHint} name="streetAddress" defaultValue={v.streetAddress} maxLength={120} />
              <ErrorText code={errors.streetAddress} />
            </div>
          </>
        )}
        <PlaceField
          countries={props.countries}
          initial={v.place}
          showDistrict={false}
          onCountryChange={setCountryCode}
          errors={{ countryCode: placeError('countryCode'), place: placeError('place'), area: placeError('area') }}
        />
        <p className="text-xs text-neutral-500">{e.placeHint}</p>
        {attendance !== 'in_person' && (
          <div>
            <Field label={`${e.onlineUrl} *`} hint={e.onlineHint} name="onlineUrl" type="url" defaultValue={v.onlineUrl} dir="ltr" maxLength={500} />
            <ErrorText code={errors.onlineUrl} />
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{e.tickets}</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{e.priceType}</span>
          <select name="priceType" value={priceType} onChange={(ev) => setPriceType(ev.target.value as EventPrice)} className={selectClass}>
            {(['free', 'fixed', 'on_request'] as const).map((p) => (
              <option key={p} value={p}>
                {e.priceTypes[p]}
              </option>
            ))}
          </select>
          <ErrorText code={errors.priceType} />
        </label>
        {priceType === 'fixed' && (
          <div>
            <Field label={e.amount} hint={t.amountHint} name="amount" defaultValue={v.amount} inputMode="decimal" dir="ltr" className="text-end" />
            {currencySymbol && <span className="mt-1 block text-xs text-neutral-500">{t.currencyOf(currencySymbol)}</span>}
            <ErrorText code={errors.amount} />
          </div>
        )}
        <div>
          <Field label={e.ticketUrl} hint={e.ticketHint} name="ticketUrl" type="url" defaultValue={v.ticketUrl} dir="ltr" maxLength={500} />
          <ErrorText code={errors.ticketUrl} />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{e.more}</h2>
        <div>
          <Field label={e.organizerName} hint={e.organizerHint} name="organizerName" defaultValue={v.organizerName} maxLength={80} />
          <ErrorText code={errors.organizerName} />
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-700">{e.languages}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(['fa', 'de', 'en', 'other'] as const).map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="languages" value={l} defaultChecked={languages.has(l)} />
                {messages.events.languages[l]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{e.minAge}</span>
          <select name="minAge" defaultValue={AGES.includes(v.minAge) ? v.minAge : ''} className={selectClass}>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a ? messages.events.age.min(Number(a)) : messages.events.age.all}
              </option>
            ))}
          </select>
          <ErrorText code={errors.minAge} />
        </label>
        {!draft && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{e.scheduleStatus}</span>
            <select name="scheduleStatus" defaultValue={v.scheduleStatus} className={selectClass}>
              {(['scheduled', 'postponed', 'cancelled'] as const).map((s) => (
                <option key={s} value={s}>
                  {messages.events.scheduleStatus[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="allowPhoneContact" defaultChecked={v.allowPhoneContact} className="size-5" />
          {t.allowPhone}
        </label>
      </Card>

      {props.needsName && (
        <Card>
          <Field label={t.yourName} hint={t.yourNameHint} name="displayName" maxLength={50} autoComplete="name" />
          <ErrorText code={errors.displayName} />
        </Card>
      )}

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.notice && <Alert tone="success">{state.notice}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        {draft || rejected ? (
          <>
            <Button type="submit" name="intent" value="publish" disabled={pending} className="sm:flex-1">
              {rejected ? t.resubmit : t.publish}
            </Button>
            <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending} className="sm:flex-1">
              {draft ? t.saveDraft : t.save}
            </Button>
          </>
        ) : (
          <Button type="submit" name="intent" value="save" disabled={pending} className="sm:flex-1">
            {t.save}
          </Button>
        )}
      </div>
    </form>
  );
}
