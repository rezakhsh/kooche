'use client';

import { useState } from 'react';
import { messages } from '../../../../messages/fa';

// Share an event: Telegram and WhatsApp links (plain links, they work without JavaScript), and
// "copy link", which uses the phone's own share sheet when there is one.

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = messages.events.page;
  const [copied, setCopied] = useState(false);
  const text = encodeURIComponent(title);
  const link = encodeURIComponent(url);
  const pill = 'rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50';

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The visitor closed the share sheet
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`https://t.me/share/url?url=${link}&text=${text}`} target="_blank" rel="noopener noreferrer" className={pill}>
        {t.shareTelegram}
      </a>
      <a href={`https://wa.me/?text=${text}%20${link}`} target="_blank" rel="noopener noreferrer" className={pill}>
        {t.shareWhatsApp}
      </a>
      <button type="button" onClick={share} className={pill}>
        {t.copyLink}
      </button>
      {copied && (
        <span role="status" className="text-xs text-brand-800">
          {t.copied}
        </span>
      )}
    </div>
  );
}
