import { createTransport, type Transporter } from 'nodemailer';

// Notification emails from the worker, through the same Amazon SES SMTP as the login codes
// (docs/setup.md, "Email"). Without SMTP_URL (development) the message is printed instead.

export type Mail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };
export type Mailer = (mail: Mail) => Promise<void>;

let transport: Transporter | undefined;

export function notificationMailer({ smtpUrl, from }: { smtpUrl?: string; from?: string }): Mailer {
  if (!smtpUrl || !from) {
    return async (mail) => console.log(`email: to ${mail.to}: ${mail.subject}\n${mail.text}`);
  }
  transport ??= createTransport({
    url: smtpUrl,
    requireTLS: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return async (mail) => {
    await transport!.sendMail({ from, ...mail });
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The shared right-to-left frame of our emails */
export function emailHtml(body: string): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Tahoma,Arial,sans-serif;color:#171717">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;text-align:right">
${body}
</div>
</body>
</html>`;
}
