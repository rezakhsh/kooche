import Link from 'next/link';
import { Icon } from '../../components/icons';
import { LinkButton, PageShell, Pill } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { MAX_BUSINESSES_PER_USER, myBusinesses } from '../../modules/organizations/organizations';
import { requireSession } from '../../modules/users/server';

// «کسب‌وکار من»: the businesses the user belongs to, and creating one (roadmap step 6)

export const metadata = { title: messages.business.mine, robots: { index: false } };

export default async function MyBusinessesPage() {
  const { user } = await requireSession('/business');
  const list = await myBusinesses(appDb(), user.id);
  const t = messages.business;
  const owned = list.filter((b) => b.role === 'owner').length;
  return (
    <PageShell title={t.mine} wide>
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">{t.mineIntro}</p>
        {list.length === 0 && <p className="text-neutral-600">{t.none}</p>}
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/b/${b.slug}/manage`} className="flex items-center gap-3 px-4 py-4 hover:bg-neutral-50">
                <Icon name="store" className="size-5 text-brand-700" />
                <span className="min-w-0 flex-1 truncate font-bold">{b.name}</span>
                {b.verificationStatus === 'verified' && <Icon name="verified" className="size-4 text-brand-700" />}
                <Pill tone="neutral">{t.roles[b.role]}</Pill>
              </Link>
            </li>
          ))}
        </ul>
        {owned < MAX_BUSINESSES_PER_USER && (
          <LinkButton href="/business/new" className="w-full sm:w-auto">
            <Icon name="plus" className="size-4" />
            {t.create}
          </LinkButton>
        )}
        <p>
          <Link href="/pro" className="text-sm text-brand-800 hover:underline">
            {messages.pro.title}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
