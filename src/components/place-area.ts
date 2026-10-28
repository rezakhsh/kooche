'use client';

import { useEffect, useState } from 'react';
import type { MultiPolygon } from '../modules/maps/view';

/**
 * The area of the postal code chosen in a form (`placeValue` "p:{id}"), from /map/place-area/{id}
 * (src/app/map/place-area/). Null for a city, a postal code without an area, or no map.
 */
export function usePlaceArea(placeValue: string, enabled: boolean): MultiPolygon | null {
  const [area, setArea] = useState<MultiPolygon | null>(null);
  const postalId = placeValue.startsWith('p:') ? placeValue.slice(2) : null;
  useEffect(() => {
    setArea(null);
    if (!postalId || !enabled) return;
    let stale = false;
    fetch(`/map/place-area/${postalId}`)
      .then((r) => (r.ok ? (r.json() as Promise<MultiPolygon>) : null))
      .then((a) => {
        if (!stale) setArea(a);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [postalId, enabled]);
  return area;
}
