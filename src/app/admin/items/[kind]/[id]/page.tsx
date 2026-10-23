import { inArray, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Alert, Pill } from '../../../../../components/ui';
import { appDb } from '../../../../../db/drizzle';
import { userSanctions } from '../../../../../db/schema';
import { webEnv } from '../../../../../lib/env';
import { admin, faDigits } from '../../../../../messages/fa';
import { staffAudit } from '../../../../../modules/admin/audit';
import { businessForReview, decisionsOn, duplicateOf, listingForReview, messageInContext, personHistory, reportsOn, type DecisionRow } from '../../../../../modules/admin/items';
import { HELD_RESUBMISSIONS } from '../../../../../modules/admin/queue';
import { requireStaff } from '../../../../../modules/admin/server';
import { can } from '../../../../../modules/admin/access';
import { eventPath } from '../../../../../modules/events/slug';
import { ancestry, cachedCatalog } from '../../../../../modules/listings/catalog';
import { formatPrice } from '../../../../../modules/listings/price';
import { listingPath } from '../../../../../modules/listings/slug';
import { AdminTitle, Ago, Facts, Panel, StatusPill, When } from '../../../ui';
import { DecisionForm, type OpChoice } from '../../decision-form';
import { allowedOps, DecisionsList, Guide, op, PersonCard, Photos, reasonChoices, ReportsList } from '../../parts';

// One thing in the queue, in context, with the decision form (roadmap step 8): a listing or
// event, a user, a business or a chat message.

type Params = { kind: string; id: string };

const RESTRICTED = new Set(['remove', 'reject', 'warn', 'sanction', 'hide']);

/** "Grant the appeal" and "keep the decision" for each open appeal among these decisions */
async function appealOps(rows: DecisionRow[]): Promise<{ ops: OpChoice[]; sanctionTypes: Record<string, string> }> {
  const open = rows.filter((d) => d.appealId && d.appealStatus === 'open' && RESTRICTED.has(d.decision));
  const sanctions = open.length
    ? await appDb().select({ id: userSanctions.id, type: userSanctions.type, decisionId: userSanctions.moderationDecisionId }).from(userSanctions).where(inArray(userSanctions.moderationDecisionId, open.map((d) => d.id)))
    : [];
  const ops: OpChoice[] = [];
  for (const d of open) {
    const label = (o: string) => `${admin.decide.ops.grant}: ${o}`;
    if (d.decision === 'remove' || d.decision === 'reject') ops.push(op('restore', { appealId: d.appealId!, label: label(admin.decide.ops.restore!) }));
    else if (d.decision === 'hide') ops.push(op('unhide_message', { appealId: d.appealId!, label: label(admin.decide.ops.unhide_message!) }));
    else {
      const s = sanctions.find((x) => x.decisionId === d.id);
      if (s) ops.push(op('lift_sanction', { appealId: d.appealId!, sanctionId: s.id, label: label(admin.decide.ops.lift_sanction!) }));
    }
    ops.push(op('keep', { appealId: d.appealId! }));
  }
  return { ops, sanctionTypes: Object.fromEntries(sanctions.map((s) => [s.id, s.type])) };
}

