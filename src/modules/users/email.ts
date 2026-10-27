import { createTransport, type Transporter } from 'nodemailer';
import { messages } from '../../messages/fa';
import { rtlLine, rtlLines } from '../../lib/bidi';

// Login code emails through Amazon SES SMTP (eu-central-1, port 587 with STARTTLS). Sent directly from the web process,
// not through the outbox: the outbox would store the code in plain text.

export type LoginCodeMailer = (email: string, code: string) => Promise<void>;

type MailConfig = { smtpUrl?: string; from?: string };

let transport: Transporter | undefined;

export function smtpMailer({ smtpUrl, from }: MailConfig): LoginCodeMailer {
  if (!smtpUrl || !from) {
    // Development only (env.ts requires SMTP in production)
    return async (email, code) => {
      console.log(`email: login code for ${email}: ${code}`);
    };
  }
  transport ??= createTransport({
    url: smtpUrl,
    // SES on port 587 starts plain and upgrades with STARTTLS: refuse to send if it can't
    requireTLS: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return async (email, code) => {
    const t = messages.email.loginCode;
    await transport!.sendMail({
      from,
      to: email,
      subject: rtlLine(t.subject(code)),
      text: rtlLines(t.text(code)),
      html: loginCodeHtml(code),
    });
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function loginCodeHtml(code: string): string {
  const t = messages.email.loginCode;
  return `<!doctype html>
<html lang="fa" dir="rtl">
<body dir="rtl" style="margin:0;padding:24px;background:#f5f5f5;font-family:Tahoma,Arial,sans-serif;color:#171717">
<div dir="rtl" lang="fa" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;direction:rtl;text-align:right">
<p style="margin:0 0 16px;font-size:16px">${escapeHtml(t.intro)}</p>
<p dir="ltr" style="margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center">${escapeHtml(code)}</p>
<p style="margin:0 0 8px;font-size:14px;color:#525252">${escapeHtml(t.expiry)}</p>
<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(t.ignore)}</p>
</div>
</body>
</html>`;
}
