'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import { appDb } from '../../db/drizzle';
import { organizationMembers, subscriptions, users } from '../../db/schema';
import { clientIp } from '../../lib/client-ip';
import { webEnv } from '../../lib/env';
import { hit, type Limit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { operator } from '../../messages/operator';
import { notificationMailer, type Mail } from '../../modules/notifications/mailer';
import { HOLDING } from '../../modules/payments/plans';
import { checkTurnstile } from '../../modules/security/server';
import {
  confirmMail,
  contactInput,
  contactMails,
  contactRefusal,
  formTimeOk,
  held,
  HELD_TTL_SECONDS,
  heldKey,
  newHeldToken,
  TOPIC_RULES,
  type ContactSender,
} from '../../modules/users/contact';
import { FORM_TIME_FIELD, HONEYPOT_FIELD } from '../../modules/users/contact-topics';
import { testInbox } from '../../modules/users/test-accounts';
import { currentSession } from '../../modules/users/server';

// The contact form (src/modules/users/contact.ts). Like the waitlist's mail it goes straight from
// the web; nothing is stored except a guest's message waiting for its click (Valkey, a day).

export type ContactState = { sent: 'now' | 'confirm' } | { error: string; at: number } | undefined;

const MINUTE = 60;
const LIMITS = {
  perIp: { name: 'contact:ip:1h', max: 5, windowSeconds: 60 * MINUTE },
  perEmail: { name: 'contact:email:1d', max: 5, windowSeconds: 24 * 60 * MINUTE },
  guestEmail: { name: 'contact:guest-email:1d', max: 3, windowSeconds: 24 * 60 * MINUTE },
  // Every guest together: past it the form points to the email address until the hour ends
  guestsAll: { name: 'contact:guests:1h', max: 30, windowSeconds: 60 * MINUTE },
};

function mailer() {
  const env = webEnv();
  return notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM, route: testInbox(appDb(), env.TEST_INBOX_EMAIL).mail });
}

async function deliver(support: Mail, receipt: Mail | null): Promise<boolean> {
  const send = mailer();
  try {
    await send(support);
  } catch (e) {
    console.error('contact: support mail failed', e instanceof Error ? e.message : e);
    return false;
  }
  // The receipt is a courtesy: the message already reached us
  if (receipt) await send(receipt).catch((e) => console.error('contact: receipt failed', e instanceof Error ? e.message : e));
  return true;
}

export async function contactAction(_prev: ContactState, form: FormData): Promise<ContactState> {
  const t = messages.contactForm;
  const err = (error: string): ContactState => ({ error, at: Date.now() });
  const env = webEnv();
  const session = await currentSession();
  // A bot that fills the hidden field or posts faster than a person learns nothing: it sees "sent"
  if (!session && (String(form.get(HONEYPOT_FIELD) ?? '') !== '' || !formTimeOk(env.AUTH_SECRET, form.get(FORM_TIME_FIELD)))) return { sent: 'now' };

  const parsed = contactInput.safeParse({
    topic: form.get('topic'),
    name: form.get('name') ?? '',
    // Signed in, the reply goes to the account's own address
    email: session ? session.user.email : String(form.get('email') ?? '').trim().toLowerCase(),
    message: form.get('message') ?? '',
    link: String(form.get('link') ?? '').trim() || undefined,
    goodFaith: form.get('goodFaith') === 'on',
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return err(field === 'message' ? t.errors.message : field === 'email' ? t.errors.email : field === 'name' ? t.errors.name : t.errors.invalid);
  }
  const input = parsed.data;
  const refused = contactRefusal(input, !!session, env.APP_URL);
  if (refused) return err(t.errors[refused]);
  if (!session) {
    const notHuman = await checkTurnstile(form, 'contact');
    if (notHuman) return err(notHuman);
  }
  const ip = clientIp(await headers());
  const checks: Array<readonly [Limit, string]> = [[LIMITS.perEmail, input.email]];
  if (ip) checks.push([LIMITS.perIp, ip]);
  if (!session) checks.push([LIMITS.guestEmail, input.email], [LIMITS.guestsAll, 'all']);
  const limited = await hit(valkey(), checks);
  if (!limited.ok) return err(session ? messages.rateLimited(Math.max(1, Math.ceil(limited.retryAfterSeconds / 60))) : t.errors.busy(operator.email));

  if (!session && TOPIC_RULES[input.topic].confirmGuests) {
    const token = newHeldToken();
    await valkey().set(heldKey(token), JSON.stringify({ input, ip }), 'EX', HELD_TTL_SECONDS);
    try {
      await mailer()(confirmMail(input.email, `${env.APP_URL}/contact/confirm?t=${token}`));
    } catch (e) {
      console.error('contact: confirmation mail failed', e instanceof Error ? e.message : e);
      return err(t.errors.failed);
    }
    return { sent: 'confirm' };
  }

  let sender: ContactSender = { userId: null, ip };
  if (session) {
    const db = appDb();
    const [me] = await db.select({ publicToken: users.publicToken }).from(users).where(eq(users.id, session.user.id));
    const [pro] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .innerJoin(organizationMembers, eq(organizationMembers.organizationId, subscriptions.organizationId))
      .where(and(eq(organizationMembers.userId, session.user.id), inArray(subscriptions.status, [...HOLDING])))
      .limit(1);
    sender = { userId: session.user.id, publicToken: me?.publicToken ?? null, pro: !!pro };
  }
  const mails = contactMails(input, sender, env.APP_URL);
  return (await deliver(mails.support, mails.receipt)) ? { sent: 'now' } : err(t.errors.failed);
}

/** The confirmation page's button (a mail scanner that opens the link sends nothing) */
export async function confirmContactAction(form: FormData): Promise<void> {
  const token = String(form.get('t') ?? '');
  const raw = /^[A-Za-z0-9_-]{32}$/.test(token) ? await valkey().getdel(heldKey(token)) : null;
  const parsed = raw ? held.safeParse(JSON.parse(raw)) : null;
  if (!parsed?.success) redirect('/contact/confirm?invalid=1');
  const mails = contactMails(parsed.data.input, { userId: null, ip: parsed.data.ip }, webEnv().APP_URL);
  redirect((await deliver(mails.support, mails.receipt)) ? '/contact/confirm?done=1' : '/contact/confirm?failed=1');
}
