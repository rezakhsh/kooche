'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Pages that must never show an old copy (the chat list, a conversation) under the browser's
// page memory (`staleTimes` in next.config.ts, smooth loading): each server render carries a new
// id, so seeing an id a second time means the page came back from memory, and it reloads its
// data at once.
const seen = new Set<string>();

export function FreshOnReturn({ renderId }: { renderId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (seen.has(renderId)) router.refresh();
    else seen.add(renderId);
  }, [renderId, router]);
  return null;
}
