// SMS fallback for phone verification. One interface, one adapter per provider. Recommended
// provider when it is needed: seven.io (Berlin, German DPA, pay as you go); GatewayAPI (Denmark)
// as the alternative. Neither is bought yet.

export type SmsResult = { provider: string; messageId: string | null };

export interface SmsProvider {
  readonly name: string;
  send(toE164: string, text: string): Promise<SmsResult>;
}

/**
 * Development: the message goes to the log, nothing is sent. Elsewhere the log keeps only the
 * number's last digits and never the code (code check, Oct 30, 2026).
 */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  async send(toE164: string, text: string): Promise<SmsResult> {
    if (process.env.NODE_ENV === 'development') console.log(`sms: to ${toE164}: ${text}`);
    else console.log(`sms: not sent (no provider) to …${toE164.slice(-2)}`);
    return { provider: this.name, messageId: null };
  }
}

/**
 * Whether people can verify by SMS: only with a real provider (development tries it with the
 * log). Until one is chosen the SMS option is hidden and its page closed (owner, Oct 30, 2026).
 */
export function smsAvailable(provider: string): boolean {
  return provider !== 'log' || process.env.NODE_ENV === 'development';
}

export function smsProvider(name: 'log'): SmsProvider {
  switch (name) {
    case 'log':
      return new LogSmsProvider();
  }
}
