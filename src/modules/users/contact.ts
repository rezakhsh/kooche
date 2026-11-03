import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { messages } from '../../messages/fa';
import { operator } from '../../messages/operator';
import { emailHtml, escapeHtml, type Mail } from '../notifications/mailer';
import { CONTACT_TOPICS, TOPIC_RULES, type ContactTopic } from './contact-topics';

// The contact page (/contact; docs/kleinanzeigen-study.md, 1.5): the second quick channel next to
// the email address (§ 5 Abs. 1 Nr. 2 DDG, CJEU C-298/07). Help first, then a topic, then the form.
// Account topics need a sign-in; guests may write about sign-in problems, illegal content,
// authorities, privacy and anything else. Guests pass Turnstile, a hidden trap field, a minimum
// filling time, a link limit and hourly limits; for privacy and "other" their message waits in
// Valkey until they click an emailed link. Messages go to the support address with the sender as
// Reply-To and a topic tag in the subject. A receipt never repeats the message or the name, so the
// form can't be used to send our mail with someone else's text to a stranger.

export { CONTACT_TOPICS, TOPIC_RULES, type ContactTopic } from './contact-topics';

export const contactInput = z.object({
  topic: z.enum(CONTACT_TOPICS),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  message: z.string().trim().min(10).max(5000),
  /** Illegal content: the address of the content on Peydoo */
  link: z.string().trim().max(500).optional(),
  /** Illegal content: "my information is correct and complete" */
  goodFaith: z.boolean().optional(),
});
export type ContactInput = z.infer<typeof contactInput>;

/** Who sent it: the account when signed in (with [Pro] when one of its businesses subscribes), else the visitor's address */
export type ContactSender = { userId: string; publicToken: string | null; pro: boolean } | { userId: null; ip: string | null };

export type ContactRefusal = 'signIn' | 'link' | 'goodFaith' | 'links';

const LINK = /https?:\/\/|www\./gi;
/** Guests may send at most this many links; a message can't be only a link */
export const GUEST_MAX_LINKS = 2;

/** The rules beyond the field shapes: sign-in, the illegal-content details, links in guests' messages */
export function contactRefusal(input: ContactInput, signedIn: boolean, appUrl: string): ContactRefusal | null {
  const rule = TOPIC_RULES[input.topic];
  if (!signedIn && !rule.guests) return 'signIn';
  if (input.topic === 'illegal') {
    if (!input.link || !isOwnUrl(input.link, appUrl)) return 'link';
    if (!input.goodFaith) return 'goodFaith';
  }
  if (!signedIn) {
    const links = input.message.match(LINK)?.length ?? 0;
    const words = input.message.replace(/\S*(https?:\/\/|www\.)\S*/gi, '').trim();
    if (links > GUEST_MAX_LINKS || (links > 0 && words.length < 10)) return 'links';
  }
  return null;
}

function isOwnUrl(link: string, appUrl: string): boolean {
  try {
    return new URL(link).host === new URL(appUrl).host;
  } catch {
    return false;
  }
}

// The form's drawing time, signed, so a bot can't skip the minimum filling time
const MIN_FILL_MS = 3_000;
const MAX_FILL_MS = 2 * 60 * 60_000;
const sign = (secret: string, t: string) => createHmac('sha256', secret).update(`peydoo-contact-v1:${t}`).digest('base64url');

export function formTime(secret: string, now: Date = new Date()): string {
  const t = String(now.getTime());
  return `${t}.${sign(secret, t)}`;
}

/** False for a missing, forged, too quick or stale form time */
export function formTimeOk(secret: string, value: unknown, now: Date = new Date()): boolean {
  if (typeof value !== 'string') return false;
  const [t, mac] = value.split('.');
  if (!t || !mac || !/^\d{13}$/.test(t)) return false;
  const want = Buffer.from(sign(secret, t));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  const age = now.getTime() - Number(t);
  return age >= MIN_FILL_MS && age <= MAX_FILL_MS;
}

export function contactMails(input: ContactInput, sender: ContactSender, appUrl: string): { support: Mail; receipt: Mail | null } {
  const t = messages.contactForm;
  const rule = TOPIC_RULES[input.topic];
  const topic = t.topics[input.topic];
  const tags = [rule.tag, sender.userId !== null ? 'Konto' : 'Gast', ...(sender.userId !== null && sender.pro ? ['Pro'] : [])];
  const who =
    sender.userId !== null
      ? t.mail.account(sender.publicToken ? `${appUrl}/u/${sender.publicToken}` : sender.userId)
      : t.mail.guest(sender.ip ?? '—');
  const head = [`${t.mail.topic}: ${topic}`, `${t.mail.from}: ${input.name} <${input.email}>`, who, ...(input.link ? [`${t.mail.link}: ${input.link}`] : [])];
  if (input.goodFaith) head.push(t.mail.goodFaith);
  const support: Mail = {
    to: operator.email,
    subject: `${tags.map((x) => `[${x}]`).join('')} ${t.mail.subject(topic, input.name)}`,
    text: [...head, '', input.message].join('\n'),
    html: emailHtml(
      `${head.map((l) => `<p style="margin:0 0 4px">${escapeHtml(l)}</p>`).join('')}<hr style="border:0;border-top:1px solid #e5e5e5;margin:16px 0"><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    ),
    headers: { 'Reply-To': input.email },
  };
  const wantsReceipt = rule.receipt === 'always' || (rule.receipt === 'signedIn' && sender.userId !== null);
  const receipt: Mail | null = wantsReceipt
    ? {
        to: input.email,
        subject: t.receipt.subject,
        text: `${t.receipt.text(topic)}\n\n${t.receipt.notYou}`,
        html: emailHtml(`<p>${escapeHtml(t.receipt.text(topic))}</p><p style="color:#525252;font-size:13px">${escapeHtml(t.receipt.notYou)}</p>`),
      }
    : null;
  return { support, receipt };
}

/** A guest's message waiting for the click (privacy, other): kept for a day, then gone */
export const HELD_TTL_SECONDS = 24 * 60 * 60;
export const heldKey = (token: string) => `contact:held:${token}`;
export const newHeldToken = () => randomBytes(24).toString('base64url');

/** The one email a held message sends: a link only, never the guest's text */
export function confirmMail(to: string, link: string): Mail {
  const t = messages.contactForm.confirm;
  return {
    to,
    subject: t.subject,
    text: `${t.text}\n\n${link}\n\n${t.notYou}`,
    html: emailHtml(
      `<p>${escapeHtml(t.text)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.button)}</a></p><p style="color:#525252;font-size:13px">${escapeHtml(t.notYou)}</p>`,
    ),
  };
}

export const held = z.object({ input: contactInput, ip: z.string().nullable() });
