'use client';

import { useEffect } from 'react';
import { fieldDir } from '../lib/field-dir';

// Fields that take Persian or Latin text («12045 Berlin», a business name) follow what is typed
// (dir="auto"). But an empty dir="auto" field is left to right: the caret and the placeholder
// start on the left of a right-to-left page. So an empty field is dir="rtl" and turns "auto" from
// the first letter. Server-rendered fields start with `fieldDir(value)` and carry
// `data-auto-dir`; this listener, mounted once in the root layout, keeps them in step as people
// type and when a form is reset. Controlled fields (the chat box) use `fieldDir` themselves.
// Without JavaScript a field keeps the direction it was sent with.

type TextControl = HTMLInputElement | HTMLTextAreaElement;

const isAutoDir = (el: EventTarget | null): el is TextControl =>
  (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && 'autoDir' in el.dataset;

export function AutoDirection() {
  useEffect(() => {
    const update = (el: TextControl) => {
      const dir = fieldDir(el.value);
      if (el.dir !== dir) el.dir = dir;
    };
    const onInput = (e: Event) => {
      if (isAutoDir(e.target)) update(e.target);
    };
    // A reset (React empties a form after its action) changes values without an input event
    const onReset = (e: Event) => {
      const form = e.target as HTMLFormElement;
      setTimeout(() => form.querySelectorAll('[data-auto-dir]').forEach((el) => isAutoDir(el) && update(el)));
    };
    // Typed before the page finished loading
    document.querySelectorAll('[data-auto-dir]').forEach((el) => isAutoDir(el) && update(el));
    document.addEventListener('input', onInput, true);
    document.addEventListener('reset', onReset, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('reset', onReset, true);
    };
  }, []);
  return null;
}
