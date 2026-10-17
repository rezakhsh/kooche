'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Button, Card, Field } from '../../../../components/ui';
import type { Point } from '../../../../db/types';
import { snapToGrid } from '../../../../lib/geo';
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
  currencies: { code: string; label: string }[];
  cities: { id: string; label: string; currency: string }[];
  needsName: boolean;
  values: {
    kind: 'offer' | 'wanted';
    title: string;
    description: string;
    attributes: Record<string, unknown>;
    priceType: PriceType;
    amount: string;
    currency: string;
    locationId: string;
    district: string;
    area: Point | null;
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
  'block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20';

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
  const [area, setArea] = useState<Point | null>(v.area);
  const [areaError, setAreaError] = useState(false);
  const [currency, setCurrency] = useState(v.currency);

  const draft = props.status === 'draft';
  const rejected = props.status === 'rejected';

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  function locate() {
    setAreaError(false);
    navigator.geolocation?.getCurrentPosition(
      // Snapped here already: the exact position never leaves the browser
      (pos) => setArea(snapToGrid({ lat: pos.coords.latitude, lng: pos.coords.longitude })),
      () => setAreaError(true),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
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
            <Link href={props.listingId ? `/new?listing=${props.listingId}` : '/new'} className="text-sm text-emerald-800 hover:underline">
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
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <Field label={t.amount} hint={t.amountHint} name="amount" defaultValue={v.amount} inputMode="decimal" dir="ltr" className="text-end" />
                <ErrorText code={errors.amount} />
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">{t.currency}</span>
                <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
                  {props.currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ErrorText code={errors.currency} />
              </label>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">{t.location}</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.city}</span>
          <select
            name="locationId"
            defaultValue={v.locationId}
            className={selectClass}
            onChange={(e) => {
              const c = props.cities.find((x) => x.id === e.target.value);
              if (c && !v.amount) setCurrency(c.currency);
            }}
          >
            <option value="">{t.choose}</option>
            {props.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <ErrorText code={errors.locationId} />
        </label>
        <div>
          <Field label={t.district} hint={t.districtHint} name="district" defaultValue={v.district} maxLength={60} />
          <ErrorText code={errors.district} />
        </div>
        {area && (
          <>
            <input type="hidden" name="areaLat" value={area.lat} />
            <input type="hidden" name="areaLng" value={area.lng} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {area ? (
            <>
              <span className="text-emerald-800">{t.locationSet}</span>
              <button type="button" onClick={() => setArea(null)} className="text-neutral-600 underline">
                {t.locationClear}
              </button>
            </>
          ) : (
            <button type="button" onClick={locate} className="text-emerald-800 underline">
              {t.useMyLocation}
            </button>
          )}
          {areaError && <span className="text-red-700">{t.locationFailed}</span>}
        </div>
        <ErrorText code={errors.area} />
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
}: {
  def: AttributeDef;
  value: unknown;
  parentValue?: string;
  onSelect: (value: string) => void;
  error?: FieldError;
}) {
  const name = `attr.${def.key}`;
  const label = `${def.labelFa}${def.unitFa ? ` (${def.unitFa})` : ''}${def.isRequired ? ' *' : ''}`;
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
          inputMode={def.validation.integer ? 'numeric' : 'decimal'}
          dir="ltr"
          className="text-end"
        />,
      );
    case 'text':
      return wrap(<Field label={label} name={name} defaultValue={typeof value === 'string' ? value : ''} maxLength={def.validation.max_length ?? 200} />);
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
