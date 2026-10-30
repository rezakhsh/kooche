import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { AppBar } from '../../../components/app-bar';
import { Icon, type IconName } from '../../../components/icons';
import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { webEnv } from '../../../lib/env';
import { maskPhone } from '../../../modules/users/phone-number';
import { smsAvailable } from '../../../modules/users/sms';
import { requireSession, telegramLogin } from '../../../modules/users/server';
import { TelegramLogin, TelegramVerify } from './telegram';

export const metadata = { title: messages.phone.title, robots: { index: false } };

// The phone check (wave 1, mockup final/verify-phone): the reason first, «تأیید با تلگرام» as the
// main way, the bot when Telegram's login doesn't work, the tip for Telegram on an Iranian number,
// and SMS for people without Telegram. WhatsApp (the mockup's second button) is postponed. A +98
// number shared through Telegram's login comes back here as ?telegram=iran and gets its own
// screen (mockup final/iran-phone).

const ICONS: IconName[] = ['phone', 'heart', 'chat'];

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ telegram?: string }> }) {
  const { user } = await requireSession('/account/phone');
  const [me] = await appDb()
    .select({ phone: users.phoneE164, method: users.phoneVerificationMethod })
    .from(users)
    .where(eq(users.id, user.id));
  const t = messages.phone;
  const sms = smsAvailable(webEnv().SMS_PROVIDER);
  const login = telegramLogin() !== null;
  // The result of "Log in with Telegram" (./telegram/callback/route.ts)
  const result = (await searchParams).telegram;
  if (result === 'iran') return <IranNumber login={login} />;
  const resultText =
    result === undefined ? null : (t.loginResult as Record<string, string>)[result] ?? (t.failed as Record<string, string>)[result] ?? null;

  return (
    <>
      <AppBar title={me?.phone ? t.verifiedScreenTitle : t.screenTitle} back="/account/settings" backLabel={messages.account.back} />
      <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
        {resultText && (
          <div className="mb-4">
            <Alert tone={result === 'ok' ? 'success' : 'error'}>{resultText}</Alert>
          </div>
        )}
        {me?.phone ? (
          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <Icon name="shield" className="size-4 text-brand-700" />
              {t.verifiedBy(me.method === 'sms' ? t.methodSms : t.methodTelegram)}
            </p>
            <p dir="ltr" className="mt-2 text-end text-lg font-extrabold">
              {maskPhone(me.phone)}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">
              <Icon name="shield" className="size-6" />
            </span>
            <p className="text-sm leading-7 text-neutral-800">
              <b className="block text-brand-800">{t.reasonTitle}</b>
              {t.reasonBody}
            </p>
          </div>
        )}

        {me?.phone && <h2 className="mt-6 text-base font-extrabold">{t.change}</h2>}
        <div className="mt-5">{login ? <TelegramLogin /> : <TelegramVerify />}</div>
        {login && (
          <details className="mt-4 rounded-2xl border border-neutral-200 p-4">
            <summary className="cursor-pointer text-sm font-bold text-brand-800">{t.botTitle}</summary>
            <p className="my-3 text-sm leading-7 text-neutral-600">{t.botIntro}</p>
            <TelegramVerify />
          </details>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 p-4 text-sm leading-7 text-neutral-700">
          <b className="block text-neutral-900">{t.iranTipTitle}</b>
          {t.iranTipBody}
        </div>
        {sms ? (
          <Link href="/account/phone/sms" className="mt-3 flex h-11 items-center justify-center text-sm font-bold text-brand-800 hover:underline">
            {t.noneOfThem}
          </Link>
        ) : (
          <p className="mt-4 text-center text-sm leading-7 text-neutral-600">
            {t.noTelegramYet}{' '}
            <Link href="/contact" className="font-bold text-brand-800 underline">
              {t.contactUs}
            </Link>
          </p>
        )}
        <p className="mt-2 text-center text-xs">
          <Link href="/privacy#s4-2" className="text-neutral-600 underline">
            {t.privacy}
          </Link>
        </p>
      </main>
    </>
  );
}

/** A +98 number from Telegram's login: why it isn't accepted and what to do instead */
function IranNumber({ login }: { login: boolean }) {
  const t = messages.phone.iranScreen;
  const sms = smsAvailable(webEnv().SMS_PROVIDER);
  return (
    <>
      <AppBar title={t.title} back="/account/settings" backLabel={messages.account.back} />
      <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <Icon name="send" className="size-4 text-brand-700" />
            {t.sent}
          </p>
          <p dir="ltr" className="mt-2 text-end text-lg font-extrabold">
            +98 ••• ••• ••••
          </p>
        </div>
        <section className="mt-4 rounded-2xl bg-saffron-50 p-4">
          <h1 className="flex items-center gap-2 text-base font-extrabold text-saffron-800">
            <Icon name="ban" className="size-5" />
            {t.heading}
          </h1>
          <p className="mt-2 text-sm leading-7 text-neutral-800">{t.body}</p>
        </section>
        <h2 className="mt-6 text-base font-extrabold">{t.whatTitle}</h2>
        <ul className="mt-3 space-y-2">
          {t.rows.map((r, i) => (
            <li key={r.title}>
              <Link href={r.href} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:bg-neutral-50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon name={ICONS[i]!} className="size-5" />
                </span>
                <span className="flex-1">
                  <b className="block text-sm">{r.title}</b>
                  <span className="text-xs leading-6 text-neutral-600">{r.body}</span>
                </span>
                <Icon name="chevronEnd" className="size-4 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6">{login ? <TelegramLogin label={t.retry} hint={false} /> : <TelegramVerify />}</div>
        {sms && (
          <Link href="/account/phone/sms" className="mt-2 flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-bold text-neutral-800 hover:bg-neutral-50">
            {messages.phone.smsLink}
          </Link>
        )}
      </main>
    </>
  );
}
