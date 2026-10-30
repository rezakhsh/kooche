import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../../../components/icons';
import { Pill } from '../../../components/ui';
import { admin, faDigits, messages, pages } from '../../../messages/fa';
import type { DecisionRow, ReportRow } from '../../../modules/admin/items';
import { can, type StaffRole } from '../../../modules/admin/access';
import { bySeverity, opPermission, type Op } from '../../../modules/admin/ops';
import { REASON_CODES } from '../../../db/schema/_values';
import { groundSection } from '../../../modules/moderation/terms';
import { REASON_SECTIONS } from '../../../modules/moderation/reasons';
import { imageUrl } from '../../../modules/media/server';
import { sellerPath } from '../../../modules/users/profile';
import { adminHref } from '../../../modules/admin/server';
import { hoursToDeadline } from '../../../modules/admin/attention';
import { riskyParts } from '../../../modules/admin/risky';
import { Ago, Panel, StatusPill, When } from '../ui';
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

/** The operations this staff member may pick, from mild to severe (a restriction if its shortest length is theirs) */
export function allowedOps(role: StaffRole, ops: OpChoice[], sanctionTypes: Record<string, string> = {}): OpChoice[] {
  return bySeverity(ops).filter((o) => can(role, opPermission({ op: o.op, days: '7', appealId: o.appealId }, o.sanctionId ? sanctionTypes[o.sanctionId] : null)));
}

export const op = (o: Op, extra: Partial<OpChoice> = {}): OpChoice => ({ op: o, label: admin.decide.ops[o] ?? o, ...extra });

