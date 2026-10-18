'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '../../../components/icons';
import { snapToGrid } from '../../../lib/geo';
import { messages } from '../../../messages/fa';
import { nearMeToken } from './near-action';

// "Near me" (approved Oct 18, 2026): asks for the browser's location only when tapped. The
// position is snapped to the ~500 m grid here, before it leaves the browser; the server returns
// an encrypted token, and the page moves to ?near=<token>&r=10&sort=distance. The server then
// writes the canonical address. Without JavaScript the button doesn't appear; the postal code
// field does the same job.

type Status = 'idle' | 'asking' | 'denied' | 'unavailable' | 'outside';

export function NearMe({ country, countryName, active }: { country: string; countryName: string; active: boolean }) {
  const t = messages.browse.near;
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [pending, start] = useTransition();
  useEffect(() => setReady(typeof navigator !== 'undefined' && 'geolocation' in navigator), []);
  if (!ready) return null;

  const ask = () => {
    setStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cell = snapToGrid({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        start(async () => {
          const r = await nearMeToken({ country, ...cell });
          if ('error' in r) {
            setStatus(r.error === 'outside' ? 'outside' : 'unavailable');
            return;
          }
          const q = new URLSearchParams(search.toString());
          for (const k of ['postal', 'after', 'near', 'sort']) q.delete(k);
          // On a city page the server moves this to the country's address (a radius crosses cities)
          q.set('near', r.token);
          q.set('r', q.get('r') ?? '10');
          q.set('sort', 'distance');
          setStatus('idle');
          router.push(`${path}?${q.toString()}`);
        });
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  };

  const busy = status === 'asking' || pending;
  const message = status === 'denied' ? t.denied : status === 'unavailable' ? t.unavailable : status === 'outside' ? t.outside(countryName) : null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={ask}
        disabled={busy}
        aria-pressed={active}
        title={t.hint}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold whitespace-nowrap disabled:opacity-60 ${
          active ? 'border-brand-700 bg-brand-700 text-white' : 'border-brand-100 bg-brand-50 text-brand-700 hover:border-brand-300'
        }`}
      >
        <Icon name="locate" className="size-4" />
        {busy ? t.asking : t.button}
      </button>
      {message && (
        <p role="status" className="max-w-xs text-xs text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
