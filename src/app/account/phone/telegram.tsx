'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { Icon } from '../../../components/icons';
import { Alert } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { startTelegram, startTelegramLoginAction, type TelegramState } from './actions';

const POLL_MS = 3_000;

type Status = { status: string; failureReason?: string | null };

export function TelegramVerify() {
  const [state, action, pending] = useActionState<TelegramState>(startTelegram, undefined);
  const [status, setStatus] = useState<Status | null>(null);
  const router = useRouter();
  const t = messages.phone;
  const verificationId = state && 'verificationId' in state ? state.verificationId : null;

  // While the user is in Telegram, ask the server every few seconds how it went
  useEffect(() => {
    if (!verificationId) return;
    setStatus({ status: 'pending' });
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/account/phone/status?id=${verificationId}`, { cache: 'no-store' });
        const next = (await res.json()) as Status;
        if (stopped) return;
        setStatus(next);
        if (next.status !== 'pending') {
          clearInterval(timer);
          if (next.status === 'verified') router.refresh();
        }
      } catch {
        // Offline for a moment: the next tick tries again
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [verificationId, router]);

  if (status?.status === 'verified') return <Alert tone="success">{t.done}</Alert>;

  const failed = status?.status === 'failed' || status?.status === 'expired' || status?.status === 'unknown';
  if (state && 'link' in state && !failed) {
    return (
      <div className="space-y-3">
        <a
          href={state.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2aabee] text-base font-bold text-white hover:bg-[#229ed9]"
        >
          <Icon name="send" className="size-5" />
          {t.telegramOpen}
        </a>
        <p className="text-sm leading-relaxed text-neutral-600">{t.telegramSteps}</p>
        <p className="text-xs text-neutral-500">{t.telegramExpires}</p>
        <Alert tone="info">{t.waiting}</Alert>
      </div>
    );
  }

  const reason = status?.failureReason as keyof typeof t.failed | null | undefined;
  return (
    <form action={action} className="space-y-3">
      {state && 'error' in state && <Alert tone="error">{state.error}</Alert>}
      {failed && <Alert tone="error">{reason && t.failed[reason] ? t.failed[reason] : t.expired}</Alert>}
      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2aabee] text-base font-bold text-white hover:bg-[#229ed9] disabled:opacity-70"
      >
        <Icon name="send" className="size-5" />
        {failed ? t.retry : t.loginButton}
      </button>
      {!failed && <p className="text-center text-xs text-neutral-600">{t.botHint}</p>}
    </form>
  );
}

/** "Log in with Telegram": one big button in Telegram's blue (mockup final/verify-phone); the server action sends the browser to Telegram */
export function TelegramLogin({ label, hint = true }: { label?: string; hint?: boolean }) {
  const [state, action, pending] = useActionState<TelegramState>(startTelegramLoginAction, undefined);
  const t = messages.phone;
  return (
    <form action={action}>
      {state && 'error' in state && <Alert tone="error">{state.error}</Alert>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2aabee] text-base font-bold text-white hover:bg-[#229ed9] disabled:opacity-70"
      >
        <Icon name="send" className="size-5" />
        {label ?? t.loginButton}
      </button>
      {hint && <p className="mt-1.5 text-center text-xs text-neutral-600">{t.loginHint}</p>}
    </form>
  );
}
