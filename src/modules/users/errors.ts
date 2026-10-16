import { isAPIError } from 'better-auth/api';
import { messages } from '../../messages/fa';

// Better Auth errors → Persian text for the forms. Unknown errors are logged, never shown.

export function authErrorCode(e: unknown): string | null {
  if (!isAPIError(e)) return null;
  const body = e.body as { code?: unknown } | undefined;
  return typeof body?.code === 'string' ? body.code : null;
}

export function rateLimitMessage(e: unknown): string | null {
  if (authErrorCode(e) !== 'RATE_LIMITED') return null;
  const seconds = Number((e as { body?: { retryAfterSeconds?: unknown } }).body?.retryAfterSeconds);
  return messages.rateLimited(Math.max(1, Math.ceil((Number.isFinite(seconds) ? seconds : 60) / 60)));
}
