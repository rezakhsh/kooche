// The two Meilisearch API keys (docs/setup.md, "Keyword search and saved searches"), created once
// per environment from the master key with scripts/meili-keys.ts. A key's value is derived from
// its uid and the master key, so the same uids give the same values again after a restore, and
// after the script recreates a key whose definition changed (Meilisearch can't change a key's
// actions or indexes in place).

export const WEB_KEY = {
  uid: '6f1d6a1e-6c3b-4d0b-9a51-1e0c7a5e2b01',
  name: 'classifieds-web',
  description: 'Web app: search the listings and suggestions indexes, nothing else',
  actions: ['search'],
  indexes: ['listings', 'suggestions'],
  expiresAt: null,
} as const;

// All indexes: an index swap's task belongs to no index, and a key limited to `listings` can't
// see it. This Meilisearch serves only this app, so that widens nothing in practice.
export const WORKER_KEY = {
  uid: '6f1d6a1e-6c3b-4d0b-9a51-1e0c7a5e2b02',
  name: 'classifieds-worker',
  description: 'Worker: keep the listings and suggestions indexes in line with PostgreSQL',
  actions: [
    'search',
    'documents.add',
    'documents.get',
    'documents.delete',
    'indexes.create',
    'indexes.get',
    'indexes.delete',
    'indexes.swap',
    'settings.get',
    'settings.update',
    'tasks.get',
    'tasks.delete',
    'stats.get',
  ],
  indexes: ['*'],
  expiresAt: null,
} as const;
