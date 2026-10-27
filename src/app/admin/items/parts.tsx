import Link from 'next/link';
import { Pill } from '../../../components/ui';
import { admin, faDigits, messages, pages } from '../../../messages/fa';
import type { DecisionRow, ReportRow } from '../../../modules/admin/items';
import { can, type StaffRole } from '../../../modules/admin/access';
import { opPermission, type Op } from '../../../modules/admin/ops';
import { REASON_CODES } from '../../../db/schema/_values';
import { groundSection } from '../../../modules/moderation/terms';
import { REASON_SECTIONS } from '../../../modules/moderation/reasons';
import { imageUrl } from '../../../modules/media/server';
import { sellerPath } from '../../../modules/users/profile';
import { adminHref } from '../../../modules/admin/server';
import { Ago, Facts, Panel, StatusPill, When } from '../ui';
import type { OpChoice, ReasonChoice } from './decision-form';

// Parts of the item pages: reports, decisions, a person's history, photos, and the operations a
// staff member may choose here.

const sectionHeading = new Map(pages.terms.sections.map((s) => [s.id, s.heading]));

/** Every reason with the sections it may cite, labelled for the form */
export function reasonChoices(): ReasonChoice[] {
  return REASON_CODES.map((code) => ({
    code,
    label: messages.report.reasons[code] ?? code,
    sections: REASON_SECTIONS[code].map((id) => ({ id, label: sectionHeading.get(id) ?? id })),
  }));
}

/** The operations this staff member may pick, in the order given */
export function allowedOps(role: StaffRole, ops: OpChoice[], sanctionTypes: Record<string, string> = {}): OpChoice[] {
  return ops.filter((o) => can(role, opPermission({ op: o.op, days: undefined, appealId: o.appealId }, o.sanctionId ? sanctionTypes[o.sanctionId] : null)));
}

export const op = (o: Op, extra: Partial<OpChoice> = {}): OpChoice => ({ op: o, label: admin.decide.ops[o] ?? o, ...extra });

