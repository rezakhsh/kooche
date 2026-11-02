import { z } from 'zod';
import { messages } from '../../messages/fa';
import { operator } from '../../messages/operator';
import { emailHtml, escapeHtml, type Mail } from '../notifications/mailer';
import { CONTACT_TOPICS } from './contact-topics';

// The contact form on /contact: the second quick way to reach Peydoo next to the email address
// (§ 5 Abs. 1 Nr. 2 DDG, CJEU C-298/07; docs/legal-review.md). A message goes to the support
// address with the sender as Reply-To, and the sender gets a short receipt. The receipt never
// repeats the message or the name, so the form can't be used to send our mail with someone
// else's text to a stranger.

export { CONTACT_TOPICS, type ContactTopic } from './contact-topics';

export const contactInput = z.object({
  topic: z.enum(CONTACT_TOPICS),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  message: z.string().trim().min(10).max(5000),
});
export type ContactInput = z.infer<typeof contactInput>;

/** Who sent it, for the support mail: the account when signed in, else the visitor's address */
export type ContactSender = { userId: string; publicToken: string | null } | { userId: null; ip: string | null };

export function contactMails(input: ContactInput, sender: ContactSender, appUrl: string): { support: Mail; receipt: Mail } {
  const t = messages.contactForm;
  const topic = t.topics[input.topic];
  const who =
    sender.userId !== null
      ? t.mail.account(sender.publicToken ? `${appUrl}/u/${sender.publicToken}` : sender.userId)
      : t.mail.guest(sender.ip ?? '—');
  const lines = [`${t.mail.topic}: ${topic}`, `${t.mail.from}: ${input.name} <${input.email}>`, who, '', input.message];
  const support: Mail = {
    to: operator.email,
    subject: t.mail.subject(topic, input.name),
    text: lines.join('\n'),
    html: emailHtml(
      `${lines
        .slice(0, 3)
        .map((l) => `<p style="margin:0 0 4px">${escapeHtml(l)}</p>`)
        .join('')}<hr style="border:0;border-top:1px solid #e5e5e5;margin:16px 0"><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    ),
    headers: { 'Reply-To': input.email },
  };
  const receipt: Mail = {
    to: input.email,
    subject: t.receipt.subject,
    text: `${t.receipt.text(topic)}\n\n${t.receipt.notYou}`,
    html: emailHtml(`<p>${escapeHtml(t.receipt.text(topic))}</p><p style="color:#525252;font-size:13px">${escapeHtml(t.receipt.notYou)}</p>`),
  };
  return { support, receipt };
}
