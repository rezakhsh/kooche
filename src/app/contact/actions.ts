'use server';

import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { appDb } from '../../db/drizzle';
import { users } from '../../db/schema';
import { clientIp } from '../../lib/client-ip';
import { webEnv } from '../../lib/env';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { notificationMailer } from '../../modules/notifications/mailer';
import { checkTurnstile } from '../../modules/security/server';
import { contactInput, contactMails } from '../../modules/users/contact';
import { testInbox } from '../../modules/users/test-accounts';
import { currentSession } from '../../modules/users/server';

// The contact form (src/modules/users/contact.ts). Like the waitlist's mail, it goes straight
// from the web: nothing is stored, the support inbox is the record.

export type ContactState = { sent: true } | { error: string; at: number } | undefined;

const MINUTE = 60;
const LIMITS = {
  perIp: { name: 'contact:ip:1h', max: 5, windowSeconds: 60 * MINUTE },
  perEmail: { name: 'contact:email:1d', max: 5, windowSeconds: 24 * 60 * MINUTE },
};

export async function contactAction(_prev: ContactState, form: FormData): Promise<ContactState> {
  const t = messages.contactForm;
  const session = await currentSession();
  const parsed = contactInput.safeParse({
    topic: form.get('topic'),
    name: form.get('name') ?? '',
    // Signed in, the reply goes to the account's own address
    email: session ? session.user.email : String(form.get('email') ?? '').trim().toLowerCase(),
    message: form.get('message') ?? '',
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === 'message' ? t.errors.message : field === 'email' ? t.errors.email : field === 'name' ? t.errors.name : t.errors.invalid, at: Date.now() };
  }
  if (!session) {
    const refused = await checkTurnstile(form, 'contact');
    if (refused) return { error: refused, at: Date.now() };
  }
  const ip = clientIp(await headers());
  const limited = await hit(valkey(), [[LIMITS.perEmail, parsed.data.email], ...(ip ? ([[LIMITS.perIp, ip]] as const) : [])]);
  if (!limited.ok) return { error: messages.rateLimited(Math.max(1, Math.ceil(limited.retryAfterSeconds / 60))), at: Date.now() };

  const db = appDb();
  const env = webEnv();
  const [me] = session ? await db.select({ publicToken: users.publicToken }).from(users).where(eq(users.id, session.user.id)) : [];
  const mails = contactMails(parsed.data, session ? { userId: session.user.id, publicToken: me?.publicToken ?? null } : { userId: null, ip }, env.APP_URL);
  const send = notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM, route: testInbox(db, env.TEST_INBOX_EMAIL).mail });
  try {
    await send(mails.support);
  } catch (e) {
    console.error('contact: support mail failed', e instanceof Error ? e.message : e);
    return { error: t.errors.failed, at: Date.now() };
  }
  // The receipt is a courtesy: the message already reached us
  await send(mails.receipt).catch((e) => console.error('contact: receipt failed', e instanceof Error ? e.message : e));
  return { sent: true };
}
