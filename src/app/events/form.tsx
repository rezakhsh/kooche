'use client';

import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DateInput } from '../../components/date-input';
import { Icon } from '../../components/icons';
import { MapPinField } from '../../components/map-pin-field';
import { PlaceField, type PlaceFieldValue } from '../../components/place-field';
import { TermsNotice } from '../../components/terms-notice';
import { useTurnstile } from '../../components/turnstile';
import { Alert, Button } from '../../components/ui';
import { messages } from '../../messages/fa';
import type { FieldError } from '../../modules/listings/listings';
import { saveEventAction, type EventSaveState } from './actions';
import { eventStepOf, firstEventStepWithErrors, type EventStep } from './steps';

// The event form (wave 1, mockups final/post-event1 and post-event2; step 3 designed in the same
// style). A draft is filled in three steps (./steps.ts): the poster, type and title; the time and
// place; the tickets, details and publishing. Each «ادامه» saves the draft. An event that is out
// shows every part at once with one save button. Plain fields, so it also posts without
// JavaScript (then every step shows at once, see ../my/listings/[id]/no-script-steps.tsx).
// Dates and times are Gregorian, at the venue.

type Attendance = 'in_person' | 'online' | 'hybrid';
type EventPrice = 'free' | 'fixed' | 'on_request';
type Language = 'fa' | 'de' | 'en' | 'other';
type RepeatMode = 'none' | 'days' | 'weekly' | 'monthly';
type Tri = '' | 'yes' | 'no';

export type EventFormProps = {
  /** null: a new event nobody saved yet; the first save starts the draft */
  listingId: string | null;
  status: string;
  /** The event types (leaf categories of the events section) */
  types: { id: string; nameFa: string }[];
  /** The event's country only (fixed, like every listing's); empty until the visitor chose one */
  countries: { code: string; nameFa: string; currencySymbol: string }[];
  /** False once the event has a country: then "change country" isn't offered */
  countryChangeable: boolean;
  needsName: boolean;
  /** «خودم (…)» */
  userName: string;
  /** The city the times are read in («به وقت برلین») */
  cityName: string;
  /** Post as the user or one of their businesses, chosen while it is a draft */
  postAs: { options: { id: string; name: string; slug: string; legal: boolean }[]; locked: boolean };
  /** Cloudflare Turnstile for "publish" (src/components/turnstile.tsx); null when it is off */
  turnstileSiteKey: string | null;
  /** The street map's version for the venue's pin; null without a map file */
  mapVersion: string | null;
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
    /** "lat,lng" of the venue's pin, or "" */
    pin: string;
    onlineUrl: string;
    ticketUrl: string;
    organizerName: string;
    languages: Language[];
    minAge: string;
    scheduleStatus: 'scheduled' | 'postponed' | 'cancelled';
    timeZone: string;
    seating: string;
    stepFree: Tri;
    doorSales: Tri;
    refundNote: string;
    performers: { name: string; role: string }[];
    organizationId: string;
  };
};

export type EventWizard = {
  step: EventStep;
  setStep: (s: EventStep) => void;
  /** The poster's thumbnail, for the check before publishing */
  poster: string | null;
};

const t = messages.form;
const e = messages.events.form;
const st = messages.events.steps;

const TITLE_MAX = 90;
const AGES = ['', '6', '12', '16', '18'];
/** Half hours, as organisers announce them */
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const selectClass =
  'block h-12 w-full rounded-xl border border-neutral-400 bg-white px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';
const inputClass =
  'block h-12 w-full rounded-xl border border-neutral-400 bg-white px-4 text-base outline-none focus:border-2 focus:border-brand-600';
const pill =
  'flex h-10 items-center rounded-full border border-neutral-300 px-3.5 text-sm peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40';
const segment =
  'flex h-10 items-center justify-center rounded-lg px-1 text-center text-sm text-neutral-700 peer-checked:bg-white peer-checked:font-bold peer-checked:text-neutral-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40';

const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });

function ErrorText({ code }: { code?: FieldError }) {
  if (!code) return null;
  return <span className="mt-1 block text-xs text-red-700">{t.errors[code] ?? t.errors.invalid}</span>;
}

