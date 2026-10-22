import type { Queryable } from '../../db/drizzle';
import type { Catalog } from '../listings/catalog';
import { DOC_VERSION, documentBatch, documentsFor, indexableCount, indexSettings } from './documents';
import type { Meili, Task } from './meili';

// Keeping the index in line with PostgreSQL (docs/setup.md, "Keyword search and saved searches"):
// - every listing and event change reaches the worker through the outbox; the job re-reads the
//   listing and writes it (active) or removes it (anything else), so stale, repeated or
//   out-of-order events do no harm;
// - a full rebuild into a second index that is then swapped in, so search never sees a half-built
//   index: when the index is missing, its settings or document shape are outdated or its count
//   differs from PostgreSQL's, and every night.
// The index holds nothing that isn't rebuilt from PostgreSQL, so it has no backup of its own.

export const REBUILD_BATCH = 500;

/** Writes the listings as they are now. Returns the Meilisearch tasks (the caller may wait for them). */
export async function syncListings(db: Queryable, meili: Meili, index: string, catalog: Catalog, ids: string[]): Promise<{ upserted: string[]; removed: string[]; tasks: Task[] }> {
  const { upsert, remove } = await documentsFor(db, catalog, ids);
  const tasks: Task[] = [];
  if (upsert.length) tasks.push(await meili.addDocuments(index, upsert));
  if (remove.length) tasks.push(await meili.deleteDocuments(index, remove));
  return { upserted: upsert.map((d) => d.id), removed: remove, tasks };
}

/** Builds `<index>_new` from PostgreSQL and swaps it in. Returns the number of documents. */
export async function rebuildIndex(db: Queryable, meili: Meili, index: string, catalog: Catalog, batch = REBUILD_BATCH): Promise<number> {
  const next = `${index}_new`;
  if (await meili.indexStats(next)) await meili.wait(await meili.deleteIndex(next));
  await meili.wait(await meili.createIndex(next));
  await meili.wait(await meili.updateSettings(next, indexSettings()), 300_000);
  let total = 0;
  let last: Task | null = null;
  for (let after: string | null = null; ; ) {
    const { docs, lastId } = await documentBatch(db, catalog, after, batch);
    if (docs.length) {
      last = await meili.addDocuments(next, docs);
      total += docs.length;
    }
    if (!lastId) break;
    after = lastId;
  }
  // Tasks run in order, so the last one finishing means all of them did
  if (last) await meili.wait(last, 600_000);
  // Swapping with an index that doesn't exist yet is refused: create the live one empty first
  if (!(await meili.indexStats(index))) await meili.wait(await meili.createIndex(index));
  await meili.wait(await meili.swapIndexes(index, next));
  await meili.wait(await meili.deleteIndex(next));
  return total;
}

export type IndexState = 'ok' | 'missing' | 'settings' | 'version' | 'count';

/** Whether the live index can be used as it is, or why it needs a rebuild */
export async function indexState(db: Queryable, meili: Meili, index: string): Promise<IndexState> {
  const stats = await meili.indexStats(index);
  if (!stats) return 'missing';
  if (!settingsMatch(indexSettings(), await meili.getSettings(index))) return 'settings';
  const sample = await meili.fetchDocuments<{ v?: number }>(index, { fields: ['v'], limit: 1 });
  if (sample.results[0] && sample.results[0].v !== DOC_VERSION) return 'version';
  // The count right after Meilisearch finished its queue: pending writes would make it differ
  if (stats.numberOfDocuments !== (await indexableCount(db))) return 'count';
  return 'ok';
}

// Meilisearch returns some lists in its own order; these are sets for our purposes
const UNORDERED = new Set(['filterableAttributes', 'sortableAttributes', 'stopWords']);

/** Whether the index's settings include what we want (fields Meilisearch adds itself are ignored) */
export function settingsMatch(want: Record<string, unknown>, have: Record<string, unknown>): boolean {
  return Object.entries(want).every(([key, w]) => {
    const h = have[key];
    if (key === 'synonyms') return canonical(w) === canonical(h);
    if (UNORDERED.has(key) && Array.isArray(w) && Array.isArray(h)) return canonical(w.map(nfkc).sort()) === canonical(h.map(nfkc).sort());
    if (w && typeof w === 'object' && !Array.isArray(w)) return !!h && typeof h === 'object' && settingsMatch(w as Record<string, unknown>, h as Record<string, unknown>);
    return canonical(w) === canonical(h);
  });
}

// Meilisearch stores some letters decomposed («آ» as ا + ٓ); compare in one form
const nfkc = (x: unknown) => (typeof x === 'string' ? x.normalize('NFKC') : x);

/** JSON with object keys sorted and text in one Unicode form, so equal values compare equal */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k.normalize('NFKC'), y] as const).sort(([a], [b]) => (a < b ? -1 : 1)))
      : nfkc(x),
  );
}
