'use client';

import { useEffect } from 'react';
import { validationMessage } from '../lib/validation-message';

// The browser's own form checks speak the browser's language ("Please check this box if you want
// to proceed."). Mounted once in the root layout, this puts the Persian text from the messages
// file on any field the browser refuses, site-wide: `invalid` doesn't bubble, so it is caught on
// the way down. The message is cleared as soon as the field changes, so the browser checks the
// new value itself. Without JavaScript the browser's own text shows and the server's checks
// answer in Persian, as before. Our own code, no inline script: fits the nonce CSP.

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isControl = (el: EventTarget | null): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

export function FormValidation() {
  useEffect(() => {
    // Fields that carry our message (not one set by other code)
    const ours = new WeakSet<Control>();
    const clear = (el: Control) => {
      if (!ours.has(el)) return;
      ours.delete(el);
      el.setCustomValidity('');
    };
    // A required radio group is invalid as a whole: choosing any radio clears them all
    const clearField = (el: Control) => {
      if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
        const group = el.form ? el.form.querySelectorAll('input[type="radio"]') : document.querySelectorAll('input[type="radio"]');
        group.forEach((r) => (r as HTMLInputElement).name === el.name && clear(r as HTMLInputElement));
      } else clear(el);
    };

    const onInvalid = (e: Event) => {
      const el = e.target;
      if (!isControl(el)) return;
      if (el.validity.customError && !ours.has(el)) return;
      const v = el.validity;
      const native = v.valueMissing || v.typeMismatch || v.patternMismatch || v.tooShort || v.tooLong || v.rangeUnderflow || v.rangeOverflow || v.stepMismatch || v.badInput;
      // Only our old message left (the value was set by code, not typed): let the next try through
      if (!native) return clear(el);
      el.setCustomValidity(
        validationMessage({
          type: el.type,
          value: el.value,
          validity: v,
          minLength: 'minLength' in el ? el.minLength : undefined,
          maxLength: 'maxLength' in el ? el.maxLength : undefined,
          min: el instanceof HTMLInputElement ? el.min : undefined,
          max: el instanceof HTMLInputElement ? el.max : undefined,
          patternMessage: el.dataset.patternMessage,
        }),
      );
      ours.add(el);
    };
    const onChange = (e: Event) => {
      if (isControl(e.target)) clearField(e.target);
    };
    // A submit button is clicked before the browser checks the form: drop our old messages, so a
    // value set by code (a quick reply, a date picker) is checked afresh
    const onClick = (e: Event) => {
      const button = (e.target as Element | null)?.closest?.('button, input[type="submit"]');
      const form = (button as HTMLButtonElement | HTMLInputElement | null)?.form;
      if (!form || (button as HTMLButtonElement).type !== 'submit') return;
      for (const el of Array.from(form.elements)) if (isControl(el)) clear(el);
    };

    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onChange, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onChange, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
  return null;
}
