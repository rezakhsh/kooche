'use client';

import { useActionState, useMemo, useState } from 'react';
import { Alert } from '../../../components/ui';
import { fieldDir } from '../../../lib/field-dir';
import { admin } from '../../../messages/fa';
import type { Op } from '../../../modules/admin/ops';
import { composeStatement, type StatementWhat } from '../../../modules/moderation/statement';
import { decideAction, type DecideState } from '../moderation-actions';

export type OpChoice = { op: Op; label: string; appealId?: string; sanctionId?: string };
export type ReasonChoice = { code: string; label: string; sections: Array<{ id: string; label: string }> };

const RESTRICTING = new Set<Op>(['take_down', 'warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned', 'hide_message', 'suspend_business']);
const TIMED = new Set<Op>(['posting_restricted', 'messaging_restricted', 'suspended']);

const field = 'block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';
const chip = 'flex min-h-9 cursor-pointer items-center rounded-full border border-neutral-300 px-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600/40';
const fa = (n: number) => n.toLocaleString('fa-IR');

/**
 * The decision form on an item page (wave 1, mockup admin-item): the operations from mild to
 * severe with nothing chosen in advance (keys 1–9, src/app/admin/keys.tsx), reason chips that pick
 * the terms section, a first sentence for the facts, the statement of reasons as the person will
 * get it (the server composes the same text again), and «… و بعدی», which opens the next item.
 */
