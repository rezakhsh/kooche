'use client';

import Link from 'next/link';
import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DateInput } from '../../../../components/date-input';
import { TermsNotice } from '../../../../components/terms-notice';
import { useTurnstile } from '../../../../components/turnstile';
import { Icon } from '../../../../components/icons';
import { Alert, Button, Card, Field } from '../../../../components/ui';
import { PlaceField, type PlaceFieldValue } from '../../../../components/place-field';
import { messages } from '../../../../messages/fa';
import type { AttributeDef } from '../../../../modules/listings/catalog';
import { dependentOptions, parentOf } from '../../../../modules/listings/dependent-options';
import type { FieldError } from '../../../../modules/listings/listings';
import { saveListingAction, type SaveState } from '../actions';
import { firstStepWithErrors, stepOf, type Step } from './steps';

// The posting form (mobile first). Plain fields, so it also posts without JavaScript; with
// JavaScript the submit is intercepted so React doesn't clear what was typed when the server
// sends errors back.
// Wave 1 (mockups final/post2–post4): a draft is filled in steps, 2 photos and text, 3 details and
// price, 4 place and publishing (step 1, the category, is /new). Every field stays in the form, so
// each «ادامه» saves the whole draft; the server answers with what publishing would still refuse
// (`missing`), and the step goes on when its own fields are done. Choices are buttons, optional
// fields say «(اختیاری)», and step 4 ends with a check of everything with «تغییر» links. Without
// JavaScript the page's <noscript> style shows all steps at once with the plain buttons. A listing
// that is out keeps one page.

type PriceType = 'fixed' | 'negotiable' | 'free' | 'exchange' | 'on_request';

export type FormProps = {
  /** null: a new listing nobody saved yet; the first save starts the draft */
  listingId: string | null;
  categoryId: string;
  status: string;
  categoryPath: string[];
  /** The top category's slug: the description's prompts depend on it */
  rootSlug: string;
  /** A room or flat to rent: the price is the cold rent a month */
  rent: boolean;
  /** Things that can be sent by post (not homes, services, jobs, lessons) */
  shippable: boolean;
  defs: AttributeDef[];
  priceTypes: PriceType[];
  /**
   * The listing's country, fixed (decided Oct 17, 2026; src/modules/listings/posting-country.ts),
   * null when the visitor hasn't chosen one yet. Its currency is the listing's currency.
   */
  country: { code: string; nameFa: string; currencySymbol: string; currencyName: string } | null;
  /** False once the listing has a country: then "change country" isn't offered */
  countryChangeable: boolean;
  needsName: boolean;
  /** The seller's name, for «انتشار به نام: خودم (…)» */
  userName: string;
  /** Cloudflare Turnstile for "publish" (src/components/turnstile.tsx); null when it is off */
  turnstileSiteKey: string | null;
  /** "Post as": the user's businesses; fixed once the listing is out; some categories need one */
  postAs: { options: { id: string; name: string }[]; locked: boolean; businessOnly: boolean };
  values: {
    kind: 'offer' | 'wanted';
    title: string;
    description: string;
    attributes: Record<string, unknown>;
    priceType: PriceType;
    amount: string;
    place: PlaceFieldValue;
    rememberPlace: boolean;
    allowPhoneContact: boolean;
    shippingOffered: boolean;
    /** '' posts privately */
    organizationId: string;
  };
};

const t = messages.form;

/** The posting steps' state, from ListingEditor (null for a listing that is out: one page) */
export type Wizard = {
  step: Step;
  setStep: (s: Step) => void;
  /** Thumbnails in order (null while processing) */
  photos: (string | null)[];
  /** The form as text, for the preview beside the steps on computers */
  onSummary?: (s: Summary) => void;
};

/** What the check before publishing and the preview show */
export type Summary = { title?: string; price?: string; details?: string; postAs?: string };

/** How many photo thumbnails the check before publishing shows; the rest as «+۳» */
const CHECK_THUMBS = 4;

