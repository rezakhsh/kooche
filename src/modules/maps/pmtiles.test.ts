import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { PMTilesFile, mapVersion, zxyToTileId } from './pmtiles';

// The street map's tile reader (docs/setup.md, "The street map") against the PMTiles v3 spec: tile
// ids on the Hilbert curve, directories with run lengths and leaf directories, tiles outside the
// file's area or zoom.

/** The spec's inverse, written independently: tile id → z/x/y */
function tileIdToZxy(id: number): [number, number, number] {
  let acc = 0;
  for (let z = 0; z < 27; z++) {
    const n = 4 ** z;
    if (acc + n > id) {
      let t = id - acc;
      let x = 0;
      let y = 0;
      for (let s = 1; s < 2 ** z; s *= 2) {
        const rx = 1 & (t / 2);
        const ry = 1 & (t ^ rx);
        if (ry === 0) {
          if (rx === 1) [x, y] = [s - 1 - x, s - 1 - y];
          [x, y] = [y, x];
        }
        x += s * rx;
        y += s * ry;
        t = Math.floor(t / 4);
      }
      return [z, x, y];
    }
    acc += n;
  }
  throw new Error('too deep');
}

function varint(n: number): number[] {
  const out: number[] = [];
  while (n >= 128) {
    out.push((n % 128) | 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}

type Entry = { id: number; run: number; offset: number; length: number };

function directory(entries: Entry[]): Buffer {
  const bytes = [...varint(entries.length)];
  let last = 0;
  for (const e of entries) {
    bytes.push(...varint(e.id - last));
    last = e.id;
  }
  for (const e of entries) bytes.push(...varint(e.run));
  for (const e of entries) bytes.push(...varint(e.length));
  entries.forEach((e, i) => {
    const prev = entries[i - 1];
    bytes.push(...varint(prev && e.offset === prev.offset + prev.length ? 0 : e.offset + 1));
  });
  return gzipSync(Buffer.from(bytes));
}

/** A small file: z0 and one z1 tile in the root, the rest of z1 and two z2 tiles in a leaf directory */
function makeFile(dir: string): { file: string; tiles: Map<string, Buffer> } {
  const tiles = new Map<string, Buffer>([
    ['0/0/0', Buffer.from('world')],
    ['1/0/0', Buffer.from('north-west')],
    ['1/1/0', Buffer.from('north-east')],
    ['1/1/1', Buffer.from('south-east')],
    ['2/2/1', Buffer.from('europe')],
    ['2/3/1', Buffer.from('east')],
  ]);
  const sorted = [...tiles.entries()].map(([k, data]) => ({ id: zxyToTileId(...(k.split('/').map(Number) as [number, number, number])), data })).sort((a, b) => a.id - b.id);
  let offset = 0;
  const entries: Entry[] = sorted.map(({ id, data }) => {
    const e = { id, run: 1, offset, length: data.length };
    offset += data.length;
    return e;
  });
  const data = Buffer.concat(sorted.map((t) => t.data));
  const leaf = directory(entries.slice(2));
  const root = directory([...entries.slice(0, 2), { id: entries[2]!.id, run: 0, offset: 0, length: leaf.length }]);
  const header = Buffer.alloc(127);
  header.write('PMTiles', 0, 'latin1');
  header[7] = 3;
  const rootOffset = 127;
  const leafOffset = rootOffset + root.length;
  const dataOffset = leafOffset + leaf.length;
  const u = (o: number, v: number) => header.writeBigUInt64LE(BigInt(v), o);
  u(8, rootOffset);
  u(16, root.length);
  u(24, dataOffset + data.length);
  u(32, 0);
  u(40, leafOffset);
  u(48, leaf.length);
  u(56, dataOffset);
  u(64, data.length);
  header[96] = 1;
  header[97] = 2;
  header[98] = 2;
  header[99] = 1;
  header[100] = 0;
  header[101] = 2;
  const file = path.join(dir, '20261028.pmtiles');
  writeFileSync(file, Buffer.concat([header, root, leaf, data]));
  return { file, tiles };
}

const dir = mkdtempSync(path.join(tmpdir(), 'pmtiles-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('the street map’s tile reader', () => {
  it('numbers tiles along the Hilbert curve like the PMTiles spec', () => {
    expect([zxyToTileId(0, 0, 0), zxyToTileId(1, 0, 0), zxyToTileId(1, 0, 1), zxyToTileId(1, 1, 1), zxyToTileId(1, 1, 0), zxyToTileId(2, 0, 0)]).toEqual([0, 1, 2, 3, 4, 5]);
    // Berlin at zoom 14, and random tiles at every zoom, survive the trip back
    expect(tileIdToZxy(zxyToTileId(14, 8800, 5373))).toEqual([14, 8800, 5373]);
    for (let i = 0; i < 2000; i++) {
      const z = i % 16;
      const x = Math.floor(Math.random() * 2 ** z);
      const y = Math.floor(Math.random() * 2 ** z);
      expect(tileIdToZxy(zxyToTileId(z, x, y))).toEqual([z, x, y]);
    }
    expect(() => zxyToTileId(2, 4, 0)).toThrow(RangeError);
    expect(() => zxyToTileId(-1, 0, 0)).toThrow(RangeError);
  });

  it('finds tiles in the root and in leaf directories, and nothing outside the file', async () => {
    const { file, tiles } = makeFile(dir);
    const map = new PMTilesFile(file);
    for (const [k, data] of tiles) expect((await map.tile(...(k.split('/').map(Number) as [number, number, number])))?.toString()).toBe(data.toString());
    expect(await map.tile(1, 0, 1)).toBeNull();
    expect(await map.tile(2, 0, 0)).toBeNull();
    // Beyond the file's zoom
    expect(await map.tile(3, 4, 2)).toBeNull();
    expect(await map.info()).toEqual({ minZoom: 0, maxZoom: 2, gzip: true });
    expect(mapVersion(file)).toBe('20261028');
  });

  it('refuses a file that isn’t PMTiles v3, and tries again once the file is there', async () => {
    const bad = path.join(dir, 'bad.pmtiles');
    writeFileSync(bad, Buffer.alloc(200));
    await expect(new PMTilesFile(bad).tile(0, 0, 0)).rejects.toThrow('not a PMTiles v3 file');
    const later = path.join(dir, 'later', '20261029.pmtiles');
    const map = new PMTilesFile(later);
    await expect(map.tile(0, 0, 0)).rejects.toThrow();
    const { file } = makeFile(dir);
    rmSync(path.dirname(later), { recursive: true, force: true });
    await import('node:fs').then((fs) => {
      fs.mkdirSync(path.dirname(later), { recursive: true });
      fs.copyFileSync(file, later);
    });
    expect((await map.tile(0, 0, 0))?.toString()).toBe('world');
  });
});
