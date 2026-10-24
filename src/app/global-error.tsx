'use client';

import { useEffect } from 'react';
import { reportBrowserError } from '../lib/monitoring/browser';
import { messages } from '../messages/fa';
import './globals.css';

// Shown when the root layout itself breaks; replaces Next's built-in page (English, inline styles
// the CSP blocks). A server error is reported on the server (its digest is skipped here), a
// browser error through the monitoring tunnel.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = messages.globalError;
  useEffect(() => reportBrowserError(error, 'react.global-error'), [error]);
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-white font-sans text-neutral-900 antialiased">
        <main className="mx-auto flex max-w-2xl flex-col px-6 py-16">
          <h1 className="text-3xl font-bold">{t.title}</h1>
          <p className="mt-4 text-lg text-neutral-700">{t.body}</p>
          <div className="mt-8 flex gap-6">
            <button type="button" onClick={reset} className="text-brand-700 underline underline-offset-4">
              {t.retry}
            </button>
            {/* A full page load: the client router may be what broke */}
            <a href="/" className="text-brand-700 underline underline-offset-4">
              {t.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
