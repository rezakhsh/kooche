import { Alert, Button, LinkButton, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { searchByUnsubscribeToken } from '../../../modules/search/saved';
import { unsubscribeAction } from './actions';

// "Turn this alert off" from an alert email, without signing in: the link's random token names
// one saved search. Opening the link changes nothing (mail scanners open links); the button does.
// Mail apps' own unsubscribe button posts to ./one-click (RFC 8058).

export const metadata = { title: messages.savedSearches.unsubscribeTitle, robots: { index: false } };

export default async function AlertsOffPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t: token = '', done } = await searchParams;
  const t = messages.savedSearches;
  const search = await searchByUnsubscribeToken(appDb(), token);
  return (
    <PageShell title={t.unsubscribeTitle}>
      <div className="space-y-4">
        {!search ? (
          <Alert tone="error">{t.unsubscribeInvalid}</Alert>
        ) : done ? (
          <Alert tone="success">{t.unsubscribed(search.name)}</Alert>
        ) : (
          <form action={unsubscribeAction} className="space-y-4">
            <input type="hidden" name="t" value={token} />
            <p>{t.unsubscribeAsk(search.name)}</p>
            <Button type="submit" className="w-full">
              {t.unsubscribeConfirm}
            </Button>
          </form>
        )}
        <LinkButton href="/my/searches" variant="secondary" className="w-full">
          {t.title}
        </LinkButton>
      </div>
    </PageShell>
  );
}
