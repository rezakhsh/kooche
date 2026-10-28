import { DARK, LIGHT, layers, type Flavor } from '@protomaps/basemaps';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LayerSpecification, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import pkg from 'maplibre-gl/package.json';
import { HOME_NEAR_KM, type MultiPolygon, type StreetMapView } from '../modules/maps/view';

// The street map's drawing (docs/setup.md, "The street map"), loaded by src/components/street-map.tsx
// only when a map scrolls into view: MapLibre with our own tiles, letters, icons and worker from
// /map/…, Protomaps' layers in the classic street-map colours people know (warm land, yellow main
// roads; owner, Oct 28, 2026), place names as written locally. A city whose districts we have
// (Berlin) gets their names and borders from /map/neighbourhoods/… at every zoom. Shops and other
// points of interest are left out, train stations stay: the map says where, not what is nearby.
// The visitor's own place and the distance: on the same map up to HOME_NEAR_KM, otherwise an arrow
// at the map's edge pointing home.

maplibregl.setWorkerUrl(`/map/worker.mjs?v=${pkg.version}`);

/** Warm land, white streets, yellow main roads, orange motorways */
const CLASSIC: Flavor = {
  ...LIGHT,
  background: '#e9e5dd',
  earth: '#f3f0ea',
  park_a: '#cfe7c1',
  park_b: '#c2e0b0',
  wood_a: '#c6e2b5',
  wood_b: '#b8daa5',
  scrub_a: '#d3e8c6',
  scrub_b: '#c8e2b8',
  hospital: '#f6dcdc',
  school: '#f0e6cf',
  industrial: '#ebe5dc',
  pedestrian: '#f7f4ee',
  water: '#9ecdea',
  buildings: '#e3ddd3',
  zoo: '#d8e9c8',
  aerodrome: '#e2dfe8',
  minor_a: '#ffffff',
  minor_b: '#ffffff',
  minor_service: '#ffffff',
  other: '#fbfaf7',
  minor_casing: '#d8d1c4',
  minor_service_casing: '#d8d1c4',
  link: '#ffe38f',
  link_casing: '#e3b64a',
  major: '#ffe38f',
  major_casing_early: '#e3b64a',
  major_casing_late: '#e3b64a',
  highway: '#ffc266',
  highway_casing_early: '#e09a3c',
  highway_casing_late: '#e09a3c',
  bridges_major: '#ffe38f',
  bridges_major_casing: '#e3b64a',
  bridges_highway: '#ffc266',
  bridges_highway_casing: '#e09a3c',
  bridges_minor: '#ffffff',
  bridges_minor_casing: '#d8d1c4',
  tunnel_major: '#fff1c7',
  tunnel_highway: '#ffdca8',
  railway: '#8f8a83',
  boundaries: '#a59f95',
  roads_label_minor: '#5b5750',
  roads_label_minor_halo: '#ffffff',
  roads_label_major: '#4a463f',
  roads_label_major_halo: '#ffffff',
  city_label: '#1f1d1a',
  city_label_halo: '#ffffff',
  subplace_label: '#4b4740',
  subplace_label_halo: '#ffffff',
};

/** The same at night: the page's dark surfaces (#0f1716), main roads in dark amber */
const CLASSIC_DARK: Flavor = {
  ...DARK,
  background: '#0f1716',
  earth: '#17211f',
  park_a: '#173026',
  park_b: '#183528',
  wood_a: '#173026',
  wood_b: '#183528',
  scrub_a: '#173026',
  scrub_b: '#183528',
  water: '#14404a',
  buildings: '#1f2b29',
  pedestrian: '#1c2725',
  minor_a: '#2a3735',
  minor_b: '#2a3735',
  minor_service: '#26322f',
  other: '#26322f',
  minor_casing: '#17211f',
  link: '#6b5523',
  major: '#6b5523',
  major_casing_early: '#3d3014',
  major_casing_late: '#3d3014',
  highway: '#8a6a2a',
  highway_casing_early: '#4a3a17',
  highway_casing_late: '#4a3a17',
  bridges_major: '#6b5523',
  bridges_highway: '#8a6a2a',
  railway: '#4d5c59',
  boundaries: '#3a4946',
  roads_label_minor: '#a9b8b4',
  roads_label_minor_halo: '#0f1716',
  roads_label_major: '#c9d5d2',
  roads_label_major_halo: '#0f1716',
  city_label: '#eef4f2',
  city_label_halo: '#0f1716',
  subplace_label: '#c3d0cd',
  subplace_label_halo: '#0f1716',
};

