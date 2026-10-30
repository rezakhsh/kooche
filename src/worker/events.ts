import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { writeWeeklyDigests } from '../modules/events/digest';
import { EVENT_OUTBOX } from '../modules/events/events';
import { DEFAULT_ZONE, EVERY_HOUR, isLocalHour, MONDAY } from '../modules/notifications/local-hour';
import {
  channelsFor,
  cityZones,
  claimReminder,
  dueReminders,
  followMessage,
  followNews,
  isQuiet,
  reminderMessage,
  takeFollowSlot,
  weeklyMessageFor,
  weeklyRecipients,
  type Outgoing,
} from '../modules/events/notices';
import { quietDelay } from '../modules/users/notification-prefs';
import type { PlainEmailJob, PlainTelegramJob } from './chat';
import type { OutboxHandlers, OutboxJobData } from './outbox';
import { reportJobFailure } from './monitoring';

// Worker jobs of the events section, on queue `events`:
// - `event-digest` (Mondays 08:00 on each country's clock): one outbox event per country for the
//   planned channel posting;
// - `event-reminders` (hourly): saved events the day before (src/modules/events/notices.ts);
// - `event-weekly` (Mondays 09:00 on each city's clock): «رویدادهای این هفته در شهر» to those who asked;
// - `event_follow` (from the outbox, an event published): the business's followers, once per
//   event; those in their quiet hours get theirs in the morning (`event_follow_one`).
// Messages go out on the shared send queues (./chat.ts). Ending an event needs no job of its own:
// its listing expires at the end of its last date (listing-expiry). The two Monday jobs run every
// hour and send where it is their hour now (wave 2 part 7, src/modules/notifications/local-hour.ts).

const SCHEDULES = {
  'event-digest': EVERY_HOUR,
  'event-reminders': { pattern: '5 * * * *', tz: 'Europe/Berlin' },
  'event-weekly': EVERY_HOUR,
} as const;

/** One fan-out per event, even when both `event.published` and `listing.published` arrive */
const FOLLOW_GUARD_SECONDS = 30 * 86_400;

export type EventJobOptions = {
  appUrl: string;
  /** The shared send queues of ./chat.ts */
  send: { telegram: Queue; email: Queue };
  /** Tests */
  prefix?: string;
  schedules?: boolean;
  now?: () => Date;
};

