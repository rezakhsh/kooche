import type { ReactNode } from 'react';
import { BrowseLink as Link } from '../../../components/browse-link';
import { DateInput } from '../../../components/date-input';
import type { AttributeDef } from '../../../modules/listings/catalog';
import { amountInputValue } from '../../../modules/listings/price';
import { attrFacet } from '../../../modules/search/keyword';
import { browseQuery, defaultSort, RADII_KM, without, type AttributeFilter, type BrowseState } from '../../../modules/search/filters';
import type { City } from '../../../modules/search/places';
import { messages } from '../../../messages/fa';
import { FilterSubmit } from './filter-submit';
import { NearMe } from './near-me';
import type { Browse } from './resolve';

// The filters as one plain GET form: it works without JavaScript, and the page rewrites what it
// sends (`year_min`, repeated checkboxes, empty fields) into the canonical address with one
// redirect. Rendered twice, in the phone sheet and the computer sidebar, so ids carry a prefix.
// Wave 1 (mockup final/filters): choices are buttons, not selects (except long lists and the
// city), the price has a typical-price hint, and the button says how many listings it will show.

/** Choices with at most this many options are checkboxes; longer lists are a select */
const CHECKBOX_LIMIT = 10;

const inputClass = 'block w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base focus:border-brand-700 focus:outline-none sm:text-sm';
const legendClass = 'mb-1.5 text-sm font-bold text-neutral-800';
/** A checkbox or radio drawn as a button (the input stays, hidden, for the form and screen readers) */
const pillClass =
  'flex min-h-10 items-center rounded-full border border-neutral-300 px-3.5 text-sm text-neutral-800 peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700';

function Pill({ type, name, value, checked, children }: { type: 'checkbox' | 'radio'; name: string; value: string; checked: boolean; children: ReactNode }) {
  return (
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className={pillClass}>{children}</span>
    </label>
  );
}

/** Matches per option, keyed by facet (`attrs.<key>`): keyword searches only (src/modules/search/keyword.ts) */
type Facets = Record<string, Record<string, number>> | null;