const COLORS = {
  light: { area: '#c0392b', areaFill: '#d6453d', areaOpacity: 0.14, home: '#c98a12', homeFill: '#e8a020', label: '#1f2b29', halo: '#ffffff', hoodLine: '#8a9a96', gap: '#1d2725' },
  dark: { area: '#ff7b72', areaFill: '#ff6b61', areaOpacity: 0.2, home: '#f0b53f', homeFill: '#e8a020', label: '#e6eeec', halo: '#0f1716', hoodLine: '#5d6f6b', gap: '#e6eeec' },
};

/** Primary roads and trunks are the yellow ones; secondary and tertiary roads are drawn like streets */
const MAIN_ROADS = ['primary', 'trunk', 'primary_link', 'trunk_link'];

type Geometry = MultiPolygon | { type: 'Polygon'; coordinates: number[][][] } | { type: 'Point'; coordinates: [number, number] } | { type: 'LineString'; coordinates: [number, number][] };
type Feature = { type: 'Feature'; properties: Record<string, never>; geometry: Geometry };
type Collection = { type: 'FeatureCollection'; features: unknown[] };
const NOTHING: Collection = { type: 'FeatureCollection', features: [] };
const feature = (geometry: Geometry | null): Feature | Collection => (geometry ? { type: 'Feature', properties: {}, geometry } : NOTHING);

