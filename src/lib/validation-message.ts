import { faDigits, messages } from '../messages/fa';

// The Persian text for a field the browser's own form check refused (required, type, pattern,
// minlength, min, max, step). Pure, so it is tested without a browser; the listener that sets it
// is src/components/form-validation.tsx.

/** What the mapping needs from an input, select or textarea: its ValidityState and attributes */
export type FieldSnapshot = {
  /** `input.type` ('text', 'email', 'checkbox' …), 'select-one', 'select-multiple' or 'textarea' */
  type: string;
  value: string;
  validity: Pick<
    ValidityState,
    'valueMissing' | 'typeMismatch' | 'patternMismatch' | 'tooShort' | 'tooLong' | 'rangeUnderflow' | 'rangeOverflow' | 'stepMismatch' | 'badInput'
  >;
  minLength?: number;
  maxLength?: number;
  min?: string;
  max?: string;
  /** `data-pattern-message`: what the pattern asks for, from the messages file */
  patternMessage?: string;
};

const t = messages.validation;
const DATE_TYPES = new Set(['date', 'month', 'week', 'time', 'datetime-local']);

export function validationMessage(f: FieldSnapshot): string {
  const v = f.validity;
  if (v.badInput) return DATE_TYPES.has(f.type) ? t.date : f.type === 'number' ? t.number : t.invalid;
  if (v.valueMissing) {
    if (f.type === 'checkbox') return t.checkbox;
    if (f.type === 'radio') return t.radio;
    if (f.type.startsWith('select')) return t.select;
    if (f.type === 'file') return t.file;
    return t.required;
  }
  if (v.typeMismatch) return f.type === 'email' ? t.email : f.type === 'url' ? t.url : t.invalid;
  if (v.patternMismatch) return f.patternMessage || t.pattern;
  if (v.tooShort && f.minLength != null && f.minLength >= 0) return t.tooShort(f.minLength, f.value.length);
  if (v.tooLong && f.maxLength != null && f.maxLength >= 0) return t.tooLong(f.maxLength);
  const date = DATE_TYPES.has(f.type);
  if (v.rangeUnderflow) return date ? t.dateMin : f.min ? t.min(faDigits(f.min)) : t.invalid;
  if (v.rangeOverflow) return date ? t.dateMax : f.max ? t.max(faDigits(f.max)) : t.invalid;
  if (v.stepMismatch) return t.step;
  return t.invalid;
}
