import { formatDate } from '../../lib/format';
import { messages } from '../../messages/fa';
import { effectiveAttributes, type AttributeDef, type Catalog, type Currency } from './catalog';
import { formatPrice } from './price';

// A listing's field values as text: the listing page's details and the facts on cards.

/** Years and other four-digit numbers read better without a thousands separator (as the chips) */
function grouped(def: AttributeDef): boolean {
  return !(def.validation.integer && (def.validation.max ?? Infinity) <= 9999);
}

export function attributeText(def: AttributeDef, value: unknown, currency: Currency | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (def.validation.money) {
    return typeof value === 'number' && currency ? formatPrice(value, currency.code, currency.minorUnit) : null;
  }
  const option = (v: unknown) => def.options.find((o) => o.value === v)?.labelFa ?? String(v);
  switch (def.type) {
    case 'select':
      return option(value);
    case 'multi_select':
      return Array.isArray(value) ? value.map(option).join('، ') : null;
    case 'boolean':
      return value ? messages.form.yes : messages.form.no;
    case 'number':
      return `${Number(value).toLocaleString('fa-IR', { useGrouping: grouped(def) })}${def.unitFa ? ` ${def.unitFa}` : ''}`;
    case 'date': {
      const [y, m, d] = String(value).split('-').map(Number);
      if (!y || !m) return null;
      // A day in the Jalali calendar; a month (TÜV) as the Gregorian month it is
      return d
        ? formatDate(new Date(Date.UTC(y, m - 1, d)), 'UTC')
        : `${messages.form.months[m - 1] ?? m} ${y.toLocaleString('fa-IR', { useGrouping: false })}`;
    }
    default:
      return String(value);
  }
}

export type CardFact = { label: string; text: string };

export const MAX_CARD_FACTS = 3;

/**
 * Up to three facts for a listing card: the category's active `show_on_card` fields in form order,
 * values only (the label is for screen readers). A yes/no field shows its label when yes and is
 * left out when no; a checklist shows two values and "…".
 */
export function cardFacts(
  catalog: Catalog,
  categoryId: string | null,
  attributes: Record<string, unknown>,
  currency: Currency | undefined,
): CardFact[] {
  if (!categoryId) return [];
  const facts: CardFact[] = [];
  for (const def of effectiveAttributes(catalog, categoryId)) {
    if (facts.length === MAX_CARD_FACTS) break;
    if (!def.showOnCard || !def.isActive) continue;
    const value = attributes[def.key];
    let text: string | null;
    if (def.type === 'boolean') text = value === true ? def.labelFa : null;
    else if (def.type === 'multi_select' && Array.isArray(value) && value.length > 2) {
      text = `${attributeText(def, value.slice(0, 2), currency)}${messages.listing.more}`;
    } else {
      text = attributeText(def, value, currency);
      // A bare count says nothing on its own ("۲"): with its label ("تعداد اتاق ۲"). Years and amounts read fine.
      if (text && def.type === 'number' && !def.unitFa && !def.validation.money && (def.validation.min ?? 0) < 1900) text = `${def.labelFa} ${text}`;
    }
    if (text) facts.push({ label: def.labelFa, text });
  }
  return facts;
}