export default async function ItemPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff('queue.view');
  const { kind, id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id) || !['listing', 'user', 'business', 'message'].includes(kind)) notFound();
  const db = appDb();
  const env = webEnv();
  const t = admin.item;
  const contact = can(staff.role, 'user.contact');
  const done = sp.done ? <div className="mb-4"><Alert tone="success">{admin.queue.done}</Alert></div> : null;
  const formProps = { reasons: reasonChoices(), timeZone: env.APP_TIME_ZONE };

  if (kind === 'listing') {
    const data = await listingForReview(db, id);
    if (!data) notFound();
    const l = data.listing;
    const [reportRows, decisionRows, seller, catalog, held] = await Promise.all([
      reportsOn(db, { listingId: id }),
      decisionsOn(db, { listingId: id }),
      personHistory(db, l.userId),
      cachedCatalog(db),
      db.execute(sql`SELECT 1 FROM (${HELD_RESUBMISSIONS}) h WHERE h.id = ${id}`),
    ]);
    const escalation = decisionRows.find((d) => d.decision === 'escalate');
    const dup = escalation ? await duplicateOf(db, escalation.aiOutput) : null;
    const appeals = await appealOps(decisionRows);
    const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
    const up = ['active', 'paused', 'sold', 'expired'].includes(l.status);
    const resubmission = l.status === 'pending_review';
    const ops: OpChoice[] = [
      ...(up ? [op('take_down'), op('no_violation')] : []),
      ...(resubmission ? [op('restore', { label: admin.decide.ops.restore }), op('take_down', { label: admin.decide.ops.reject })] : []),
      ...(l.status === 'rejected' && appeals.ops.length === 0 ? [op('restore')] : []),
      ...appeals.ops,
      ...(up && reportRows.length === 0 && !escalation ? [op('approve', { label: admin.decide.ok })] : []),
      ...(['warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned'] as const).map((o) => op(o)),
    ];
    const path = data.isEvent ? eventPath(l.title, l.publicToken) : listingPath(l.title, l.publicToken);
    return (
      <>
        <AdminTitle title={`${t.kinds[data.isEvent ? 'event' : 'listing']}: ${l.title || admin.common.none}`}>
          <a href={path} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-800 hover:underline">
            {admin.common.viewOnSite}
          </a>
        </AdminTitle>
        {done}
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-5">
            <Panel>
              <Facts
                rows={[
                  [t.status, <span key="s" className="inline-flex gap-1">{<StatusPill status={l.status} />}{held.length > 0 && <Pill tone="saffron">{admin.queue.tags.resubmitted}</Pill>}</span>],
                  [t.code, faDigits(String(l.refNumber))],
                  [t.category, l.categoryId ? ancestry(catalog, l.categoryId).map((c) => c.nameFa).join(' › ') : null],
                  [t.place, [l.postalCode, l.placeName, data.city, l.district].filter(Boolean).join('، ') || null],
                  [t.price, l.priceMinor !== null && currency ? formatPrice(l.priceMinor, currency.code, currency.minorUnit) : null],
                  [t.published, l.publishedAt ? <When key="p" date={l.publishedAt} /> : null],
                ]}
              />
            </Panel>
            <Panel title={t.photos}>
              <Photos keys={data.images.map((i) => i.key)} />
            </Panel>
            {l.description && (
              <Panel title={t.description}>
                <p className="leading-loose whitespace-pre-line" dir="auto">{l.description}</p>
              </Panel>
            )}
            {dup && (
              <Panel title={t.duplicate} className="border-saffron-300">
                <p className="mb-2 text-sm">
                  {t.otherListing}: <bdi dir="auto">{dup.title}</bdi> · <bdi>{dup.seller}</bdi> <StatusPill status={dup.status} />{' '}
                  {typeof (escalation?.aiOutput as { detail?: { distance?: number } })?.detail?.distance === 'number' && t.distance((escalation!.aiOutput as { detail: { distance: number } }).detail.distance)}
                </p>
                <Photos keys={dup.images} />
              </Panel>
            )}
            <Panel title={`${t.reports} (${faDigits(String(reportRows.length))})`}>
              <ReportsList rows={reportRows} showContact={contact} />
            </Panel>
            <Panel title={t.decisions}>
              <DecisionsList rows={decisionRows} />
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel title={admin.decide.title}>
              <DecisionForm
                kind="listing"
                id={l.id}
                userId={l.userId}
                ops={allowedOps(staff.role, ops, appeals.sanctionTypes)}
                subject={{ title: l.title, isEvent: data.isEvent, resubmission, name: '' }}
                onReport={reportRows.some((r) => r.status === 'open' || r.status === 'in_review')}
                {...formProps}
              />
            </Panel>
            <Guide />
            {seller && <PersonCard p={seller} title={t.seller} contact={false} />}
          </div>
        </div>
      </>
    );
  }

  if (kind === 'user') {
    const p = await personHistory(db, id);
    if (!p) notFound();
    const [reportRows, decisionRows] = await Promise.all([reportsOn(db, { userId: id }), decisionsOn(db, { userId: id })]);
    const appeals = await appealOps(decisionRows);
    const active = p.sanctions.filter((s) => s.active);
    const ops: OpChoice[] = [
      ...(reportRows.some((r) => r.status === 'open') ? [op('no_violation')] : []),
      ...appeals.ops,
      ...(['warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned'] as const).map((o) => op(o)),
      ...active.map((s) => op('lift_sanction', { sanctionId: s.id, label: `${admin.decide.ops.lift_sanction}: ${admin.decide.ops[s.type]}` })),
    ];
    const sanctionTypes = { ...appeals.sanctionTypes, ...Object.fromEntries(active.map((s) => [s.id, s.type])) };
    return (
      <>
        <AdminTitle title={`${t.kinds.user}: ${p.name}`} />
        {done}
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-5">
            <PersonCard p={p} title={t.person.title} contact={false} />
            <Panel title={`${t.reports} (${faDigits(String(reportRows.length))})`}>
              <ReportsList rows={reportRows} showContact={contact} />
            </Panel>
            <Panel title={t.decisions}>
              <DecisionsList rows={decisionRows} />
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel title={admin.decide.title}>
              <DecisionForm kind="user" id={id} userId={id} ops={allowedOps(staff.role, ops, sanctionTypes)} subject={{ title: '', isEvent: false, resubmission: false, name: '' }} onReport={reportRows.some((r) => r.status === 'open')} {...formProps} />
            </Panel>
            <Guide />
          </div>
        </div>
      </>
    );
  }

  if (kind === 'business') {
    const b = await businessForReview(db, id);
    if (!b) notFound();
    const [reportRows, decisionRows] = await Promise.all([reportsOn(db, { organizationId: id }), decisionsOn(db, { organizationId: id })]);
    const appeals = await appealOps(decisionRows);
    const ops: OpChoice[] = [
      ...(reportRows.some((r) => r.status === 'open') ? [op('no_violation')] : []),
      ...(b.org.status === 'active' ? [op('suspend_business')] : []),
      ...(b.org.status === 'suspended' ? [op('lift_business')] : []),
      ...appeals.ops.filter((o) => o.op === 'keep'),
    ];
    return (
      <>
        <AdminTitle title={`${t.kinds.business}: ${b.org.name}`}>
          <a href={`/b/${b.org.slug}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-800 hover:underline">
            {admin.common.viewOnSite}
          </a>
        </AdminTitle>
        {done}
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-5">
            <Panel>
              <Facts
                rows={[
                  [t.status, <StatusPill key="s" status={b.org.status} />],
                  [t.verification, admin.status[b.org.verificationStatus] ?? b.org.verificationStatus],
                  [t.person.listings, faDigits(String(b.liveListings))],
                  [t.members, b.members.map((m) => `${m.name} (${m.role})`).join('، ')],
                  [t.person.since, <Ago key="c" date={b.org.createdAt} />],
                ]}
              />
            </Panel>
            <Panel title={`${t.reports} (${faDigits(String(reportRows.length))})`}>
              <ReportsList rows={reportRows} showContact={contact} />
            </Panel>
            <Panel title={t.decisions}>
              <DecisionsList rows={decisionRows} />
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel title={admin.decide.title}>
              <DecisionForm kind="business" id={id} userId={null} ops={allowedOps(staff.role, ops)} subject={{ title: '', isEvent: false, resubmission: false, name: b.org.name }} onReport={reportRows.some((r) => r.status === 'open')} {...formProps} />
            </Panel>
            <Guide />
          </div>
        </div>
      </>
    );
  }

  // A chat message, with a few messages around it (written to audit_log)
  const m = await messageInContext(db, id);
  if (!m) notFound();
  await db.transaction((tx) => staffAudit(tx, staff.ctx, 'staff.chat_viewed', { type: 'message', id }, { conversationId: m.conversation.id }));
  const [reportRows, decisionRows, sender] = await Promise.all([reportsOn(db, { messageId: id }), decisionsOn(db, { messageId: id }), m.senderId ? personHistory(db, m.senderId) : null]);
  const appeals = await appealOps(decisionRows);
  const reported = m.messages.find((x) => x.reported);
  const ops: OpChoice[] = [
    ...(reported && !reported.hidden_at ? [op('hide_message'), op('no_violation')] : []),
    ...(reported?.hidden_at && appeals.ops.length === 0 ? [op('unhide_message')] : []),
    ...appeals.ops,
    ...(m.senderId ? (['warning', 'messaging_restricted', 'suspended', 'banned'] as const).map((o) => op(o)) : []),
  ];
  return (
    <>
      <AdminTitle title={`${t.kinds.message}: ${t.conversationAbout(m.conversation.title)}`} intro={t.chatNote} />
      {done}
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-5">
          <Panel title={t.chat}>
            <ol className="space-y-2">
              {m.messages.map((x) => (
                <li key={x.id} className={`rounded-xl p-3 text-sm ${x.reported ? 'border-2 border-red-300 bg-red-50/50' : 'bg-neutral-50'}`}>
                  <p className="mb-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                    <bdi className="font-bold">{x.sender_user_id ? (m.names[x.sender_user_id] ?? '') : '—'}</bdi>
                    <When date={x.created_at} />
                    {x.reported && <Pill tone="danger">{t.reported}</Pill>}
                    {x.hidden_at && <Pill tone="neutral">{t.hidden}</Pill>}
                    {x.withheld && <Pill tone="neutral">{t.withheld}</Pill>}
                  </p>
                  <p className="whitespace-pre-line" dir="auto">{x.kind === 'system' ? `(${x.body})` : x.body}</p>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title={`${t.reports} (${faDigits(String(reportRows.length))})`}>
            <ReportsList rows={reportRows} showContact={contact} />
          </Panel>
          <Panel title={t.decisions}>
            <DecisionsList rows={decisionRows} />
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title={admin.decide.title}>
            <DecisionForm kind="message" id={id} userId={m.senderId} ops={allowedOps(staff.role, ops, appeals.sanctionTypes)} subject={{ title: '', isEvent: false, resubmission: false, name: '' }} onReport={reportRows.some((r) => r.status === 'open')} {...formProps} />
          </Panel>
          <Guide />
          {sender && <PersonCard p={sender} title={t.seller} contact={false} />}
        </div>
      </div>
    </>
  );
}
