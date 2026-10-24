import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { buildSitemaps, writeSitemaps } from '../modules/search/sitemap';
import { reportJobFailure } from './monitoring';

// The XML sitemaps (src/modules/search/sitemap.ts): rebuilt every hour on queue `seo`, and once
// when the worker starts, so a deploy never leaves the web app without them for long.

const SCHEDULES = {
  sitemaps: { pattern: '7 * * * *' },
} as const;

export async function startSeoJobs(db: Db, connection: Redis, appUrl: string): Promise<{ close: () => Promise<void> }> {
  const scheduled = new Queue('seo', { connection });
  for (const [name, repeat] of Object.entries(SCHEDULES)) {
    await scheduled.upsertJobScheduler(name, repeat, { name, opts: { removeOnComplete: 20, removeOnFail: 50 } });
  }
  await scheduled.add('sitemaps', {}, { removeOnComplete: 20, removeOnFail: 50 });
  const own = connection.duplicate();
  const worker = new Worker(
    'seo',
    async (job) => {
      if (job.name !== 'sitemaps') throw new Error(`seo: unknown job ${job.name}`);
      const started = Date.now();
      const files = await buildSitemaps(db, appUrl);
      await writeSitemaps(db, files);
      const urls = files.slice(1).reduce((n, f) => n + f.urlCount, 0);
      console.log(`seo: sitemaps: ${files.length - 1} files, ${urls} addresses, ${Date.now() - started} ms`);
    },
    { connection: own, concurrency: 1 },
  );
  worker.on('failed', (job, e) => {
    console.error(`seo: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
  });
  return {
    close: async () => {
      await worker.close();
      await scheduled.close();
      await own.quit();
    },
  };
}
