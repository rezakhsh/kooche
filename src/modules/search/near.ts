import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { Point } from '../../db/types';
import { snapToGrid } from '../../lib/geo';

// "Near me" (approved Oct 18, 2026): only after the visitor taps it and allows the browser's
// location. The browser snaps the position to the ~500 m grid before it sends it; the server
// snaps again and puts the cell into a token for the address (`?near=<token>&r=10`), so paging,
// sorting and filters work with plain links.
//
// The token is the snapped point encrypted with AES-256-GCM and valid for 2 hours. The address
// therefore carries no readable position (Cloudflare logs, browser history, a shared link), and a
// shared link stops working soon. The key is derived from AUTH_SECRET with HKDF, so there is no
// new setting. The position is never stored or logged.

export const NEAR_TOKEN_TTL_MS = 2 * 60 * 60_000;

const VERSION = 1;
const INFO = 'peydoo near-me token v1';

function key(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), INFO, 32));
}

/** Encrypts the grid cell of a point, valid for 2 hours from `now` */
export function createNearToken(secret: string, point: Point, now = Date.now()): string {
  const cell = snapToGrid(point);
  const plain = Buffer.alloc(16);
  plain.writeInt32BE(Math.round(cell.lat * 1e6), 0);
  plain.writeInt32BE(Math.round(cell.lng * 1e6), 4);
  plain.writeBigInt64BE(BigInt(Math.floor((now + NEAR_TOKEN_TTL_MS) / 1000)), 8);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from([VERSION]));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, body, cipher.getAuthTag()]).toString('base64url');
}

export type NearTokenResult = { ok: true; point: Point } | { ok: false; reason: 'invalid' | 'expired' };

/** The grid cell in a token, or why it can't be used. A changed token fails the GCM tag. */
export function readNearToken(secret: string, token: string, now = Date.now()): NearTokenResult {
  let raw: Buffer;
  try {
    raw = Buffer.from(token, 'base64url');
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (raw.length !== 1 + 12 + 16 + 16 || raw[0] !== VERSION) return { ok: false, reason: 'invalid' };
  let plain: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(secret), raw.subarray(1, 13));
    decipher.setAAD(Buffer.from([VERSION]));
    decipher.setAuthTag(raw.subarray(29));
    plain = Buffer.concat([decipher.update(raw.subarray(13, 29)), decipher.final()]);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const expires = Number(plain.readBigInt64BE(8)) * 1000;
  if (now >= expires) return { ok: false, reason: 'expired' };
  const point = { lat: plain.readInt32BE(0) / 1e6, lng: plain.readInt32BE(4) / 1e6 };
  // Only grid cells are ever encrypted; anything else wasn't made here
  const cell = snapToGrid(point);
  if (cell.lat !== point.lat || cell.lng !== point.lng) return { ok: false, reason: 'invalid' };
  return { ok: true, point };
}
