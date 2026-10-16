import { describe, expect, it } from 'vitest';
import { parseEwkbPoint, toEwktPoint } from './types';

function ewkb(lng: number, lat: number, littleEndian: boolean, srid?: number): string {
  const buf = Buffer.alloc(srid === undefined ? 21 : 25);
  buf.writeUInt8(littleEndian ? 1 : 0, 0);
  const u32 = (v: number, o: number) => (littleEndian ? buf.writeUInt32LE(v, o) : buf.writeUInt32BE(v, o));
  const f64 = (v: number, o: number) => (littleEndian ? buf.writeDoubleLE(v, o) : buf.writeDoubleBE(v, o));
  u32(srid === undefined ? 1 : 0x20000001, 1);
  let o = 5;
  if (srid !== undefined) {
    u32(srid, 5);
    o = 9;
  }
  f64(lng, o);
  f64(lat, o + 8);
  return buf.toString('hex');
}

describe('geography point type', () => {
  it('parses little- and big-endian EWKB, with or without SRID', () => {
    expect(parseEwkbPoint(ewkb(13.405, 52.52, true, 4326))).toEqual({ lng: 13.405, lat: 52.52 });
    expect(parseEwkbPoint(ewkb(-0.1276, 51.5072, false, 4326))).toEqual({ lng: -0.1276, lat: 51.5072 });
    expect(parseEwkbPoint(ewkb(8.68, 50.11, true))).toEqual({ lng: 8.68, lat: 50.11 });
  });

  it('rejects anything but a 2D point', () => {
    const line = Buffer.from(ewkb(1, 2, true, 4326), 'hex');
    line.writeUInt32LE(0x20000002, 1);
    expect(() => parseEwkbPoint(line.toString('hex'))).toThrow(/2D point/);
  });

  it('writes EWKT and refuses invalid coordinates', () => {
    expect(toEwktPoint({ lng: 13.405, lat: 52.52 })).toBe('SRID=4326;POINT(13.405 52.52)');
    expect(() => toEwktPoint({ lng: 200, lat: 0 })).toThrow();
    expect(() => toEwktPoint({ lng: Number.NaN, lat: 0 })).toThrow();
  });
});
