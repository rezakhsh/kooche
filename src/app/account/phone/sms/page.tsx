import { notFound } from 'next/navigation';
import { AppBar } from '../../../../components/app-bar';
import { webEnv } from '../../../../lib/env';
import { smsAvailable } from '../../../../modules/users/sms';
import { messages } from '../../../../messages/fa';
import { requireSession } from '../../../../modules/users/server';
import { SmsVerify } from './form';

export const metadata = { title: messages.sms.title, robots: { index: false } };

// SMS, for people without Telegram: the same bar as the phone check (wave 1)
export default async function SmsPage() {
  // Closed until an SMS provider is chosen (owner, Oct 30, 2026)
  if (!smsAvailable(webEnv().SMS_PROVIDER)) notFound();
  await requireSession('/account/phone/sms');
  return (
    <>
      <AppBar title={messages.sms.title} back="/account/phone" backLabel={messages.account.back} />
      <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <SmsVerify />
        </div>
      </main>
    </>
  );
}
