'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { messages } from '../../messages/fa';
import { useChatStream } from './use-chat-stream';

// Keeps the inbox current: any chat event refreshes the server-rendered list (at most once a
// second). While the inbox is open and visible, its owner counts as "has the chat open".

export function InboxLive() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = () => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, 1_000);
  };
  const { live } = useChatStream({
    onMessage: refresh,
    onRead: refresh,
    onConversation: refresh,
    onUnread: refresh,
    onReload: refresh,
    onVisible: refresh,
  });
  return live ? null : (
    <p role="status" className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-center text-xs text-neutral-600">
      {messages.chat.offline}
    </p>
  );
}
