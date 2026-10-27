'use client';

import { useEffect } from 'react';

// Keyboard shortcuts on the admin page (wave 1; the owner said yes in round 2): "/" goes to the
// search, J and K to the next and previous item, 1–9 (Latin or Persian digits) pick an option of
// the decision form, Enter saves it ("save and next"); Ctrl+Enter saves from inside a text field.
// Each target is marked in the page: [data-admin-search], [data-key-next], [data-key-prev],
// [data-key-option], [data-key-submit].

const DIGITS: Record<string, number> = { '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };

function typing(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function AdminKeys() {
  useEffect(() => {
    const click = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return false;
      el.click();
      return true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.defaultPrevented) return;
      const submit = document.querySelector<HTMLButtonElement>('[data-key-submit]');
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (submit && !submit.disabled) {
          e.preventDefault();
          submit.form?.requestSubmit(submit);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || typing(e.target)) return;
      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-admin-search]');
        if (search && search.offsetParent) {
          e.preventDefault();
          search.focus();
        }
        return;
      }
      if (e.key === 'j' || e.key === 'J' || e.key === 'ت') {
        if (click('[data-key-next]')) e.preventDefault();
        return;
      }
      if (e.key === 'k' || e.key === 'K' || e.key === 'ن') {
        if (click('[data-key-prev]')) e.preventDefault();
        return;
      }
      const n = DIGITS[e.key] ?? (/^[1-9]$/.test(e.key) ? Number(e.key) : 0);
      if (n) {
        const options = document.querySelectorAll<HTMLInputElement>('[data-key-option]');
        if (options[n - 1]) {
          e.preventDefault();
          options[n - 1]!.click();
          options[n - 1]!.focus();
        }
        return;
      }
      if (e.key === 'Enter' && submit && !submit.disabled && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        submit.form?.requestSubmit(submit);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
