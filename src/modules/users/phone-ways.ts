// Which ways to verify a number the phone page offers (owner, Nov 4, 2026). Requests from Iran
// (Cloudflare's country, src/lib/region.ts) get no WhatsApp: Meta doesn't deliver messages from
// Iranian numbers to the business number, and many such attempts could get it blocked. Telegram
// stays everywhere, since it is the one way an Iranian number (+98) is accepted, for messages only
// (./phone-number.ts). SMS stays for travellers with a foreign SIM, when a provider is set up.

export type PhoneWays = { telegramLogin: boolean; telegramBot: boolean; whatsapp: boolean; sms: boolean };

export function phoneWays(o: { fromIran: boolean; whatsappConfigured: boolean; telegramLoginConfigured: boolean; smsAvailable: boolean }): PhoneWays {
  return {
    telegramLogin: o.telegramLoginConfigured,
    // The bot is the main way without Telegram's login, and the fallback with it
    telegramBot: true,
    whatsapp: o.whatsappConfigured && !o.fromIran,
    sms: o.smsAvailable,
  };
}
