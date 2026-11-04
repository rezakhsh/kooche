import { describe, expect, it } from 'vitest';
import { messages } from '../src/messages/fa';
import { phoneWays } from '../src/modules/users/phone-ways';

// The phone page's ways to verify (owner, Nov 4, 2026): no WhatsApp for requests from Iran,
// Telegram everywhere (the only way for +98, messages only), SMS wherever a provider is set up.

const all = { whatsappConfigured: true, telegramLoginConfigured: true, smsAvailable: true };

describe('the phone page by country', () => {
  it('outside Iran: Telegram, WhatsApp and SMS', () => {
    expect(phoneWays({ fromIran: false, ...all })).toEqual({ telegramLogin: true, telegramBot: true, whatsapp: true, sms: true });
  });

  it('from Iran: no WhatsApp; Telegram and SMS (travellers with a foreign SIM) stay', () => {
    expect(phoneWays({ fromIran: true, ...all })).toEqual({ telegramLogin: true, telegramBot: true, whatsapp: false, sms: true });
  });

  it('nothing appears that isn’t set up, wherever the visitor is', () => {
    const none = { whatsappConfigured: false, telegramLoginConfigured: false, smsAvailable: false };
    for (const fromIran of [false, true]) {
      expect(phoneWays({ fromIran, ...none })).toEqual({ telegramLogin: false, telegramBot: true, whatsapp: false, sms: false });
    }
  });

  it('tells everyone where a +98 number goes, without "sanctions"', () => {
    const t = messages.phone;
    expect(t.iranLine).toContain('تلگرام');
    expect(t.iranLine).toContain('پیام');
    for (const text of [t.iranLine, t.messagesOnlyNote, t.whatsapp.iranScreen.body, messages.iran.banner.guest, messages.iran.banner.noNumber, messages.bot.verifiedMessagesOnly]) {
      expect(text.toLowerCase()).not.toContain('sanction');
      expect(text).not.toContain('تحریم');
    }
  });
});
