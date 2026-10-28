import { open, type FileHandle } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

// Reads map tiles out of one PMTiles v3 file on the server's disk (the street map, docs/setup.md).
// The format: a 127-byte header, a root directory, leaf directories and the tiles, each directory
// gzip-compressed and listing tiles by their Hilbert tile id
// (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md). Tiles are returned exactly as
// stored (gzip-compressed vector tiles), so the server only copies bytes.

type Directory = { ids: Float64Array; runs: Uint32Array; lengths: Uint32Array; offsets: Float64Array };
type Header = { rootOffset: number; rootLength: number; leafOffset: number; dataOffset: number; minZoom: number; maxZoom: number; tileCompression: number };

const MAGIC = 'PMTiles';
/** Leaf directories kept parsed in memory; each covers up to a few thousand tiles (~100 KB) */
const LEAF_CACHE = 64;

export function zxyToTileId(z: number, x: number, y: number): number {
  if (!Number.isInteger(z) || z < 0 || z > 26) throw new RangeError('zoom');
  const n = 2 ** z;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) throw new RangeError('tile');
  let acc = (4 ** z - 1) / 3;
  let tx = x;
  let ty = y;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (tx & s) > 0 ? 1 : 0;
    const ry = (ty & s) > 0 ? 1 : 0;
    acc += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        tx = s - 1 - (tx % s);
        ty = s - 1 - (ty % s);
      }
      [tx, ty] = [ty, tx];
    }
    tx %= s;
    ty %= s;
  }
  return acc;
}

export function readDirectory(gz: Uint8Array): Directory {
  const buf = gunzipSync(gz);
  let p = 0;
  // Varints can exceed 32 bits (offsets into a 100 GB file), so no bit operators on the total
  const varint = () => {
    let value = 0;
    let factor = 1;
    let byte: number;
    do {
      if (p >= buf.length) throw new Error('directory ends early');
      byte = buf[p++]!;
      value += (byte & 0x7f) * factor;
      factor *= 128;
    } while (byte & 0x80);
    return value;
  };
  const n = varint();
  const d: Directory = { ids: new Float64Array(n), runs: new Uint32Array(n), lengths: new Uint32Array(n), offsets: new Float64Array(n) };
  let last = 0;
  for (let i = 0; i < n; i++) d.ids[i] = last += varint();
  for (let i = 0; i < n; i++) d.runs[i] = varint();
  for (let i = 0; i < n; i++) d.lengths[i] = varint();
  for (let i = 0; i < n; i++) {
    const v = varint();
    d.offsets[i] = v === 0 && i > 0 ? d.offsets[i - 1]! + d.lengths[i - 1]! : v - 1;
  }
  return d;
}

/** The entry for a tile id: a tile (run > 0), a leaf directory (run 0), or null */
export function findEntry(d: Directory, id: number): number | null {
  let lo = 0;
  let hi = d.ids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = id - d.ids[mid]!;
    if (c > 0) lo = mid + 1;
    else if (c < 0) hi = mid - 1;
    else return mid;
  }
  if (hi >= 0 && (d.runs[hi] === 0 || id - d.ids[hi]! < d.runs[hi]!)) return hi;
  return null;
}

export class PMTilesFile {
  private header?: Promise<{ h: Header; root: Directory }>;
  private leaves = new Map<number, Promise<Directory>>();
  private file?: Promise<FileHandle>;

  constructor(readonly path: string) {}

  private async read(offset: number, length: number): Promise<Buffer> {
    if (!this.file) {
      this.file = open(this.path, 'r');
      // A missing file is opened again on the next request (a new map is being copied in)
      this.file.catch(() => (this.file = undefined));
    }
    const f = await this.file;
    const buf = Buffer.alloc(length);
    const { bytesRead } = await f.read(buf, 0, length, offset);
    if (bytesRead !== length) throw new Error('map file ends early');
    return buf;
  }

  private start() {
    this.header ??= (async () => {
      const b = await this.read(0, 127);
      if (b.subarray(0, 7).toString('latin1') !== MAGIC || b[7] !== 3) throw new Error('not a PMTiles v3 file');
      const u = (o: number) => Number(b.readBigUInt64LE(o));
      if (b[97] !== 2) throw new Error('directories must be gzip-compressed');
      const h: Header = { rootOffset: u(8), rootLength: u(16), leafOffset: u(40), dataOffset: u(56), tileCompression: b[98]!, minZoom: b[100]!, maxZoom: b[101]! };
      return { h, root: readDirectory(await this.read(h.rootOffset, h.rootLength)) };
    })();
    // A failed start (file missing) is tried again on the next request
    this.header.catch(() => (this.header = undefined));
    return this.header;
  }

  private leaf(offset: number, length: number): Promise<Directory> {
    const hit = this.leaves.get(offset);
    if (hit) {
      // Most recently used last, so the first key is the one to drop
      this.leaves.delete(offset);
      this.leaves.set(offset, hit);
      return hit;
    }
    const p = this.read(offset, length).then(readDirectory);
    p.catch(() => this.leaves.delete(offset));
    this.leaves.set(offset, p);
    if (this.leaves.size > LEAF_CACHE) this.leaves.delete(this.leaves.keys().next().value!);
    return p;
  }

  async info() {
    const { h } = await this.start();
    return { minZoom: h.minZoom, maxZoom: h.maxZoom, gzip: h.tileCompression === 2 };
  }

  /** The stored bytes of tile z/x/y, or null where the file has none (outside its area) */
  async tile(z: number, x: number, y: number): Promise<Buffer | null> {
    const { h, root } = await this.start();
    if (z < h.minZoom || z > h.maxZoom) return null;
    const id = zxyToTileId(z, x, y);
    let dir = root;
    for (let depth = 0; depth < 4; depth++) {
      const i = findEntry(dir, id);
      if (i === null) return null;
      if (dir.runs[i]! > 0) return this.read(h.dataOffset + dir.offsets[i]!, dir.lengths[i]!);
      dir = await this.leaf(h.leafOffset + dir.offsets[i]!, dir.lengths[i]!);
    }
    return null;
  }
}

const files = new Map<string, PMTilesFile>();
/** One reader per file for the process (the file name changes with every new map) */
export function mapFile(path: string): PMTilesFile {
  let f = files.get(path);
  if (!f) files.set(path, (f = new PMTilesFile(path)));
  return f;
}

/** The version in tile addresses: the file's name without .pmtiles (20261028) */
export const mapVersion = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.pmtiles'.length);