export function ReportsList({ rows, showContact }: { rows: ReportRow[]; showContact: boolean }) {
  const t = admin.item;
  if (rows.length === 0) return <p className="text-sm text-neutral-600">{t.noReports}</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((r) => (
        <li key={r.id} className={`py-3 text-sm first:pt-0 last:pb-0 ${r.illegal ? '-mx-2 rounded-xl bg-red-50 px-2' : ''}`}>
          <p className="flex flex-wrap items-center justify-between gap-2">
            <b>{messages.report.reasons[r.reason] ?? r.reason}</b>
            <span className="text-xs text-neutral-600">
              <Ago date={r.createdAt} />
            </span>
          </p>
          {(r.illegal || r.status !== 'open') && (
            <p className="mt-1 flex flex-wrap gap-1.5">
              {r.illegal && <Pill tone="danger">{admin.queue.tags.illegal}</Pill>}
              {r.status !== 'open' && <StatusPill status={r.status} />}
            </p>
          )}
          {r.details && <p className="mt-1 leading-7 whitespace-pre-line text-neutral-700" dir="auto">{`«${r.details}»`}</p>}
          {r.legalReference && (
            <p className="mt-1 text-xs">
              {t.legalRef}: <bdi dir="auto">{r.legalReference}</bdi>
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-600">
            {r.anonymous ? t.reporterAnon(r.reporterName ?? '') : t.reporterUser(r.reporterName ?? '')}
            {showContact && r.reporterEmail && (
              <>
                {'، '}
                <bdi dir="ltr">{r.reporterEmail}</bdi>
              </>
            )}
            {'، '}
            <span className={r.reporterDismissed > 1 ? 'font-bold text-red-700' : ''}>{t.reporterHistory(r.reporterDismissed)}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DecisionsList({ rows }: { rows: DecisionRow[] }) {
  const t = admin.item;
  if (rows.length === 0) return <p className="text-sm text-neutral-600">{t.noDecisions}</p>;
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
              <span className="text-xs text-neutral-600">
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

const NEW_ACCOUNT_MS = 7 * 86_400_000;

/**
 * The person behind an item (wave 1, mockup admin-item «آگهی‌دهنده»): how new the account is, how
 * the number was verified and from which country (red when it isn't the listing's), listings,
 * decisions and reports so far, and the same text in their other listings.
 */
export function PersonCard({ p, title, contact, listingCountry, sameText, otherListings, onUserPage = false }: { p: Person; title: string; contact: boolean; listingCountry?: string | null; sameText?: number; otherListings?: number; onUserPage?: boolean }) {
  const t = admin.item;
  const f = t.sellerFacts;
  const listings = Object.entries(p.listings)
    .map(([s, n]) => `${admin.status[s] ?? s} ${faDigits(String(n))}`)
    .join('، ');
  const number = p.phone ? parsePhoneNumberFromString(p.phone) : undefined;
  const foreign = !!(listingCountry && number?.country && number.country !== listingCountry);
  const rows: Array<[string, ReactNode, boolean?]> = [
    [f.since, <Ago key="s" date={p.createdAt} />, Date.now() - p.createdAt.getTime() < NEW_ACCOUNT_MS],
    [f.phone, p.phoneVerifiedAt ? <bdi key="p">{`${t.phoneVia[p.phoneMethod ?? ''] ?? ''}، `}<span dir="ltr">{number ? `+${number.countryCallingCode}` : ''}</span></bdi> : t.noPhone, !p.phoneVerifiedAt || foreign],
    [f.listings, listings || admin.common.none],
    [f.decisions, p.decisions_against ? faDigits(String(p.decisions_against)) : t.noneYet, p.decisions_against > 0],
    [f.reports, p.reports_against ? faDigits(String(p.reports_against)) : t.noneYet, p.reports_against > 1],
    ...(sameText !== undefined ? ([[f.sameText, t.sameText(sameText), sameText > 0]] as Array<[string, ReactNode, boolean]>) : []),
    ...(p.reports_filed ? ([[t.reports, t.person.reportsFiled(p.reports_filed, p.reports_filed_dismissed)]] as Array<[string, ReactNode]>) : []),
    ...(contact ? ([[t.person.email, <bdi key="e" dir="ltr">{p.email}</bdi>]] as Array<[string, ReactNode]>) : []),
  ];
  return (
    <Panel>
      <h2 className="font-extrabold">{title}</h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <bdi dir="auto">{p.name}</bdi>
        {p.status !== 'active' && <StatusPill status={p.status} />}
        {p.staffRole && <Pill tone="brand">{t.person.staff}</Pill>}
        {p.testAccount && <Pill tone="saffron">{t.person.test}</Pill>}
      </p>
      <dl className="mt-2 divide-y divide-neutral-100 text-sm">
        {rows.map(([k, v, red]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-4 py-2">
            <dt className="text-neutral-600">{k}</dt>
            <dd className={`min-w-0 text-end font-bold ${red ? 'text-red-700' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {p.sanctions.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-bold text-neutral-600">{t.person.sanctions}</p>
          <ul className="space-y-1 text-xs">
            {p.sanctions.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-2">
                <span className="font-medium">{admin.decide.ops[s.type] ?? s.type}</span>
                <span>{s.revokedAt ? t.person.revoked : s.endsAt ? t.person.until('') : t.person.forever}</span>
                {s.endsAt && !s.revokedAt && <When date={s.endsAt} />}
                {s.active && <Pill tone="danger">{t.person.activeSanction}</Pill>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {/* On the user's own page the details are already there: no link back to itself */}
        {!onUserPage && (
          <Link href={adminHref(`/users/${p.id}`)} prefetch={false} className="font-bold text-brand-800 hover:underline">
            {otherListings ? t.seeOthers(otherListings) : t.person.adminView}
          </Link>
        )}
        <a href={sellerPath(p.publicToken)} target="_blank" rel="noreferrer" className="text-neutral-600 hover:underline">
          {t.person.profile}
        </a>
      </div>
    </Panel>
  );
}

/**
 * The photos large, the first one wide (wave 1, mockup admin-item), with «سیاه‌وسفید» for
 * pictures that are hard to look at: a checkbox and CSS, no JavaScript.
 */
export function Photos({ keys, title }: { keys: string[]; title?: boolean }) {
  const t = admin.item;
  if (keys.length === 0) return <p className="text-sm text-neutral-600">{t.noPhotos}</p>;
  return (
    <div className="group/photos">
      {title && (
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-600">
          <span>{t.photoCount(keys.length)}</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            {t.greyscale}
            <input type="checkbox" className="peer sr-only" />
            <span className="flex h-5 w-9 items-center rounded-full bg-neutral-300 p-0.5 peer-checked:bg-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
              <i className="size-4 rounded-full bg-white transition-transform group-has-[input:checked]/photos:-translate-x-4" />
            </span>
          </label>
        </div>
      )}
      <ul className="grid grid-cols-3 gap-1.5">
        {keys.map((k, i) => {
          const src = imageUrl(k, i === 0 ? 'full' : 'card', 'webp');
          const full = imageUrl(k, 'full', 'webp');
          return (
            <li key={k} className={`overflow-hidden bg-neutral-100 ${i === 0 ? 'col-span-3 aspect-[16/10] rounded-xl' : 'aspect-square rounded-lg'}`}>
              {src ? (
                <a href={full ?? src} target="_blank" rel="noreferrer">
                  <img src={src} alt="" className="size-full object-cover group-has-[input:checked]/photos:grayscale" loading={i === 0 ? 'eager' : 'lazy'} />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Text with the scam phrases marked (src/modules/admin/risky.ts) */
export function Highlighted({ text }: { text: string }) {
  return (
    <>
      {riskyParts(text).map((part, i) =>
        part.risky ? (
          <mark key={i} className="rounded bg-red-100 px-0.5 text-red-900">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

/** Where this item is in the queue, its 24-hour clock, and the previous and next ones (J and K) */
export function ItemBar({ position, since, prev, next }: { position: { index: number; total: number } | null; since: Date | null; prev: string | null; next: string | null }) {
  const t = admin.item;
  const hours = since ? hoursToDeadline(since) : null;
  const button = 'flex h-9 items-center rounded-lg border border-neutral-300 bg-white px-3 hover:bg-neutral-50';
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <Link href={adminHref('/queue')} prefetch={false} className="text-brand-800 hover:underline">
        {admin.nav.queue}
      </Link>
      {position && (
        <>
          <Icon name="chevronEnd" className="size-3.5 text-neutral-500" />
          <span>{t.position(position.index, position.total)}</span>
        </>
      )}
      <span className="ms-auto" />
      {hours !== null && (
        <span className={`flex items-center gap-1 rounded-full px-3 leading-8 font-bold ${hours < 0 ? 'bg-red-50 text-red-800' : 'bg-saffron-50 text-saffron-800'}`}>
          <Icon name="clock" className="size-4" />
          {t.deadline(hours)}
        </span>
      )}
      {prev && (
        <Link href={prev} prefetch={false} data-key-prev className={button}>
          {t.prev} <kbd className="ms-1.5 rounded bg-neutral-100 px-1 text-xs">K</kbd>
        </Link>
      )}
      {next && (
        <Link href={next} prefetch={false} data-key-next className={button}>
          {t.next} <kbd className="ms-1.5 rounded bg-neutral-100 px-1 text-xs">J</kbd>
        </Link>
      )}
    </div>
  );
}

/** On phones and tablets the decision sits below the content: «بعدی» and «تصمیم بگیرید» stay at hand */
export function DecideBar({ next }: { next: string | null }) {
  const t = admin.item;
  return (
    <>
      <div className="h-20 xl:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] xl:hidden">
        {next && (
          <Link href={next} prefetch={false} className="flex h-12 items-center rounded-xl border border-neutral-300 px-4 font-bold">
            {t.next}
          </Link>
        )}
        <a href="#decide" className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-700 font-bold text-white">
          {t.decideNow}
        </a>
      </div>
    </>
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
