'use client';

import { useEffect, useState } from 'react';

// A short note at the bottom after an action, «ذخیره شد» (wave 1 polish, owner's choice on Oct 27,
// 2026). showToast() from any client component; <Toaster /> in the layout shows it for a moment,
// above the phone's bottom bar. Read by screen readers (role="status").

const EVENT = 'peydoo:toast';

export function showToast(text: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
}

export function Toaster() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 2200);
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-8">
      {text && <span className="toast-in rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white shadow-lg">{text}</span>}
    </div>
  );
}
