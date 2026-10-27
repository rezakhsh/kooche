'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '../components/icons';
import { snapToGrid } from '../lib/geo';
import { messages } from '../messages/fa';
import { nearestCityPath } from './[country]/_browse/near-action';

// «نزدیک‌ترین شهر» on the first page (wave 1, mockup final/home): the browser's position, snapped
// to the ~500 m grid before it leaves, opens the nearest city's page. Only with JavaScript and
// geolocation; nothing is stored.

export function NearestCity({ country, countryName }: { country: string; countryName: string }) {
  const t = messages.home;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => setReady(typeof navigator !== 'undefined' && 'geolocation' in navigator), []);
  if (!ready) return null;
  const ask = () => {
    setMessage(null);
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAsking(false);
        start(async () => {
          const r = await nearestCityPath({ country, ...snapToGrid({ lat: pos.coords.latitude, lng: pos.coords.longitude }) });
          if ('path' in r) router.push(r.path);
          else setMessage(r.error === 'outside' ? messages.browse.near.outside(countryName) : messages.browse.near.unavailable);
        });
      },
      (err) => {
        setAsking(false);
        setMessage(err.code === err.PERMISSION_DENIED ? messages.browse.near.denied : messages.browse.near.unavailable);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  };
  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={ask} disabled={asking || pending} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-60">
        <Icon name="locate" className="size-4" />
        {asking || pending ? messages.browse.near.asking : t.nearestCity}
      </button>
      {message && (
        <p role="status" className="text-xs text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
