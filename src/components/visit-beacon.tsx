'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// One small request per page for the visitor numbers (src/modules/stats/visits.ts): the path, and on
// the tab's first page where it came from (the referrer and a `?ref=` code). Nothing is stored on
// the device. Not on the admin page (src/app/layout.tsx leaves it out there).

export function VisitBeacon() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const landing = first.current;
    first.current = false;
    const ref = landing ? new URLSearchParams(window.location.search).get('ref') : null;
    const body = JSON.stringify({ p: path, l: landing, r: landing ? document.referrer || null : null, q: ref ? ref.slice(0, 40) : null });
    try {
      if (!navigator.sendBeacon?.('/api/v', new Blob([body], { type: 'text/plain' }))) {
        void fetch('/api/v', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => undefined);
      }
    } catch {
      // Counting never breaks a page
    }
  }, [path]);
  return null;
}
