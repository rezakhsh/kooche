import { Alert, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { canPostListing, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { createBusinessAction } from '../actions';
import { BusinessForm } from '../business-form';

export const metadata = { title: messages.business.createTitle, robots: { index: false } };

export default async function NewBusinessPage() {
  const { user } = await requireSession('/business/new');
  const t = messages.business;
  const allowed = canPostListing(await loadActor(appDb(), user.id));
  return (
    <PageShell title={t.createTitle} wide>
      {!allowed.ok ? (
        <Alert tone="error">
          {t.phoneRequired}{' '}
          <a href="/account/phone" className="font-bold underline">
            {messages.account.phone}
          </a>
        </Alert>
      ) : (
        <BusinessForm action={createBusinessAction} initial={{}} slugLocked={false} submit={t.create} />
      )}
    </PageShell>
  );
}