function Label({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  return (
    <p className="mt-5 mb-1.5 text-sm font-bold">
      {children}
      {optional && <span className="ms-1 font-normal text-neutral-600">{st.optional}</span>}
    </p>
  );
}

function Pills<V extends string>({ name, options, value, onChange, type = 'radio' }: { name: string; options: [V, string][]; value: V | V[]; onChange?: (v: V) => void; type?: 'radio' | 'checkbox' }) {
  const on = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v || 'none'} className="cursor-pointer">
          <input type={type} name={name} value={v} defaultChecked={on(v)} onChange={() => onChange?.(v)} className="peer sr-only" />
          <span className={pill}>{label}</span>
        </label>
      ))}
    </div>
  );
}

function Segments<V extends string>({ name, options, value, onChange }: { name: string; options: [V, string][]; value: V; onChange?: (v: V) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
      {options.map(([v, label]) => (
        <label key={v || 'none'} className="flex-1 cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={value === v} onChange={() => onChange?.(v)} className="peer sr-only" />
          <span className={segment}>{label}</span>
        </label>
      ))}
    </div>
  );
}

function TimeSelect({ name, value, empty, label }: { name: string; value: string; empty?: string; label: string }) {
  const options = value && !TIMES.includes(value) ? [value, ...TIMES] : TIMES;
  return (
    <select name={name} defaultValue={value} aria-label={label} dir="ltr" className={`${selectClass} text-end`}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((x) => (
        <option key={x} value={x}>
          {x.replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!)}
        </option>
      ))}
    </select>
  );
}

/** «یکشنبه، ۸ نوامبر ۲۰۲۶، ۱۴ روز دیگر» under the date */
function DayLine({ iso }: { iso: string }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (date.getUTCDate() !== Number(m[3])) return null;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: 'UTC', ...o }).format(date);
  const now = new Date();
  const days = Math.round((date.getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)) / 86_400_000);
  const day = `${f({ weekday: 'long' })}، ${f({ day: 'numeric', month: 'long', year: 'numeric' })}`;
  return <p className="mt-1 text-xs text-neutral-600">{days >= 0 ? st.dayLine(day, messages.events.view.inDays(days)) : day}</p>;
}

type Venue = { name: string; street: string | null; place: { value: string; label: string; center: { lat: number; lng: number } } | null; neighbourhood: string | null; events: number };

/** The venue's name with suggestions from venues already on Peydoo (mockup final/post-event2) */
function VenueField({ country, initial, onPick, error }: { country: string; initial: string; onPick: (v: Venue) => void; error?: FieldError }) {
  const [text, setText] = useState(initial);
  const [list, setList] = useState<Venue[]>([]);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const search = (q: string) => {
    clearTimeout(timer.current);
    if (q.trim().length < 2 || !country) {
      setList([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/venues?c=${country}&q=${encodeURIComponent(q.trim())}`);
        const body = (await res.json()) as { venues: Venue[] };
        setList(body.venues ?? []);
        setActive(0);
      } catch {
        setList([]);
      }
    }, 250);
  };
  const pick = (v: Venue) => {
    setText(v.name);
    setList([]);
    onPick(v);
  };
  return (
    <div className={`mt-3 rounded-xl border-2 ${list.length ? 'border-brand-600' : 'border-transparent'}`}>
      <label className={`flex h-12 items-center gap-2 rounded-xl px-3 ${list.length ? '' : 'border border-neutral-400 focus-within:border-2 focus-within:border-brand-600'}`}>
        <Icon name="search" className="size-5 shrink-0 text-neutral-500" />
        <span className="sr-only">{st.venueSearch}</span>
        <input
          name="venueName"
          value={text}
          maxLength={100}
          autoComplete="off"
          placeholder={st.venueSearch}
          onChange={(ev) => {
            setText(ev.target.value);
            search(ev.target.value);
          }}
          onKeyDown={(ev) => {
            if (!list.length) return;
            if (ev.key === 'ArrowDown') setActive((a) => Math.min(a + 1, list.length - 1));
            else if (ev.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (ev.key === 'Enter') {
              ev.preventDefault();
              pick(list[active]!);
            } else if (ev.key === 'Escape') setList([]);
            else return;
            ev.preventDefault();
          }}
          role="combobox"
          aria-expanded={list.length > 0}
          aria-controls="venue-list"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </label>
      {list.length > 0 && (
        <ul id="venue-list" role="listbox" className="border-t border-neutral-200">
          {list.map((v, i) => (
            <li key={`${v.name}|${v.street}`} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => pick(v)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-start ${i === active ? 'bg-brand-50' : 'hover:bg-neutral-50'}`}>
                <Icon name="pin" className="size-4 shrink-0 text-brand-700" />
                <span className="min-w-0">
                  <bdi className="block text-sm font-bold">{v.name}</bdi>
                  <span className="block truncate text-xs text-neutral-600">{[v.street, v.neighbourhood ?? v.place?.label, st.venueOnPeydoo(v.events)].filter(Boolean).join('، ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ErrorText code={error} />
    </div>
  );
}

function Performers({ initial, error }: { initial: { name: string; role: string }[]; error?: FieldError }) {
  const [rows, setRows] = useState(() => (initial.length ? initial : [{ name: '', role: '' }]).map((r, i) => ({ ...r, key: i })));
  const next = useRef(rows.length);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-[1fr_8rem_auto] gap-2">
          <input name="performerName" defaultValue={r.name} maxLength={60} placeholder={st.performerName} aria-label={st.performerName} className={inputClass} />
          <input name="performerRole" defaultValue={r.role} maxLength={40} placeholder={st.performerRole} aria-label={st.performerRole} className={inputClass} />
          <button
            type="button"
            onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [{ name: '', role: '', key: next.current++ }]))}
            aria-label={st.removePerformer}
            title={st.removePerformer}
            className="flex size-12 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
      ))}
      {rows.length < 8 && (
        <button type="button" onClick={() => setRows((x) => [...x, { name: '', role: '', key: next.current++ }])} className="flex h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-brand-800 hover:bg-brand-50">
          <Icon name="plus" className="size-4" />
          {st.addPerformer}
        </button>
      )}
      <ErrorText code={error} />
    </div>
  );
}

