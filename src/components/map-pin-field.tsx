'use client';

import { useMemo, useState } from 'react';
import type { Point } from '../db/types';
import { distanceMeters } from '../lib/geo';
import { messages } from '../messages/fa';
import { PIN_MAX_M } from '../modules/maps/pin';
import { AREA_CIRCLE_M } from '../modules/maps/view';
import { usePlaceArea } from './place-area';
import { StreetMap } from './street-map';

// "The exact spot on the map" for an event's venue or a business's shop (optional; docs/setup.md,
// "The street map"). The map shows the chosen postal code's area; a tap puts the pin, a drag moves
// it. The form sends it as "lat,lng" in `pin`; the server checks it again (src/modules/maps/pin.ts).
// Private sellers never get this: their listings only ever show an area.

const t = messages.map;

export function MapPinField({
  version,
  place,
  initial,
  error,
}: {
  /** The street map's version; null without a map file (the field is left out) */
  version: string | null;
  /** The place chosen in the form: its value ("p:{id}" for a postal code) and centre */
  place: { value: string; center: Point | null };
  initial: string;
  error?: string;
}) {
  const [pin, setPin] = useState<Point | null>(() => {
    const [lat, lng] = initial.split(',').map(Number);
    return initial && Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : null;
  });
  const area = usePlaceArea(place.value, !!version);
  const [far, setFar] = useState(false);

  const view = useMemo(
    () =>
      version && place.center
        ? { version, center: [place.center.lng, place.center.lat] as [number, number], area, circle: area ? null : AREA_CIRCLE_M, pin: pin ? ([pin.lng, pin.lat] as [number, number]) : null }
        : null,
    [version, place.center, area, pin],
  );

  if (!version) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">{t.pickTitle}</p>
      <p className="mt-1 text-xs leading-6 text-neutral-600">{t.pickHint}</p>
      <input type="hidden" name="pin" value={pin ? `${pin.lat},${pin.lng}` : ''} />
      {view ? (
        <div className="mt-2">
          <StreetMap
            view={view}
            label={t.pickTitle}
            className="aspect-[4/3] sm:aspect-[16/10]"
            onPick={([lng, lat]) => {
              const next = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
              const tooFar = !!place.center && distanceMeters(next, place.center) > PIN_MAX_M;
              setFar(tooFar);
              if (!tooFar) setPin(next);
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {pin && <span className="text-brand-800">{t.pickSet}</span>}
            {pin && (
              <button type="button" onClick={() => setPin(null)} className="min-h-11 text-neutral-700 underline">
                {t.pickClear}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">{t.pickFirst}</p>
      )}
      {(far || error) && <p className="mt-1 text-xs text-red-700">{far ? t.pickTooFar : error}</p>}
    </div>
  );
}
