import { Redis } from 'ioredis';
import { webEnv } from './env';

// The Next.js app's Valkey client (cache, rate limits). Server code only. The worker opens its own
// connection with the options BullMQ needs (src/worker/index.ts).

const globalForValkey = globalThis as typeof globalThis & { valkey?: Redis };

export function valkey(): Redis {
  return (globalForValkey.valkey ??= new Redis(webEnv().REDIS_URL, {
    connectTimeout: 5_000,
    // Fail a command after one retry instead of queueing it forever while Valkey is down
    maxRetriesPerRequest: 1,
  }));
}
