import { DARK, LIGHT, layers, type Flavor } from '@protomaps/basemaps';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LayerSpecification, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import pkg from 'maplibre-gl/package.json';
import type { StreetMapView } from '../modules/maps/view';

// The street map's drawing (docs/setup.md, "The street map"), loaded by src/components/street-map.tsx
// only when a map scrolls into view: MapLibre with our own tiles, letters and worker from /map/…,
// Protomaps' layers in Peydoo's colours (light and dark), Persian names where OpenStreetMap has them.
// Points of interest are left out: the map says where, not what is nearby.

maplibregl.setWorkerUrl(`/map/worker.mjs?v=${pkg.version}`);

/** Protomaps' light map in our neutrals, turquoise water and parks (src/app/globals.css) */
const PEYDOO_LIGHT: Flavor = {
  ...LIGHT,
  background: '#ebf0ef',
  earth: '#f4f7f6',
  park_a: '#e1eee6',
  park_b: '#cfe6d8',
  wood_a: '#e1eee6',
  wood_b: '#cfe6d8',
  scrub_a: '#e4efe8',
  scrub_b: '#d3e8db',
  water: '#a6d3d2',
  buildings: '#dce4e2',
  pedestrian: '#eef2f1',
  boundaries: '#9aaba7',
  roads_label_minor: '#616f6c',
  roads_label_major: '#5a6966',
  city_label: '#2c3836',
  city_label_halo: '#f4f7f6',
  subplace_label: '#5a6966',
  subplace_label_halo: '#f4f7f6',
  state_label: '#9aaba7',
  state_label_halo: '#f4f7f6',
  country_label: '#616f6c',
  ocean_label: '#0b6e77',
};

/** The same in dark mode: surfaces #0f1716 / #16211f, water from the dark turquoise */
const PEYDOO_DARK: Flavor = {
  ...DARK,
  background: '#0f1716',
  earth: '#16211f',
  park_a: '#18282a',
  park_b: '#1a2e2d',
  wood_a: '#18282a',
  wood_b: '#1a2e2d',
  scrub_a: '#18282a',
  scrub_b: '#1a2e2d',
  water: '#123234',
  buildings: '#1b2826',
  pedestrian: '#1b2826',
  boundaries: '#3a4946',
  roads_label_minor: '#7d8f8b',
  roads_label_major: '#9fb0ac',
  city_label: '#d5dfdc',
  city_label_halo: '#0f1716',
  subplace_label: '#9fb0ac',
  subplace_label_halo: '#0f1716',
  state_label: '#7d8f8b',
  state_label_halo: '#0f1716',
  country_label: '#9fb0ac',
  ocean_label: '#74ccd2',
};

const AREA = { light: { fill: '#12808a', line: '#0b6e77' }, dark: { fill: '#5cc0c7', line: '#74ccd2' } };

type Feature = { type: 'Feature'; properties: Record<string, never>; geometry: { type: 'MultiPolygon' | 'Polygon'; coordinates: number[][][][] | number[][][] } };

/** A circle of `m` metres around [lng, lat], as a polygon */
function circle([lng, lat]: [number, number], m: number): Feature {
  const ring: number[][] = [];
  const dLat = m / 111_320;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

function shapeOf(view: StreetMapView): Feature | null {
  if (view.area) return { type: 'Feature', properties: {}, geometry: view.area };
  if (view.circle) return circle(view.center, view.circle);
  return null;
}

function bounds(f: Feature): [[number, number], [number, number]] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as [number, number];
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    } else (c as unknown[]).forEach(walk);
  };
  walk(f.geometry.coordinates);
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function style(view: StreetMapView, dark: boolean): StyleSpecification {
  const origin = location.origin;
  const colors = dark ? AREA.dark : AREA.light;
  const base = layers('osm', dark ? PEYDOO_DARK : PEYDOO_LIGHT, { lang: 'fa' }).filter((l) => !('source-layer' in l) || l['source-layer'] !== 'pois');
  // The area goes under the labels, so street and place names stay readable on it
  const firstLabel = base.findIndex((l) => l.type === 'symbol');
  const area: LayerSpecification[] = [
    { id: 'peydoo-area-fill', type: 'fill', source: 'peydoo-area', paint: { 'fill-color': colors.fill, 'fill-opacity': dark ? 0.2 : 0.16 } },
    { id: 'peydoo-area-line', type: 'line', source: 'peydoo-area', paint: { 'line-color': colors.line, 'line-width': 2, 'line-opacity': 0.9 } },
  ];
  const shape = shapeOf(view);
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sources: {
      osm: {
        type: 'vector',
        tiles: [`${origin}/map/tiles/${view.version}/{z}/{x}/{y}`],
        maxzoom: 14,
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>',
      },
      'peydoo-area': { type: 'geojson', data: shape ?? { type: 'FeatureCollection', features: [] } },
    },
    layers: firstLabel < 0 ? [...base, ...area] : [...base.slice(0, firstLabel), ...area, ...base.slice(firstLabel)],
  };
}

function pinElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'peydoo-map-pin';
  el.innerHTML =
    '<svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true"><path d="M12 31s10-10.2 10-18.5C22 6.2 17.5 1.5 12 1.5S2 6.2 2 12.5C2 20.8 12 31 12 31z" fill="#0b6e77" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12.5" r="4" fill="#fff"/></svg>';
  return el;
}

export type MapTexts = { zoomIn: string; zoomOut: string; gestureDesktop: string; gestureMac: string; gesturePhone: string; label: string };

export type MountedMap = {
  setDark(dark: boolean): void;
  setView(view: StreetMapView): void;
  setPin(pin: [number, number] | null): void;
  destroy(): void;
};

export function mountMap(
  container: HTMLElement,
  initial: StreetMapView,
  { dark, texts, onPick }: { dark: boolean; texts: MapTexts; onPick?: (at: [number, number]) => void },
): MountedMap {
  let view = initial;
  let isDark = dark;
  const map = new maplibregl.Map({
    container,
    style: style(view, isDark),
    center: view.center,
    zoom: 13,
    maxZoom: 17,
    minZoom: 4,
    attributionControl: { compact: true },
    cooperativeGestures: !onPick,
    dragRotate: false,
    pitchWithRotate: false,
    renderWorldCopies: false,
    locale: {
      'NavigationControl.ZoomIn': texts.zoomIn,
      'NavigationControl.ZoomOut': texts.zoomOut,
      'CooperativeGesturesHandler.WindowsHelpText': texts.gestureDesktop,
      'CooperativeGesturesHandler.MacHelpText': texts.gestureMac,
      'CooperativeGesturesHandler.MobileHelpText': texts.gesturePhone,
    },
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  map.getCanvas().setAttribute('aria-label', texts.label);

  let marker: maplibregl.Marker | null = null;
  function setPin(pin: [number, number] | null) {
    if (!pin) {
      marker?.remove();
      marker = null;
      return;
    }
    if (!marker) {
      marker = new maplibregl.Marker({ element: pinElement(), anchor: 'bottom', draggable: !!onPick }).setLngLat(pin).addTo(map);
      if (onPick) marker.on('dragend', () => onPick(marker!.getLngLat().toArray() as [number, number]));
    } else marker.setLngLat(pin);
  }

  function frame() {
    const shape = shapeOf(view);
    if (view.pin) map.jumpTo({ center: view.pin, zoom: 15.5 });
    else if (shape) map.fitBounds(bounds(shape), { padding: 28, maxZoom: 15, animate: false });
    else map.jumpTo({ center: view.center, zoom: 11 });
  }
  frame();
  setPin(view.pin);
  if (onPick) map.on('click', (e: MapMouseEvent) => onPick(e.lngLat.toArray() as [number, number]));

  return {
    setDark(next) {
      if (next === isDark) return;
      isDark = next;
      map.setStyle(style(view, isDark));
    },
    setView(next) {
      const moved = next.center[0] !== view.center[0] || next.center[1] !== view.center[1] || next.area !== view.area;
      view = next;
      const source = map.getSource<GeoJSONSource>('peydoo-area');
      const shape = shapeOf(view);
      source?.setData(shape ?? { type: 'FeatureCollection', features: [] });
      if (moved) frame();
      setPin(view.pin);
    },
    setPin,
    destroy() {
      map.remove();
    },
  };
}
