// SMS fallback for phone verification. One interface, one adapter per provider. Recommended
// provider when it is needed: seven.io (Berlin, German DPA, pay as you go); GatewayAPI (Denmark)
// as the alternative. Neither is bought yet.

export type SmsResult = { provider: string; messageId: string | null };

export interface SmsProvider {
  readonly name: string;
  send(toE164: string, text: string): Promise<SmsResult>;
}

/** Development and staging: the message goes to the log, nothing is sent. */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  async send(toE164: string, text: string): Promise<SmsResult> {
    console.log(`sms: to ${toE164}: ${text}`);
    return { provider: this.name, messageId: null };
  }
}

export function smsProvider(name: 'log'): SmsProvider {
  switch (name) {
    case 'log':
      return new LogSmsProvider();
  }
}
