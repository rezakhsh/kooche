import { describe, expect, it } from 'vitest';
import { headerPlace, needsServerHeader, type HeaderPlaceData } from '../src/components/header-place';

// The header's chip and keyword box follow the address in the browser (src/components/header-place.ts;
// owner's approval, Nov 6, 2026), with the same rules the server header had (Oct 17–31, 2026).
const data: HeaderPlaceData = {
  country: { slug: 'germany', nameFa: 'آلمان' },
  cookie: 'germany',
  footer: 'germany',
  open: ['germany'],
  closed: [['austria', 'اتریش'], ['canada', 'کانادا']],
  cities: [['berlin', 'برلین'], ['hamburg', 'هامبورگ']],
  categories: [['cars', 'خودرو'], ['real-estate', 'املاک']],
  home: null,
  mineClosed: null,
  visitorPlanned: null,
  visitorPlannedAsked: false,
};

describe('header place', () => {
  it('names the city on its pages and searches the page', () => {
    const p = headerPlace('/germany/berlin', data);
    expect(p.chip).toBe('برلین');
    expect(p.search).toEqual({ action: '/germany/berlin', city: 'berlin', placeholder: 'جستجو در برلین…', plain: false });
    expect(headerPlace('/germany/berlin/cars', data).search).toMatchObject({ action: '/germany/berlin/cars', placeholder: 'جستجو در خودرو…' });
    expect(headerPlace('/germany/cars', data)).toMatchObject({ chip: 'آلمان', search: { action: '/germany/cars', city: null } });
  });

  it('names the country elsewhere, and a signed-in user’s city away from the country pages', () => {
    expect(headerPlace('/germany', data)).toMatchObject({ chip: 'آلمان', search: { action: '/germany', placeholder: 'جستجو در آلمان…' } });
    expect(headerPlace('/v/a/abc123', data)).toMatchObject({ chip: 'آلمان', search: { action: '/germany' } });
    const home = { ...data, home: { slug: 'hamburg', nameFa: 'هامبورگ' } };
    expect(headerPlace('/my/listings', home)).toMatchObject({ chip: 'هامبورگ', search: { action: '/germany/hamburg', city: 'hamburg' } });
    expect(headerPlace('/germany', home).chip).toBe('آلمان');
  });

  it('searches the events on the events pages', () => {
    expect(headerPlace('/germany/berlin/events', data).search).toEqual({ action: '/germany/berlin/events', city: 'berlin', placeholder: 'جستجو در رویدادهای برلین…', plain: true });
    expect(headerPlace('/germany/events', data).search).toMatchObject({ action: '/germany/events', plain: true });
  });

  it('names a country that is not open on its pages, with nothing to search', () => {
    expect(headerPlace('/austria/wien', data)).toMatchObject({ chip: 'اتریش', search: null });
    const mine = { ...data, mineClosed: { slug: 'canada', nameFa: 'کانادا' } };
    expect(headerPlace('/help', mine)).toMatchObject({ chip: 'کانادا', search: null });
    expect(headerPlace('/germany/berlin', mine)).toMatchObject({ chip: 'برلین' });
    const planned = { ...data, country: null, visitorPlannedAsked: true, visitorPlanned: { slug: 'austria', nameFa: 'اتریش' } };
    expect(headerPlace('/', planned).chip).toBe('اتریش');
    expect(headerPlace('/help', planned).chip).toBeNull();
  });

  it('marks the sign-in pages and ignores unknown or broken segments', () => {
    expect(headerPlace('/login/code', data).onLogin).toBe(true);
    expect(headerPlace('/germany/%E0%A4%A', data).chip).toBe('آلمان');
    expect(headerPlace('/germany/constructor', data).search).toMatchObject({ action: '/germany' });
    expect(headerPlace('/', { ...data, country: null })).toMatchObject({ chip: null, search: null });
  });
});

describe('asking the server for the header again', () => {
  const d = { cookie: 'germany', footer: 'germany', country: 'germany' };
  it('only when the remembered country changed', () => {
    expect(needsServerHeader(d, 'germany')).toBe(false);
    expect(needsServerHeader(d, 'canada')).toBe(true);
    // A first visit that remembered the country the header and footer already show
    expect(needsServerHeader({ ...d, cookie: null }, 'germany')).toBe(false);
    expect(needsServerHeader({ ...d, cookie: null, footer: 'canada' }, 'germany')).toBe(true);
    expect(needsServerHeader({ ...d, cookie: 'austria' }, 'germany')).toBe(true);
  });
});
