'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { messages } from '../messages/fa';
import type { TurnstileAction } from '../modules/security/turnstile';

// Cloudflare Turnstile in a form (docs/setup.md, "Bot protection"). Cloudflare's script is added
// by this component, so the CSP's 'strict-dynamic' trusts it without a nonce; its iframe needs
// `frame-src https://challenges.cloudflare.com` (src/proxy.ts). The widget writes its token into
// the hidden `cf-turnstile-response` field of the form it sits in; the server action checks it
// with Cloudflare. "interaction-only": nothing shows unless Cloudflare wants a click.

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string | undefined;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

function loadScript(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
    s.onerror = () => {
      loading = undefined;
      reject(new Error('turnstile script failed'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type TurnstileState = {
  /** Put this inside the form */
  widget: React.ReactNode;
  /** A token is in the form (always true when Turnstile is off) */
  ready: boolean;
  /** Fetch a new token: call after the server has spent (or refused) the last one */
  reset: () => void;
};

/** `siteKey` null: Turnstile is off (development without keys) */
export function useTurnstile(siteKey: string | null, action: TurnstileAction): TurnstileState {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    const el = box.current;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled) return;
        id.current = api.render(el, {
          sitekey: siteKey,
          action,
          language: 'fa',
          appearance: 'interaction-only',
          'refresh-expired': 'auto',
          callback: () => {
            setFailed(false);
            setReady(true);
          },
          'expired-callback': () => setReady(false),
          'error-callback': () => {
            setReady(false);
            setFailed(true);
            // Handled here; Cloudflare retries by itself
            return true;
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = undefined;
    };
  }, [siteKey, action]);

  const reset = useCallback(() => {
    if (!id.current || !window.turnstile) return;
    setReady(false);
    window.turnstile.reset(id.current);
  }, []);

  const t = messages.turnstile;
  const widget = siteKey ? (
    <div className="space-y-2">
      <div ref={box} />
      <noscript>
        <p className="text-sm text-red-700">{t.noScript}</p>
      </noscript>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t.widgetError}
        </p>
      )}
    </div>
  ) : null;
  return { widget, ready: !siteKey || ready, reset };
}
