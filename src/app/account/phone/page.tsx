import Link from 'next/link';
import { Alert, Card, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { maskPhone } from '../../../modules/users/phone-number';
import { requireSession, telegramLogin } from '../../../modules/users/server';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { TelegramLogin, TelegramVerify } from './telegram';
import { Icon } from '../../../components/icons';

export const metadata = { title: messages.phone.title, robots: { index: false } };

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ telegram?: string }> }) {
  const { user } = await requireSession('/account/phone');
  const [me] = await appDb()
    .select({ phone: users.phoneE164, method: users.phoneVerificationMethod })
    .from(users)
    .where(eq(users.id, user.id));
  const t = messages.phone;
  const login = telegramLogin() !== null;
  // The result of "Log in with Telegram" (./telegram/callback/route.ts)
  const result = (await searchParams).telegram;
  const resultText =
    result === undefined ? null : (t.loginResult as Record<string, string>)[result] ?? (t.failed as Record<string, string>)[result] ?? null;

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        {resultText && <Alert tone={result === 'ok' ? 'success' : 'error'}>{resultText}</Alert>}
        {me?.phone ? (
          <Alert tone="success">
            {t.verified('⁦' + maskPhone(me.phone) + '⁩', me.method === 'sms' ? t.methodSms : t.methodTelegram)}
          </Alert>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
            <Icon name="shield" className="mt-1 size-6 shrink-0 text-brand-700" />
            <p className="text-sm leading-7 text-neutral-800">
              <b className="block text-brand-900">{t.reasonTitle}</b>
              {t.reasonBody}
            </p>
          </div>
        )}

        {login ? (
          <>
            <Card>
              {me?.phone && <h2 className="mb-3 font-semibold">{t.change}</h2>}
              <TelegramLogin />
            </Card>
            <details className="rounded-2xl border border-neutral-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-brand-800">{t.botTitle}</summary>
              <p className="my-3 text-sm leading-relaxed text-neutral-600">{t.botIntro}</p>
              <TelegramVerify />
            </details>
          </>
        ) : (
          <Card>
            <h2 className="mb-2 font-semibold">{me?.phone ? t.change : t.telegramTitle}</h2>
            <p className="mb-4 text-sm leading-relaxed text-neutral-600">{t.telegramIntro}</p>
            <TelegramVerify />
          </Card>
        )}
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm leading-7 text-neutral-700">
          <b className="block text-neutral-900">{t.iranTipTitle}</b>
          {t.iranTipBody}
        </div>

        <Card>
          <h2 className="mb-2 font-semibold">{t.smsTitle}</h2>
          <Link href="/account/phone/sms" className="text-sm text-brand-800 underline">
            {t.smsLink}
          </Link>
        </Card>
        <p className="text-xs">
          <Link href="/privacy#s4-2" className="text-neutral-600 underline">
            {t.privacy}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
