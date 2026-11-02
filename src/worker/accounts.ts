import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { closeEndedActingSessions } from '../modules/admin/acting';
import { LEGAL_NOTICE, sendNoticeBatch, unfinishedNotices } from '../modules/legal/notices';
import type { Mailer } from '../modules/notifications/mailer';
import type { TelegramClient } from '../modules/notifications/telegram-api';
import { ACCOUNT_NOTICE, parseAccountNotice, sendAccountNotice, sendGoodbye } from '../modules/users/account-notices';
import { ERASED, ERASE_REQUESTED, eraseRequestedUser, finishStuckErasures } from '../modules/users/erasure';
import type { OutboxHandlers, OutboxJobData } from './outbox';
import { reportJobFailure, logText } from './monitoring';

// Worker jobs for accounts: queue `accounts` erases an account after its owner asked for it
// (src/modules/users/erasure.ts). Retried like the other outbox jobs; a retry after a success
// does nothing. Every minute it also closes sign-in-as sessions that ran out (acting_ended); every
// hour it finishes deletions whose job gave up (erase_stuck).
// It also sends «خبر تغییر شرایط به همه» (src/modules/legal/notices.ts): one job per batch of 100
// accounts, the next batch queued by the one before, so the other jobs here keep running between
// them; every hour a notice that stopped (its batch gave up) is taken up again (legal_resume).
// And the account notices (src/modules/users/account-notices.ts): team changes, a confirmed phone
// number, a restriction that ran out; the goodbye email goes out from the erase job, just before
// the address is wiped.

// Failed jobs hold an address and a message text: kept 30 days at most (Check B, Oct 31, 2026)
const KEEP = { removeOnComplete: 200, removeOnFail: { age: 30 * 86_400, count: 1_000 } };
const RETRY = { attempts: 5, backoff: { type: 'exponential' as const, delay: 10_000 } };

type LegalJob = OutboxJobData & { payload: { chain?: string; batch?: number } };

export async function startAccountJobs(db: Db, connection: Redis, opts: { prefix?: string; mailer?: Mailer; appUrl?: string; telegram?: TelegramClient | null } = {}) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('accounts', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  // Sign-in-as sessions whose time ran out without «پایان» (src/modules/admin/acting.ts)
  await queue.upsertJobScheduler('acting-ended', { every: 60_000 }, { name: 'acting_ended', opts: { removeOnComplete: true, removeOnFail: 20, attempts: 1 } });
  // Deletions whose job gave up are finished (src/modules/users/erasure.ts)
  await queue.upsertJobScheduler('erase-stuck', { pattern: '23 * * * *', tz: 'UTC' }, { name: 'erase_stuck', opts: { removeOnComplete: true, removeOnFail: 20, attempts: 1 } });
  await queue.upsertJobScheduler('legal-resume', { pattern: '41 * * * *', tz: 'UTC' }, { name: 'legal_resume', opts: { removeOnComplete: true, removeOnFail: 20, attempts: 1 } });

  /** The next batch of a notice; the chain keeps the ids of a resumed run apart from the first */
  const nextBatch = (data: LegalJob, chain: string, batch: number) =>
    queue.add('legal_notice', { ...data, payload: { chain, batch } }, { jobId: `legal_${data.aggregateId}_${chain}_${batch}` });
  const own = connection.duplicate();
  const worker = new Worker<OutboxJobData>(
    'accounts',
    async (job) => {
      if (job.name === 'acting_ended') return closeEndedActingSessions(db);
      if (job.name === 'erase_stuck') return finishStuckErasures(db);
      if (job.name === 'legal_notice') {
        if (!opts.mailer || !opts.appUrl) return 'skipped';
        const data = job.data as LegalJob;
        const r = await sendNoticeBatch(db, connection, opts.mailer, data.aggregateId, opts.appUrl);
        const chain = data.payload.chain ?? data.outboxId;
        if (r.more) await nextBatch(data, chain, (data.payload.batch ?? 0) + 1);
        else console.log(`accounts: legal notice ${data.aggregateId} finished`);
        return r;
      }
      if (job.name === 'legal_resume') {
        const ids = await unfinishedNotices(db);
        // Only notices that stopped (src/modules/legal/notices.ts, STALLED_MS); each account goes once anyway
        const hour = new Date().toISOString().slice(0, 13).replace(/\D/g, '');
        for (const id of ids) await nextBatch({ outboxId: `resume${hour}`, eventType: LEGAL_NOTICE, aggregateId: id, payload: {} }, `r${hour}`, 0);
        return ids.length;
      }
      if (job.name === 'account_notice') {
        const notice = parseAccountNotice(job.data.payload);
        if (!notice || !opts.mailer || !opts.appUrl) return 'skipped';
        const sent = await sendAccountNotice(db, connection, { mail: opts.mailer, telegram: opts.telegram ?? null, appUrl: opts.appUrl, once: job.data.outboxId }, job.data.aggregateId, notice);
        console.log(`accounts: notice ${notice.kind} ${job.data.aggregateId}: email ${sent.email}, telegram ${sent.telegram}`);
        return sent;
      }
      if (job.name !== 'erase') throw new Error(`accounts: unknown job ${job.name}`);
      // «حساب شما حذف شد» while the address is still there; never holds the deletion up
      if (opts.mailer && opts.appUrl) await sendGoodbye(db, connection, opts.mailer, opts.appUrl, job.data.aggregateId, job.data.outboxId);
      const outcome = await eraseRequestedUser(db, job.data.aggregateId);
      console.log(`accounts: erase ${job.data.aggregateId}: ${outcome}`);
      return outcome;
    },
    { connection: own, concurrency: 1, ...prefix },
  );
  worker.on('failed', (job, e) => {
    console.error(`accounts: ${job?.name} failed (attempt ${job?.attemptsMade}):`, logText(e));
    reportJobFailure(job, e);
  });

  const handlers: OutboxHandlers = {
    [ERASE_REQUESTED]: [{ name: 'erase', queue }],
    // The avatar file would be deleted here; accounts have no avatars yet
    [ERASED]: [],
    [LEGAL_NOTICE]: [{ name: 'legal_notice', queue }],
    [ACCOUNT_NOTICE]: [{ name: 'account_notice', queue }],
  };
  return {
    handlers,
    queue,
    worker,
    close: async () => {
      await worker.close();
      await queue.close();
      await own.quit();
    },
  };
}
