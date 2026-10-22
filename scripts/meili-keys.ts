// Creates (or shows) the web and worker keys of a Meilisearch from its master key, once per
// environment (docs/setup.md, "Keyword search and saved searches"). Prints the two values for
// /root/.secrets/meilisearch.env and Coolify; never the master key.
//
//   MEILI_URL=http://<meilisearch>:7700 MEILI_MASTER_KEY=… npx tsx scripts/meili-keys.ts

import { WEB_KEY, WORKER_KEY } from '../src/modules/search/keys';

const url = process.env.MEILI_URL?.replace(/\/$/, '');
const master = process.env.MEILI_MASTER_KEY;
if (!url || !master) throw new Error('MEILI_URL and MEILI_MASTER_KEY are required');
const headers = { Authorization: `Bearer ${master}`, 'Content-Type': 'application/json' };

for (const [name, def] of [['MEILI_SEARCH_KEY', WEB_KEY], ['MEILI_WRITE_KEY', WORKER_KEY]] as const) {
  let res = await fetch(`${url}/keys/${def.uid}`, { headers });
  if (res.status === 404) res = await fetch(`${url}/keys`, { method: 'POST', headers, body: JSON.stringify(def) });
  const key = (await res.json()) as { key?: string; message?: string };
  if (!key.key) throw new Error(`${def.name}: ${key.message ?? res.status}`);
  console.log(`${name}=${key.key}`);
}
