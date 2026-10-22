import { describe, expect, it } from 'vitest';
import { messages } from '../messages/fa';
import { validationMessage, type FieldSnapshot } from './validation-message';

const t = messages.validation;
const ok = { valueMissing: false, typeMismatch: false, patternMismatch: false, tooShort: false, tooLong: false, rangeUnderflow: false, rangeOverflow: false, stepMismatch: false, badInput: false };
const field = (type: string, flag: keyof typeof ok, extra: Partial<FieldSnapshot> = {}): FieldSnapshot => ({ type, value: '', validity: { ...ok, [flag]: true }, ...extra });

describe('the browser’s form checks in Persian', () => {
  it.each([
    ['checkbox', t.checkbox],
    ['radio', t.radio],
    ['select-one', t.select],
    ['select-multiple', t.select],
    ['file', t.file],
    ['text', t.required],
    ['email', t.required],
    ['textarea', t.required],
  ])('required %s', (type, text) => expect(validationMessage(field(type, 'valueMissing'))).toBe(text));

  it('the unticked terms box', () => expect(validationMessage(field('checkbox', 'valueMissing'))).toBe('برای ادامه، این گزینه را تیک بزنید.'));

  it('email and URL, with the Latin example kept left to right', () => {
    expect(validationMessage(field('email', 'typeMismatch'))).toBe(t.email);
    expect(validationMessage(field('url', 'typeMismatch'))).toBe(t.url);
    expect(t.url).toContain('⁦https://⁩');
  });

  it('pattern: the field’s own text, else a general one', () => {
    expect(validationMessage(field('text', 'patternMismatch', { patternMessage: messages.code.codePattern }))).toBe(messages.code.codePattern);
    expect(validationMessage(field('text', 'patternMismatch'))).toBe(t.pattern);
  });

  it('length, with Persian digits', () => {
    expect(validationMessage(field('text', 'tooShort', { minLength: 2, value: 'a' }))).toBe('دست‌کم ۲ نویسه بنویسید (الان ۱ نویسه).');
    expect(validationMessage(field('textarea', 'tooLong', { maxLength: 4000 }))).toBe(`حداکثر ${(4000).toLocaleString('fa-IR')} نویسه.`);
  });

  it('min and max: numbers with Persian digits, dates without a Latin date', () => {
    expect(validationMessage(field('number', 'rangeUnderflow', { min: '10' }))).toBe('کمترین مقدار ۱۰ است.');
    expect(validationMessage(field('number', 'rangeOverflow', { max: '2100' }))).toBe('بیشترین مقدار ۲۱۰۰ است.');
    expect(validationMessage(field('date', 'rangeUnderflow', { min: '1900-01-01' }))).toBe(t.dateMin);
    expect(validationMessage(field('date', 'rangeOverflow', { max: '2100-12-31' }))).toBe(t.dateMax);
    expect(validationMessage(field('month', 'rangeOverflow', { max: '2100-12' }))).toBe(t.dateMax);
  });

  it('step and unreadable input', () => {
    expect(validationMessage(field('number', 'stepMismatch'))).toBe(t.step);
    expect(validationMessage(field('number', 'badInput'))).toBe(t.number);
    expect(validationMessage(field('date', 'badInput'))).toBe(t.date);
  });

  it('never English, never empty', () => {
    for (const type of ['text', 'email', 'url', 'number', 'date', 'checkbox', 'radio', 'select-one', 'textarea', 'tel']) {
      for (const flag of Object.keys(ok) as (keyof typeof ok)[]) {
        const text = validationMessage(field(type, flag, { min: '1', max: '9', minLength: 2, maxLength: 5 }));
        expect(text.length).toBeGreaterThan(0);
        // Latin only inside an isolate (an example address)
        expect(text.replace(/⁦[^⁩]*⁩/g, '')).not.toMatch(/[A-Za-z]/);
      }
    }
  });
});
