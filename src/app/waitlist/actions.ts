'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { appDb } from '../../db/drizzle';
import { locations } from '../../db/schema';
import { clientIp } from '../../lib/client-ip';
import { webEnv } from '../../lib/env';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { confirmWaitlist, joinWaitlist, leaveWaitlist } from '../../modules/launch/waitlist';
import { emailHtml, escapeHtml, notificationMailer } from '../../modules/notifications/mailer';
import { testInbox } from '../../modules/users/test-accounts';
import { checkTurnstile } from '../../modules/security/server';
import { WAITLIST_ROLES } from '../../db/schema';

// City waitlist (src/modules/launch/waitlist.ts): "notify me", the confirmation link, leaving.
// The confirmation email goes straight from the web, like login codes, so its token never sits in
// the outbox. The answer is the same whether or not the email was already on the list.

export type WaitlistState = { sent: true } | { error: string } | undefined;

const MINUTE = 60;
const LIMITS = {
  perIp: { name: 'waitlist:ip:1h', max: 10, windowSeconds: 60 * MINUTE },
  perEmail: { name: 'waitlist:email:1d', max: 3, windowSeconds: 24 * 60 * MINUTE },
};

const input = z.object({
  cityId: z.uuid(),
  email: z.email().max(254),
  role: z.enum(WAITLIST_ROLES),
});

export async function joinWaitlistAction(_: WaitlistState, form: FormData): Promise<WaitlistState> {
  const t = messages.launch;
  const parsed = input.safeParse({ cityId: form.get('cityId'), email: String(form.get('email') ?? '').trim().toLowerCase(), role: form.get('role') });
  if (!parsed.success) return { error: t.errors.invalid };
  const notHuman = await checkTurnstile(form, 'waitlist');
  if (notHuman) return { error: notHuman };

  const ip = clientIp(await headers());
  const limited = await hit(valkey(), [[LIMITS.perEmail, parsed.data.email], ...(ip ? ([[LIMITS.perIp, ip]] as const) : [])]);
  if (!limited.ok) return { error: messages.rateLimited(Math.max(1, Math.ceil(limited.retryAfterSeconds / 60))) };

  const db = appDb();
  const joined = await joinWaitlist(db, parsed.data);
  if (!joined.ok) return { error: t.errors.notWaiting };
  if (joined.token) {
    const [city] = await db.select({ nameFa: locations.nameFa }).from(locations).where(eq(locations.id, parsed.data.cityId));
    const env = webEnv();
    const link = `${env.APP_URL}/waitlist/confirm?t=${joined.token}`;
    const e = t.email;
    await notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM, route: testInbox(appDb(), env.TEST_INBOX_EMAIL).mail })({
      to: parsed.data.email,
      subject: e.subject(city!.nameFa),
      text: e.text(city!.nameFa, link),
      html: emailHtml(
        `<p>${escapeHtml(e.intro(city!.nameFa))}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(e.button)}</a></p><p style="color:#525252;font-size:13px">${escapeHtml(e.ignore)}</p>`,
      ),
    });
  }
  return { sent: true };
}

/** The confirmation page's button: a click, not the link itself (mail scanners open links) */
export async function confirmWaitlistAction(form: FormData): Promise<void> {
  const token = String(form.get('t') ?? '');
  const r = await confirmWaitlist(appDb(), token);
  redirect(r.ok ? `/waitlist/confirm?done=${r.citySlug}` : '/waitlist/confirm?invalid=1');
}

export async function leaveWaitlistAction(form: FormData): Promise<void> {
  const ok = await leaveWaitlist(appDb(), String(form.get('t') ?? ''));
  redirect(ok ? '/waitlist/leave?done=1' : '/waitlist/leave?invalid=1');
}