export async function startEventJobs(db: Db, connection: Redis, opts: EventJobOptions): Promise<{ handlers: OutboxHandlers; queue: Queue; close: () => Promise<void> }> {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const now = opts.now ?? (() => new Date());
  const queue = new Queue('events', { connection, ...prefix, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 200, removeOnFail: 500 } });
  if (opts.schedules !== false) {
    for (const [name, repeat] of Object.entries(SCHEDULES)) {
      await queue.upsertJobScheduler(name, repeat, { name, opts: { removeOnComplete: 20, removeOnFail: 50 } });
    }
  }

  const deliver = async (out: Outgoing, key: string) => {
    if (out.telegram) await opts.send.telegram.add('plain_telegram', out.telegram satisfies PlainTelegramJob, { jobId: `tg_${key}` });
    if (out.mail) await opts.send.email.add('plain_email', { mail: out.mail } satisfies PlainEmailJob, { jobId: `mail_${key}` });
  };

  const reminders = async () => {
    const at = now();
    let sent = 0;
    for (const r of await dueReminders(db, opts.appUrl, at)) {
      // Quiet hours: a later hourly run sends it, while the date is still 12 hours or more ahead
      if (isQuiet(r, at)) continue;
      const channels = await channelsFor(connection, r, 'reminders');
      if (!(await claimReminder(db, r.listingId, r.userId, r.startsAt))) continue;
      if (!channels.length) continue;
      await deliver(reminderMessage(r, channels, opts.appUrl), `remind_${r.listingId}_${r.userId}_${r.startsAt.getTime()}`);
      sent++;
    }
    return sent;
  };

  /** The followers' notices (`userId`: only theirs, after quiet hours); quiet ones wait for the morning */
  const followOne = async (news: NonNullable<Awaited<ReturnType<typeof followNews>>>, userId: string | null) => {
    const at = now();
    const listingId = news.listingId;
    let sent = 0;
    for (const r of news.followers) {
      if (userId && r.userId !== userId) continue;
      const channels = await channelsFor(connection, r, 'reminders');
      if (!channels.length) continue;
      if (!userId && isQuiet(r, at)) {
        await queue.add('event_follow_one', { listingId, userId: r.userId }, { jobId: `follow_${listingId}_${r.userId}`, delay: quietDelay(at, r.timeZone) });
        continue;
      }
      if (!(await takeFollowSlot(connection, r.userId, at, r.timeZone))) continue;
      await deliver(followMessage(news, r, channels, opts.appUrl), `follow_${listingId}_${r.userId}`);
      sent++;
    }
    return sent;
  };

  const weekly = async () => {
    const at = now();
    const byCity = new Map<string, Awaited<ReturnType<typeof weeklyMessageFor>>>();
    let sent = 0;
    const recipients = await weeklyRecipients(db);
    // Only the cities where it is Monday 9:00 now
    const zones = await cityZones(db, [...new Set(recipients.map((r) => r.cityId))]);
    for (const r of recipients) {
      if (!isLocalHour(at, zones.get(r.cityId) ?? DEFAULT_ZONE, 9, MONDAY)) continue;
      if (!byCity.has(r.cityId)) byCity.set(r.cityId, await weeklyMessageFor(db, r.cityId, opts.appUrl, at));
      const message = byCity.get(r.cityId);
      if (!message) continue;
      const channels = await channelsFor(connection, r, 'events');
      if (!channels.length) continue;
      const week = at.toISOString().slice(0, 10);
      await deliver(message.build(r, channels), `weekly_${r.userId}_${week}`);
      sent++;
    }
    return sent;
  };

  const own = connection.duplicate();
  const worker = new Worker(
    'events',
    async (job: Job) => {
      switch (job.name) {
        case 'event-digest': {
          const n = await writeWeeklyDigests(db, now(), { localHour: 8 });
          return `digest for ${n} countries`;
        }
        case 'event-reminders':
          return `${await reminders()} reminders`;
        case 'event-weekly':
          return `${await weekly()} weekly messages`;
        case 'event_follow': {
          const listingId = (job.data as OutboxJobData).aggregateId;
          // Most published listings are no business's event
          const news = await followNews(db, listingId, opts.appUrl, now());
          if (!news) return 'not a business event';
          if ((await connection.set(`event-follow:${listingId}`, '1', 'EX', FOLLOW_GUARD_SECONDS, 'NX')) !== 'OK') return 'done before';
          return `${await followOne(news, null)} followers`;
        }
        case 'event_follow_one': {
          const d = job.data as { listingId: string; userId: string };
          const news = await followNews(db, d.listingId, opts.appUrl, now());
          return news ? `${await followOne(news, d.userId)} sent` : 'gone';
        }
        default:
          throw new Error(`events: unknown job ${job.name}`);
      }
    },
    { connection: own, ...prefix, concurrency: 1 },
  );
  worker.on('failed', (job, e) => {
    console.error(`events: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
  });

  // Search sync subscribes to these too (./search.ts); the n8n webhook (channel posting) later.
  // A business's event that waited for review goes live with `listing.published`.
  const toFollowers = [{ name: 'event_follow', queue }];
  const handlers: OutboxHandlers = {
    [EVENT_OUTBOX.published]: toFollowers,
    'listing.published': toFollowers,
    [EVENT_OUTBOX.changed]: [],
    [EVENT_OUTBOX.cancelled]: [],
    [EVENT_OUTBOX.weeklyDigest]: [],
  };
  return {
    handlers,
    queue,
    close: async () => {
      await worker.close();
      await queue.close();
      await own.quit();
    },
  };
}
