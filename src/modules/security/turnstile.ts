import { z } from 'zod';

// Cloudflare Turnstile, checked on the server (docs/setup.md, "Bot protection"). The browser's
// widget only hands us a token; it counts once Cloudflare's siteverify has accepted it for our
// hostname and for this form's action. Tokens are single-use and expire after 300 seconds, which
// siteverify enforces (`timeout-or-duplicate`). Any doubt refuses: no token, a wrong answer, a
// timeout or Cloudflare unreachable.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The hidden field Turnstile's widget adds to the form it sits in */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

/** One action per form, so a token solved on one form can't be spent on another */
export type TurnstileAction = 'login' | 'publish-listing' | 'publish-event' | 'report' | 'waitlist';

/**
 * Cloudflare's published test secrets (always pass, always fail, always "already spent"). Their
 * answers carry hostname `example.com` and no action, so those two checks are skipped for them.
 * env.ts allows them only for a local APP_URL.
 */
export const TEST_SECRETS = [
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
] as const;

export type TurnstileDeps = {
  secret: string;
  /** APP_URL's host: the only hostname a token may come from */
  hostname: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type TurnstileResult =
  | { ok: true }
  /** missing: no token (no JavaScript, or sent before the widget finished); rejected: Cloudflare said
   *  no or the token belongs elsewhere; unavailable: no usable answer from Cloudflare */
  | { ok: false; reason: 'missing' | 'rejected' | 'unavailable'; codes?: string[] };

const tokenSchema = z.string().min(1).max(2048);

const answerSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});

export async function verifyTurnstile(
  input: { token: unknown; action: TurnstileAction; ip: string | null },
  deps: TurnstileDeps,
): Promise<TurnstileResult> {
  const token = tokenSchema.safeParse(input.token);
  if (!token.success) return { ok: false, reason: 'missing' };

  const body = new URLSearchParams({ secret: deps.secret, response: token.data });
  if (input.ip) body.set('remoteip', input.ip);
  let answer: z.infer<typeof answerSchema>;
  try {
    const res = await (deps.fetch ?? fetch)(SITEVERIFY, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(deps.timeoutMs ?? 5_000),
    });
    if (!res.ok) return { ok: false, reason: 'unavailable', codes: [`http-${res.status}`] };
    const parsed = answerSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, reason: 'unavailable', codes: ['bad-answer'] };
    answer = parsed.data;
  } catch (e) {
    return { ok: false, reason: 'unavailable', codes: [e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network'] };
  }

  if (!answer.success) return { ok: false, reason: 'rejected', codes: answer['error-codes'] ?? [] };
  if (!(TEST_SECRETS as readonly string[]).includes(deps.secret)) {
    if (answer.hostname !== deps.hostname) return { ok: false, reason: 'rejected', codes: ['wrong-hostname'] };
    if (answer.action !== input.action) return { ok: false, reason: 'rejected', codes: ['wrong-action'] };
  }
  return { ok: true };
}
