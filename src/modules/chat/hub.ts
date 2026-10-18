import type { Redis } from 'ioredis';
import { valkey } from '../../lib/valkey';
import { type ChatEvent, userChannel } from './realtime';

// The web process's side of the live chat: ONE Valkey subscriber connection for all browsers.
// A user's channel is subscribed when their first stream opens and unsubscribed when the last one
// closes. ioredis subscribes again by itself after a reconnect. Server code only.
//
// Limits per web process (docs/setup.md, "Chat"): MAX_STREAMS in all, MAX_STREAMS_PER_USER per
// account. Above them the stream endpoint answers 503/429 and the page falls back to reloading.

export const MAX_STREAMS = 2_000;
export const MAX_STREAMS_PER_USER = 5;

type Listener = (event: ChatEvent) => void;

class ChatHub {
  private sub: Redis | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();
  private total = 0;

  private connection(): Redis {
    if (this.sub) return this.sub;
    const sub = valkey().duplicate({ maxRetriesPerRequest: null });
    sub.on('error', (e) => console.error('chat hub: valkey:', e.message));
    sub.on('message', (channel: string, payload: string) => {
      const userId = channel.slice('chat:user:'.length);
      const set = this.listeners.get(userId);
      if (!set) return;
      let event: ChatEvent;
      try {
        event = JSON.parse(payload) as ChatEvent;
      } catch {
        return;
      }
      for (const fn of set) fn(event);
    });
    return (this.sub = sub);
  }

  /** Room for one more stream of this user? */
  canOpen(userId: string): 'ok' | 'process_full' | 'user_full' {
    if (this.total >= MAX_STREAMS) return 'process_full';
    if ((this.listeners.get(userId)?.size ?? 0) >= MAX_STREAMS_PER_USER) return 'user_full';
    return 'ok';
  }

  /** Starts receiving the user's events; resolves once the subscription is in place */
  async subscribe(userId: string, fn: Listener): Promise<() => void> {
    let set = this.listeners.get(userId);
    if (!set) {
      set = new Set();
      this.listeners.set(userId, set);
    }
    set.add(fn);
    this.total++;
    if (set.size === 1) await this.connection().subscribe(userChannel(userId));
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.total--;
      set.delete(fn);
      if (set.size === 0 && this.listeners.get(userId) === set) {
        this.listeners.delete(userId);
        void this.connection().unsubscribe(userChannel(userId)).catch(() => {});
      }
    };
  }

  stats() {
    return { streams: this.total, users: this.listeners.size };
  }
}

const globalForHub = globalThis as typeof globalThis & { chatHub?: ChatHub };

export function chatHub(): ChatHub {
  return (globalForHub.chatHub ??= new ChatHub());
}
