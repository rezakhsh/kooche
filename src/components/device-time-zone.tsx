'use client';

import { useEffect } from 'react';

// Sends the device's time zone for quiet hours and other notices on the person's clock
// (src/app/api/time-zone/route.ts, src/modules/users/time-zone.ts). Only for a signed-in visitor
// (src/app/layout.tsx), once per tab session and again when the zone or the account changes
// (`mark` stands for the account without naming it); the server writes only when it differs from
// what it has. So right after signing in the first page sends it, and other page views send nothing.

const KEY = 'peydoo-tz';

export function DeviceTimeZone({ mark }: { mark: string }) {
  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    const sent = `${mark}:${tz}`;
    try {
      if (sessionStorage.getItem(KEY) === sent) return;
    } catch {
      // No storage (private mode, blocked): send it; the server writes nothing when it is the same
    }
    void fetch('/api/time-zone', { method: 'POST', body: JSON.stringify({ tz }), headers: { 'content-type': 'application/json' }, keepalive: true })
      .then((r) => {
        if (!r.ok) return;
        try {
          sessionStorage.setItem(KEY, sent);
        } catch {
          // As above
        }
      })
      .catch(() => undefined);
  }, [mark]);
  return null;
}
