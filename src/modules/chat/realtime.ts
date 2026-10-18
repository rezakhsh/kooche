import type { Redis } from 'ioredis';
import type { ConversationStatus, MessageView } from './conversations';

// Live chat events (docs/setup.md, "Chat"). Whoever commits a change publishes it to the
// participants' Valkey channels: the web process after a message or a read, the worker after a
// listing closed or reopened its conversations. Every web process holds one subscriber
// connection (hub.ts) and forwards the events to the browsers' server-sent event streams, so
// several app instances work without any change. Pub/sub keeps nothing: a browser that was away
// catches up from the database (replay after Last-Event-ID).

export type WireMessage = Omit<MessageView, 'createdAt'> & { createdAt: string };

export type ChatEvent =
  | { type: 'message'; message: WireMessage }
  | { type: 'read'; conversationId: string; readerId: string; at: string }
  | { type: 'conversation'; conversationId: string; status: ConversationStatus }
  /** The unread badge changed */
  | { type: 'unread' };

export const userChannel = (userId: string) => `chat:user:${userId}`;

export function wireMessage(m: MessageView): WireMessage {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

/** Publishes one event to each user. Failures are logged, never thrown: the data is committed. */
export async function publish(redis: Redis, userIds: readonly string[], event: ChatEvent): Promise<void> {
  const payload = JSON.stringify(event);
  try {
    await Promise.all([...new Set(userIds)].map((id) => redis.publish(userChannel(id), payload)));
  } catch (e) {
    console.error('chat: publish failed:', e instanceof Error ? e.message : e);
  }
}
