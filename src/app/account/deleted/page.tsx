import { LinkButton, PageShell } from '../../../components/ui';
import { messages } from '../../../messages/fa';

export const metadata = { title: messages.account.deleted.title, robots: { index: false } };

// Shown after "delete my account"; needs no session

export default function AccountDeletedPage() {
  const t = messages.account.deleted;
  return (
    <PageShell title={t.title}>
      <div className="space-y-5">
        <p className="leading-relaxed text-neutral-700">{t.body}</p>
        <LinkButton href="/?choose" variant="secondary" className="w-full">
          {t.home}
        </LinkButton>
      </div>
    </PageShell>
  );
}