export function DecisionForm(props: {
  kind: 'listing' | 'user' | 'business' | 'message';
  id: string;
  userId: string | null;
  ops: OpChoice[];
  reasons: ReasonChoice[];
  subject: { title: string; isEvent: boolean; resubmission: boolean; name: string };
  onReport: boolean;
  timeZone: string;
  /** Where «و بعدی» goes, under the admin path: the next item in the queue, or the queue */
  next: string;
}) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideAction, undefined);
  const [choice, setChoice] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [section, setSection] = useState('');
  const [legal, setLegal] = useState('');
  const [facts, setFacts] = useState('');
  const [days, setDays] = useState<'7' | '30' | 'none'>('7');
  const [note, setNote] = useState('');
  const t = admin.decide;
  const picked = choice === null ? null : props.ops[choice];
  const restricting = picked ? RESTRICTING.has(picked.op) : false;
  const sections = props.reasons.find((r) => r.code === reason)?.sections ?? [];

  const pickReason = (code: string) => {
    const before = t.templates[reason] ?? '';
    setReason(code);
    setSection(props.reasons.find((r) => r.code === code)?.sections[0]?.id ?? '');
    // The reason's first sentence, unless the moderator has written their own
    if (!facts.trim() || facts === before) setFacts(t.templates[code] ?? '');
  };

  const preview = useMemo(() => {
    if (!picked || !restricting) return null;
    const until = days === 'none' ? null : new Date(Date.now() + Number(days) * 86_400_000);
    const s = props.subject;
    const what: StatementWhat =
      picked.op === 'take_down'
        ? { kind: s.resubmission ? 'listing_rejected' : s.isEvent ? 'event_removed' : 'listing_removed', title: s.title }
        : picked.op === 'suspend_business'
          ? { kind: 'business_suspended', name: s.name }
          : picked.op === 'hide_message'
            ? { kind: 'message_hidden' }
            : picked.op === 'warning' || picked.op === 'banned'
              ? { kind: picked.op }
              : { kind: picked.op as 'posting_restricted' | 'messaging_restricted' | 'suspended', until };
    return composeStatement({ what, facts: facts || '…', section: section || null, legalGround: legal || null, onReport: props.onReport, timeZone: props.timeZone });
  }, [picked, restricting, days, facts, section, legal, props.subject, props.onReport, props.timeZone]);

  if (props.ops.length === 0) return null;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={props.kind} />
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="next" value={props.next} />
      {picked && <input type="hidden" name="op" value={picked.op} />}
      {props.userId && <input type="hidden" name="userId" value={props.userId} />}
      {picked?.appealId && <input type="hidden" name="appealId" value={picked.appealId} />}
      {picked?.sanctionId && <input type="hidden" name="sanctionId" value={picked.sanctionId} />}
      <fieldset>
        <legend className="mb-2 text-xs text-neutral-600">{t.keysHint(Math.min(9, props.ops.length))}</legend>
        <div className="space-y-1.5">
          {props.ops.map((o, i) => {
            const red = RESTRICTING.has(o.op);
            return (
              <label
                key={`${o.op}-${o.appealId ?? ''}-${o.sanctionId ?? ''}`}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 text-sm has-[:checked]:border-2 has-[:checked]:font-bold has-[:focus-visible]:ring-2 ${red ? 'has-[:checked]:border-red-600 has-[:checked]:bg-red-50 has-[:checked]:text-red-800 has-[:focus-visible]:ring-red-600/30' : 'has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800 has-[:focus-visible]:ring-brand-600/30'}`}
              >
                <input type="radio" name="$choice" data-key-option checked={choice === i} onChange={() => setChoice(i)} className="sr-only" />
                <kbd className="w-5 shrink-0 rounded bg-neutral-100 text-center text-xs font-normal text-neutral-700">{i < 9 ? fa(i + 1) : ''}</kbd>
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {picked && restricting && (
        <>
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">{t.reason}</legend>
            <div className="flex flex-wrap gap-1.5">
              {props.reasons.map((r) => (
                <label key={r.code} className={chip} title={r.label}>
                  <input type="radio" name="reason" value={r.code} required checked={reason === r.code} onChange={() => pickReason(r.code)} className="sr-only" />
                  {t.reasonChips[r.code] ?? r.label}
                </label>
              ))}
            </div>
            {sections.length === 1 && <p className="mt-1.5 text-xs text-neutral-600">{t.sectionAuto(sections[0]!.label)}</p>}
          </fieldset>
          {/* The section goes with the reason; a choice only when the reason may cite several */}
          {sections.length === 1 && <input type="hidden" name="section" value={section} />}
          {sections.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-bold">{t.section}</legend>
              <div className="flex flex-wrap gap-1.5">
                {sections.map((s) => (
                  <label key={s.id} className={chip}>
                    <input type="radio" name="section" value={s.id} checked={section === s.id} onChange={() => setSection(s.id)} className="sr-only" />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {TIMED.has(picked.op) && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-bold">{t.days}</legend>
              <div className="flex flex-wrap gap-1.5">
                {(picked.op === 'suspended' ? (['7', '30'] as const) : (['7', '30', 'none'] as const)).map((d) => (
                  <label key={d} className={chip}>
                    <input type="radio" name="days" value={d} checked={days === d} onChange={() => setDays(d)} className="sr-only" />
                    {t.dayOptions[d]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">{t.facts}</span>
            <textarea name="facts" required minLength={10} maxLength={1000} rows={3} value={facts} onChange={(e) => setFacts(e.target.value)} dir={fieldDir(facts)} className={`${field} leading-7`} />
            <span className="mt-1 block text-xs text-neutral-600">{t.factsHint}</span>
          </label>
          <details open={legal !== ''} className="text-sm">
            <summary className="cursor-pointer text-neutral-700">{t.legalToggle}</summary>
            <label className="mt-2 block">
              <span className="mb-1 block text-sm text-neutral-700">{t.legal}</span>
              <input name="legalGround" value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={200} dir={fieldDir(legal)} className={field} />
              <span className="mt-1 block text-xs text-neutral-600">{t.legalHint}</span>
            </label>
          </details>
          {preview && (
            <details className="rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">
              <summary className="cursor-pointer text-xs font-bold text-neutral-600">{t.preview}</summary>
              <p className="mt-1">{preview}</p>
            </details>
          )}
        </>
      )}
      {picked && !restricting && picked.op !== 'approve' && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">{picked.op === 'keep' ? t.keepNote : t.note}</span>
          <textarea name="note" rows={2} maxLength={1000} required={picked.op === 'keep'} minLength={picked.op === 'keep' ? 10 : undefined} value={note} onChange={(e) => setNote(e.target.value)} dir={fieldDir(note)} className={field} />
        </label>
      )}

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <button
        type="submit"
        data-key-submit
        disabled={!picked || pending}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold disabled:cursor-not-allowed ${!picked ? 'bg-neutral-100 text-neutral-500' : restricting ? 'bg-danger text-snow hover:bg-danger-hover' : 'bg-brand-700 text-white hover:bg-brand-800'} disabled:opacity-80`}
      >
        {picked ? t.submitNext(picked.label) : t.chooseFirst}
        {picked && <kbd className="rounded bg-snow/20 px-1.5 text-xs font-normal">Enter</kbd>}
      </button>
      {restricting && <p className="text-center text-xs text-neutral-600">{t.previewNote}</p>}
    </form>
  );
}
