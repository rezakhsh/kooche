import { AppBar } from '../../../../components/app-bar';
import { messages } from '../../../../messages/fa';
import { requireSession } from '../../../../modules/users/server';
import { SmsVerify } from './form';

export const metadata = { title: messages.sms.title, robots: { index: false } };

// SMS, for people without Telegram: the same bar as the phone check (wave 1)
export default async function SmsPage() {
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
