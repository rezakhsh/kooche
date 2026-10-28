import { describe, expect, it } from 'vitest';
import { decodeRing } from '../../../seed/postal-areas';
import { PIN_MAX_M, pinField, pinNear } from './pin';

// The venue and shop pin (src/modules/maps/pin.ts) and the postal areas' encoding
// (seed/postal-areas/index.ts)

describe('a venue or shop pin', () => {
  it('reads "lat,lng" from the form, rounded to six decimals; empty is no pin', () => {
    expect(pinField.parse('52.5459123,13.3591')).toEqual({ lat: 52.545912, lng: 13.3591 });
    expect(pinField.parse(' 48.2,16.37 ')).toEqual({ lat: 48.2, lng: 16.37 });
    expect(pinField.parse('')).toBeNull();
    expect(pinField.parse(undefined)).toBeNull();
  });

  it('refuses anything else', () => {
    for (const bad of ['abc', '52.5', '52.5;13.4', '91,13', '52,181', '52.5,13.4,1', '1e2,3', '52.12345678,13.4', 'POINT(13 52)']) {
      expect(pinField.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('must lie within 15 km of the chosen postal code', () => {
    const neukoelln = { lat: 52.4811, lng: 13.4353 };
    expect(PIN_MAX_M).toBe(15_000);
    expect(pinNear({ lat: 52.4875, lng: 13.4248 }, neukoelln)).toBe(true);
    // Potsdam is ~30 km away, Hamburg ~250 km
    expect(pinNear({ lat: 52.3906, lng: 13.0645 }, neukoelln)).toBe(false);
    expect(pinNear({ lat: 53.5511, lng: 9.9937 }, neukoelln)).toBe(false);
  });
});

describe('postal areas in the seed', () => {
  it('decode Google’s polyline encoding at 5 decimals, first value first', () => {
    // The format's own example (https://developers.google.com/maps/documentation/utilities/polylinealgorithm)
    expect(decodeRing('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
    expect(decodeRing('')).toEqual([]);
  });
});
