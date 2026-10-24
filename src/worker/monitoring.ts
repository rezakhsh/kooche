import { RateLimitError, UnrecoverableError, type Job } from 'bullmq';
import { reportError } from '../lib/monitoring/server';

// Error monitoring for BullMQ jobs (docs/setup.md, "Error monitoring"). Called from every queue's
// `failed` handler next to its log line. A job is reported once, when it fails for good: after its
// last attempt, or at once when it can never succeed (UnrecoverableError). Retries that still have
// attempts left (payments' NotReady, a flaky SMTP) and Telegram's flood control are not errors.
// Only the queue, job name and attempts are sent, never the job's data.

export function reportJobFailure(job: Job | undefined, error: Error): void {
  if (error instanceof RateLimitError || error.message === 'bullmq:rateLimitExceeded') return;
  const attempts = job?.opts.attempts ?? 1;
  if (job && !(error instanceof UnrecoverableError) && job.attemptsMade < attempts) return;
  const queue = job?.queueName ?? 'unknown';
  const name = job?.name ?? 'unknown';
  reportError(error, {
    tags: { queue, job: name },
    job: { queue, job: name, attempts: job?.attemptsMade ?? 0 },
  });
}

/**
 * For loops that retry by themselves (the Telegram bot's long polling): a single dropped connection
 * is normal and fixes itself, so a failure counts only from the `threshold`-th in a row on.
 */
export function failureStreak(threshold = 3) {
  let count = 0;
  return {
    /** Counts one failure; true once `threshold` failures came in a row */
    failed(): boolean {
      return ++count >= threshold;
    },
    succeeded(): void {
      count = 0;
    },
  };
}
