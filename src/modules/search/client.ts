import { webEnv } from '../../lib/env';
import { Meili } from './meili';

// The web app's Meilisearch client, with the key that may only search the listings index.
// Null without MEILI_URL and MEILI_SEARCH_KEY: keyword search then runs on PostgreSQL.

const globalForMeili = globalThis as typeof globalThis & { webMeili?: Meili | null };

export function webMeili(): Meili | null {
  if (globalForMeili.webMeili !== undefined) return globalForMeili.webMeili;
  const env = webEnv();
  return (globalForMeili.webMeili = env.MEILI_URL && env.MEILI_SEARCH_KEY ? new Meili({ url: env.MEILI_URL, key: env.MEILI_SEARCH_KEY }) : null);
}
