import { customType } from 'drizzle-orm/pg-core';

export type Point = { lng: number; lat: number };

/**
 * Parses a PostGIS point from hex EWKB, the text form PostgreSQL returns for geography values.
 * Only 2D points are stored in this schema, so anything else is an error.
 */
export function parseEwkbPoint(hex: string): Point {
  const buf = Buffer.from(hex, 'hex');
  const le = buf.readUInt8(0) === 1;
  const readU32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const readF64 = (o: number) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  const type = readU32(1);
  const hasSrid = (type & 0x20000000) !== 0;
  if ((type & 0x0fffffff) !== 1 || (type & 0xc0000000) !== 0) {
    throw new Error(`Expected a 2D point, got EWKB type 0x${type.toString(16)}`);
  }
  const offset = hasSrid ? 9 : 5;
  return { lng: readF64(offset), lat: readF64(offset + 8) };
}

/** Writes a point as EWKT, which PostGIS casts to geography on input. */
export function toEwktPoint({ lng, lat }: Point): string {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    throw new Error(`Invalid coordinates: ${lng}, ${lat}`);
  }
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/**
 * geography(Point,4326): city centres, snapped listing points, business addresses.
 * drizzle-kit 0.31 wraps types it doesn't know in double quotes, and "geography(Point,4326)"
 * is then read as one type name. After generating a migration that adds such a column,
 * unquote it by hand: sed -i 's/"geography(Point,4326)"/geography(Point,4326)/g'.
 * The test setup applies every migration, so a missed one fails the tests.
 */
export const geographyPoint = customType<{ data: Point; driverData: string }>({
  dataType: () => 'geography(Point,4326)',
  toDriver: toEwktPoint,
  fromDriver: parseEwkbPoint,
});

/** ltree: category paths such as `vehicles.cars`. */
export const ltree = customType<{ data: string }>({
  dataType: () => 'ltree',
});

/** bytea: hashes (SHA-256, HMAC). postgres.js maps it to Buffer both ways. */
export const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea',
});
