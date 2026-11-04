import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppBar } from '../../../components/app-bar';
import { Icon } from '../../../components/icons';
import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { webEnv } from '../../../lib/env';
import { isIranRequest } from '../../../lib/region';
import { isMessagesOnlyNumber, maskPhone } from '../../../modules/users/phone-number';
import { phoneWays } from '../../../modules/users/phone-ways';
import { smsAvailable } from '../../../modules/users/sms';
import { requireSession, telegramLogin, whatsApp } from '../../../modules/users/server';
import { TelegramLogin, TelegramVerify } from './telegram';
import { WhatsAppButton, WhatsAppFlow, WhatsAppMark } from './whatsapp';

export const metadata = { title: messages.phone.title, robots: { index: false } };

// The phone check (wave 1, mockup final/verify-phone): the reason first, «تأیید با تلگرام» as the
// main way, the bot when Telegram's login doesn't work, the tip for Telegram on an Iranian number,
// and SMS for people without Telegram. WhatsApp, the mockup's second button, since Nov 3, 2026
// (mockup after-wave2/whatsapp-verify; ./whatsapp.tsx), when its settings are there.
// Iranian numbers (owner, Nov 4, 2026): +98 is accepted through Telegram only, for messages only.
// A line above the buttons says so to everyone (VPN users from Iran look like anyone else);
// requests from Iran get no WhatsApp (src/modules/users/phone-ways.ts); a verified +98 number shows
// what it is good for. A +98 number sent on WhatsApp comes back as ?whatsapp=iran. Telegram's
// login no longer refuses +98, so the old ?telegram=iran screen (mockup final/iran-phone) is gone.

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ telegram?: string; whatsapp?: string }> }) {
  const { user } = await requireSession('/account/phone');
  const [me] = await appDb()
    .select({ phone: users.phoneE164, method: users.phoneVerificationMethod })
    .from(users)
    .where(eq(users.id, user.id));
  const t = messages.phone;
  const ways = phoneWays({
    fromIran: isIranRequest(await headers()),
    whatsappConfigured: whatsApp() !== null,
    telegramLoginConfigured: telegramLogin() !== null,
    smsAvailable: smsAvailable(webEnv().SMS_PROVIDER),
  });
  const sms = ways.sms;
  const login = ways.telegramLogin;
  const wa = ways.whatsapp;
  const params = await searchParams;
  if (params.whatsapp === 'iran') return <IranOnWhatsApp />;
  // The result of "Log in with Telegram" (./telegram/callback/route.ts)
  const result = params.telegram;
  if (result === 'iran') redirect('/account/phone');
  const messagesOnly = isMessagesOnlyNumber(me?.phone);
  const resultText =
    result === undefined ? null : (t.loginResult as Record<string, string>)[result] ?? (t.failed as Record<string, string>)[result] ?? null;

  return (
    <>
      <AppBar title={me?.phone ? t.verifiedScreenTitle : t.screenTitle} back="/account/settings" backLabel={messages.account.back} />
      <Main withWhatsApp={wa}>
        {resultText && (
          <div className="mb-4">
            <Alert tone={result === 'ok' ? 'success' : 'error'}>{resultText}</Alert>
          </div>
        )}
        {me?.phone ? (
          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              {me.method === 'whatsapp' ? <WhatsAppMark className="size-4 text-[#13854a]" /> : <Icon name="shield" className="size-4 text-brand-700" />}
              {t.verifiedBy(me.method === 'sms' ? t.methodSms : me.method === 'whatsapp' ? t.methodWhatsapp : t.methodTelegram)}
            </p>
            <p dir="ltr" className="mt-2 text-end text-lg font-extrabold">
              {maskPhone(me.phone)}
            </p>
            {messagesOnly && (
              <p data-messages-only className="mt-3 rounded-xl bg-saffron-50 px-3 py-2.5 text-sm leading-7 text-saffron-800">
                {t.messagesOnlyNote}
              </p>
            )}
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

        {me?.phone && <h2 className="mt-6 text-base font-extrabold">{messagesOnly ? t.changeToLocal : t.change}</h2>}
        {/* For everyone, before the buttons: where an Iranian number goes and what it is good for */}
        <p data-iran-line className="mt-5 flex items-start gap-2 rounded-xl bg-saffron-50 px-3 py-2.5 text-sm leading-7 text-saffron-800">
          <Icon name="globe" className="mt-1.5 size-4 shrink-0" />
          <span>{t.iranLine}</span>
        </p>
        <div className="mt-4">{login ? <TelegramLogin /> : <TelegramVerify />}</div>
        {wa && <WhatsAppButton />}
        {login && (
          <details className="mt-4 rounded-2xl border border-neutral-200 p-4">
            <summary className="cursor-pointer text-sm font-bold text-brand-800">{t.botTitle}</summary>
            <p className="my-3 text-sm leading-7 text-neutral-600">{t.botIntro}</p>
            <TelegramVerify />
          </details>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 p-4 text-sm leading-7 text-neutral-700">
          <b className="block text-neutral-900">{wa ? t.iranTipBothTitle : t.iranTipTitle}</b>
          {wa ? t.iranTipBothBody : t.iranTipBody}
        </div>
        {sms ? (
          <Link href="/account/phone/sms" className="mt-3 flex h-11 items-center justify-center text-sm font-bold text-brand-800 hover:underline">
            {wa ? t.noneOfBoth : t.noneOfThem}
          </Link>
        ) : (
          // A way out for people without Telegram, as in the mockup's «هیچ‌کدام را ندارم» (design check, Oct 31, 2026)
          <div className="mt-3 text-center">
            <Link href="/help#phone" className="inline-flex h-11 items-center text-sm font-bold text-brand-800 hover:underline">
              {wa ? t.noneOfBoth : t.noneOfThem}
            </Link>
            <p className="text-xs leading-6 text-neutral-600">{wa ? t.noMessengerYet : t.noTelegramYet}</p>
          </div>
        )}
        <p className="mt-2 text-center text-xs">
          <Link href="/privacy#s4-2" className="text-neutral-600 underline">
            {wa ? t.privacyBoth : t.privacy}
          </Link>
        </p>
      </Main>
    </>
  );
}

/** The page's column; with WhatsApp on, its flow can take the place of the choices (./whatsapp.tsx) */
function Main({ withWhatsApp, children }: { withWhatsApp: boolean; children: ReactNode }) {
  if (withWhatsApp) return <WhatsAppFlow>{children}</WhatsAppFlow>;
  return <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">{children}</main>;
}

/** A +98 number sent on WhatsApp (mockup after-wave2/whatsapp-verify, screen 5): nothing was stored */
function IranOnWhatsApp() {
  const t = messages.phone.whatsapp.iranScreen;
  return (
    <>
      <AppBar title={t.title} back="/account/phone" backLabel={messages.account.back} />
      <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <WhatsAppMark className="size-4 text-[#13854a]" />
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
        <h2 className="mt-5 text-base font-extrabold">{t.whatTitle}</h2>
        <ul className="mt-2 space-y-2">
          {t.rows.map((r) => (
            <li key={r.title}>
              <Link href={r.href} className="block rounded-2xl border border-neutral-200 p-3 text-sm hover:bg-neutral-50">
                <b className="block">{r.title}</b>
                <span className="text-xs leading-6 text-neutral-600">{r.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
