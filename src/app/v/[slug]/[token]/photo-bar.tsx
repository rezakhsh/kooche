'use client';

import { useState } from 'react';
import { BackLink } from '../../../../components/back-link';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';
import { showToast } from '../../../../components/toast';

// Back and share over the photo on phones (wave 1, mockup final/listing), where the listing page
// hides the site header. Back returns to the previous Peydoo page, or to the listing's category
// when there is none (a shared link). Share opens the phone's share sheet, or copies the link.

const round = 'pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/95 text-neutral-900 shadow';

export function BackButton({ fallback }: { fallback: string }) {
  return (
    <BackLink fallback={fallback} label={messages.listing.back} className={round}>
      <Icon name="back" className="size-5" />
    </BackLink>
  );
}

/** `label`: a bordered button with text (an event's ticket box, wave 1 part 6) instead of the round one */
export function ShareButton({ title, label }: { title: string; label?: string }) {
  const t = messages.listing;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ? undefined : t.share}
      title={copied ? t.copied : t.share}
      className={label ? 'flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-300 text-sm font-bold hover:bg-neutral-50' : round}
      onClick={async () => {
        const url = location.href.split('?')[0]!;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        setCopied(true);
        showToast(t.copied);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Icon name={copied ? 'check' : label ? 'send' : 'share'} className={label ? 'size-4' : 'size-5'} />
      {label}
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
