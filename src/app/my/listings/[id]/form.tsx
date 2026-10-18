'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Button, Card, Field } from '../../../../components/ui';
import { PlaceField, type PlaceFieldValue } from '../../../../components/place-field';
import { messages } from '../../../../messages/fa';
import type { AttributeDef } from '../../../../modules/listings/catalog';
import type { FieldError } from '../../../../modules/listings/listings';
import { saveListingAction, type SaveState } from '../actions';

// The posting form (mobile first). Plain fields, so it also posts without JavaScript; with
// JavaScript the submit is intercepted so React doesn't clear what was typed when the server
// sends errors back.

type PriceType = 'fixed' | 'negotiable' | 'free' | 'exchange' | 'on_request';

export type FormProps = {
  /** null: a new listing nobody saved yet; the first save starts the draft */
  listingId: string | null;
  categoryId: string;
  status: string;
  categoryPath: string[];
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
  };
};

const t = messages.form;

function ErrorText({ code }: { code?: FieldError }) {
  if (!code) return null;
  return <span className="mt-1 block text-xs text-red-700">{t.errors[code] ?? t.errors.invalid}</span>;
}

const selectClass =
  'block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

export function ListingForm(props: FormProps & { onDraftCreated?: (listingId: string) => void }) {
  const [state, dispatch, pending] = useActionState<SaveState, FormData>(saveListingAction, undefined);
  const { onDraftCreated } = props;
  useEffect(() => {
    if (state?.listingId) onDraftCreated?.(state.listingId);
  }, [state?.listingId, onDraftCreated]);
  const v = props.values;
  const errors = state?.errors ?? {};
  const [priceType, setPriceType] = useState<PriceType>(props.priceTypes.includes(v.priceType) ? v.priceType : (props.priceTypes[0] ?? 'on_request'));
  const [selects, setSelects] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.defs.filter((d) => d.type === 'select').map((d) => [d.key, String(v.attributes[d.key] ?? '')])),
  );
  const currencySymbol = props.country?.currencySymbol ?? '';
  const placeError = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.errors.invalid) : undefined);

  const draft = props.status === 'draft';
  const rejected = props.status === 'rejected';

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  return (
    <form action={dispatch} onSubmit={onSubmit} className="space-y-6" noValidate>
      {props.listingId && <input type="hidden" name="listingId" value={props.listingId} />}
      <input type="hidden" name="categoryId" value={props.categoryId} />
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block text-sm font-medium text-neutral-700">{t.category}</span>
            <span className="text-sm text-neutral-600">{props.categoryPath.join(' › ')}</span>
          </div>
          {draft && (
            <Link href={props.listingId ? `/new?listing=${props.listingId}` : '/new'} className="text-sm text-brand-800 hover:underline">
              {t.changeCategory}
            </Link>
          )}
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-700">{t.kind}</legend>
          <div className="flex flex-wrap gap-4">
            {(['offer', 'wanted'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="radio" name="kind" value={k} defaultChecked={v.kind === k} />
                {messages.kind[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Field label={t.titleLabel} hint={t.titleHint} name="title" defaultValue={v.title} maxLength={90} required />
          <ErrorText code={errors.title} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.descriptionLabel}</span>
          <textarea
            name="description"
            defaultValue={v.description}
            rows={6}
            maxLength={5000}
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
          <span className="mt-1 block text-xs text-neutral-500">{t.descriptionHint}</span>
          <ErrorText code={errors.description} />
        </label>
      </Card>

      {props.defs.length > 0 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">{t.details}</h2>
          {props.defs.map((d) => (
            <AttributeField
              key={d.key}
              def={d}
              value={v.attributes[d.key]}
              parentValue={d.dependsOn ? selects[d.dependsOn] : undefined}
              onSelect={(val) => setSelects((s) => ({ ...s, [d.key]: val }))}
              error={errors[`attr.${d.key}`]}
              currencySymbol={currencySymbol}
            />
          ))}
        </Card>
      )}

      {props.priceTypes.length > 0 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">{t.price}</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.priceType}</span>
            <select name="priceType" value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)} className={selectClass}>
              {props.priceTypes.map((p) => (
                <option key={p} value={p}>
                  {messages.priceType[p]}
                </option>
              ))}
            </select>
            <ErrorText code={errors.priceType} />
          </label>
          {(priceType === 'fixed' || priceType === 'negotiable') && (
            <div>
              <Field label={t.amount} hint={t.amountHint} name="amount" defaultValue={v.amount} inputMode="decimal" dir="ltr" className="text-end" />
              {currencySymbol && <span className="mt-1 block text-xs text-neutral-500">{t.currencyOf(currencySymbol)}</span>}
              <ErrorText code={errors.amount} />
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">{t.location}</h2>
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
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="rememberPlace" defaultChecked={v.rememberPlace} className="size-5" />
          {t.rememberPlace}
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t.options}</h2>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="allowPhoneContact" defaultChecked={v.allowPhoneContact} className="size-5" />
          {t.allowPhone}
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="shippingOffered" defaultChecked={v.shippingOffered} className="size-5" />
          {t.shipping}
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

function AttributeField({
  def,
  value,
  parentValue,
  onSelect,
  error,
  currencySymbol,
}: {
  def: AttributeDef;
  value: unknown;
  parentValue?: string;
  onSelect: (value: string) => void;
  error?: FieldError;
  /** The listing country's currency, for amounts */
  currencySymbol: string;
}) {
  const name = `attr.${def.key}`;
  const unit = def.validation.money ? currencySymbol : def.unitFa;
  const label = `${def.labelFa}${unit ? ` (${unit})` : ''}${def.isRequired ? ' *' : ''}`;
  const wrap = (control: ReactNode) => (
    <div>
      {control}
      {def.helpFa && <span className="mt-1 block text-xs text-neutral-500">{def.helpFa}</span>}
      <ErrorText code={error} />
    </div>
  );

  switch (def.type) {
    case 'number':
      return wrap(
        <Field
          label={label}
          name={name}
          defaultValue={value === undefined ? '' : String(value)}
          inputMode={def.validation.integer && !def.validation.money ? 'numeric' : 'decimal'}
          dir="ltr"
          className="text-end"
        />,
      );
    case 'text':
      return wrap(<Field label={label} name={name} defaultValue={typeof value === 'string' ? value : ''} maxLength={def.validation.max_length ?? 200} />);
    case 'date': {
      const stored = typeof value === 'string' ? value : '';
      if (!def.validation.month) {
        return wrap(<Field label={label} name={name} type="date" defaultValue={stored} min="1900-01-01" max="2100-12-31" dir="ltr" className="text-end" />);
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
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
          <select name={name} defaultValue={value === true ? 'true' : value === false ? 'false' : ''} className={selectClass}>
            <option value="">{t.choose}</option>
            <option value="true">{t.yes}</option>
            <option value="false">{t.no}</option>
          </select>
        </label>,
      );
    case 'select': {
      // A dependent select (model) shows only the options of the chosen parent (brand)
      const options = def.dependsOn ? def.options.filter((o) => !o.parentValue || o.parentValue === parentValue) : def.options;
      // Nothing to choose for this parent (karat when the material isn't gold): no field
      if (def.dependsOn && parentValue && options.length === 0) return null;
      return wrap(
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
          <select
            name={name}
            defaultValue={typeof value === 'string' ? value : ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={!!def.dependsOn && !parentValue}
            className={selectClass}
            key={def.dependsOn ? parentValue : undefined}
          >
            <option value="">{t.choose}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelFa}
              </option>
            ))}
          </select>
        </label>,
      );
    }
    case 'multi_select': {
      const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
      return wrap(
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-700">{label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {def.options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={name} value={o.value} defaultChecked={chosen.has(o.value)} />
                {o.labelFa}
              </label>
            ))}
          </div>
        </fieldset>,
      );
    }
  }
}
