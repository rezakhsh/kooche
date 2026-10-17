'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Point } from '../db/types';
import { snapToGrid } from '../lib/geo';
import { messages } from '../messages/fa';
import type { PlaceSuggestion } from '../modules/listings/places';
import { nearestPlaceAction, searchPlacesAction } from '../app/place-actions';
import { Flag } from './flag';
import { Icon } from './icons';
import { Field } from './ui';
import { OutlineMap } from './outline-map';

// Where something is: country, postal code or town (suggestions from our own data), an optional
// district, and "use my location". Used by the posting form and by "my location" in the account.
// Without JavaScript it is a plain select and text field; the server resolves what was typed.
// The browser snaps its position to the ~500 m grid before anything leaves it.

export type PlaceFieldValue = {
  countryCode: string;
  place: string;
  placeValue: string;
  district: string;
  area: Point | null;
  /** Centre of the chosen place, for the drawing before the form is saved */
  center: Point | null;
};

const t = messages.form;

const selectClass =
  'block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

function ErrorLine({ text }: { text?: string }) {
  return text ? <span className="mt-1 block text-xs text-red-700">{text}</span> : null;
}

export function PlaceField({
  countries,
  initial,
  errors = {},
  allowArea = true,
  fixed,
  onCountryChange,
}: {
  countries: { code: string; nameFa: string }[];
  initial: PlaceFieldValue;
  /** Already translated, by field: countryCode, place, district, area */
  errors?: Partial<Record<'countryCode' | 'place' | 'district' | 'area', string>>;
  /** The account's saved place has no position */
  allowArea?: boolean;
  /**
   * The posting form: the country is shown as fixed text, not a select (decided Oct 17, 2026).
   * `changeHref` leads to the list of countries; null when the listing's country can't change.
   */
  fixed?: { hint: string; changeHref: string | null };
  onCountryChange?: (code: string) => void;
}) {
  const [country, setCountry] = useState(initial.countryCode || countries[0]?.code || '');
  const [text, setText] = useState(initial.place);
  const [value, setValue] = useState(initial.placeValue);
  const [center, setCenter] = useState<Point | null>(initial.center);
  const [area, setArea] = useState<Point | null>(initial.area);
  const [areaError, setAreaError] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[] | null>(null);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const request = useRef(0);
  const listId = useId();

  // Suggestions a moment after the seller stops typing; an older answer never replaces a newer one
  useEffect(() => {
    if (value || text.trim().length < 2) {
      setSuggestions(null);
      return;
    }
    const n = ++request.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlacesAction(country, text).catch(() => []);
      if (n !== request.current) return;
      setSearching(false);
      setSuggestions(found);
      setActive(-1);
    }, 250);
    return () => clearTimeout(timer);
  }, [text, value, country]);

  function pick(s: PlaceSuggestion) {
    request.current++;
    setText(s.label);
    setValue(s.value);
    setCenter(s.center);
    setSuggestions(null);
    setSearching(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions?.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]!);
    } else if (e.key === 'Escape') {
      setSuggestions(null);
    }
  }

  function locate() {
    setAreaError(false);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        // Snapped here already: the exact position never leaves the browser
        const snapped = snapToGrid({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setArea(snapped);
        if (!value) {
          const nearest = await nearestPlaceAction(country, snapped.lat, snapped.lng).catch(() => null);
          if (nearest) pick(nearest);
          else setAreaError(true);
        }
      },
      () => setAreaError(true),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  const shown = area ?? center;

  return (
    <div className="space-y-4">
      {fixed ? (
        <div>
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.country}</span>
          <input type="hidden" name="countryCode" value={country} />
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <Flag code={country} />
            <span className="font-bold">{countries.find((c) => c.code === country)?.nameFa}</span>
            <Icon name="lock" className="size-4 text-neutral-500" />
            {fixed.changeHref && (
              <a href={fixed.changeHref} className="ms-auto text-sm font-medium text-brand-800 hover:underline">
                {t.changeCountry}
              </a>
            )}
          </div>
          <span className="mt-1 block text-xs text-neutral-500">{fixed.hint}</span>
          <ErrorLine text={errors.countryCode} />
        </div>
      ) : countries.length > 1 ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.country}</span>
          <select
            name="countryCode"
            value={country}
            className={selectClass}
            onChange={(e) => {
              setCountry(e.target.value);
              setText('');
              setValue('');
              setCenter(null);
              setArea(null);
              onCountryChange?.(e.target.value);
            }}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nameFa}
              </option>
            ))}
          </select>
          <ErrorLine text={errors.countryCode} />
        </label>
      ) : (
        <input type="hidden" name="countryCode" value={country} />
      )}

      <div className="relative">
        <Field
          label={t.place}
          hint={t.placeHint}
          name="place"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setValue('');
            setCenter(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setSuggestions(null), 150)}
          autoComplete="off"
          // "12045 Berlin" must not turn into "Berlin 12045" on a right-to-left page
          dir="auto"
          role="combobox"
          aria-expanded={!!suggestions?.length}
          aria-controls={listId}
          aria-autocomplete="list"
          maxLength={100}
        />
        <input type="hidden" name="placeValue" value={value} />
        {searching && !suggestions && <span className="mt-1 block text-xs text-neutral-500">{t.placeSearching}</span>}
        {suggestions && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-[4.75rem] z-10 max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {suggestions.length === 0 && <li className="px-4 py-2 text-sm text-neutral-500">{t.placeNoMatch}</li>}
            {suggestions.map((s, i) => (
              <li key={s.value} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  className={`block w-full px-4 py-2 text-start text-sm hover:bg-neutral-50 ${i === active ? 'bg-neutral-100' : ''}`}
                >
                  <bdi>{s.label}</bdi>
                </button>
              </li>
            ))}
          </ul>
        )}
        <ErrorLine text={errors.place} />
      </div>

      <div>
        <Field label={t.district} hint={t.districtHint} name="district" defaultValue={initial.district} maxLength={60} />
        <ErrorLine text={errors.district} />
      </div>

      {allowArea && (
        <div className="space-y-2">
          {area && (
            <>
              <input type="hidden" name="areaLat" value={area.lat} />
              <input type="hidden" name="areaLng" value={area.lng} />
            </>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {area ? (
              <>
                <span className="text-brand-800">{t.locationSet}</span>
                <button type="button" onClick={() => setArea(null)} className="text-neutral-600 underline">
                  {t.locationClear}
                </button>
              </>
            ) : (
              <button type="button" onClick={locate} className="text-brand-800 underline">
                {t.useMyLocation}
              </button>
            )}
            {areaError && <span className="text-red-700">{t.locationFailed}</span>}
          </div>
          <ErrorLine text={errors.area} />
        </div>
      )}

      {shown && (
        <div className="flex justify-center">
          <OutlineMap countryCode={country} point={shown} label={t.mapPreview} />
        </div>
      )}
    </div>
  );
}
