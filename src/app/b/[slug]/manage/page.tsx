import Link from 'next/link';
import { Icon } from '../../../../components/icons';
import { Alert, Card, LinkButton, PageShell, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { messages } from '../../../../messages/fa';
import { listingPath } from '../../../../modules/listings/slug';
import { eventPath } from '../../../../modules/events/slug';
import { businessUsage } from '../../../../modules/organizations/limits';
import { managedListings } from '../../../../modules/organizations/queries';
import { memberOf } from '../member';

// The business's own view (members only): its plan and usage, its listings with simple stats, and
// links to the team, billing and the public page. Staff see only the listings they posted.

export const metadata = { title: messages.business.manage.title, robots: { index: false } };

export default async function ManageBusinessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string; saved?: string; joined?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, org, role } = await memberOf(slug, `/b/${slug}/manage`);
  const db = appDb();
  const t = messages.business;
  const [usage, rows] = await Promise.all([businessUsage(db, org.id), managedListings(db, org.id, role === 'staff' ? { onlyPostedBy: user.id } : {})]);
  const planName = (usage.plan.code && messages.pro.planNames[usage.plan.code]) || t.manage.free;

  return (
    <PageShell title={org.name} wide>
      <div className="space-y-5">
        {query.created && <Alert tone="success">{t.created}</Alert>}
        {query.saved && <Alert tone="success">{t.saved}</Alert>}
        {query.joined && <Alert tone="success">{t.invitation.accepted}</Alert>}

        <Card className="space-y-3">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              {t.manage.plan}: <Pill tone={usage.plan.code ? 'saffron' : 'neutral'}>{planName}</Pill>
            </span>
            <span className="text-sm text-neutral-600">{t.manage.usage(usage.active, usage.limit)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/new" className="px-3 py-2 text-xs">
              <Icon name="plus" className="size-4" />
              {t.manage.newListing}
            </LinkButton>
            <LinkButton href={`/b/${org.slug}`} variant="secondary" className="px-3 py-2 text-xs">
              {t.manage.publicPage}
            </LinkButton>
            {role === 'owner' && (
              <>
                <LinkButton href={`/b/${org.slug}/edit`} variant="secondary" className="px-3 py-2 text-xs">
                  {t.edit}
                </LinkButton>
                <LinkButton href={`/b/${org.slug}/team`} variant="secondary" className="px-3 py-2 text-xs">
                  {t.manage.team}
                </LinkButton>
                <LinkButton href={`/b/${org.slug}/billing`} variant="secondary" className="px-3 py-2 text-xs">
                  {t.manage.billing}
                </LinkButton>
              </>
            )}
            {!usage.plan.code && role === 'owner' && (
              <LinkButton href="/pro" variant="accent" className="px-3 py-2 text-xs">
                {t.manage.upgrade}
              </LinkButton>
            )}
          </div>
        </Card>

        <section>
          <h2 className="mb-1 font-extrabold">{t.manage.listings}</h2>
          <p className="mb-3 text-xs text-neutral-500">{t.manage.statsHint}</p>
          {rows.length === 0 && <p className="text-neutral-600">{t.manage.noListings}</p>}
          <ul className="divide-y divide-neutral-200">
            {rows.map((l) => (
              <li key={l.id} className="space-y-1.5 py-3">
                <p className="flex flex-wrap items-center gap-2">
                  {l.status === 'draft' ? (
                    <span className="font-bold">{l.title || messages.my.untitled}</span>
                  ) : (
                    <Link href={l.isEvent ? eventPath(l.title, l.publicToken) : listingPath(l.title, l.publicToken)} className="font-bold hover:underline">
                      {l.title}
                    </Link>
                  )}
                  <Pill tone={l.status === 'active' ? 'success' : 'neutral'}>{messages.status[l.status]}</Pill>
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                  <span>{t.manage.postedBy(l.postedBy)}</span>
                  <span>
                    {t.manage.views}: {l.views.toLocaleString('fa-IR')}
                  </span>
                  <span>
                    {t.manage.saves}: {l.saves.toLocaleString('fa-IR')}
                  </span>
                  <span>
                    {t.manage.chats}: {l.chats.toLocaleString('fa-IR')}
                  </span>
                  <span>
                    {t.manage.phone}: {l.phoneReveals.toLocaleString('fa-IR')}
                  </span>
                </p>
                <p className="flex flex-wrap gap-2">
                  {(role !== 'staff' || l.posterId === user.id) && (
                    <LinkButton href={l.isEvent ? `/my/events/${l.id}` : `/my/listings/${l.id}`} variant="secondary" className="px-3 py-1.5 text-xs">
                      {messages.my.edit}
                    </LinkButton>
                  )}
                  {l.status === 'active' && (
                    <LinkButton href={`/my/listings/${l.id}/promote`} variant="accent" className="px-3 py-1.5 text-xs">
                      {t.manage.promote}
                    </LinkButton>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
