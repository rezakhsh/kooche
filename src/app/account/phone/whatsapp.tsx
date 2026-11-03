'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, use, useEffect, useState, useTransition, type ReactNode } from 'react';
import { Icon } from '../../../components/icons';
import { Alert } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { startWhatsAppAction, type WhatsAppStart } from './actions';

// «تأیید با واتس‌اپ» (mockup after-wave2/whatsapp-verify, Nov 3, 2026): the button under Telegram's,
// then a screen of its own: the steps, «باز کردن واتس‌اپ» on phones, the QR code on computers, the
// ready message and «منتظر پیام شما…» while the page asks the server how it went. WhatsApp's own
// green, darkened for white text (4.69:1) like Telegram's blue.

const POLL_MS = 3_000;
const GREEN = 'bg-[#13854a] text-snow hover:bg-[#10763f]';

type Attempt = Extract<WhatsAppStart, { link: string }>;
type Status = { status: string; failureReason?: string | null; iran?: boolean; masked?: string };
type Flow = { start: () => void; pending: boolean; error: string | null };

const FlowContext = createContext<Flow | null>(null);

/** WhatsApp's mark, filled (the other icons are drawn with lines) */
export function WhatsAppMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 1.8a8 8 0 1 1-4.2 14.8l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Zm-3.3 4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4l-.5-.3-1.9-.9c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5.3-.5v-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5h-.5Z" />
    </svg>
  );
}

/**
 * The page's content with WhatsApp's flow around it: while an attempt runs (or just finished), its
 * screen takes the place of the page's choices, and the page widens for the QR code on computers.
 */
export function WhatsAppFlow({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = messages.phone.whatsapp;

  const start = () =>
    startTransition(async () => {
      const r = await startWhatsAppAction();
      if ('error' in r) return setError(r.error);
      setError(null);
      setStatus({ status: 'pending' });
      setAttempt(r);
    });

  // While the user is in WhatsApp, ask the server every few seconds how it went
  const verificationId = attempt?.verificationId;
  useEffect(() => {
    if (!verificationId) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/account/phone/status?id=${verificationId}`, { cache: 'no-store' });
        const next = (await res.json()) as Status;
        if (stopped || next.status === 'pending') return;
        clearInterval(timer);
        if (next.iran) return router.push('/account/phone?whatsapp=iran');
        setStatus(next);
        if (next.status === 'verified') router.refresh();
        else {
          setAttempt(null);
          setError((next.failureReason && t.failed[next.failureReason]) || t.expired);
        }
      } catch {
        // Offline for a moment: the next tick tries again
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [verificationId, router, t]);

  if (status?.status === 'verified') {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
        <Done masked={status.masked} />
      </main>
    );
  }
  if (attempt) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-10">
        <Waiting attempt={attempt} onCancel={() => (setAttempt(null), setStatus(null))} />
      </main>
    );
  }
  return (
    <FlowContext value={{ start, pending, error }}>
      <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">{children}</main>
    </FlowContext>
  );
}

/** «تأیید با واتس‌اپ» under Telegram's button, with «یا» between them */
export function WhatsAppButton() {
  const flow = use(FlowContext);
  const t = messages.phone.whatsapp;
  if (!flow) return null;
  return (
    <form action={flow.start} className="mt-4">
      <div className="mb-4 flex items-center gap-3 text-xs text-neutral-500">
        <span className="h-px flex-1 bg-neutral-200" />
        {t.or}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      {flow.error && (
        <div className="mb-3">
          <Alert tone="error">{flow.error}</Alert>
        </div>
      )}
      <button type="submit" disabled={flow.pending} className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-70 ${GREEN}`}>
        <WhatsAppMark className="size-6" />
        {t.button}
      </button>
      <p className="mt-1.5 text-center text-xs text-neutral-600">{t.hint}</p>
    </form>
  );
}

function Waiting({ attempt, onCancel }: { attempt: Attempt; onCancel: () => void }) {
  const t = messages.phone.whatsapp;
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <WhatsAppMark className="size-6 text-[#13854a]" />
          {t.title}
        </h2>
        {/* Phones: the steps and the big button; computers: the QR code's line instead */}
        <ol className="mt-4 space-y-3 text-sm leading-6 text-neutral-800 md:hidden">
          {t.steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-800">{(i + 1).toLocaleString('fa-IR')}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-2 hidden text-sm leading-7 text-neutral-700 md:block">{t.scanIntro}</p>
        <a href={attempt.link} target="_blank" rel="noopener noreferrer" className={`mt-5 flex h-14 items-center justify-center gap-2 rounded-xl text-base font-bold md:hidden ${GREEN}`}>
          <WhatsAppMark className="size-6" />
          {t.open}
        </a>
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs text-neutral-600">{t.preview}</p>
          <p className="mt-2 ms-8 rounded-xl rounded-se-sm bg-green-50 px-3 py-2 text-sm leading-7 text-neutral-900">
            {t.prefill('')}
            <span dir="ltr" className="inline-block font-mono font-bold tracking-wider whitespace-nowrap">
              {attempt.code}
            </span>
          </p>
        </div>
        <div role="status" className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <span className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-700 motion-reduce:animate-none" />
          <span>
            <b>{t.waiting}</b>
            <span className="block text-xs text-neutral-600">{t.expires}</span>
          </span>
        </div>
        <a href={attempt.link} target="_blank" rel="noopener noreferrer" className="mt-5 hidden h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold text-neutral-800 hover:bg-neutral-50 md:flex">
          <WhatsAppMark className="size-5" />
          {t.openHere}
        </a>
        <button type="button" onClick={onCancel} className="mt-3 flex h-11 w-full items-center justify-center text-sm font-bold text-brand-800 hover:underline">
          {t.cancel}
        </button>
      </div>
      <div className="hidden flex-col items-center self-start rounded-2xl border border-neutral-200 p-5 md:flex">
        <div className="size-56 rounded-xl bg-snow p-3 ring-1 ring-neutral-200">
          <svg viewBox={`0 0 ${attempt.qr.size} ${attempt.qr.size}`} role="img" aria-label={t.qrLabel} className="size-full" shapeRendering="crispEdges">
            <path d={attempt.qr.d} fill="#0d1514" />
          </svg>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-neutral-800">
          <WhatsAppMark className="size-4 text-[#13854a]" />
          {t.scan}
        </p>
        <p className="mt-1 text-center text-xs leading-6 text-neutral-600">{t.scanHint}</p>
      </div>
    </div>
  );
}

function Done({ masked }: { masked?: string }) {
  const t = messages.phone.whatsapp;
  return (
    <>
      <div className="flex flex-col items-center rounded-2xl bg-green-50 px-4 py-6 text-center">
        <span className={`flex size-14 items-center justify-center rounded-full ${GREEN}`}>
          <Icon name="shield" className="size-8" />
        </span>
        <p className="mt-3 text-lg font-extrabold text-green-800">{t.doneTitle}</p>
        <p className="mt-1 text-sm text-neutral-700">{t.doneBody}</p>
      </div>
      {masked && (
        <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <WhatsAppMark className="size-4 text-[#13854a]" />
            {messages.phone.verifiedBy(messages.phone.methodWhatsapp)}
          </p>
          <p dir="ltr" className="mt-2 text-end text-lg font-extrabold">
            {masked}
          </p>
        </div>
      )}
      <Link href="/new" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800">
        {t.continue}
      </Link>
    </>
  );
}

