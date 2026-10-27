import Link from 'next/link';
import { Icon } from '../../../../components/icons';
import { Alert, Button, Card, LinkButton, PageShell, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { messages } from '../../../../messages/fa';
import { listingPath } from '../../../../modules/listings/slug';
import { eventPath } from '../../../../modules/events/slug';
import { businessUsage } from '../../../../modules/organizations/limits';
import { managedListings } from '../../../../modules/organizations/queries';
import { memberOf } from '../member';
import { foundingState } from '../../../../modules/payments/founding';
import { activeSubscription } from '../../../../modules/payments/plans';
import { paymentGateway } from '../../../../modules/payments/server';
import { foundingAction } from '../../../business/actions';

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
  // A founding business's owner starts the free months right here (src/modules/payments/founding.ts)
  const founding = role === 'owner' && paymentGateway() && (await foundingState(db, org.id)) === 'offered' && !(await activeSubscription(db, org.id));

  return (
    <PageShell title={org.name} wide>
      <div className="space-y-5">
        {founding && (
          <form action={foundingAction} className="space-y-3 rounded-3xl border-2 border-brand-200 bg-brand-50 p-4 lg:p-5">
            <input type="hidden" name="organizationId" value={org.id} />
            <input type="hidden" name="slug" value={org.slug} />
            <p className="flex items-center gap-2 text-xs font-bold text-saffron-800">
              <Icon name="star" className="size-4" />
              {t.foundingBadge}
            </p>
            <h2 className="text-lg font-extrabold">{t.billing.founding.title}</h2>
            <p className="text-sm leading-7 text-neutral-700">{t.billing.founding.body}</p>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="business" required className="mt-0.5 size-4 shrink-0 accent-brand-700" />
              <span>{t.billing.businessTick}</span>
            </label>
            <Button type="submit" className="w-full sm:w-auto">
              {t.billing.founding.start}
            </Button>
          </form>
        )}
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
