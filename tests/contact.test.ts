import { describe, expect, it } from 'vitest';
import { operator } from '../src/messages/operator';
import { contactInput, contactMails } from '../src/modules/users/contact';

const ok = { topic: 'support', name: 'Sara', email: 'sara@example.com', message: 'My code never arrived, twice.' };

describe('contact form', () => {
  it('accepts a complete message and refuses short, unknown or oversized fields', () => {
    expect(contactInput.safeParse(ok).success).toBe(true);
    expect(contactInput.safeParse({ ...ok, topic: 'sales' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, name: 'S' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, email: 'not-an-email' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, message: 'short' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, message: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('sends the message to support with the sender as Reply-To, escaped in the HTML', () => {
    const input = contactInput.parse({ ...ok, message: 'See <script>alert(1)</script> here' });
    const { support } = contactMails(input, { userId: null, ip: '203.0.113.7' }, 'https://peydoo.com');
    expect(support.to).toBe(operator.email);
    expect(support.headers).toEqual({ 'Reply-To': 'sara@example.com' });
    expect(support.text).toContain('See <script>alert(1)</script> here');
    expect(support.text).toContain('203.0.113.7');
    expect(support.html).not.toContain('<script>');
    expect(support.html).toContain('&#60;script&#62;');
  });

  it('links a signed-in sender to their public page', () => {
    const { support } = contactMails(contactInput.parse(ok), { userId: 'u1', publicToken: 'abc123' }, 'https://peydoo.com');
    expect(support.text).toContain('https://peydoo.com/u/abc123');
  });

  it('the receipt goes to the sender and never repeats the message or the name', () => {
    const input = contactInput.parse({ ...ok, name: 'Buy cheap pills at spam.example', message: 'Visit spam.example for offers now' });
    const { receipt } = contactMails(input, { userId: null, ip: null }, 'https://peydoo.com');
    expect(receipt.to).toBe('sara@example.com');
    for (const part of [receipt.subject, receipt.text, receipt.html]) expect(part).not.toContain('spam.example');
  });
});
