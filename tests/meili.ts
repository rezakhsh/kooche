import { randomUUID } from 'node:crypto';
import { afterAll } from 'vitest';
import { indexSettings } from '../src/modules/search/documents';
import { Meili } from '../src/modules/search/meili';

// A Meilisearch for the tests (TEST_MEILI_URL, with its master key). Each test file works in
// indexes of its own, named after a random prefix, and deletes them at the end.

const url = process.env.TEST_MEILI_URL;
const key = process.env.TEST_MEILI_MASTER_KEY;
if (!url || !key) throw new Error('TEST_MEILI_URL and TEST_MEILI_MASTER_KEY are not set (a Meilisearch for the tests)');

export const meili = new Meili({ url, key });
const prefix = `test_${randomUUID().slice(0, 8)}`;
const made: string[] = [];

/** A new, empty index with the app's settings */
export async function testIndex(name = 'listings'): Promise<string> {
  const index = `${prefix}_${name}`;
  made.push(index, `${index}_new`);
  await meili.wait(await meili.createIndex(index));
  await meili.wait(await meili.updateSettings(index, indexSettings()), 120_000);
  return index;
}

/** A key made exactly like the server's (src/modules/search/keys.ts), its value */
export async function keyLike(def: { uid: string } & Record<string, unknown>): Promise<string> {
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  let res = await fetch(`${url}/keys/${def.uid}`, { headers });
  if (res.status === 404) res = await fetch(`${url}/keys`, { method: 'POST', headers, body: JSON.stringify(def) });
  keys.push(def.uid);
  return ((await res.json()) as { key: string }).key;
}
const keys: string[] = [];

export const meiliUrl = url;

/** Waits until every queued Meilisearch task is done */
export async function settled(): Promise<void> {
  const r = await fetch(`${url}/tasks?statuses=enqueued,processing&limit=1`, { headers: { Authorization: `Bearer ${key}` } });
  const { results } = (await r.json()) as { results: { uid: number }[] };
  if (results[0]) await meili.wait({ taskUid: results[0].uid }, 120_000);
  // Another task may have been queued behind it
  const again = (await (await fetch(`${url}/tasks?statuses=enqueued,processing&limit=1`, { headers: { Authorization: `Bearer ${key}` } })).json()) as { results: unknown[] };
  if (again.results.length) await settled();
}

afterAll(async () => {
  for (const uid of keys) await fetch(`${url}/keys/${uid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } });
  for (const index of made) {
    if (await meili.indexStats(index)) await meili.wait(await meili.deleteIndex(index));
  }
});
