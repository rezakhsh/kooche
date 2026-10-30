import { admin } from '../../../messages/fa';
import { dismissKey, SOFTWARE_LATE_MS, type Dismissal, type Kind, type SoftwareItem, type SoftwareReport } from '../../../modules/admin/software';
import { Ago } from '../ui';
import { dismissSoftwareAction } from './actions';

// Admin › وضعیت سیستم › «به‌روزرسانی نرم‌افزار» (owner, Oct 30, 2026): the worker's weekly check
// (src/modules/admin/software.ts), most urgent first; developer tools and the updates marked
// «لازم نیست» folded away below.

const t = admin.system.software;
const KINDS: Kind[] = ['security', 'fix', 'major'];
const DOT: Record<Kind, string> = { security: 'bg-red-600', fix: 'bg-saffron-500', major: 'bg-neutral-400' };
const SEVERITY_CHIP: Record<string, string> = {
  critical: 'bg-red-600 text-snow',
  high: 'bg-red-100 text-red-800',
  moderate: 'bg-amber-50 text-amber-800 border border-amber-200',
  low: 'bg-neutral-100 text-neutral-700',
};

function Row({ item, dismissible, error }: { item: SoftwareItem; dismissible: boolean; error: boolean }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <bdi dir="ltr" className="font-mono text-[13px] font-bold">{item.name}</bdi>
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-neutral-700">{t.groups[item.group]}</span>
          <bdi dir="ltr" className="font-mono text-[13px] tabular-nums text-neutral-700">
            {item.ours} → {item.target ?? item.newest}
          </bdi>
          {item.target && item.newest && <span className="text-xs text-neutral-600">({t.newest(item.newest)})</span>}
        </div>
        {item.advisories.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {item.advisories.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-sm leading-6">
                <span className={`shrink-0 rounded-md px-1.5 text-[11px] font-bold ${SEVERITY_CHIP[a.severity ?? 'high']}`}>{a.severity ? t.severity[a.severity] : t.securityUnrated}</span>
                <span className="min-w-0">
                  <a href={a.url} target="_blank" rel="noreferrer" dir="ltr" className="break-words text-brand-700 underline underline-offset-2">
                    {a.title}
                  </a>
                  {a.fixedIn && (
                    <span className="ms-2 text-xs text-neutral-600">
                      {t.fixedIn}{' '}
                      <bdi dir="ltr" className="font-mono">{a.fixedIn}</bdi>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {item.notes && (
          <a href={item.notes} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-700 underline underline-offset-2">
            {t.notes}
          </a>
        )}
      </div>
      {dismissible && (
        <details className="group shrink-0" open={error}>
          <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-neutral-300 px-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50">{t.dismiss}</summary>
          <form action={dismissSoftwareAction} className="mt-2 flex w-72 max-w-full flex-col gap-2">
            <input type="hidden" name="key" value={dismissKey(item)} />
            <input type="hidden" name="name" value={item.name} />
            <textarea name="reason" required minLength={3} maxLength={300} rows={2} placeholder={t.dismissReason} className="rounded-lg border border-neutral-300 bg-white p-2 text-sm" />
            {error && <p className="text-xs font-bold text-red-700">{t.dismissInvalid}</p>}
            <button className="h-9 rounded-lg bg-neutral-800 px-3 text-sm font-bold text-snow hover:bg-neutral-700">{t.dismissSave}</button>
          </form>
        </details>
      )}
    </li>
  );
}

export function SoftwareCard({ report, dismissed, errorKey, now }: { report: SoftwareReport | null; dismissed: Map<string, Dismissal>; errorKey: string | null; now: Date }) {
  const items = report?.items ?? [];
  const isDismissed = (i: SoftwareItem) => dismissed.has(dismissKey(i));
  const live = items.filter((i) => i.group !== 'dev' && !isDismissed(i));
  const dev = items.filter((i) => i.group === 'dev' && !isDismissed(i));
  const marked = items.filter(isDismissed);
  const late = report && now.getTime() - new Date(report.at).getTime() > SOFTWARE_LATE_MS;
  return (
    <section id="software" className="mt-4 scroll-mt-20 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-extrabold">{t.title}</h2>
        {report && (
          <span className="text-xs text-neutral-600">
            {t.checked} <Ago date={new Date(report.at)} />
          </span>
        )}
      </div>
      <p className="mt-1 max-w-prose text-sm leading-7 text-neutral-600">{t.intro}</p>
      {!report && <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">{t.notYet}</p>}
      {late && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{t.late}</p>}
      {report && live.length === 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{t.allCurrent}</p>
      )}

      {KINDS.map((kind) => {
        const list = live.filter((i) => i.kind === kind);
        if (!list.length) return null;
        return (
          <div key={kind} className="mt-4">
            <h3 className="flex items-center gap-2 font-bold">
              <span className={`size-2.5 shrink-0 rounded-full ${DOT[kind]}`} />
              {t.kinds[kind]!.title} ({list.length.toLocaleString('fa-IR')})
            </h3>
            <p className="mt-0.5 text-xs text-neutral-600">{t.kinds[kind]!.rule}</p>
            <ul className="divide-y divide-neutral-100">
              {list.map((i) => (
                <Row key={i.name} item={i} dismissible error={errorKey === dismissKey(i)} />
              ))}
            </ul>
          </div>
        );
      })}

      {report && report.support.length > 0 && (
        <p className="mt-4 text-xs text-neutral-600">
          <b>{t.support}:</b>{' '}
          {report.support.map((s, n) => (
            <span key={s.name}>
              {n > 0 && '، '}
              <bdi dir="ltr" className="font-mono">{t.supportLine(s.name, s.line, s.ends)}</bdi>
            </span>
          ))}
        </p>
      )}

      {dev.length > 0 && (
        <details className="mt-4 rounded-xl bg-neutral-50 p-3">
          <summary className="cursor-pointer text-sm font-bold text-neutral-700">{t.devTitle(dev.length)}</summary>
          <p className="mt-2 text-xs text-neutral-600">{t.devNote}</p>
          <ul className="divide-y divide-neutral-200">
            {dev.map((i) => (
              <Row key={i.name} item={i} dismissible={i.kind === 'security'} error={errorKey === dismissKey(i)} />
            ))}
          </ul>
        </details>
      )}

      {marked.length > 0 && (
        <details className="mt-3 rounded-xl bg-neutral-50 p-3">
          <summary className="cursor-pointer text-sm font-bold text-neutral-700">{t.dismissedTitle(marked.length)}</summary>
          <p className="mt-2 text-xs text-neutral-600">{t.dismissedNote}</p>
          <ul className="mt-1 divide-y divide-neutral-200">
            {marked.map((i) => {
              const d = dismissed.get(dismissKey(i))!;
              return (
                <li key={i.name} className="py-2 text-sm">
                  <bdi dir="ltr" className="font-mono text-[13px] font-bold">{i.name}</bdi>{' '}
                  <bdi dir="ltr" className="font-mono text-[13px] text-neutral-600">
                    {i.ours} → {i.target ?? i.newest}
                  </bdi>
                  <span className="block text-neutral-700">«{d.reason}»</span>
                  <span className="block text-xs text-neutral-600">
                    {d.by ? <bdi dir="ltr">{d.by}</bdi> : null}، <Ago date={d.at} />
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {report && report.errors.length > 0 && (
        <div className="mt-3 text-xs text-neutral-600">
          {t.errors}
          <ul className="mt-1 list-inside list-disc" dir="ltr">
            {report.errors.map((e) => (
              <li key={e} className="font-mono">{e}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
