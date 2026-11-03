import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { rtlLines } from '../../lib/bidi';
import { sameBytes } from '../../lib/tokens';

// WhatsApp Cloud API (Meta's Graph API) for the phone check (src/modules/users/whatsapp.ts): the
// webhook's signature, its messages, and our reply. Replies are free text inside the 24-hour window
// that the user's own message opens; we never write first and never send templates (paid, and
// limited while the business is unverified). The token is never logged.

export const GRAPH_API = 'https://graph.facebook.com';

export type WhatsAppConfig = {
  /** Digits only, for wa.me links */
  businessNumber: string;
  phoneNumberId: string;
  token: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
};

/** Meta signs the raw body with the app secret (X-Hub-Signature-256: sha256=<hex>) */
export function validSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  const hex = header?.match(/^sha256=([0-9a-f]{64})$/i)?.[1];
  if (!hex) return false;
  return sameBytes(Buffer.from(hex, 'hex'), createHmac('sha256', appSecret).update(rawBody, 'utf8').digest());
}

/** The webhook's handshake when the callback URL is saved: the same verify token we gave Meta */
export function sameVerifyToken(given: string | null, expected: string): boolean {
  return given !== null && sameBytes(Buffer.from(given), Buffer.from(expected));
}

export type IncomingMessage = { id: string; from: string; text: string };

const payloadSchema = z.object({
  object: z.string(),
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z.object({
                messages: z
                  .array(
                    z.object({
                      id: z.string().max(200),
                      // Digits only, no +. Meta's coming usernames may leave it out (business-scoped ids)
                      from: z.string().regex(/^[0-9]{6,15}$/).optional(),
                      type: z.string(),
                      text: z.object({ body: z.string().max(4096) }).optional(),
                    }),
                  )
                  .optional(),
              }),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

/** The users' messages in a webhook call; delivery statuses of our replies and the rest are skipped */
export function incomingMessages(payload: unknown): IncomingMessage[] {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.object !== 'whatsapp_business_account') return [];
  return (parsed.data.entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .filter((c) => c.field === 'messages')
    .flatMap((c) => c.value.messages ?? [])
    .flatMap((m) => (m.from ? [{ id: m.id, from: m.from, text: m.type === 'text' ? (m.text?.body ?? '') : '' }] : []));
}

export type SendText = (to: string, text: string) => Promise<void>;

/** Sends a text message. `base`: another address, for tests with a fake Graph API */
export function whatsAppSender(config: WhatsAppConfig, base = GRAPH_API): SendText {
  return async (to, text) => {
    const res = await fetch(`${base}/${config.graphVersion}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        // Every line right to left, whatever it starts with (../../lib/bidi.ts)
        text: { body: rtlLines(text), preview_url: false },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`whatsapp send: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  };
}
