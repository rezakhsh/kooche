import { describe, expect, it } from 'vitest';
import { pages } from '../src/messages/fa';
import { operator } from '../src/messages/operator';
import { confirmMail, contactInput, contactMails, contactRefusal, formTime, formTimeOk } from '../src/modules/users/contact';
import { CONTACT_TOPICS, TOPIC_RULES } from '../src/modules/users/contact-topics';

// The contact page, help first (src/modules/users/contact.ts; docs/kleinanzeigen-study.md, 1.5)

const APP = 'https://peydoo.com';
const ok = { topic: 'other', name: 'Sara', email: 'sara@example.com', message: 'Is Peydoo coming to Hamburg soon?' };
const parse = (over: Record<string, unknown> = {}) => contactInput.parse({ ...ok, ...over });

describe('contact topics', () => {
  it('every help answer a topic shows exists on the help page', () => {
    const questions = new Set(pages.help.groups.flatMap((g) => (g.items as readonly { q: string }[]).map((i) => i.q)));
    for (const k of CONTACT_TOPICS) for (const q of TOPIC_RULES[k].help) expect(questions, `${k}: ${q}`).toContain(q);
  });

  it('account topics need a sign-in; sign-in problems, illegal content, authorities, privacy and other stay open to guests', () => {
    const open = CONTACT_TOPICS.filter((k) => TOPIC_RULES[k].guests);
    expect(open).toEqual(['login', 'illegal', 'authority', 'privacy', 'other']);
    expect(contactRefusal(parse({ topic: 'listing' }), false, APP)).toBe('signIn');
    expect(contactRefusal(parse({ topic: 'listing' }), true, APP)).toBeNull();
  });
});

describe('the contact page', () => {
  it('shows no support address: the form instead, the address is in the Impressum (owner, Nov 3, 2026)', () => {
    expect(JSON.stringify(pages.contact)).not.toContain(operator.email);
  });
});

describe('contact form checks', () => {
  it('refuses short, unknown or oversized fields', () => {
    expect(contactInput.safeParse(ok).success).toBe(true);
    expect(contactInput.safeParse({ ...ok, topic: 'sales' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, name: 'S' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, email: 'not-an-email' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, message: 'short' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, message: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('a notice of illegal content needs a Peydoo address and the good-faith tick', () => {
    const notice = { topic: 'illegal', message: 'This listing sells stolen phones.' };
    expect(contactRefusal(parse(notice), false, APP)).toBe('link');
    expect(contactRefusal(parse({ ...notice, link: 'https://evil.example/v/x' }), false, APP)).toBe('link');
    expect(contactRefusal(parse({ ...notice, link: 'https://peydoo.com/v/x/abc' }), false, APP)).toBe('goodFaith');
    expect(contactRefusal(parse({ ...notice, link: 'https://peydoo.com/v/x/abc', goodFaith: true }), false, APP)).toBeNull();
  });

  it('guests may send at most two links, and never a message that is only links', () => {
    expect(contactRefusal(parse({ message: 'See https://a.example and https://b.example please' }), false, APP)).toBeNull();
    expect(contactRefusal(parse({ message: 'https://a.example https://b.example https://c.example' }), false, APP)).toBe('links');
    expect(contactRefusal(parse({ message: 'https://spam.example/offer-now' }), false, APP)).toBe('links');
    expect(contactRefusal(parse({ message: 'https://a.example https://b.example https://c.example' }), true, APP)).toBeNull();
  });

  it('the form time must be signed, at least 3 seconds old and at most 2 hours', () => {
    const secret = 'x'.repeat(32);
    const drawn = new Date('2026-11-03T10:00:00Z');
    const v = formTime(secret, drawn);
    expect(formTimeOk(secret, v, new Date(drawn.getTime() + 1_000))).toBe(false);
    expect(formTimeOk(secret, v, new Date(drawn.getTime() + 10_000))).toBe(true);
    expect(formTimeOk(secret, v, new Date(drawn.getTime() + 3 * 60 * 60_000))).toBe(false);
    expect(formTimeOk('y'.repeat(32), v, new Date(drawn.getTime() + 10_000))).toBe(false);
    expect(formTimeOk(secret, `${drawn.getTime() - 60_000}.forged`, drawn)).toBe(false);
    expect(formTimeOk(secret, undefined, drawn)).toBe(false);
  });
});

describe('contact mails', () => {
  it('go to support with the sender as Reply-To, a topic tag, escaped HTML', () => {
    const { support } = contactMails(parse({ message: 'See <script>alert(1)</script> here' }), { userId: null, ip: '203.0.113.7' }, APP);
    expect(support.to).toBe(operator.email);
    expect(support.headers).toEqual({ 'Reply-To': 'sara@example.com' });
    expect(support.subject.startsWith('[Sonstiges][Gast] ')).toBe(true);
    expect(support.text).toContain('203.0.113.7');
    expect(support.html).not.toContain('<script>');
    expect(support.html).toContain('&#60;script&#62;');
  });

  it('a signed-in sender is linked to their public page, tagged Pro when subscribed, and gets a receipt', () => {
    const { support, receipt } = contactMails(parse({ topic: 'payment' }), { userId: 'u1', publicToken: 'abc123', pro: true }, APP);
    expect(support.subject.startsWith('[Zahlung][Konto][Pro] ')).toBe(true);
    expect(support.text).toContain('https://peydoo.com/u/abc123');
    expect(receipt?.to).toBe('sara@example.com');
  });

  it('guests get a receipt only for a notice of illegal content, and it never repeats their words', () => {
    expect(contactMails(parse(), { userId: null, ip: null }, APP).receipt).toBeNull();
    expect(contactMails(parse({ topic: 'login' }), { userId: null, ip: null }, APP).receipt).toBeNull();
    const notice = parse({ topic: 'illegal', name: 'Buy cheap pills at spam.example', message: 'Visit spam.example for offers now', link: 'https://peydoo.com/v/x/a', goodFaith: true });
    const { receipt } = contactMails(notice, { userId: null, ip: null }, APP);
    expect(receipt?.to).toBe('sara@example.com');
    for (const part of [receipt!.subject, receipt!.text, receipt!.html]) expect(part).not.toContain('spam.example');
  });

  it('the confirmation mail for a held message carries the link only', () => {
    const mail = confirmMail('sara@example.com', 'https://peydoo.com/contact/confirm?t=abc');
    expect(mail.text).toContain('https://peydoo.com/contact/confirm?t=abc');
    expect(mail.text).not.toContain('Hamburg');
  });
});
