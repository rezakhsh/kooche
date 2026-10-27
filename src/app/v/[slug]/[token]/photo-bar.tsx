'use client';

import { useState } from 'react';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';

// Back and share over the photo on phones (wave 1, mockup final/listing), where the listing page
// hides the site header. Back returns to the previous Peydoo page, or to the listing's category
// when there is none (a shared link). Share opens the phone's share sheet, or copies the link.

const round = 'pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/95 text-neutral-900 shadow';

export function BackButton({ fallback }: { fallback: string }) {
  const t = messages.listing;
  return (
    <a
      href={fallback}
      aria-label={t.back}
      title={t.back}
      className={round}
      onClick={(e) => {
        const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
        if (fromHere && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      }}
    >
      <Icon name="chevronStart" className="size-5" />
    </a>
  );
}

export function ShareButton({ title }: { title: string }) {
  const t = messages.listing;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={t.share}
      title={copied ? t.copied : t.share}
      className={round}
      onClick={async () => {
        const url = location.href.split('?')[0]!;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Icon name={copied ? 'check' : 'send'} className="size-5" />
      <span role="status" className="sr-only">
        {copied ? t.copied : ''}
      </span>
    </button>
  );
}

/** «کپی پیوند» on the page shown right after publishing */
export function CopyLink({ label }: { label: string }) {
  const t = messages.listing;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard?.writeText(location.href.split('?')[0]!).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 text-sm font-bold hover:bg-neutral-50"
    >
      <Icon name={copied ? 'check' : 'doc'} className="size-5 text-brand-700" />
      <span role="status">{copied ? t.copied : label}</span>
    </button>
  );
}