export function EventForm(
  props: EventFormProps & {
    onDraftCreated?: (listingId: string) => void;
    onTypeChange?: (categoryId: string) => void;
    /** The poster editor, step 1 */
    photos?: ReactNode;
    wizard?: EventWizard | null;
  },
) {
  const [state, dispatch, pending] = useActionState<EventSaveState, FormData>(saveEventAction, undefined);
  const { onDraftCreated, onTypeChange, wizard = null } = props;
  useEffect(() => {
    if (state?.listingId) onDraftCreated?.(state.listingId);
  }, [state?.listingId, onDraftCreated]);
  const v = props.values;
  const leaving = useRef<EventStep | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!wizard || !state?.at) return;
    const from = leaving.current;
    leaving.current = null;
    // A refused publish: back to the first step with something to fix
    const target = state.errors ? firstEventStepWithErrors(state.errors, 3) : from && state.missing ? (firstEventStepWithErrors(state.missing, from) ?? ((from + 1) as EventStep)) : null;
    if (target && target !== wizard.step) {
      wizard.setStep(target);
      window.scrollTo({ top: 0 });
    }
    // Only state changes move the steps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);

  // While stepping, only the steps already left show their missing fields
  const missingShown = wizard && state?.missing ? Object.fromEntries(Object.entries(state.missing).filter(([k]) => eventStepOf(k) < wizard.step)) : {};
  const errors = state?.errors ?? missingShown;
  const shown = (n: EventStep) => !wizard || wizard.step === n;
  const section = (n: EventStep) => ({ 'data-step': wizard ? n : undefined, className: shown(n) ? 'block' : 'hidden' });

  const [priceType, setPriceType] = useState<EventPrice>(v.priceType);
  const [attendance, setAttendance] = useState<Attendance>(v.attendance);
  const [repeat, setRepeat] = useState<RepeatMode>(v.repeat !== 'none' ? v.repeat : v.endDate ? 'days' : 'none');
  const [startDate, setStartDate] = useState(v.startDate);
  const [titleLength, setTitleLength] = useState(v.title.length);
  const [street, setStreet] = useState(v.streetAddress);
  const [place, setPlace] = useState<{ value: PlaceFieldValue; key: number }>({ value: v.place, key: 0 });
  const [pinPlace, setPinPlace] = useState({ value: v.place.placeValue, center: v.place.center });
  const currencySymbol = props.countries[0]?.currencySymbol ?? '';
  const placeError = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.errors.invalid) : undefined);

  const draft = props.status === 'draft';
  const rejected = props.status === 'rejected';
  // Publishing needs Turnstile, saving doesn't. A publish spends the token, so a new one after it.
  const turnstile = useTurnstile(draft || rejected ? props.turnstileSiteKey : null, 'publish-event');
  const { reset: resetTurnstile } = turnstile;
  const sentPublish = useRef(false);
  useEffect(() => {
    if (state && sentPublish.current) resetTurnstile();
    sentPublish.current = false;
  }, [state, resetTurnstile]);

  // The check at step 3, read from the form as it is
  const [summary, setSummary] = useState<Record<string, string>>({});
  const readSummary = useCallback(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const day = ['day', 'month', 'year'].map((p) => get(`startDate.${p}`));
    const when = day.every(Boolean)
      ? `${fa(Number(day[0]))} ${messages.form.months[Number(day[1]) - 1]} ${fa(Number(day[2]))}${get('startTime') ? `، ${get('startTime').replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!)}` : ''}`
      : '';
    const att = get('attendance') as Attendance;
    const where = att === 'online' ? messages.events.attendance.online : [get('venueName'), get('place')].filter(Boolean).join('، ');
    const pt = get('priceType') as EventPrice;
    const entry = pt === 'fixed' ? (get('amount') ? `${messages.events.price.from(`${get('amount')} ${currencySymbol}`)}` : '') : pt ? st.entries[pt] : '';
    setSummary({ title: get('title'), when, where, entry });
  }, [currencySymbol]);
  useEffect(() => {
    if (!wizard || wizard.step < 3) return;
    readSummary();
    const form = formRef.current;
    form?.addEventListener('input', readSummary);
    form?.addEventListener('change', readSummary);
    return () => {
      form?.removeEventListener('input', readSummary);
      form?.removeEventListener('change', readSummary);
    };
  }, [wizard, readSummary]);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(ev.currentTarget, submitter);
    sentPublish.current = submitter?.value === 'publish';
    if (submitter?.value === 'next' && wizard) leaving.current = wizard.step;
    startTransition(() => dispatch(data));
  }

  const names: readonly string[] = st.names;
  const country = props.countries[0]?.code ?? '';

  return (
    <form ref={formRef} action={dispatch} onSubmit={onSubmit} className={wizard ? 'pb-24 lg:pb-0' : 'space-y-8'} noValidate>
      {props.listingId && <input type="hidden" name="listingId" value={props.listingId} />}

      {/* 1. Poster, type and title */}
      <section {...section(1)}>
        {wizard && <h1 className="mt-5 text-2xl font-extrabold">{st.posterHeading}</h1>}
        {!wizard && <h2 className="text-lg font-extrabold">{names[0]}</h2>}
        <p className="mt-1 text-sm text-neutral-600">{st.posterLead}</p>
        <div className="mt-4">{props.photos}</div>
        <Label>{st.type}</Label>
        {draft ? (
          <Pills name="categoryId" value={v.categoryId} options={props.types.map((c) => [c.id, c.nameFa])} onChange={(id) => onTypeChange?.(id)} />
        ) : (
          <>
            <input type="hidden" name="categoryId" value={v.categoryId} />
            <p className="text-sm">{props.types.find((c) => c.id === v.categoryId)?.nameFa}</p>
          </>
        )}
        <ErrorText code={errors.categoryId} />
        <label className="mt-5 block">
          <span className="flex justify-between text-sm font-bold">
            <span>{st.title}</span>
            <span className="font-normal text-neutral-600">{st.titleCount(titleLength, TITLE_MAX)}</span>
          </span>
          <input name="title" defaultValue={v.title} maxLength={TITLE_MAX} onChange={(ev) => setTitleLength(ev.target.value.length)} className={`mt-1.5 ${inputClass}`} />
          <span className="mt-1 block text-xs text-neutral-600">{st.titleHint}</span>
          <ErrorText code={errors.title} />
        </label>
      </section>

      {/* 2. Time and place */}
      <section {...section(2)}>
        {wizard ? <h1 className="mt-5 text-2xl font-extrabold">{st.whenHeading}</h1> : <h2 className="text-lg font-extrabold">{names[1]}</h2>}
        <div className="mt-5">
          <DateInput label={st.date} name="startDate" defaultValue={v.startDate} onChange={setStartDate} years={{ before: 0, after: 2 }} />
          <DayLine iso={startDate} />
          <ErrorText code={errors.startDate} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-sm font-bold">{st.start}</p>
            <TimeSelect name="startTime" value={v.startTime || '20:00'} label={st.start} />
            <ErrorText code={errors.startTime} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold">
              {st.end} <span className="font-normal text-neutral-600">{st.optional}</span>
            </p>
            <TimeSelect name="endTime" value={v.endTime} empty="—" label={st.end} />
            <ErrorText code={errors.endTime} />
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-600">{st.timeHint(props.cityName)}</p>

        <Label>{st.repeat}</Label>
        <Pills<RepeatMode>
          name="repeatMode"
          value={repeat}
          onChange={setRepeat}
          options={[
            ['none', st.repeats.none],
            ['days', st.repeats.days],
            ['weekly', st.repeats.weekly],
            ['monthly', st.repeats.monthly],
          ]}
        />
        {repeat === 'days' && (
          <div className="mt-3">
            <DateInput label={st.lastDay} name="endDate" defaultValue={v.endDate} years={{ before: 0, after: 2 }} showDay />
            <ErrorText code={errors.endDate} />
          </div>
        )}
        {(repeat === 'weekly' || repeat === 'monthly') && (
          <div className="mt-3">
            <DateInput label={st.until} name="repeatUntil" defaultValue={v.repeatUntil} years={{ before: 0, after: 2 }} showDay />
            <span className="mt-1 block text-xs text-neutral-600">{e.repeatHint}</span>
            <ErrorText code={errors.repeatUntil} />
          </div>
        )}

        <Label>{st.where}</Label>
        <Segments<Attendance>
          name="attendance"
          value={attendance}
          onChange={setAttendance}
          options={[
            ['in_person', st.attendance.in_person],
            ['online', st.attendance.online],
            ['hybrid', st.attendance.hybrid],
          ]}
        />
        {attendance !== 'online' && (
          <>
            <VenueField
              country={country}
              initial={v.venueName}
              error={errors.venueName}
              onPick={(venue) => {
                setStreet(venue.street ?? '');
                if (venue.place) setPlace((p) => ({ key: p.key + 1, value: { ...p.value, place: venue.place!.label, placeValue: venue.place!.value, center: venue.place!.center, area: null } }));
              }}
            />
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-bold">{st.street}</span>
              <input name="streetAddress" value={street} onChange={(ev) => setStreet(ev.target.value)} maxLength={120} dir="auto" className={inputClass} />
              <span className="mt-1 block text-xs text-neutral-600">{e.streetHint}</span>
              <ErrorText code={errors.streetAddress} />
            </label>
          </>
        )}
        <div className="mt-3">
          {props.countries[0] ? (
            <PlaceField
              key={place.key}
              countries={props.countries}
              initial={place.value}
              showDistrict={false}
              allowArea={false}
              compact={!!wizard}
              fixed={{
                hint: props.countryChangeable ? messages.form.countryFixedEvent : messages.form.countryFixedEdit,
                changeHref: props.countryChangeable ? '/?choose' : null,
              }}
              errors={{ countryCode: placeError('countryCode'), place: placeError('place'), area: placeError('area') }}
              onPlaceChange={setPinPlace}
            />
          ) : (
            <Alert tone="info">
              {messages.form.chooseCountryFirst}{' '}
              <a href="/?choose" className="font-bold underline">
                {messages.form.changeCountry}
              </a>
            </Alert>
          )}
          <p className="mt-1 text-xs text-neutral-600">{e.placeHint}</p>
          {attendance !== 'online' && (
            <MapPinField
              version={props.mapVersion}
              place={pinPlace}
              initial={v.pin}
              error={errors.pin === 'too_far' ? messages.map.pickTooFar : errors.pin ? (t.errors[errors.pin] ?? t.errors.invalid) : undefined}
            />
          )}
        </div>
        {attendance !== 'in_person' && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-bold">{e.onlineUrl}</span>
            <input name="onlineUrl" type="url" defaultValue={v.onlineUrl} dir="ltr" maxLength={500} className={inputClass} />
            <span className="mt-1 block text-xs text-neutral-600">{e.onlineHint}</span>
            <ErrorText code={errors.onlineUrl} />
          </label>
        )}
      </section>

      {/* 3. Tickets, details and publishing (no mockup: designed like the steps before it) */}
      <section {...section(3)}>
        {wizard ? <h1 className="mt-5 text-2xl font-extrabold">{st.ticketsHeading}</h1> : <h2 className="text-lg font-extrabold">{names[2]}</h2>}
        <Label>{st.entry}</Label>
        <Segments<EventPrice>
          name="priceType"
          value={priceType}
          onChange={setPriceType}
          options={[
            ['free', st.entries.free],
            ['fixed', st.entries.fixed],
            ['on_request', st.entries.on_request],
          ]}
        />
        <ErrorText code={errors.priceType} />
        {priceType === 'fixed' && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-bold">{st.cheapest}</span>
            <span className="flex items-center gap-2">
              <input name="amount" defaultValue={v.amount} inputMode="decimal" dir="ltr" className={`${inputClass} text-end`} />
              <span className="shrink-0 text-base font-bold text-neutral-700">{currencySymbol}</span>
            </span>
            <ErrorText code={errors.amount} />
          </label>
        )}
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-bold">
            {st.ticketLink} <span className="font-normal text-neutral-600">{st.optional}</span>
          </span>
          <input name="ticketUrl" type="url" defaultValue={v.ticketUrl} dir="ltr" maxLength={500} placeholder="https://" className={inputClass} />
          <span className="mt-1 block text-xs text-neutral-600">{st.ticketLinkHint}</span>
          <ErrorText code={errors.ticketUrl} />
        </label>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-bold">{st.about}</span>
          <textarea name="description" defaultValue={v.description} rows={5} maxLength={5000} className="block w-full rounded-xl border border-neutral-400 px-4 py-3 text-base leading-8 outline-none focus:border-2 focus:border-brand-600" />
          <span className="mt-1 block text-xs text-neutral-600">{st.aboutHint}</span>
          <ErrorText code={errors.description} />
        </label>

        <Label optional>{st.performers}</Label>
        <Performers initial={v.performers} error={errors.performers} />

        <h2 className="mt-6 text-base font-extrabold">{st.facts}</h2>
        <Label>{e.languages}</Label>
        <Pills<Language> name="languages" type="checkbox" value={v.languages} options={(['fa', 'de', 'en', 'other'] as const).map((l) => [l, messages.events.languages[l]])} />
        <Label>{st.age}</Label>
        <Pills name="minAge" value={AGES.includes(v.minAge) ? v.minAge : ''} options={AGES.map((a) => [a, a ? st.agePlus(Number(a)) : st.ages.all])} />
        <ErrorText code={errors.minAge} />
        {attendance !== 'online' && (
          <>
            <Label>{messages.events.view.facts.seating}</Label>
            <Pills
              name="seating"
              value={v.seating}
              options={[
                ...(['numbered', 'seated', 'standing', 'mixed'] as const).map((x) => [x, messages.events.view.seating[x]] as [string, string]),
                ['', st.notSaid],
              ]}
            />
            <Label>{messages.events.view.facts.access}</Label>
            <Pills<Tri> name="stepFree" value={v.stepFree} options={[['yes', messages.events.view.stepFree.yes], ['no', messages.events.view.stepFree.no], ['', st.notSaid]]} />
          </>
        )}
        {priceType !== 'free' && (
          <>
            <Label>{messages.events.view.facts.door}</Label>
            <Pills<Tri> name="doorSales" value={v.doorSales} options={[['yes', messages.events.view.door.yes], ['no', messages.events.view.door.no], ['', st.notSaid]]} />
            <label className="block">
              <Label optional>{messages.events.view.facts.refund}</Label>
              <input name="refundNote" defaultValue={v.refundNote} maxLength={80} placeholder={st.refundPlaceholder} className={inputClass} />
              <ErrorText code={errors.refundNote} />
            </label>
          </>
        )}

        <h2 className="mt-6 text-base font-extrabold">{st.organizer}</h2>
        {props.postAs.options.length > 0 && (
          <>
            <Label>{st.postAs}</Label>
            {props.postAs.locked ? (
              <p className="text-sm font-bold">{props.postAs.options.find((o) => o.id === v.organizationId)?.name ?? st.myself(props.userName)}</p>
            ) : (
              <Pills name="organizationId" value={v.organizationId} options={[['', st.myself(props.userName)], ...props.postAs.options.map((o) => [o.id, o.name] as [string, string])]} />
            )}
            <ErrorText code={errors.organizationId} />
            {/* A business without its Impressum can't publish yet (src/modules/organizations/limits.ts) */}
            {!props.postAs.locked &&
              props.postAs.options
                .filter((o) => !o.legal)
                .map((o) => (
                  <p key={o.id} className="text-xs leading-6 text-red-700">
                    {messages.business.limits.legalMissingFor(o.name)}{' '}
                    <a href={`/b/${o.slug}/edit`} className="font-bold underline">
                      {messages.business.limits.completeLegal}
                    </a>
                  </p>
                ))}
          </>
        )}
        <label className="block">
          <Label>{st.organizerName}</Label>
          <input name="organizerName" defaultValue={v.organizerName} maxLength={80} className={inputClass} />
          <span className="mt-1 block text-xs text-neutral-600">{e.organizerHint}</span>
          <ErrorText code={errors.organizerName} />
        </label>
        {!draft && (
          <>
            <Label>{e.scheduleStatus}</Label>
            <Pills name="scheduleStatus" value={v.scheduleStatus} options={(['scheduled', 'postponed', 'cancelled'] as const).map((s) => [s, messages.events.scheduleStatus[s]])} />
          </>
        )}
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input type="checkbox" name="allowPhoneContact" defaultChecked={v.allowPhoneContact} className="size-5" />
          {t.allowPhone}
        </label>
        {props.needsName && (
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-bold">{t.yourName}</span>
            <input name="displayName" maxLength={50} autoComplete="name" className={inputClass} />
            <span className="mt-1 block text-xs text-neutral-600">{t.yourNameHint}</span>
            <ErrorText code={errors.displayName} />
          </label>
        )}

        {wizard && (
          <section className="mt-6">
            <h2 className="text-lg font-extrabold">{st.check}</h2>
            <dl className="mt-1 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 px-4">
              {(
                [
                  ['poster', null, 1],
                  ['title', summary.title, 1],
                  ['when', summary.when, 2],
                  ['where', summary.where, 2],
                  ['entry', summary.entry, 3],
                ] as const
              ).map(([key, value, step]) => (
                <div key={key} className="flex items-start gap-3 py-3">
                  <dt className="w-20 shrink-0 text-sm text-neutral-600">{st.checkRows[key]}</dt>
                  <dd className={`min-w-0 flex-1 text-sm leading-6 ${key === 'poster' || value ? 'font-bold' : 'text-neutral-600'}`}>
                    {key === 'poster' ? (
                      wizard.poster ? <img src={wizard.poster} alt="" width={44} height={55} className="h-14 w-11 rounded-lg object-cover" /> : <span className="font-normal text-neutral-600">{st.noPoster}</span>
                    ) : (
                      value || t.notEntered
                    )}
                  </dd>
                  {step !== 3 && (
                    <button type="button" onClick={() => wizard.setStep(step)} className="flex min-h-11 items-center text-sm font-bold text-brand-800 hover:underline">
                      {st.change}
                    </button>
                  )}
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-6 text-neutral-600">{t.reviewNote}</p>
          </section>
        )}
      </section>

      {state?.error && (
        <div className="mt-4">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      {state?.notice && (
        <div className="mt-4">
          <Alert tone="success">{state.notice}</Alert>
        </div>
      )}
      <div {...(wizard ? section(3) : {})}>
        {(draft || rejected) && <div className="mt-4">{turnstile.widget}</div>}
        {(draft || rejected) && (
          <div className="mt-4">
            <TermsNotice />
          </div>
        )}
      </div>

      {/* The plain buttons: an event that is out, and the steps without JavaScript (<noscript> shows them) */}
      <div data-noscript-actions className={wizard ? 'hidden' : 'flex flex-col gap-3 sm:flex-row-reverse'}>
        {draft || rejected ? (
          <>
            <Button type="submit" name="intent" value="publish" disabled={pending || !turnstile.ready} className="sm:flex-1">
              {!turnstile.ready ? messages.turnstile.checking : rejected ? t.resubmit : st.publish}
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

      {/* The steps' bar: back and continue within thumb reach; publish at the last step */}
      {wizard && (
        <div data-step-bar className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0">
          <div className="mx-auto flex max-w-2xl gap-2">
            {wizard.step > 1 && (
              <button
                type="button"
                onClick={() => {
                  wizard.setStep((wizard.step - 1) as EventStep);
                  window.scrollTo({ top: 0 });
                }}
                className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-5 font-bold text-neutral-800"
              >
                {st.previous}
              </button>
            )}
            {wizard.step < 3 ? (
              <button type="submit" name="intent" value="next" disabled={pending} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60">
                {st.continueTo(names[wizard.step]!)}
              </button>
            ) : (
              <button
                type="submit"
                name="intent"
                value="publish"
                disabled={pending || !turnstile.ready}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {!turnstile.ready ? messages.turnstile.checking : st.publish}
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
