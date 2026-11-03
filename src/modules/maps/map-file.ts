import { webEnv } from '../../lib/env';
import { PMTilesFile, bucketSource, mapVersion } from './pmtiles';

// Which street map this server shows (docs/setup.md, "The street map"): the object MAP_TILES_OBJECT
// in the R2 bucket peydoo-maps (staging and production, one map for both, each with its own
// read-only key), or the file MAP_TILES_FILE on a disk (development). Neither: no street map, pages
// keep the outline map.

export type StreetMapFile = { version: string; map: PMTilesFile };

let current: { name: string; file: StreetMapFile } | undefined;

function open(): { name: string; map: () => PMTilesFile } | null {
  const e = webEnv();
  if (e.MAP_TILES_OBJECT) {
    // The environment check sets these together (src/lib/env.ts)
    if (!e.S3_ENDPOINT || !e.MAP_S3_BUCKET || !e.MAP_S3_ACCESS_KEY_ID || !e.MAP_S3_SECRET_ACCESS_KEY) return null;
    const config = { endpoint: e.S3_ENDPOINT, region: e.S3_REGION, bucket: e.MAP_S3_BUCKET, accessKeyId: e.MAP_S3_ACCESS_KEY_ID, secretAccessKey: e.MAP_S3_SECRET_ACCESS_KEY };
    const key = e.MAP_TILES_OBJECT;
    return { name: key, map: () => new PMTilesFile(bucketSource(config, key)) };
  }
  const path = e.MAP_TILES_FILE;
  return path ? { name: path, map: () => new PMTilesFile(path) } : null;
}

/** The street map and its version, or null when this server has none */
export function streetMapFile(): StreetMapFile | null {
  const o = open();
  if (!o) return null;
  // One reader for the process, so the file's directories are read once
  if (current?.name !== o.name) current = { name: o.name, file: { version: mapVersion(o.name), map: o.map() } };
  return current.file;
}
