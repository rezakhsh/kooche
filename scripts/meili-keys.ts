// Creates (or shows) the web and worker keys of a Meilisearch from its master key, once per
// environment (docs/setup.md, "Keyword search and saved searches"). Prints the two values for
// /root/.secrets/meilisearch.env and Coolify; never the master key. A key whose actions or indexes
// differ from src/modules/search/keys.ts is deleted and made again with the same uid, which gives
// it the same value, so nothing changes in Coolify. `--quiet` prints only what it did.
//
//   MEILI_URL=http://<meilisearch>:7700 MEILI_MASTER_KEY=… npx tsx scripts/meili-keys.ts [--quiet]

import { WEB_KEY, WORKER_KEY } from '../src/modules/search/keys';

const url = process.env.MEILI_URL?.replace(/\/$/, '');
const master = process.env.MEILI_MASTER_KEY;
if (!url || !master) throw new Error('MEILI_URL and MEILI_MASTER_KEY are required');
const quiet = process.argv.includes('--quiet');
const headers = { Authorization: `Bearer ${master}`, 'Content-Type': 'application/json' };

const same = (a: readonly string[], b: readonly string[] | undefined) => !!b && a.length === b.length && [...a].sort().join() === [...b].sort().join();

for (const [name, def] of [['MEILI_SEARCH_KEY', WEB_KEY], ['MEILI_WRITE_KEY', WORKER_KEY]] as const) {
  let res = await fetch(`${url}/keys/${def.uid}`, { headers });
  let action = 'unchanged';
  if (res.ok) {
    const have = (await res.clone().json()) as { actions?: string[]; indexes?: string[] };
    if (!same(def.actions, have.actions) || !same(def.indexes, have.indexes)) {
      const del = await fetch(`${url}/keys/${def.uid}`, { method: 'DELETE', headers });
      if (!del.ok) throw new Error(`${def.name}: delete ${del.status}`);
      res = await fetch(`${url}/keys`, { method: 'POST', headers, body: JSON.stringify(def) });
      action = 'recreated';
    }
  } else if (res.status === 404) {
    res = await fetch(`${url}/keys`, { method: 'POST', headers, body: JSON.stringify(def) });
    action = 'created';
  }
  const key = (await res.json()) as { key?: string; message?: string };
  if (!key.key) throw new Error(`${def.name}: ${key.message ?? res.status}`);
  console.log(quiet ? `${name}: ${action}` : `${name}=${key.key}`);
}
