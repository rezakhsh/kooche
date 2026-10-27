'use client';

import { useState } from 'react';
import { Icon } from '../../../components/icons';
import { messages } from '../../../messages/fa';

// «اشتراک در تلگرام یا واتس‌اپ» in a listing's ⋯ sheet: the phone's share sheet (Telegram and
// WhatsApp are in it), or the link copied on computers.

export function ShareRow({ title, path, className }: { title: string; path: string; className: string }) {
  const t = messages.my;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const url = new URL(path, location.origin).href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Icon name={copied ? 'check' : 'share'} className="size-5" />
      <span role="status">{copied ? t.copied : t.share}</span>
    </button>
  );
}
