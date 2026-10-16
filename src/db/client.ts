import postgres from 'postgres';
import { webEnv } from '../lib/env';

// The Next.js app's connection pool, as classifieds_app. Kept on globalThis so `next dev` hot
// reloads reuse it instead of opening a new pool each time. The worker opens its own pool as
// classifieds_worker (src/worker/index.ts).

const globalForDb = globalThis as typeof globalThis & { appSql?: postgres.Sql };

export function appSql(): postgres.Sql {
  return (globalForDb.appSql ??= postgres(webEnv().DATABASE_URL, {
    max: 10,
    connect_timeout: 5,
    idle_timeout: 60,
    onnotice: () => {},
  }));
}
