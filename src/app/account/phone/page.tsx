import Link from 'next/link';
import { Alert, Card, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { maskPhone } from '../../../modules/users/phone-number';
import { requireSession } from '../../../modules/users/server';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { TelegramVerify } from './telegram';

export const metadata = { title: messages.phone.title, robots: { index: false } };

export default async function PhonePage() {
  const { user } = await requireSession('/account/phone');
  const [me] = await appDb()
    .select({ phone: users.phoneE164, method: users.phoneVerificationMethod })
    .from(users)
    .where(eq(users.id, user.id));
  const t = messages.phone;

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        {me?.phone ? (
          <Alert tone="success">
            {t.verified(
              '⁦' + maskPhone(me.phone) + '⁩',
              me.method === 'sms' ? t.methodSms : t.methodTelegram,
            )}
          </Alert>
        ) : (
          <p className="text-sm leading-relaxed text-neutral-600">{t.why}</p>
        )}

        <Card>
          <h2 className="mb-2 font-semibold">{me?.phone ? t.change : t.telegramTitle}</h2>
          <p className="mb-4 text-sm leading-relaxed text-neutral-600">{t.telegramIntro}</p>
          <TelegramVerify />
        </Card>

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
