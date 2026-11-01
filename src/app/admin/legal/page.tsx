import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDateTime } from '../../../lib/format';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { checkDocuments, draftById, nextPath, noticeHistory, noticeMail, recipientCount, SUMMARY_MAX, upcomingVersions } from '../../../modules/legal/notices';
import { dayFa, earliestTermsDay, LEGAL_ZONE } from '../../../modules/legal/versions';
import { AdminTitle, Panel } from '../ui';
import { discardNoticeAction, previewNoticeAction, sampleNoticeAction, sendNoticeAction } from './actions';

// Admin › «خبر تغییر شرایط به همه» (Check B, Nov 1, 2026; no mockup, in the admin pages' style):
// the new versions waiting in the code, the form (documents, a Persian and a German summary), the
// preview with the number of accounts, a sample to oneself, «مطمئنم» and «فرستادن به همه», and the
// notices sent with their progress. src/modules/legal/notices.ts does the work. Admins only.

const t = admin.legal;
const field = 'block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-brand-600';
const secondary = 'inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold hover:bg-neutral-50';
type Search = { draft?: string; edit?: string; sample?: string; sending?: string; error?: string };
const isId = (s: string | undefined): s is string => !!s && /^[0-9a-f-]{36}$/.test(s);

export default async function LegalNoticePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff('legal.announce');
  const sp = await searchParams;
  const db = appDb();
  const now = new Date();
  const upcoming = upcomingVersions(now);
  const [draft, editing, history, count] = await Promise.all([
    isId(sp.draft) ? draftById(db, sp.draft) : null,
    isId(sp.edit) ? draftById(db, sp.edit) : null,
    noticeHistory(db),
    recipientCount(db),
  ]);
  const appUrl = webEnv().APP_URL.replace(/\/$/, '');
  const mail = draft ? noticeMail(draft, appUrl, '') : null;
  const termsTooSoon = !checkDocuments(['terms'], now).ok && upcoming.some((u) => u.doc === 'terms');

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {sp.sending && <div className="mb-4"><Alert tone="success">{t.sending}</Alert></div>}
      {sp.sample && <div className="mb-4"><Alert tone="success">{t.sampleSent}</Alert></div>}
      {sp.error && t.errors[sp.error] && <div className="mb-4"><Alert tone="error">{t.errors[sp.error]}</Alert></div>}

      <Panel title={t.versionsTitle} className="mb-4">
        <ul className="divide-y divide-neutral-100 text-sm">
          {(['terms', 'privacy'] as const).map((doc) => {
            const u = upcoming.find((x) => x.doc === doc);
            return (
              <li key={doc} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <b>{t.docs[doc]}</b>
                {u ? (
                  <span>
                    {t.upcoming(dayFa(u.version.from))} ·{' '}
                    <Link href={nextPath(doc)} prefetch={false} className="font-bold text-brand-800 underline">
                      {t.read}
                    </Link>
                  </span>
                ) : (
                  <span className="text-neutral-500">{t.noUpcoming}</span>
                )}
              </li>
            );
          })}
        </ul>
        {termsTooSoon && <p className="mt-2 text-sm text-red-700">{t.tooSoon(dayFa(earliestTermsDay(now)))}</p>}
      </Panel>

      {draft && mail ? (
        <section className="mb-4 rounded-2xl border border-saffron-100 bg-saffron-50 p-4">
          <h2 className="font-extrabold">{t.previewTitle}</h2>
          <p className="mt-2 text-sm">
            <b>{t.subject}:</b> <bdi>{mail.subject}</bdi>
          </p>
          <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 text-sm leading-7">
            {mail.text.split('\n').map((line, i) => (line ? <p key={i} dir="auto" className="break-words">{line}</p> : <br key={i} />))}
          </div>
          <p className="mt-3 text-sm font-bold">{t.recipients(count)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={sampleNoticeAction}>
              <input type="hidden" name="id" value={draft.id} />
              <Button type="submit" variant="secondary">{t.sample}</Button>
            </form>
            <Link href={adminHref(`/legal?edit=${draft.id}`)} prefetch={false} className={secondary}>
              {t.edit}
            </Link>
            <form action={discardNoticeAction}>
              <input type="hidden" name="id" value={draft.id} />
              <button type="submit" className={secondary}>{t.discard}</button>
            </form>
          </div>
          <form action={sendNoticeAction} className="mt-4 space-y-3 border-t border-saffron-100 pt-4">
            <input type="hidden" name="id" value={draft.id} />
            <label className="flex gap-2 text-sm font-bold">
              <input type="checkbox" name="sure" required className="mt-1 size-4 shrink-0 accent-brand-700" />
              {t.sure}
            </label>
            <Button type="submit">{t.send}</Button>
          </form>
        </section>
      ) : upcoming.length > 0 ? (
        <Panel title={t.formTitle} className="mb-4">
          <form action={previewNoticeAction} className="space-y-4">
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t.which}</legend>
              <div className="flex flex-wrap gap-4">
                {upcoming.map((u) => (
                  <label key={u.doc} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="documents"
                      value={u.doc}
                      defaultChecked={editing ? editing.documents.includes(u.doc) : upcoming.length === 1}
                      className="size-4 accent-brand-700"
                    />
                    {t.docs[u.doc]} ({dayFa(u.version.from)})
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t.summaryFa}</span>
              <textarea name="summaryFa" required maxLength={SUMMARY_MAX} rows={5} defaultValue={editing?.summaryFa} className={field} />
              <span className="mt-1 block text-xs text-neutral-500">{t.summaryFaHint}</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t.summaryDe}</span>
              <textarea name="summaryDe" required maxLength={SUMMARY_MAX} rows={5} dir="ltr" lang="de" defaultValue={editing?.summaryDe} className={field} />
              <span className="mt-1 block text-xs text-neutral-500">{t.summaryDeHint}</span>
            </label>
            <Button type="submit">{t.preview}</Button>
          </form>
        </Panel>
      ) : (
        <Panel className="mb-4">
          <p className="text-sm leading-7 text-neutral-700">{t.noneReady}</p>
        </Panel>
      )}

      <Panel title={t.historyTitle} className="mb-6">
        {history.length === 0 ? (
          <p className="text-sm text-neutral-600">{t.historyEmpty}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {history.map((n) => (
              <li key={n.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b>
                    {n.documents.map((d) => t.docs[d]).join(' و ')} · {t.upcoming(dayFa(n.effectiveOn))}
                  </b>
                  <span className={n.finishedAt ? 'text-brand-800' : 'text-saffron-700'}>{n.finishedAt ? t.finished : t.inProgress}</span>
                </div>
                <p className="mt-1 text-neutral-700 tabular-nums">
                  {t.progress(n.sent, n.recipients ?? 0)}
                  {n.failed > 0 && <> · <span className="text-red-700">{t.failed(n.failed)}</span></>}
                  {n.confirmedAt && <> · {t.sentAt(formatDateTime(n.confirmedAt, LEGAL_ZONE))}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
