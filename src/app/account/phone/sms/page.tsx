import { Card, PageShell } from '../../../../components/ui';
import { messages } from '../../../../messages/fa';
import { requireSession } from '../../../../modules/users/server';
import { SmsVerify } from './form';

export const metadata = { title: messages.sms.title, robots: { index: false } };

export default async function SmsPage() {
  await requireSession('/account/phone/sms');
  return (
    <PageShell title={messages.sms.title}>
      <Card>
        <SmsVerify />
      </Card>
    </PageShell>
  );
}