export function ReportsList({ rows, showContact }: { rows: ReportRow[]; showContact: boolean }) {
  const t = admin.item;
  if (rows.length === 0) return <p className="text-sm text-neutral-500">{t.noReports}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className={`rounded-xl border p-3 text-sm ${r.illegal ? 'border-red-200 bg-red-50/40' : 'border-neutral-200'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="warning">{messages.report.reasons[r.reason] ?? r.reason}</Pill>
            {r.illegal && <Pill tone="danger">{admin.queue.tags.illegal}</Pill>}
            <StatusPill status={r.status} />
            <span className="text-xs text-neutral-500">
              <Ago date={r.createdAt} />
            </span>
          </div>
          {r.details && <p className="mt-2 whitespace-pre-line" dir="auto">{r.details}</p>}
          {r.legalReference && (
            <p className="mt-1 text-xs">
              {t.legalRef}: <bdi dir="auto">{r.legalReference}</bdi>
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {r.anonymous ? t.reporterAnon(r.reporterName ?? '') : t.reporterUser(r.reporterName ?? '')}
            {showContact && r.reporterEmail && (
              <>
                {'، '}
                <bdi dir="ltr">{r.reporterEmail}</bdi>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DecisionsList({ rows }: { rows: DecisionRow[] }) {
  const t = admin.item;
  if (rows.length === 0) return <p className="text-sm text-neutral-500">{t.noDecisions}</p>;
  return (
    <ol className="space-y-3">
      {rows.map((d) => {
        const section = groundSection(d.policyGround);
        return (
          <li key={d.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={['remove', 'reject', 'hide', 'warn', 'sanction'].includes(d.decision) ? 'danger' : d.decision === 'escalate' ? 'saffron' : 'neutral'}>{t.decisionNames[d.decision] ?? d.decision}</Pill>
              <span className="text-xs text-neutral-600">{d.decidedBy === 'staff' ? t.by.staff(d.moderator ?? '') : t.by[d.decidedBy]}</span>
              {section && <span className="text-xs text-neutral-600">{messages.moderation.termsSection(section)}</span>}
              {d.legalGround && <bdi className="text-xs text-neutral-600">{d.legalGround}</bdi>}
              <span className="text-xs text-neutral-500">
                <When date={d.createdAt} />
              </span>
            </div>
            {d.statement && <p className="mt-2 leading-relaxed text-neutral-700">{d.statement}</p>}
            {d.appealId && (
              <div className="mt-2 rounded-lg bg-saffron-50 p-2 text-xs">
                <span className="font-bold">{d.appealStatus === 'open' ? t.appealOpen : t.appeal}:</span> <span dir="auto">{d.appealBody}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type Person = NonNullable<Awaited<ReturnType<typeof import('../../../modules/admin/items').personHistory>>>;

export function PersonCard({ p, title, contact }: { p: Person; title: string; contact: boolean }) {
  const t = admin.item.person;
  const listings = Object.entries(p.listings)
    .map(([s, n]) => `${admin.status[s] ?? s} ${faDigits(String(n))}`)
    .join('، ');
  return (
    <Panel title={title}>
      <p className="mb-2 flex flex-wrap items-center gap-2 font-bold">
        <bdi dir="auto">{p.name}</bdi>
        <StatusPill status={p.status} />
        {p.staffRole && <Pill tone="brand">{t.staff}</Pill>}
      </p>
      <Facts
        rows={[
          [t.since, <Ago key="s" date={p.createdAt} />],
          [t.phone, p.phoneVerifiedAt ? admin.common.yes : admin.common.no],
          [t.telegram, p.telegramLinked ? admin.common.yes : admin.common.no],
          [t.listings, listings || admin.common.none],
          [t.reportsAgainst, faDigits(String(p.reports_against))],
          [t.decisionsAgainst, faDigits(String(p.decisions_against))],
          [admin.item.reports, t.reportsFiled(p.reports_filed, p.reports_filed_dismissed)],
          ...(contact ? ([[t.email, <bdi key="e" dir="ltr">{p.email}</bdi>]] as Array<[string, React.ReactNode]>) : []),
        ]}
      />
      {p.sanctions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-bold text-neutral-500">{t.sanctions}</p>
          <ul className="space-y-1 text-xs">
            {p.sanctions.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-2">
                <span className="font-medium">{admin.decide.ops[s.type] ?? s.type}</span>
                <span>{s.revokedAt ? t.revoked : s.endsAt ? t.until('') : t.forever}</span>
                {s.endsAt && !s.revokedAt && <When date={s.endsAt} />}
                {s.active && <Pill tone="danger">{t.activeSanction}</Pill>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href={adminHref(`/users/${p.id}`)} prefetch={false} className="font-medium text-brand-800 hover:underline">
          {t.adminView}
        </Link>
        <a href={sellerPath(p.publicToken)} target="_blank" rel="noreferrer" className="text-neutral-600 hover:underline">
          {t.profile}
        </a>
      </div>
    </Panel>
  );
}

export function Photos({ keys }: { keys: string[] }) {
  if (keys.length === 0) return <p className="text-sm text-neutral-500">{admin.item.noPhotos}</p>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {keys.map((k) => {
        const src = imageUrl(k, 'card', 'webp');
        const full = imageUrl(k, 'full', 'webp');
        return (
          <li key={k} className="aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
            {src ? (
              <a href={full ?? src} target="_blank" rel="noreferrer">
                <img src={src} alt="" className="size-full object-cover" loading="lazy" />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Guide() {
  const t = admin.decide;
  return (
    <details className="rounded-2xl border border-neutral-200 p-4 text-sm">
      <summary className="cursor-pointer font-bold">{t.guideTitle}</summary>
      <table className="mt-3 w-full text-xs">
        <tbody className="divide-y divide-neutral-100">
          {t.guide.map(([see, act, sec]) => (
            <tr key={see}>
              <td className="py-1.5 pe-2">{see}</td>
              <td className="py-1.5 pe-2 font-medium">{act}</td>
              <td className="py-1.5 whitespace-nowrap">{sec}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-neutral-600">{t.steps}</p>
      <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{t.police}</p>
    </details>
  );
}
