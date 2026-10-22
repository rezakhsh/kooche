// A small Meilisearch client over fetch (docs/setup.md, "Keyword search and saved searches"): only
// the calls this app makes, no SDK. The web app holds a key that may only search the listings
// index; the worker holds one that may write it. The master key never leaves the Meilisearch
// service and /root/.secrets.

export type MeiliConfig = { url: string; key: string };

export class MeiliError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'MeiliError';
  }
}

export type Task = { taskUid: number };
export type TaskStatus = { uid: number; status: 'enqueued' | 'processing' | 'succeeded' | 'failed' | 'canceled'; error?: { message: string; code: string } | null };

export type SearchQuery = {
  indexUid?: string;
  q?: string;
  filter?: string;
  sort?: string[];
  offset?: number;
  limit?: number;
  facets?: string[];
  attributesToRetrieve?: string[];
  /** `all`: every word (or a synonym) must match, as people expect from classifieds */
  matchingStrategy?: 'all' | 'last' | 'frequency';
  /** Each hit says which fields matched (`_matchesPosition`) */
  showMatchesPosition?: boolean;
};

export type SearchResult = {
  hits: ({ id: string; _matchesPosition?: Record<string, unknown> } & Record<string, unknown>)[];
  estimatedTotalHits?: number;
  facetDistribution?: Record<string, Record<string, number>>;
};

/** Searches answer within this time or the page falls back to PostgreSQL */
export const SEARCH_TIMEOUT_MS = 2_000;
const WRITE_TIMEOUT_MS = 30_000;

export class Meili {
  private readonly base: string;

  constructor(private readonly config: MeiliConfig) {
    this.base = config.url.replace(/\/$/, '');
  }

  private async call<T>(method: string, path: string, body?: unknown, timeoutMs = WRITE_TIMEOUT_MS): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.config.key}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new MeiliError(`meilisearch unreachable: ${e instanceof Error ? e.message : e}`, null, null);
    }
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const err = (json ?? {}) as { message?: string; code?: string };
      throw new MeiliError(`meilisearch ${method} ${path.split('?')[0]}: ${res.status} ${err.message ?? ''}`.trim(), res.status, err.code ?? null);
    }
    return json as T;
  }

  health(): Promise<{ status: string }> {
    return this.call('GET', '/health', undefined, SEARCH_TIMEOUT_MS);
  }

  search(index: string, query: SearchQuery): Promise<SearchResult> {
    return this.call('POST', `/indexes/${index}/search`, query, SEARCH_TIMEOUT_MS);
  }

  async multiSearch(queries: (SearchQuery & { indexUid: string })[]): Promise<SearchResult[]> {
    const r = await this.call<{ results: SearchResult[] }>('POST', '/multi-search', { queries }, SEARCH_TIMEOUT_MS);
    return r.results;
  }

  /** The index's stats, or null when it doesn't exist */
  async indexStats(index: string): Promise<{ numberOfDocuments: number } | null> {
    try {
      return await this.call('GET', `/indexes/${index}/stats`);
    } catch (e) {
      if (e instanceof MeiliError && e.code === 'index_not_found') return null;
      throw e;
    }
  }

  createIndex(index: string): Promise<Task> {
    return this.call('POST', '/indexes', { uid: index, primaryKey: 'id' });
  }

  deleteIndex(index: string): Promise<Task> {
    return this.call('DELETE', `/indexes/${index}`);
  }

  getSettings(index: string): Promise<Record<string, unknown>> {
    return this.call('GET', `/indexes/${index}/settings`);
  }

  updateSettings(index: string, settings: Record<string, unknown>): Promise<Task> {
    return this.call('PATCH', `/indexes/${index}/settings`, settings);
  }

  addDocuments(index: string, docs: object[]): Promise<Task> {
    return this.call('POST', `/indexes/${index}/documents`, docs);
  }

  deleteDocuments(index: string, ids: string[]): Promise<Task> {
    return this.call('POST', `/indexes/${index}/documents/delete-batch`, ids);
  }

  fetchDocuments<T = Record<string, unknown>>(index: string, opts: { fields?: string[]; offset?: number; limit?: number; filter?: string }): Promise<{ results: T[] }> {
    return this.call('POST', `/indexes/${index}/documents/fetch`, opts);
  }

  /** Every document id of the index, in pages */
  async documentIds(index: string): Promise<string[]> {
    const ids: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await this.fetchDocuments<{ id: string }>(index, { fields: ['id'], offset, limit: 1000 });
      ids.push(...page.results.map((d) => d.id));
      if (page.results.length < 1000) return ids;
    }
  }

  swapIndexes(a: string, b: string): Promise<Task> {
    return this.call('POST', '/swap-indexes', [{ indexes: [a, b] }]);
  }

  /** Deletes finished tasks enqueued before the date (the task log grows with every change) */
  deleteTasks(before: Date): Promise<Task> {
    return this.call('DELETE', `/tasks?statuses=succeeded,failed,canceled&beforeEnqueuedAt=${encodeURIComponent(before.toISOString())}`);
  }

  task(uid: number): Promise<TaskStatus> {
    return this.call('GET', `/tasks/${uid}`);
  }

  /** Waits until the task is done; throws when it failed or takes longer than the timeout */
  async wait(task: Task, timeoutMs = 60_000): Promise<TaskStatus> {
    const until = Date.now() + timeoutMs;
    for (let delay = 50; ; delay = Math.min(delay * 2, 1_000)) {
      const t = await this.task(task.taskUid);
      if (t.status === 'succeeded') return t;
      if (t.status === 'failed' || t.status === 'canceled') throw new MeiliError(`meilisearch task ${t.uid} ${t.status}: ${t.error?.message ?? ''}`, null, t.error?.code ?? null);
      if (Date.now() > until) throw new MeiliError(`meilisearch task ${t.uid} still ${t.status} after ${timeoutMs} ms`, null, null);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** Quotes a value for a Meilisearch filter expression */
export function filterValue(v: string | number | boolean): string {
  if (typeof v !== 'string') return String(v);
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
