import { describe, expect, it } from 'vitest';
import { headerPlace, needsServerHeader, serverCountry, type HeaderPlaceData } from '../src/components/header-place';

// The header's chip and keyword box follow the address in the browser (src/components/header-place.ts;
// owner's approval, Nov 6, 2026), with the same rules the server header had (Oct 17–31, 2026).
const data: HeaderPlaceData = {
  country: { slug: 'germany', nameFa: 'آلمان' },
  cookie: 'germany',
  viewAs: false,
  adminRoot: null,
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
  const d = { ...data, countrySlug: 'germany' };
  it('not between pages the header already knows', () => {
    for (const path of ['/germany/berlin', '/help', '/v/a/abc123', '/my/listings', '/login']) expect(needsServerHeader(d, serverCountry(path, d, 'germany'))).toBe(false);
  });

  it('when the server would use another remembered country', () => {
    // Another country's page: the proxy renders it as if that country were chosen
    expect(serverCountry('/austria/wien', d, 'germany')).toBe('austria');
    expect(needsServerHeader(d, 'austria')).toBe(true);
    // The cookie was changed (another country remembered)
    expect(needsServerHeader(d, serverCountry('/help', d, 'canada'))).toBe(true);
    // A browse page knows its country whatever the cookie still says
    expect(needsServerHeader(d, serverCountry('/germany', d, 'austria'))).toBe(false);
  });

  it('treats unknown values as nothing remembered, as the server does', () => {
    expect(serverCountry('/cities', d, 'germany')).toBeNull();
    expect(serverCountry('/help', d, 'nowhere')).toBeNull();
    // A first visit that remembered the country the header and footer already show
    const first = { ...d, cookie: null };
    expect(needsServerHeader(first, serverCountry('/germany', first, null))).toBe(false);
    expect(needsServerHeader({ ...first, footer: 'canada' }, 'germany')).toBe(true);
  });

  it('follows the proxy while staff view the site as a country, and leaves the admin page alone', () => {
    const viewing = { ...d, viewAs: true };
    expect(serverCountry('/help', viewing, 'germany')).toBeNull();
    expect(needsServerHeader(viewing, serverCountry('/help', viewing, 'germany'))).toBe(true);
    expect(serverCountry('/germany/berlin', viewing, 'germany')).toBe('germany');
    const admin = { ...d, adminRoot: 'staff-x1' };
    expect(serverCountry('/staff-x1/users', admin, 'germany')).toBe('germany');
  });
});