/** A circle of `m` metres around [lng, lat], as a polygon */
function circle([lng, lat]: [number, number], m: number): Geometry {
  const ring: number[][] = [];
  const dLat = m / 111_320;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function shapeOf(view: StreetMapView): Geometry | null {
  if (view.area) return view.area;
  if (view.circle) return circle(view.center, view.circle);
  return null;
}

/** Home and place share one map; within a kilometre they are the same area */
const nearHome = (view: StreetMapView) => !!view.home && view.home.km <= HOME_NEAR_KM;
const gapLine = (view: StreetMapView): Geometry | null =>
  view.home && nearHome(view) && view.home.km >= 1 ? { type: 'LineString', coordinates: [view.home.center, view.pin ?? view.center] } : null;

function bounds(geometries: Geometry[]): [[number, number], [number, number]] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as [number, number];
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    } else (c as unknown[]).forEach(walk);
  };
  for (const g of geometries) walk(g.coordinates);
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function style(view: StreetMapView, dark: boolean): StyleSpecification {
  const origin = location.origin;
  const c = dark ? COLORS.dark : COLORS.light;
  const flavor = dark ? CLASSIC_DARK : CLASSIC;
  const tier = (main: string, other: string) => ['match', ['get', 'kind_detail'], MAIN_ROADS, main, other];
  const base = layers('osm', flavor, { lang: 'en' })
    .filter((l) => !('source-layer' in l) || l['source-layer'] !== 'pois')
    .map((l): LayerSpecification => {
      if (l.type === 'line' && (l.id === 'roads_major' || l.id === 'roads_bridges_major')) {
        return { ...l, paint: { ...l.paint, 'line-color': tier(flavor.major, flavor.minor_a) as never } };
      }
      if (l.type === 'line' && (l.id.startsWith('roads_major_casing') || l.id === 'roads_bridges_major_casing')) {
        return { ...l, paint: { ...l.paint, 'line-color': tier(flavor.major_casing_late, flavor.minor_casing) as never } };
      }
      // Street names one step sooner, so a venue's close-up names the streets around it
      if (l.type === 'symbol' && l.id === 'roads_labels_minor') return { ...l, minzoom: 14, layout: { ...l.layout, 'text-size': 11 } };
      // OpenStreetMap's own district names only close up, where ours stop
      if (l.type === 'symbol' && l.id === 'places_subplace' && view.neighbourhoods) return { ...l, minzoom: 14.5 };
      return l;
    });
  // Our overlays go under the labels, so street and place names stay readable on them
  const firstLabel = base.findIndex((l) => l.type === 'symbol');
  const overlays: LayerSpecification[] = [
    { id: 'peydoo-hood-line', type: 'line', source: 'peydoo-hood-lines', maxzoom: 14, paint: { 'line-color': c.hoodLine, 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.7 } },
    { id: 'peydoo-home-fill', type: 'fill', source: 'peydoo-home', paint: { 'fill-color': c.homeFill, 'fill-opacity': 0.14 } },
    { id: 'peydoo-home-line', type: 'line', source: 'peydoo-home', paint: { 'line-color': c.home, 'line-width': 1.5, 'line-dasharray': [2, 2] } },
    { id: 'peydoo-area-fill', type: 'fill', source: 'peydoo-area', paint: { 'fill-color': c.areaFill, 'fill-opacity': c.areaOpacity } },
    { id: 'peydoo-area-line', type: 'line', source: 'peydoo-area', paint: { 'line-color': c.area, 'line-width': 2.5, 'line-opacity': 0.95 } },
    { id: 'peydoo-gap', type: 'line', source: 'peydoo-gap', paint: { 'line-color': c.gap, 'line-width': 1.6, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.75 } },
  ];
  const labels: LayerSpecification[] = [
    {
      id: 'peydoo-stations',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'pois',
      minzoom: 12,
      filter: ['==', ['get', 'kind'], 'station'],
      layout: {
        'icon-image': 'train_station',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 15, 1],
        'text-field': ['step', ['zoom'], '', 14, ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': flavor.roads_label_major, 'text-halo-color': c.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'peydoo-hood-label',
      type: 'symbol',
      source: 'peydoo-hood-labels',
      maxzoom: 14.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Medium'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11.5, 12, 13.5, 14, 15],
        'text-padding': 4,
        'symbol-avoid-edges': true,
        // Bigger districts win when names collide
        'symbol-sort-key': ['-', 0, ['get', 'km2']],
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 2 },
    },
  ];
  const home = view.home;
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/map/sprites/4/light`,
    sources: {
      osm: {
        type: 'vector',
        tiles: [`${origin}/map/tiles/${view.version}/{z}/{x}/{y}`],
        maxzoom: 14,
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>',
      },
      'peydoo-area': { type: 'geojson', data: feature(shapeOf(view)) as never },
      'peydoo-home': { type: 'geojson', data: feature(home?.area && nearHome(view) ? home.area : null) as never },
      'peydoo-gap': { type: 'geojson', data: feature(gapLine(view)) as never },
      'peydoo-hood-labels': { type: 'geojson', data: NOTHING as never },
      'peydoo-hood-lines': { type: 'geojson', data: NOTHING as never },
    },
    layers: [...base.slice(0, firstLabel), ...overlays, ...base.slice(firstLabel), ...labels],
  };
}

function pinElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'peydoo-map-pin';
  el.innerHTML =
    '<svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true"><path d="M12 31s10-10.2 10-18.5C22 6.2 17.5 1.5 12 1.5S2 6.2 2 12.5C2 20.8 12 31 12 31z" fill="var(--color-brand-700)" stroke="var(--color-white)" stroke-width="2"/><circle cx="12" cy="12.5" r="4" fill="var(--color-white)"/></svg>';
  return el;
}

const HOUSE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12h14m-5-6 6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function element(className: string, html: string, title?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  if (title) el.title = title;
  return el;
}

export type MapTexts = {
  zoomIn: string;
  zoomOut: string;
  gestureDesktop: string;
  gestureMac: string;
  gesturePhone: string;
  label: string;
  /** «محدودهٔ شما» */
  home: string;
  /** «حدود ۹ کیلومتر» */
  km: (km: number) => string;
  /** «۱۵۰ کیلومتر تا Berlin» */
  far: (km: number, name: string) => string;
};

export type MountedMap = {
  setDark(dark: boolean): void;
  setView(view: StreetMapView): void;
  setPin(pin: [number, number] | null): void;
  /** Full screen: the page's gestures no longer need two fingers or Ctrl */
  setExpanded(expanded: boolean): void;
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
    attributionControl: { compact: false },
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
  container.classList.toggle('peydoo-map-dark', isDark);

  // The city's district names and borders, once per map (and again after a style change)
  let hoods: { labels: Collection; lines: Collection } | null = null;
  let hoodsFor: string | null = null;
  async function loadHoods() {
    const id = view.neighbourhoods ?? null;
    if (id !== hoodsFor) {
      hoodsFor = id;
      hoods = id ? await fetch(`/map/neighbourhoods/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    }
    map.getSource<GeoJSONSource>('peydoo-hood-labels')?.setData((hoods?.labels ?? NOTHING) as never);
    map.getSource<GeoJSONSource>('peydoo-hood-lines')?.setData((hoods?.lines ?? NOTHING) as never);
  }
  map.on('style.load', () => void loadHoods());

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

  // The visitor's place: a house where it is, the distance halfway when it's near, otherwise an
  // arrow on the edge of the map pointing at it for as long as it is out of sight
  const homeMarkers: maplibregl.Marker[] = [];
  let far: HTMLElement | null = null;
  function placeFar() {
    if (!far || !view.home) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const from = map.project(view.pin ?? view.center);
    const to = map.project(view.home.center);
    const inSight = to.x >= 0 && to.y >= 0 && to.x <= w && to.y <= h;
    far.hidden = inSight;
    if (inSight) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // Where the line from the place to home leaves the frame, kept clear of the corners' buttons
    const [ix, top, bottom] = [Math.min(90, w / 3), 28, Math.max(28, h - 64)];
    const t = Math.min(dx ? ((dx > 0 ? w - ix : ix) - from.x) / dx : Infinity, dy ? ((dy > 0 ? bottom : top) - from.y) / dy : Infinity);
    far.style.left = `${Math.min(w - ix, Math.max(ix, from.x + dx * Math.max(0, t)))}px`;
    far.style.top = `${Math.min(bottom, Math.max(top, from.y + dy * Math.max(0, t)))}px`;
    far.querySelector('svg')!.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  }
  function setHome() {
    homeMarkers.splice(0).forEach((m) => m.remove());
    far?.remove();
    far = null;
    const home = view.home;
    if (!home) return;
    homeMarkers.push(new maplibregl.Marker({ element: element('peydoo-map-home', HOUSE, texts.home) }).setLngLat(home.center).addTo(map));
    const gap = gapLine(view);
    if (gap?.type === 'LineString') {
      const [[ax, ay], [bx, by]] = gap.coordinates as [[number, number], [number, number]];
      homeMarkers.push(new maplibregl.Marker({ element: element('peydoo-map-km', texts.km(home.km)) }).setLngLat([(ax + bx) / 2, (ay + by) / 2]).addTo(map));
    }
    if (!nearHome(view)) {
      far = element('peydoo-map-far', `${ARROW}<span>${texts.far(home.km, home.name)}</span>`);
      container.appendChild(far);
      placeFar();
    }
  }
  map.on('move', placeFar);

  function frame() {
    const shape = shapeOf(view);
    const home = view.home;
    if (home && nearHome(view)) {
      const here: Geometry = shape && !view.pin ? shape : { type: 'Point', coordinates: view.pin ?? view.center };
      const there: Geometry = home.area ?? { type: 'Point', coordinates: home.center };
      // Room for the house, the pin and the distance, in proportion to the frame (event maps are
      // wide and low on phones)
      const [w, h] = [container.clientWidth, container.clientHeight];
      const side = Math.round(w * 0.12);
      const top = Math.round(h * 0.14);
      map.fitBounds(bounds([here, there]), { padding: { top: top + (view.pin ? 20 : 0), bottom: top, left: side, right: side }, maxZoom: 14.5, animate: false });
    } else if (view.pin) map.jumpTo({ center: view.pin, zoom: onPick ? 15.5 : 14.8 });
    else if (shape) {
      map.fitBounds(bounds([shape]), { padding: 24, maxZoom: 15, animate: false });
      // Pages show the area with the districts around it (about a quarter of the map); the forms
      // keep it large, to tap the exact spot
      if (!onPick) map.setZoom(Math.min(13.5, Math.max(10.9, map.getZoom() - 1.9)));
    } else map.jumpTo({ center: view.center, zoom: 11 });
    placeFar();
    // For checks in the browser: the zoom and the size it was fitted to
    container.dataset.fit = `${map.getZoom().toFixed(2)}@${container.clientWidth}x${container.clientHeight}`;
  }
  frame();
  // The frame's size can settle after the map starts (fonts, the page's layout on phones): fit the
  // area again until the visitor moves the map themselves
  let moved = false;
  map.on('movestart', (e) => {
    if ((e as { originalEvent?: unknown }).originalEvent) moved = true;
  });
  map.once('load', () => !moved && frame());
  map.on('resize', () => (moved ? placeFar() : frame()));
  setPin(view.pin);
  setHome();
  if (onPick) map.on('click', (e: MapMouseEvent) => onPick(e.lngLat.toArray() as [number, number]));

  return {
    setDark(next) {
      if (next === isDark) return;
      isDark = next;
      container.classList.toggle('peydoo-map-dark', isDark);
      map.setStyle(style(view, isDark));
    },
    setView(next) {
      const changed = next.center[0] !== view.center[0] || next.center[1] !== view.center[1] || next.area !== view.area;
      view = next;
      map.getSource<GeoJSONSource>('peydoo-area')?.setData(feature(shapeOf(view)) as never);
      if (changed) frame();
      setPin(view.pin);
    },
    setPin,
    setExpanded(expanded) {
      if (!onPick) {
        if (expanded) map.cooperativeGestures.disable();
        else map.cooperativeGestures.enable();
      }
      map.resize();
      moved = false;
      frame();
    },
    destroy() {
      map.remove();
    },
  };
}
