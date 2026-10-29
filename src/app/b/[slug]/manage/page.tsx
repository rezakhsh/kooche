import Link from 'next/link';
import { fromIran } from '../../../../components/iran';
import { Icon, type IconName } from '../../../../components/icons';
import { Alert, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { messages } from '../../../../messages/fa';
import { eventPath } from '../../../../modules/events/slug';
import { listingPath } from '../../../../modules/listings/slug';
import { imageUrl } from '../../../../modules/media/server';
import { validHours } from '../../../../modules/organizations/hours';
import { businessUsage } from '../../../../modules/organizations/limits';
import { legalComplete } from '../../../../modules/organizations/organizations';
import { cachedCatalog } from '../../../../modules/listings/catalog';
import { managedListings } from '../../../../modules/organizations/queries';
import { foundingPlaces, foundingState } from '../../../../modules/payments/founding';
import { activeSubscription } from '../../../../modules/payments/plans';
import { paymentGateway } from '../../../../modules/payments/server';
import { foundingAction, moveListingsAction } from '../../../business/actions';
import { movableListings } from '../../../../modules/organizations/move';
import { memberOf } from '../member';
import { VerifyForm } from './verify-form';

// The business's own dashboard (members only; wave 1, mockup final/business-dashboard): the
// founding offer where it was given, as steps (verified, place kept, start), with the real places
// left; for a new business the steps to a complete page instead (logo, contact and hours, legal
// details, first listing). Then the plan and the shortcuts, and its listings with simple stats.
// Staff see only the listings they posted.

export const metadata = { title: messages.business.manage.title, robots: { index: false } };

/** The checklist's bar without a style attribute (the CSP allows no inline styles) */
const PROGRESS = ['w-0', 'w-1/4', 'w-1/2', 'w-3/4', 'w-full'];

function Step({ done, title, sub }: { done: boolean; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand-700 text-white' : 'border-2 border-neutral-300 bg-white'}`}>{done && <Icon name="check" className="size-3.5" />}</span>
      <span>
        <b className="block text-sm">{title}</b>
        <span className="text-xs text-neutral-600">{sub}</span>
      </span>
    </li>
  );
}

export default async function ManageBusinessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string; saved?: string; joined?: string; moved?: string; left?: string; why?: string; verify?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, org, role, cityFa, neighbourhood } = await memberOf(slug, `/b/${slug}/manage`);
  const db = appDb();
  const t = messages.business;
  const d = t.dashboard;
  const [usage, rows, catalog, movable] = await Promise.all([
    businessUsage(db, org.id),
    managedListings(db, org.id, role === 'staff' ? { onlyPostedBy: user.id } : {}),
    cachedCatalog(db),
    movableListings(db, user.id),
  ]);
  const moved = query.moved ? Number(query.moved) : null;
  const left = Number(query.left ?? 0);
  const planName = (usage.plan.code && messages.pro.planNames[usage.plan.code]) || t.manage.free;
  // A founding business's owner starts the free months right here (src/modules/payments/founding.ts)
  // Not from Iran: paying (a Stripe checkout, even a free one) isn't possible there (src/lib/region.ts)
  const founding = role === 'owner' && paymentGateway() && !(await fromIran()) && (await foundingState(db, org.id)) === 'offered' && !(await activeSubscription(db, org.id));
  const places = founding ? await foundingPlaces(db, org.id) : null;
  const legal = legalComplete(org);
  const logo = org.logoKey ? imageUrl(org.logoKey, 'thumb', 'webp') : null;

  // The steps to a complete page, until all are done
  const checklist = [
    { key: 'logo', done: !!org.logoKey },
    { key: 'contact', done: !!(org.phoneE164 || org.email) && validHours(org.openingHours) },
    { key: 'legal', done: legal },
    { key: 'listing', done: rows.length > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const showChecklist = role !== 'staff' && !founding && doneCount < checklist.length;

  const tiles: { icon: IconName; label: string; href: string; owner?: boolean }[] = [
    { icon: 'plus', label: d.tiles.newListing, href: '/new' },
    { icon: 'calendar', label: d.tiles.newEvent, href: '/events/new' },
    { icon: 'store', label: d.tiles.page, href: `/b/${org.slug}` },
    { icon: 'gear', label: d.tiles.edit, href: `/b/${org.slug}/edit`, owner: true },
    { icon: 'people', label: d.tiles.team, href: `/b/${org.slug}/team`, owner: true },
    { icon: 'card', label: d.tiles.billing, href: `/b/${org.slug}/billing`, owner: true },
  ];

  return (
    <main data-soft-page className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-lg font-black text-brand-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="size-full object-cover" /> : org.name.trim().charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 truncate text-xl font-extrabold">
            <bdi className="truncate">{org.name}</bdi>
            {org.verificationStatus === 'verified' && <Icon name="verified" className="size-5 shrink-0 text-brand-700" />}
          </h1>
          <p className="text-sm text-neutral-600">{d.subtitle([neighbourhood, cityFa].filter(Boolean).join('، '))}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 empty:hidden">
        {query.created && <Alert tone="success">{t.created}</Alert>}
        {query.saved && <Alert tone="success">{t.saved}</Alert>}
        {query.joined && <Alert tone="success">{t.invitation.accepted}</Alert>}
      </div>

      {founding && (
        <form action={foundingAction} className="mt-5 rounded-3xl border-2 border-saffron-300 bg-saffron-50 p-4 lg:p-5">
          <input type="hidden" name="organizationId" value={org.id} />
          <input type="hidden" name="slug" value={org.slug} />
          <p className="flex items-center gap-2 text-xs font-bold text-saffron-800">
            <Icon name="star" className="size-4" />
            {d.foundingKicker(places?.city ?? cityFa ?? '')}
          </p>
          <h2 className="mt-1 text-lg font-extrabold">{d.foundingTitle}</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
              <i className="block h-full w-2/3 rounded-full bg-saffron-500" />
            </span>
            <b className="text-sm">{d.checklistDone(2, 3)}</b>
          </div>
          <ol className="mt-4 space-y-3">
            {(['verified', 'offered', 'start'] as const).map((k) => (
              <Step key={k} done={k !== 'start'} title={d.foundingSteps[k]![0]} sub={d.foundingSteps[k]![1]} />
            ))}
          </ol>
          {places && (
            <p className="mt-4 text-xs leading-6 text-saffron-800">
              {d.foundingNote(Math.max(0, places.places - places.used), places.places)}{' '}
              <Link href="/pro" className="font-bold underline">
                {d.terms}
              </Link>
            </p>
          )}
          <label className="mt-4 flex gap-2 text-sm">
            <input type="checkbox" name="business" required className="mt-0.5 size-4 shrink-0 accent-brand-700" />
            <span>{t.billing.businessTick}</span>
          </label>
          {!legal && (
            <p className="mt-3 text-sm text-red-700">
              {t.billing.errors.legal_missing}{' '}
              <Link href={`/b/${org.slug}/edit`} className="font-bold underline">
                {t.wizard.legalHeading}
              </Link>
            </p>
          )}
          <button type="submit" disabled={!legal} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            <Icon name="sparkle" className="size-5" />
            {t.billing.founding.start}
          </button>
        </form>
      )}

      {showChecklist && (
        <section className="mt-5 rounded-3xl border-2 border-brand-200 bg-brand-50 p-4 lg:p-5">
          <h2 className="text-lg font-extrabold">{d.checklistTitle}</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
              <i className={`block h-full rounded-full bg-brand-600 ${PROGRESS[doneCount]}`} />
            </span>
            <b className="text-sm">{d.checklistDone(doneCount, checklist.length)}</b>
          </div>
          <ol className="mt-4 space-y-3">
            {checklist.map((c) => {
              const [title, sub] = d.checklist[c.key]!;
              const href = c.key === 'listing' ? '/new' : role === 'owner' ? `/b/${org.slug}/edit` : null;
              return (
                <li key={c.key}>
                  {href && !c.done ? (
                    <Link href={href} className="flex items-center gap-3 rounded-xl hover:bg-white/60">
                      <span className="min-w-0 flex-1">
                        <ol>
                          <Step done={c.done} title={title} sub={sub} />
                        </ol>
                      </span>
                      <Icon name="chevronEnd" className="size-4 shrink-0 text-neutral-400" />
                    </Link>
                  ) : (
                    <ol>
                      <Step done={c.done} title={title} sub={sub} />
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Verification (wave 2 part 4, src/modules/organizations/verification.ts): one document, then staff decide */}
      {query.verify && (
        <div className="mt-4">
          <Alert tone={query.verify === 'sent' ? 'success' : 'error'}>{t.verification.result[query.verify] ?? t.verification.result.bad_file}</Alert>
        </div>
      )}
      {role === 'owner' && legal && org.verificationStatus !== 'verified' && (
        <section className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Icon name="verified" className="size-5 text-brand-700" />
            {t.verification.title}
          </h2>
          {org.verificationStatus === 'pending' ? (
            <p className="mt-1 text-sm leading-7 text-neutral-700">{t.verification.pending}</p>
          ) : (
            <>
              <p className="mt-1 text-sm leading-7 text-neutral-700">{t.verification.intro}</p>
              {org.verificationStatus === 'rejected' && <p className="mt-1 text-sm leading-7 text-saffron-800">{t.verification.rejected}</p>}
              <VerifyForm organizationId={org.id} slug={org.slug} />
            </>
          )}
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold">
            {t.manage.plan}: <Pill tone={usage.plan.code ? 'saffron' : 'neutral'}>{planName}</Pill>
          </span>
          <span className="text-sm text-neutral-600">{t.manage.usage(usage.active, usage.limit)}</span>
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tiles
            .filter((x) => !x.owner || role === 'owner')
            .map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-neutral-200 px-1 text-center text-xs font-bold text-neutral-800 hover:bg-neutral-50">
                  <Icon name={x.icon} className="size-5 text-brand-700" />
                  {x.label}
                </Link>
              </li>
            ))}
        </ul>
        {!usage.plan.code && role === 'owner' && (
          <Link href="/pro" className="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-saffron-50 text-sm font-bold text-saffron-800 hover:bg-saffron-100">
            <Icon name="sparkle" className="size-4" />
            {t.manage.upgrade}
          </Link>
        )}
      </section>

      <h2 className="mt-7 mb-1 text-base font-extrabold">{t.manage.listings}</h2>
      <p className="mb-2 text-xs text-neutral-500">{t.manage.statsHint}</p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">{t.manage.noListings}</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {rows.map((l) => {
            const editable = role !== 'staff' || l.posterId === user.id;
            const edit = l.isEvent ? `/my/events/${l.id}` : `/my/listings/${l.id}`;
            const view = l.status === 'draft' ? null : l.isEvent ? eventPath(l.title, l.publicToken) : listingPath(l.title, l.publicToken);
            return (
              <li key={l.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 px-0.5 text-center text-[11px] leading-4 font-black text-brand-800">
                  {(l.categoryId && <span className="line-clamp-2">{catalog.byId.get(l.categoryId)?.nameFa.split(' ')[0]}</span>) || <Icon name={l.isEvent ? 'calendar' : 'doc'} className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  {view ? (
                    <Link href={view} className="block truncate text-sm font-bold hover:underline">
                      {l.title}
                    </Link>
                  ) : (
                    <b className="block truncate text-sm">{l.title || messages.my.untitled}</b>
                  )}
                  <span className="block text-xs text-neutral-600">{d.rowStats(messages.status[l.status], l.views, l.chats)}</span>
                  <span className="block text-xs text-neutral-500">{t.manage.postedBy(l.postedBy)}</span>
                </span>
                {l.status === 'active' && (
                  <Link href={`/my/listings/${l.id}/promote`} className="hidden h-9 items-center rounded-lg bg-saffron-50 px-3 text-xs font-bold text-saffron-800 hover:bg-saffron-100 sm:flex">
                    {t.manage.promote}
                  </Link>
                )}
                {editable && (
                  <Link href={edit} aria-label={messages.my.edit} title={messages.my.edit} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50">
                    <Icon name="chevronEnd" className="size-4" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Moving one's own private listings here (wave 2 part 4, src/modules/organizations/move.ts) */}
      {moved !== null && (
        <div className="mt-4">
          <Alert tone={left ? 'info' : 'success'}>
            {t.move.done(moved)}
            {left > 0 && ` ${query.why === 'legal_missing' ? t.move.leftLegal(left) : t.move.leftLimit(left)}`}
          </Alert>
        </div>
      )}
      {movable.length > 0 && (
        <details className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-bold">
            <Icon name="archive" className="size-5 text-brand-700" />
            {t.move.title(movable.length)}
          </summary>
          <p className="mt-1 text-xs leading-6 text-neutral-600">{t.move.intro(org.name)}</p>
          <form action={moveListingsAction} className="mt-3 space-y-3">
            <input type="hidden" name="organizationId" value={org.id} />
            <input type="hidden" name="slug" value={org.slug} />
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {movable.map((l) => (
                <li key={l.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                    <input type="checkbox" name="listingId" value={l.id} className="size-5 accent-brand-700" />
                    <span className="min-w-0 flex-1 truncate text-sm">{l.title || messages.my.untitled}</span>
                    <span className="shrink-0 text-xs text-neutral-600">{messages.status[l.status]}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="submit" className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800 sm:w-auto">
              {t.move.button}
            </button>
          </form>
        </details>
      )}
    </main>
  );
}
