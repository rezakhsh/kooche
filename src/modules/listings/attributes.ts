import { z } from 'zod';
import { normalizePersian } from '../../lib/normalize-persian';
import type { AttributeDef } from './catalog';

// listings.attributes is validated on every write against the category's definitions
// (docs/schema.md, section 5): a Zod schema is built from them. Selects store option values,
// numbers are JSON numbers, multi-selects arrays of values, unknown keys are refused. Required
// fields are enforced only when publishing; drafts may lack them.

export type AttributeErrorCode =
  | 'required'
  | 'invalid'
  | 'too_small'
  | 'too_large'
  | 'not_integer'
  | 'too_long'
  | 'too_many'
  | 'unknown_option'
  | 'parent_mismatch'
  | 'unknown_field';

export type AttributeValues = Record<string, number | string | boolean | string[]>;

export type AttributeResult =
  | { ok: true; value: AttributeValues }
  | { ok: false; errors: Record<string, AttributeErrorCode> };

const TEXT_MAX_DEFAULT = 200;

function fieldSchema(def: AttributeDef): z.ZodType {
  const v = def.validation;
  switch (def.type) {
    case 'number': {
      let s = z.number({ error: 'invalid' }).refine(Number.isFinite, { error: 'invalid' });
      if (v.integer) s = s.refine(Number.isInteger, { error: 'not_integer' });
      if (v.min !== undefined) s = s.refine((n) => n >= v.min!, { error: 'too_small' });
      if (v.max !== undefined) s = s.refine((n) => n <= v.max!, { error: 'too_large' });
      return s;
    }
    case 'select': {
      const values = new Set(def.options.map((o) => o.value));
      return z.string({ error: 'invalid' }).refine((x) => values.has(x), { error: 'unknown_option' });
    }
    case 'multi_select': {
      const values = new Set(def.options.map((o) => o.value));
      return z
        .array(z.string({ error: 'invalid' }), { error: 'invalid' })
        .min(1, { error: 'required' })
        .max(v.max_items ?? def.options.length, { error: 'too_many' })
        .refine((xs) => new Set(xs).size === xs.length, { error: 'invalid' })
        .refine((xs) => xs.every((x) => values.has(x)), { error: 'unknown_option' });
    }
    case 'boolean':
      return z.boolean({ error: 'invalid' });
    case 'text':
      return z
        .string({ error: 'invalid' })
        .min(1, { error: 'required' })
        .max(v.max_length ?? TEXT_MAX_DEFAULT, { error: 'too_long' });
  }
}

/**
 * Validates attribute values against the definitions. Only active definitions accept input;
 * values of retired fields are kept by the caller as they were (`keepRetired`).
 */
export function validateAttributes(
  defs: AttributeDef[],
  raw: Record<string, unknown>,
  mode: 'draft' | 'publish',
): AttributeResult {
  const active = defs.filter((d) => d.isActive);
  const errors: Record<string, AttributeErrorCode> = {};
  const value: AttributeValues = {};
  const known = new Set(active.map((d) => d.key));

  for (const key of Object.keys(raw)) {
    if (!known.has(key)) errors[key] = 'unknown_field';
  }
  for (const def of active) {
    const input = raw[def.key];
    if (input === undefined) {
      if (mode === 'publish' && def.isRequired) errors[def.key] = 'required';
      continue;
    }
    const parsed = fieldSchema(def).safeParse(input);
    if (!parsed.success) {
      errors[def.key] = (parsed.error.issues[0]?.message as AttributeErrorCode) ?? 'invalid';
      continue;
    }
    value[def.key] = parsed.data as AttributeValues[string];
  }

  // Dependent selects: a model must belong to the chosen brand
  for (const def of active) {
    if (!def.dependsOn || errors[def.key] || value[def.key] === undefined) continue;
    const parentValue = value[def.dependsOn];
    const option = def.options.find((o) => o.value === value[def.key]);
    if (option?.parentValue && option.parentValue !== parentValue) errors[def.key] = 'parent_mismatch';
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Values of retired fields from the stored attributes, which an edit leaves untouched */
export function keepRetired(defs: AttributeDef[], stored: Record<string, unknown>): AttributeValues {
  const retired = new Set(defs.filter((d) => !d.isActive).map((d) => d.key));
  return Object.fromEntries(
    Object.entries(stored).filter(([k]) => retired.has(k)),
  ) as AttributeValues;
}

/** Number input in Persian or Latin digits, with ٫ or . as the decimal point and ٬ or , grouping */
function parseNumberInput(s: string): number | string {
  const t = normalizePersian(s).replace(/[\s٬,]/g, '').replace('٫', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : s;
}

/**
 * Reads `attr.<key>` fields from the posting form. Empty fields are left out (unset). A value
 * that isn't a number stays a string, so validation reports it as invalid instead of dropping it.
 */
export function attributesFromForm(defs: AttributeDef[], form: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const def of defs.filter((d) => d.isActive)) {
    const name = `attr.${def.key}`;
    if (def.type === 'multi_select') {
      const values = form.getAll(name).map(String).filter(Boolean);
      if (values.length) raw[def.key] = values;
      continue;
    }
    const v = form.get(name);
    if (typeof v !== 'string' || v.trim() === '') continue;
    const s = v.trim();
    if (def.type === 'number') raw[def.key] = parseNumberInput(s);
    else if (def.type === 'boolean') raw[def.key] = s === 'true' ? true : s === 'false' ? false : s;
    else raw[def.key] = def.type === 'text' ? s.normalize('NFC') : s;
  }
  return raw;
}
