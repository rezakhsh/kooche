'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { messages } from '../messages/fa';
import type { StreetMapView } from '../modules/maps/view';
import type { MountedMap } from './street-map-gl';

// The street map on listing, event and business pages and in the forms (docs/setup.md, "The street
// map"). The page arrives with `fallback` (the outline map) in the frame; MapLibre is loaded only
// when the frame comes near the screen, so pages without a scroll to the map never download it.
// Without JavaScript, or if WebGL fails, the outline stays. Follows the page's light or dark mode.

const t = messages.map;

/** Dark when the page is: the `theme` cookie's data-theme, otherwise the device */
function pageIsDark(): boolean {
  const chosen = document.documentElement.dataset.theme;
  return chosen === 'dark' || (chosen !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export function StreetMap({
  view,
  label,
  fallback,
  onPick,
  className = 'aspect-[16/10]',
}: {
  view: StreetMapView;
  label: string;
  fallback?: ReactNode;
  /** Forms: a tap or drag sets the pin */
  onPick?: (at: [number, number]) => void;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedMap | null>(null);
  const latest = useRef({ view, onPick });
  latest.current = { view, onPick };
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting) || mounted.current) return;
        observer.disconnect();
        try {
          const { mountMap } = await import('./street-map-gl');
          if (cancelled) return;
          mounted.current = mountMap(el.querySelector<HTMLElement>('[data-map-canvas]')!, latest.current.view, {
            dark: pageIsDark(),
            texts: { zoomIn: t.zoomIn, zoomOut: t.zoomOut, gestureDesktop: t.gestureDesktop, gestureMac: t.gestureMac, gesturePhone: t.gesturePhone, label },
            onPick: latest.current.onPick ? (at) => latest.current.onPick?.(at) : undefined,
          });
          setReady(true);
        } catch (e) {
          // No WebGL or the script failed: the outline map stays
          console.warn('street map:', e instanceof Error ? e.message : e);
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    // Light or dark: the footer's switch changes data-theme, the device changes the media query
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => mounted.current?.setDark(pageIsDark());
    const attrs = new MutationObserver(sync);
    attrs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    media.addEventListener('change', sync);
    return () => {
      cancelled = true;
      observer.disconnect();
      attrs.disconnect();
      media.removeEventListener('change', sync);
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, [label]);

  useEffect(() => {
    mounted.current?.setView(view);
  }, [view]);

  return (
    <div ref={frame} className={`relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 ${className}`}>
      {/* The map is drawn left to right like every map; the controls are placed by MapLibre. Sized by
          height and width, not by `absolute inset-0`: MapLibre's stylesheet makes its box relative */}
      <div data-map-canvas dir="ltr" className={`h-full w-full transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`} />
      {!ready && fallback && <div className="absolute inset-0 flex items-center justify-center p-4">{fallback}</div>}
    </div>
  );
}