/** Choice lists up to this long are buttons; longer ones stay a select */
const SHORT_CHOICE = 6;

/** A radio or checkbox drawn as a button */
const pillClass =
  'flex min-h-11 items-center rounded-xl border border-neutral-300 px-4 text-sm text-neutral-800 peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700';

function Pill({ type, name, value, checked, onChange, children }: { type: 'radio' | 'checkbox'; name: string; value: string; checked?: boolean; onChange?: () => void; children: ReactNode }) {
  return (
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={onChange ? undefined : checked} checked={onChange ? checked : undefined} onChange={onChange} className="peer sr-only" />
      <span className={pillClass}>{children}</span>
    </label>
  );
}

/** An on/off choice as a switch (mockup final/post4); a checkbox underneath, so it posts as before */
function Toggle({ name, checked, hint, children }: { name: string; checked: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-300 px-4 py-2 text-sm">
      <span>
        {children}
        {hint && <span className="block text-xs text-neutral-600">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={checked} role="switch" className="peer sr-only" />
      <span
        aria-hidden
        className="flex h-6 w-11 shrink-0 items-center justify-start rounded-full bg-neutral-300 p-0.5 peer-checked:justify-end peer-checked:bg-brand-700 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700"
      >
        <i className="size-5 rounded-full bg-white shadow-sm" />
      </span>
    </label>
  );
}

/** A group of fields: a card with its heading on the one-page form, plain in the steps */
function Section({ titled, title, children }: { titled: boolean; title: string; children: ReactNode }) {
  if (!titled) return <div className="space-y-5">{children}</div>;
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

/** «عنوان» or «ودیعه (اختیاری)»: required fields are plain, optional ones say so */
function labelText(text: string, required: boolean): ReactNode {
  return (
    <>
      {text}
      {!required && <span className="ms-1 font-normal text-neutral-600">{t.optional}</span>}
    </>
  );
}

function ErrorText({ code }: { code?: FieldError }) {
  if (!code) return null;
  return <span className="mt-1 block text-xs text-red-700">{t.errors[code] ?? t.errors.invalid}</span>;
}

const selectClass =
  'block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

export function ListingForm(props: FormProps & { onDraftCreated?: (listingId: string) => void; wizard?: Wizard | null }) {
  const [state, dispatch, pending] = useActionState<SaveState, FormData>(saveListingAction, undefined);
  const { onDraftCreated, wizard = null } = props;
  useEffect(() => {
    if (state?.listingId) onDraftCreated?.(state.listingId);
  }, [state?.listingId, onDraftCreated]);
  const v = props.values;
  // The step «ادامه» was pressed on; its answer decides where to go
  const leaving = useRef<Step | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [summary, setSummaryState] = useState<Summary>({});
  const onSummary = wizard?.onSummary;
  const setSummary = useCallback(
    (x: Summary) => {
      setSummaryState(x);
      onSummary?.(x);
    },
    [onSummary],
  );
  const [titleLength, setTitleLength] = useState(v.title.length);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!wizard || !state?.at) return;
    const from = leaving.current;
    leaving.current = null;
    // A refused publish: back to the first step with something to fix
    const target = state.errors ? firstStepWithErrors(state.errors, 4) : from && state.missing ? (firstStepWithErrors(state.missing, from) ?? ((from + 1) as Step)) : null;
    if (target && target !== wizard.step) {
      wizard.setStep(target);
      window.scrollTo({ top: 0 });
    }
    // Only state changes move the steps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
  // What the check at step 4 and the preview beside steps 3–4 show, read from the form as it is
  const readSummary = useCallback(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const details = props.defs.flatMap((d) => {
      const text = fieldText(d, data);
      return text ? [text] : [];
    });
    const type = String(data.get('priceType') ?? props.priceTypes[0] ?? '');
    const amount = String(data.get('amount') ?? '').trim();
    const unit = props.rent ? ` ${messages.country.rentUnit}` : '';
    setSummary({
      title: String(data.get('title') ?? '').trim(),
      price: type === 'fixed' || type === 'negotiable' ? (amount ? `${amount} ${props.country?.currencySymbol ?? ''}${unit}${type === 'negotiable' ? `، ${messages.priceType.negotiable}` : ''}` : '') : type ? messages.priceType[type as PriceType] : '',
      details: details.join('، '),
      postAs: props.postAs.options.find((o) => o.id === String(data.get('organizationId') ?? v.organizationId))?.name ?? `${t.myself}${props.userName ? ` (${props.userName})` : ''}`,
    });
  }, [props.defs, props.priceTypes, props.rent, props.postAs.options, props.country, props.userName, v.organizationId, setSummary]);
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
  // While stepping, only the steps already left show their missing fields
  const missingShown = wizard && state?.missing ? Object.fromEntries(Object.entries(state.missing).filter(([k]) => stepOf(k) < wizard.step)) : {};
  const errors = state?.errors ?? missingShown;
  const shown = (n: Step) => !wizard || wizard.step === n;
  const section = (n: Step) => ({ 'data-step': wizard ? n : undefined, className: shown(n) ? 'space-y-6' : 'hidden' });
  const [priceType, setPriceType] = useState<PriceType>(props.priceTypes.includes(v.priceType) ? v.priceType : (props.priceTypes[0] ?? 'on_request'));
  const [selects, setSelects] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.defs.filter((d) => d.type === 'select').map((d) => [d.key, String(v.attributes[d.key] ?? '')])),
  );
  const currencySymbol = props.country?.currencySymbol ?? '';
  const placeError = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.errors.invalid) : undefined);

  const draft = props.status === 'draft';
  const rejected = props.status === 'rejected';
  // Publishing needs Turnstile, saving doesn't. A publish spends the token, so a new one after it.
  const turnstile = useTurnstile(draft || rejected ? props.turnstileSiteKey : null, 'publish-listing');
  const { reset: resetTurnstile } = turnstile;
  const sentPublish = useRef(false);
  useEffect(() => {
    if (state && sentPublish.current) resetTurnstile();
    sentPublish.current = false;
  }, [state, resetTurnstile]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget, submitter);
    sentPublish.current = submitter?.value === 'publish';
    if (submitter?.value === 'next' && wizard) leaving.current = wizard.step;
    startTransition(() => dispatch(data));
  }

  const stepNames: readonly string[] = t.steps;

  return (
    <form ref={formRef} action={dispatch} onSubmit={onSubmit} className={`space-y-6 ${wizard ? 'pb-24 lg:pb-0' : ''}`} noValidate>
      {props.listingId && <input type="hidden" name="listingId" value={props.listingId} />}
      <input type="hidden" name="categoryId" value={props.categoryId} />

      <div {...section(2)}>
        {/* A listing that is out shows its category here; the steps have it in the top bar */}
        {!wizard && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
            <div className="min-w-0">
              <span className="block text-xs text-neutral-600">{t.category}</span>
              <span className="block truncate text-sm font-bold">{props.categoryPath.join('، ')}</span>
            </div>
          </div>
        )}
        <div>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm font-bold">
              <span>{wizard ? t.titleShort : t.titleLabel}</span>
              <span className="font-normal text-neutral-600">{t.titleCount(titleLength, 90)}</span>
            </span>
            <input
              name="title"
              defaultValue={v.title}
              maxLength={90}
              required
              onChange={(e) => setTitleLength(e.target.value.length)}
              className="block h-12 w-full rounded-xl border border-neutral-300 px-4 text-base outline-none focus:border-2 focus:border-brand-600"
            />
            {!wizard && <span className="mt-1 block text-xs text-neutral-600">{t.titleHint}</span>}
          </label>
          <ErrorText code={errors.title} />
        </div>
        <div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">{t.descriptionLabel}</span>
            <textarea
              ref={descriptionRef}
              name="description"
              defaultValue={v.description}
              rows={4}
              maxLength={5000}
              className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base leading-8 outline-none focus:border-2 focus:border-brand-600"
            />
          </label>
          {/* What to write (mockup final/post2): a tap adds the topic to the text */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-600">{t.promptsLead}</span>
            {(t.prompts[props.rootSlug] ?? t.prompts.default ?? []).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const area = descriptionRef.current;
                  if (!area) return;
                  area.value = `${area.value.trimEnd()}${area.value.trim() ? '\n' : ''}${p}: `;
                  area.focus();
                }}
                className="min-h-8 rounded-full bg-neutral-100 px-2.5 text-xs text-neutral-700 hover:bg-neutral-200"
              >
                + {p}
              </button>
            ))}
          </div>
          {!wizard && <span className="mt-1 block text-xs text-neutral-600">{t.descriptionHint}</span>}
          <ErrorText code={errors.description} />
        </div>
        <fieldset>
          <legend className="sr-only">{t.kind}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['offer', 'wanted'] as const).map((k) => (
              <label key={k} className="cursor-pointer">
                <input type="radio" name="kind" value={k} defaultChecked={v.kind === k} className="peer sr-only" />
                <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 text-sm text-neutral-700 peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700 [&>svg]:hidden peer-checked:[&>svg]:block">
                  <Icon name="check" className="size-4" />
                  {t.kindShort[k]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div {...section(3)}>
      {/* The price first, then the category's fields (mockup final/post3); cards only on one page */}
      {props.priceTypes.length > 0 && (
        <Section titled={!wizard} title={t.price}>
          {(priceType === 'fixed' || priceType === 'negotiable') && (
            <div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">{props.rent ? t.rentAmount : t.amount}</span>
                <span className="flex h-12 items-center rounded-xl border border-neutral-300 px-4 focus-within:border-2 focus-within:border-brand-600">
                  <input name="amount" defaultValue={v.amount} inputMode="decimal" dir="ltr" className="min-w-0 flex-1 bg-transparent text-end text-base outline-none" />
                  {currencySymbol && <span className="ms-2 text-neutral-600">{currencySymbol}</span>}
                </span>
              </label>
              <ErrorText code={errors.amount} />
            </div>
          )}
          {/* The kind of price only where there is a choice */}
          {props.priceTypes.length > 1 ? (
            <fieldset>
              <legend className="mb-1.5 block text-sm font-bold">{t.priceType}</legend>
              <div className="flex flex-wrap gap-2">
                {props.priceTypes.map((p) => (
                  <Pill key={p} type="radio" name="priceType" value={p} checked={priceType === p} onChange={() => setPriceType(p)}>
                    {messages.priceType[p]}
                  </Pill>
                ))}
              </div>
              <ErrorText code={errors.priceType} />
            </fieldset>
          ) : (
            <input type="hidden" name="priceType" value={priceType} />
          )}
        </Section>
      )}

      {props.defs.length > 0 && (
        <Section titled={!wizard} title={t.details}>
          {props.defs.map((d) => (
            <AttributeField
              key={d.key}
              def={d}
              value={v.attributes[d.key]}
              parent={d.dependsOn ? props.defs.find((p) => p.key === d.dependsOn) : undefined}
              hasChildren={props.defs.some((c) => c.dependsOn === d.key)}
              selects={selects}
              onSelect={(val) => setSelects((s) => chooseSelect(props.defs, s, d, val))}
              error={errors[`attr.${d.key}`]}
              currencySymbol={currencySymbol}
            />
          ))}
        </Section>
      )}
      {props.shippable && (
        <div className="flex flex-wrap gap-2">
          <Pill type="checkbox" name="shippingOffered" value="on" checked={v.shippingOffered}>
            {t.shipping}
          </Pill>
        </div>
      )}
      </div>

      <div {...section(4)}>
      <Section titled={!wizard} title={t.location}>
        {props.country ? (
          <PlaceField
            countries={[props.country]}
            initial={v.place}
            fixed={{
              hint: props.countryChangeable ? t.countryFixed(props.country.currencyName) : t.countryFixedEdit,
              changeHref: props.countryChangeable ? '/?choose' : null,
            }}
            errors={{
              countryCode: placeError('countryCode'),
              place: placeError('place'),
              district: placeError('district'),
              area: placeError('area'),
            }}
          />
        ) : (
          <Alert tone="info">
            {t.chooseCountryFirst}{' '}
            <Link href="/?choose" className="font-bold underline">
              {t.changeCountry}
            </Link>
          </Alert>
        )}
        {/* In the steps the place is always kept for the next listing (mockup final/post4 has no switch) */}
        {wizard ? (
          <input type="hidden" name="rememberPlace" value="on" />
        ) : (
          <Toggle name="rememberPlace" checked={v.rememberPlace}>
            {t.rememberPlace}
          </Toggle>
        )}
      </Section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold">{t.contact}</h2>
        {/* Chat is always on: a switch that can't be turned off */}
        <p className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-neutral-300 px-4 py-2 text-sm">
          <span>{t.chatAlways}</span>
          <span aria-hidden className="flex h-6 w-11 shrink-0 items-center justify-end rounded-full bg-brand-700 p-0.5">
            <i className="size-5 rounded-full bg-white shadow-sm" />
          </span>
          <span className="sr-only">{t.chatAlwaysHint}</span>
        </p>
        <Toggle name="allowPhoneContact" checked={v.allowPhoneContact} hint={t.allowPhoneHint}>
          {t.allowPhoneShort}
        </Toggle>
      </section>

      {props.postAs.options.length > 0 && (
        <Card className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.postAs}</span>
            {props.postAs.locked ? (
              <>
                <input type="hidden" name="organizationId" value={v.organizationId} />
                <span className="block text-sm">{props.postAs.options.find((o) => o.id === v.organizationId)?.name ?? t.postAsPrivate}</span>
              </>
            ) : (
              <select name="organizationId" defaultValue={v.organizationId} className={selectClass}>
                {!props.postAs.businessOnly && <option value="">{t.postAsPrivate}</option>}
                {props.postAs.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <span className="block text-xs text-neutral-600">{props.postAs.locked ? t.postAsLocked : t.postAsHint}</span>
        </Card>
      )}

      {props.needsName && (
        <Card>
          <Field label={t.yourName} hint={t.yourNameHint} name="displayName" maxLength={50} autoComplete="name" />
          <ErrorText code={errors.displayName} />
        </Card>
      )}

      {wizard && (
        <section>
          <h2 className="text-lg font-extrabold">{t.check}</h2>
          <dl className="mt-1 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 px-4">
            {(
              [
                ['photos', t.photoCount(wizard.photos.length), 2],
                ['title', summary.title, 2],
                ['price', props.priceTypes.length > 0 ? summary.price : null, 3],
                ['details', props.defs.length > 0 ? summary.details : null, 3],
                ['postAs', summary.postAs ?? null, 4],
              ] as const
            )
              .filter(([, value]) => value !== null)
              .map(([key, value, step]) => (
                <div key={key} className="flex items-start gap-3 py-3">
                  <dt className="w-24 shrink-0 text-sm text-neutral-600">{t.checkRows[key]}</dt>
                  <dd className={`min-w-0 flex-1 text-sm leading-6 ${value ? 'font-bold' : 'text-neutral-600'}`}>
                    {key === 'photos' && wizard.photos.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="sr-only">{value}</span>
                        {wizard.photos.slice(0, CHECK_THUMBS).map((src, i) =>
                          src ? (
                            <img key={i} src={src} alt="" width={44} height={44} className="size-11 rounded-lg object-cover" />
                          ) : (
                            <span key={i} className="size-11 rounded-lg bg-neutral-100" />
                          ),
                        )}
                        {wizard.photos.length > CHECK_THUMBS && <span className="text-xs text-neutral-600">+{(wizard.photos.length - CHECK_THUMBS).toLocaleString('fa-IR')}</span>}
                      </span>
                    ) : (
                      value || t.notEntered
                    )}
                  </dd>
                  {step !== 4 && (
                    <button type="button" onClick={() => wizard.setStep(step)} className="flex min-h-11 items-center text-sm font-bold text-brand-800 hover:underline">
                      {t.change}
                    </button>
                  )}
                </div>
              ))}
          </dl>
          <p className="mt-3 text-xs leading-6 text-neutral-600">{t.reviewNote}</p>
        </section>
      )}

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.notice && <Alert tone="success">{state.notice}</Alert>}

      {(draft || rejected) && turnstile.widget}
      {(draft || rejected) && <TermsNotice />}
      </div>

      {/* The plain buttons: a listing that is out, and the steps without JavaScript (<noscript> shows them) */}
      <div data-noscript-actions className={wizard ? 'hidden' : 'flex flex-col gap-3 sm:flex-row-reverse'}>
        {draft || rejected ? (
          <>
            <Button type="submit" name="intent" value="publish" disabled={pending || !turnstile.ready} className="sm:flex-1">
              {!turnstile.ready ? messages.turnstile.checking : rejected ? t.resubmit : t.publish}
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
        <div data-step-bar className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:px-0">
          <div className="mx-auto flex max-w-2xl gap-2">
            {wizard.step === 2 && (
              <Link
                href={props.listingId ? `/new?listing=${props.listingId}` : '/new'}
                className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-5 font-bold text-neutral-800"
              >
                {t.previous}
              </Link>
            )}
            {wizard.step > 2 && (
              <button
                type="button"
                onClick={() => {
                  wizard.setStep((wizard.step - 1) as Step);
                  window.scrollTo({ top: 0 });
                }}
                className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-5 font-bold text-neutral-800"
              >
                {t.previous}
              </button>
            )}
            {wizard.step < 4 ? (
              <button type="submit" name="intent" value="next" disabled={pending} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60">
                {t.continueTo(stepNames[wizard.step]!)}
              </button>
            ) : (
              <button
                type="submit"
                name="intent"
                value="publish"
                disabled={pending || !turnstile.ready}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {!turnstile.ready ? messages.turnstile.checking : t.publish}
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * The chosen selects after one changes: a model chosen before its brand fills the brand; a brand
 * change empties a model of another brand.
 */
function chooseSelect(defs: AttributeDef[], current: Record<string, string>, def: AttributeDef, value: string): Record<string, string> {
  const next = { ...current, [def.key]: value };
  if (def.dependsOn && value && !next[def.dependsOn]) next[def.dependsOn] = parentOf(def, value) ?? '';
  for (const child of defs) {
    if (child.dependsOn !== def.key || !next[child.key]) continue;
    const p = parentOf(child, next[child.key]!);
    if (p && p !== value) next[child.key] = '';
  }
  return next;
}

function AttributeField({
  def,
  value,
  parent,
  selects,
  onSelect,
  error,
  currencySymbol,
  hasChildren,
}: {
  def: AttributeDef;
  value: unknown;
  /** The select this one depends on (brand for model) */
  parent?: AttributeDef;
  /** Another field depends on this one (brand): it stays a select */
  hasChildren: boolean;
  /** The chosen value of every select (the selects are controlled) */
  selects: Record<string, string>;
  onSelect: (value: string) => void;
  error?: FieldError;
  /** The listing country's currency, for amounts */
  currencySymbol: string;
}) {
  const name = `attr.${def.key}`;
  const unit = def.validation.money ? currencySymbol : def.unitFa;
  // Optional fields say so; required ones are plain (wave 1)
  const label = `${def.labelFa}${unit ? ` (${unit})` : ''}${def.isRequired ? '' : ` ${t.optional}`}`;
  const legend = <legend className="mb-1.5 block text-sm font-bold">{labelText(`${def.labelFa}${unit ? ` (${unit})` : ''}`, def.isRequired)}</legend>;
  const wrap = (control: ReactNode) => (
    <div>
      {control}
      {def.helpFa && <span className="mt-1 block text-xs text-neutral-500">{def.helpFa}</span>}
      <ErrorText code={error} />
    </div>
  );

  switch (def.type) {
    case 'number':
      // The unit or currency inside the field (mockup final/post3: «۱۴ متر مربع»)
      return wrap(
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">{labelText(def.labelFa, def.isRequired)}</span>
          <span className="flex h-12 items-center rounded-xl border border-neutral-300 px-4 focus-within:border-2 focus-within:border-brand-600">
            <input
              name={name}
              defaultValue={value === undefined ? '' : String(value)}
              inputMode={def.validation.integer && !def.validation.money ? 'numeric' : 'decimal'}
              dir="ltr"
              className="min-w-0 flex-1 bg-transparent text-end text-base outline-none"
            />
            {unit && <span className="ms-2 shrink-0 text-neutral-600">{unit}</span>}
          </span>
        </label>,
      );
    case 'text':
      return wrap(<Field label={label} name={name} defaultValue={typeof value === 'string' ? value : ''} maxLength={def.validation.max_length ?? 200} />);
    case 'date': {
      const stored = typeof value === 'string' ? value : '';
      if (!def.validation.month) {
        // An optional end date (until when): «نامحدود» or «تاریخ مشخص» first (mockup final/post3)
        if (!def.isRequired && def.key.endsWith('_until')) return wrap(<UntilField label={labelText(def.labelFa, false)} name={name} stored={stored} />);
        // Move-in and start dates get «از همین حالا» and «اول ماه بعد»
        return wrap(<DateInput label={label} name={name} defaultValue={stored} quick={def.key === 'available_from'} showDay />);
      }
      // Month and year (TÜV): two selects, since Firefox and desktop Safari have no month input
      const [y = '', m = ''] = stored.split('-');
      const now = new Date().getFullYear();
      const years = Array.from({ length: 6 }, (_, i) => String(now - 1 + i));
      if (y && !years.includes(y)) years.unshift(y);
      return wrap(
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-700">{label}</legend>
          <div className="flex gap-2">
            <select name={`${name}.month`} defaultValue={m ? String(Number(m)) : ''} aria-label={t.month} className={selectClass}>
              <option value="">{t.month}</option>
              {t.months.map((label, i) => (
                <option key={label} value={String(i + 1)}>
                  {label}
                </option>
              ))}
            </select>
            <select name={`${name}.year`} defaultValue={y} aria-label={t.year} className={selectClass}>
              <option value="">{t.year}</option>
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {Number(yr).toLocaleString('fa-IR', { useGrouping: false })}
                </option>
              ))}
            </select>
          </div>
        </fieldset>,
      );
    }
    case 'boolean':
      return wrap(
        <fieldset>
          {legend}
          <div className="flex flex-wrap gap-2">
            <Pill type="radio" name={name} value="true" checked={value === true}>
              {t.yes}
            </Pill>
            <Pill type="radio" name={name} value="false" checked={value === false}>
              {t.no}
            </Pill>
          </div>
        </fieldset>,
      );
    case 'select': {
      // A dependent select (model): the chosen brand's models; before a brand, all of them under
      // their brand's name. Never disabled, so it opens with and without JavaScript.
      const parentValue = def.dependsOn ? selects[def.dependsOn] : undefined;
      const choice = dependentOptions(def, parent, parentValue);
      // Nothing to choose for this parent (karat when the material isn't gold): no field
      if (choice.kind === 'flat' && def.dependsOn && parentValue && choice.options.length === 0) return null;
      // A short list nobody depends on: buttons instead of a select (wave 1)
      if (!def.dependsOn && !hasChildren && def.options.length <= SHORT_CHOICE) {
        return wrap(
          <fieldset>
            {legend}
            <div className="flex flex-wrap gap-2">
              {def.options.map((o) => (
                <Pill key={o.value} type="radio" name={name} value={o.value} checked={value === o.value}>
                  {o.labelFa}
                </Pill>
              ))}
            </div>
          </fieldset>,
        );
      }
      const option = (o: { value: string; labelFa: string }) => (
        <option key={o.value} value={o.value}>
          {o.labelFa}
        </option>
      );
      return (
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
            <select name={name} value={selects[def.key] ?? ''} onChange={(e) => onSelect(e.target.value)} className={selectClass}>
              <option value="">{t.choose}</option>
              {choice.kind === 'flat'
                ? choice.options.map(option)
                : choice.groups.map((g) =>
                    g.value ? (
                      <optgroup key={g.value} label={g.labelFa}>
                        {g.options.map(option)}
                      </optgroup>
                    ) : (
                      g.options.map(option)
                    ),
                  )}
            </select>
          </label>
          {choice.kind === 'grouped' && parent && <span className="mt-1 block text-xs text-neutral-500">{t.chooseParentFirst(parent.labelFa)}</span>}
          {def.helpFa && <span className="mt-1 block text-xs text-neutral-500">{def.helpFa}</span>}
          <ErrorText code={error} />
        </div>
      );
    }
    case 'multi_select': {
      const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
      return wrap(
        <fieldset>
          {legend}
          <div className="flex flex-wrap gap-2">
            {def.options.map((o) => (
              <Pill key={o.value} type="checkbox" name={name} value={o.value} checked={chosen.has(o.value)}>
                {o.labelFa}
              </Pill>
            ))}
          </div>
        </fieldset>,
      );
    }
  }
}

/** «تا تاریخ»: open-ended, or a day (mockup final/post3) */
function UntilField({ label, name, stored }: { label: ReactNode; name: string; stored: string }) {
  const [dated, setDated] = useState(!!stored);
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-bold">{label}</legend>
      <div className="mb-2 flex flex-wrap gap-2">
        <Pill type="radio" name={`${name}.until`} value="open" checked={!dated} onChange={() => setDated(false)}>
          {t.untilOpen}
        </Pill>
        <Pill type="radio" name={`${name}.until`} value="dated" checked={dated} onChange={() => setDated(true)}>
          {t.untilDated}
        </Pill>
      </div>
      {dated && <DateInput label={t.untilDated} name={name} defaultValue={stored} showDay />}
    </fieldset>
  );
}

/** One filled field as the check and the preview show it («۱۴ متر مربع», «مبله», «از ۱ دسامبر ۲۰۲۶»), or null */
function fieldText(def: AttributeDef, data: FormData): string | null {
  const name = `attr.${def.key}`;
  const one = (k: string) => {
    const v = data.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };
  const fa = (n: string) => (/^\d+(\.\d+)?$/.test(n) ? Number(n).toLocaleString('fa-IR') : n);
  const option = (v: string) => def.options.find((o) => o.value === v)?.labelFa ?? v;
  switch (def.type) {
    case 'number': {
      const v = one(name);
      return v ? `${fa(v)}${def.unitFa ? ` ${def.unitFa}` : ''}` : null;
    }
    case 'boolean':
      return one(name) === 'true' ? def.labelFa : null;
    case 'select':
      return one(name) ? option(one(name)) : null;
    case 'multi_select': {
      const all = data.getAll(name).filter((x): x is string => typeof x === 'string' && x !== '');
      return all.length ? all.map(option).join('، ') : null;
    }
    case 'date': {
      const [d, m, y] = [one(`${name}.day`), one(`${name}.month`), one(`${name}.year`)];
      if (!m || !y) return null;
      const month = t.months[Number(m) - 1] ?? m;
      return `${def.labelFa} ${d ? `${fa(d)} ` : ''}${month} ${Number(y).toLocaleString('fa-IR', { useGrouping: false })}`;
    }
    case 'text':
      return one(name) || null;
  }
}
