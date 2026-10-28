import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress, pinFromAddress } from './geocode';

// The venue or shop pin found from its street address (src/modules/maps/geocode.ts): what is sent
// to the Nominatim server, what comes back, and when a lookup happens at all.

vi.hoisted(() => {
  process.env.GEOCODER_URL = 'https://geocoder.test';
});
vi.mock('../../lib/env', () => ({ webEnv: () => ({ APP_URL: 'https://peydoo.test', GEOCODER_URL: 'https://geocoder.test' }) }));

const asked: { url: URL; headers: Headers }[] = [];
let answer: () => Response = () => Response.json([]);

beforeEach(() => {
  asked.length = 0;
  vi.stubGlobal('fetch', async (url: URL, init: RequestInit) => {
    asked.push({ url: new URL(url), headers: new Headers(init.headers) });
    return answer();
  });
});
afterEach(() => vi.unstubAllGlobals());

const MARIANNENPLATZ = [{ lat: '52.5045440', lon: '13.4233799' }];

describe('an address lookup', () => {
  it('asks for the street and place in the country, names the site, and rounds the answer', async () => {
    answer = () => Response.json(MARIANNENPLATZ);
    expect(await geocodeAddress({ street: ' Mariannenplatz 2 ', place: '10997 Berlin', countryCode: 'DE' })).toEqual({ lat: 52.504544, lng: 13.42338 });
    const [{ url, headers }] = asked as [(typeof asked)[0]];
    expect(url.origin + url.pathname).toBe('https://geocoder.test/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'Mariannenplatz 2, 10997 Berlin', countrycodes: 'de', format: 'jsonv2', limit: '1' });
    expect(headers.get('user-agent')).toBe('Peydoo (https://peydoo.test)');
  });

  it('is nothing when the server finds nothing, fails, or answers nonsense', async () => {
    const q = { street: 'Nirgendwo 1', place: '10997', countryCode: 'DE' };
    answer = () => Response.json([]);
    expect(await geocodeAddress(q)).toBeNull();
    answer = () => new Response('busy', { status: 503 });
    expect(await geocodeAddress(q)).toBeNull();
    answer = () => Response.json([{ lat: 'x', lon: '13' }]);
    expect(await geocodeAddress(q)).toBeNull();
    answer = () => {
      throw new Error('network down');
    };
    expect(await geocodeAddress(q)).toBeNull();
    // Without a street or a real country code nothing is asked
    expect(await geocodeAddress({ ...q, street: '  ' })).toBeNull();
    expect(await geocodeAddress({ ...q, countryCode: 'Germany' })).toBeNull();
    expect(asked).toHaveLength(4);
  });

  it('waits a second between lookups (OpenStreetMap’s rule)', async () => {
    answer = () => Response.json(MARIANNENPLATZ);
    const times: number[] = [];
    vi.stubGlobal('fetch', async () => {
      times.push(Date.now());
      return answer();
    });
    await Promise.all([1, 2].map(() => geocodeAddress({ street: 'Mariannenplatz 2', place: '10997', countryCode: 'DE' })));
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1_000);
  });
});

describe('the pin saved with an address', () => {
  const street = 'Mariannenplatz 2';
  const here = { lat: 52.504544, lng: 13.42338 };
  const mine = { lat: 52.5041, lng: 13.4241 };
  const pin = (opts: Partial<Parameters<typeof pinFromAddress>[0]>) => pinFromAddress({ pin: null, street, place: '10997 Berlin', countryCode: 'DE', saved: null, ...opts });
  beforeEach(() => {
    answer = () => Response.json(MARIANNENPLATZ);
  });

  it('is found for a new address without a pin', async () => {
    expect(await pin({})).toEqual({ pin: here, fromAddress: true });
    expect(await pin({ saved: { street: 'Oranienstraße 1', pin: null } })).toEqual({ pin: here, fromAddress: true });
  });

  it('is the owner’s own when they placed one, and stays removed when they removed it', async () => {
    expect(await pin({ pin: mine })).toEqual({ pin: mine, fromAddress: false });
    expect(await pin({ pin: null, saved: { street, pin: here } })).toEqual({ pin: null, fromAddress: false });
    expect(await pin({ pin: mine, saved: { street: 'Oranienstraße 1', pin: here } })).toEqual({ pin: mine, fromAddress: false });
    expect(asked).toHaveLength(0);
  });

  it('moves with a changed address, or goes with the old one when the new one isn’t found', async () => {
    expect(await pin({ pin: mine, saved: { street: 'Oranienstraße 1', pin: mine } })).toEqual({ pin: here, fromAddress: true });
    answer = () => Response.json([]);
    expect(await pin({ pin: mine, saved: { street: 'Oranienstraße 1', pin: mine } })).toEqual({ pin: null, fromAddress: false });
  });

  it('is never looked up without a street or a country', async () => {
    expect(await pin({ street: null })).toEqual({ pin: null, fromAddress: false });
    expect(await pin({ countryCode: null })).toEqual({ pin: null, fromAddress: false });
    expect(asked).toHaveLength(0);
  });
});