export function FilterForm({
  b,
  cities,
  id,
  facets = null,
  count,
  typical,
}: {
  b: Browse;
  cities: City[];
  id: string;
  facets?: Facets;
  /** The page's own count, the button's first label */
  count: { n: number; capped: boolean };
  /** «قیمت بیشتر آگهی‌های …: ۵۰۰ تا ۷۵۰ €», or null */
  typical: string | null;
}) {
  const t = messages.browse;
  const { state, ctx, country } = b;
  const byKey = new Map(state.attributes.map((f) => [f.key, f]));
  const currency = country.currency;
  const nearOn = !!state.near;

  return (
    <form method="get" action={b.path} className="flex flex-col gap-5">
      {state.q && <input type="hidden" name="q" value={state.q} />}
      {state.sort !== defaultSort(state.q) && <input type="hidden" name="sort" value={state.sort} />}
      {state.view && <input type="hidden" name="view" value={state.view} />}
      {state.near && <input type="hidden" name="near" value={state.near.token} />}

      <fieldset className="flex flex-col gap-2">
        <legend className={legendClass}>{t.place}</legend>
        <label htmlFor={`${id}-city`} className="sr-only">
          {t.city}
        </label>
        <select id={`${id}-city`} name="city" defaultValue={b.city?.slug ?? ''} className={inputClass}>
          <option value="">{t.allCities}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.nameFa}
            </option>
          ))}
        </select>
        {!b.city && (
          <div>
            {!nearOn && (
              <>
                <label htmlFor={`${id}-postal`} className="sr-only">
                  {t.postal}
                </label>
                <input
                  id={`${id}-postal`}
                  name="postal"
                  defaultValue={state.postal?.code ?? ''}
                  placeholder={`${t.postal}، ${t.postalPlaceholder}`}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  dir="ltr"
                  className={`${inputClass} text-end`}
                />
              </>
            )}
          </div>
        )}
        {!b.city && (
          <div role="radiogroup" aria-label={t.radius} className="flex flex-wrap gap-1.5">
            {!nearOn && (
              <Pill type="radio" name="r" value="" checked={!state.postal?.radiusKm}>
                {t.radiusOnly}
              </Pill>
            )}
            {RADII_KM.map((km) => (
              <Pill key={km} type="radio" name="r" value={String(km)} checked={(state.near?.radiusKm ?? state.postal?.radiusKm ?? (nearOn ? 10 : null)) === km}>
                {t.radiusKm(km)}
              </Pill>
            ))}
          </div>
        )}
        {!b.city && <NearMe country={country.slug} countryName={country.nameFa} active={nearOn} />}
      </fieldset>

      {ctx.priceAllowed && (
        <fieldset>
          <legend className={legendClass}>
            {t.priceRange} ({currency.symbol})
          </legend>
          <Range id={`${id}-price`} name="price" kind="number" min={state.price?.min != null ? amountInputValue(state.price.min, currency.minorUnit) : ''} max={state.price?.max != null ? amountInputValue(state.price.max, currency.minorUnit) : ''} />
          {typical && <p className="mt-1.5 text-xs text-neutral-600">{typical}</p>}
        </fieldset>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Pill type="checkbox" name="ship" value="1" checked={state.ship}>
          {t.shipping}
        </Pill>
      </div>

      {ctx.defs.map((def) => (
        <AttributeField
          key={def.key}
          def={def}
          value={byKey.get(def.key)}
          state={state}
          id={`${id}-${def.key}`}
          currencySymbol={currency.symbol}
          minorUnit={currency.minorUnit}
          counts={facets?.[attrFacet(def.key)] ?? null}
        />
      ))}

      {/* The shadow covers the sheet's bottom padding, so nothing shows through under the bar */}
      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-neutral-100 bg-white px-1 pt-3 pb-1 shadow-[0_1.25rem_0_0_#fff]">
        <Link href={`${b.path}${browseQuery(without(state, 'all'), ctx.minorUnit)}`} className="flex min-h-11 items-center px-1 text-sm font-medium text-neutral-700 hover:underline">
          {t.clearAll}
        </Link>
        <FilterSubmit path={b.path} count={count.n} capped={count.capped} />
      </div>
    </form>
  );
}

function Range({ id, name, kind, min, max, month }: { id: string; name: string; kind: 'number' | 'date'; min: string; max: string; month?: boolean }) {
  const t = messages.browse;
  // A day as day / month name / year (src/components/date-input.tsx); joined by joinDateParts()
  if (kind === 'date' && !month) {
    return (
      <div className="flex flex-col gap-2">
        <DateInput label={t.from} name={`${name}_from`} defaultValue={min} years={{ before: 1, after: 2 }} />
        <DateInput label={t.to} name={`${name}_to`} defaultValue={max} years={{ before: 1, after: 2 }} />
      </div>
    );
  }
  const [lo, hi] = kind === 'date' ? ['from', 'to'] : ['min', 'max'];
  const type = kind === 'date' ? (month ? 'month' : 'date') : 'text';
  return (
    <div className="grid grid-cols-2 gap-2">
      <label htmlFor={`${id}-${lo}`} className="sr-only">
        {kind === 'date' ? t.from : t.min}
      </label>
      <input id={`${id}-${lo}`} name={`${name}_${lo}`} type={type} defaultValue={min} placeholder={kind === 'date' ? undefined : t.min} inputMode={kind === 'number' ? 'decimal' : undefined} dir="ltr" className={`${inputClass} text-end`} />
      <label htmlFor={`${id}-${hi}`} className="sr-only">
        {kind === 'date' ? t.to : t.max}
      </label>
      <input id={`${id}-${hi}`} name={`${name}_${hi}`} type={type} defaultValue={max} placeholder={kind === 'date' ? undefined : t.max} inputMode={kind === 'number' ? 'decimal' : undefined} dir="ltr" className={`${inputClass} text-end`} />
    </div>
  );
}

function AttributeField({
  def,
  value,
  state,
  id,
  currencySymbol,
  minorUnit,
  counts,
}: {
  def: AttributeDef;
  value: AttributeFilter | undefined;
  state: BrowseState;
  id: string;
  currencySymbol: string;
  minorUnit: number;
  /** Matches per option with a keyword (without this field's own filter), else null */
  counts: Record<string, number> | null;
}) {
  const t = messages.browse;
  const count = (v: string) => (counts ? messages.search.count(counts[v] ?? 0) : '');
  const unit = def.validation.money ? currencySymbol : def.unitFa;
  const legend = (
    <legend className={legendClass}>
      {def.labelFa}
      {unit && <span className="font-normal text-neutral-500"> ({unit})</span>}
    </legend>
  );
  switch (def.type) {
    case 'number': {
      const f = value?.type === 'number' ? value : null;
      const fmt = (n: number | null | undefined) => (n == null ? '' : def.validation.money ? amountInputValue(n, minorUnit) : String(n));
      return (
        <fieldset>
          {legend}
          <Range id={id} name={def.key} kind="number" min={fmt(f?.min)} max={fmt(f?.max)} />
        </fieldset>
      );
    }
    case 'date': {
      const f = value?.type === 'date' ? value : null;
      return (
        <fieldset>
          {legend}
          <Range id={id} name={def.key} kind="date" month={def.validation.month} min={f?.from ?? ''} max={f?.to ?? ''} />
        </fieldset>
      );
    }
    case 'boolean':
      return (
        <div className="flex flex-wrap gap-1.5">
          <Pill type="checkbox" name={def.key} value="1" checked={!!value}>
            {def.labelFa}
            {counts && <span className="ms-1 text-xs font-normal text-neutral-500">{count('true')}</span>}
          </Pill>
        </div>
      );
    case 'select':
    case 'multi_select': {
      const chosen = new Set(value && 'values' in value ? value.values : []);
      let options = def.options;
      if (def.dependsOn) {
        // A model list only once a make is chosen, and only that make's models
        const parent = state.attributes.find((f) => f.key === def.dependsOn);
        if (!parent || !('values' in parent)) return null;
        const parents = new Set(parent.values);
        options = options.filter((o) => !o.parentValue || parents.has(o.parentValue));
      }
      if (options.length <= CHECKBOX_LIMIT) {
        return (
          <fieldset>
            {legend}
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <Pill key={o.value} type="checkbox" name={def.key} value={o.value} checked={chosen.has(o.value)}>
                  {o.labelFa}
                  {counts && <span className="ms-1 text-xs font-normal text-neutral-500">{count(o.value)}</span>}
                </Pill>
              ))}
            </div>
          </fieldset>
        );
      }
      // A long list: one choice in the form; several chosen through chips stay as hidden fields
      const [firstChosen, ...others] = options.filter((o) => chosen.has(o.value)).map((o) => o.value);
      return (
        <fieldset>
          {legend}
          <label htmlFor={id} className="sr-only">
            {def.labelFa}
          </label>
          <select id={id} name={def.key} defaultValue={firstChosen ?? ''} className={inputClass}>
            <option value="">{t.any}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {counts ? `${o.labelFa} ${count(o.value)}` : o.labelFa}
              </option>
            ))}
          </select>
          {others.map((v) => (
            <input key={v} type="hidden" name={def.key} value={v} />
          ))}
        </fieldset>
      );
    }
    case 'text':
      return null;
  }
}
