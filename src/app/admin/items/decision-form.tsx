'use client';

import { useActionState, useMemo, useState } from 'react';
import { Alert, Button } from '../../../components/ui';
import { fieldDir } from '../../../lib/field-dir';
import { admin } from '../../../messages/fa';
import type { Op } from '../../../modules/admin/ops';
import { composeStatement, type StatementWhat } from '../../../modules/moderation/statement';
import { decideAction, type DecideState } from '../moderation-actions';

export type OpChoice = { op: Op; label: string; appealId?: string; sanctionId?: string };
export type ReasonChoice = { code: string; label: string; sections: Array<{ id: string; label: string }> };

const RESTRICTING = new Set<Op>(['take_down', 'warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned', 'hide_message', 'suspend_business']);
const TIMED = new Set<Op>(['posting_restricted', 'messaging_restricted', 'suspended']);

const field = 'block w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

/**
 * The decision form on an item page. Shows only what the chosen operation needs, and the
 * statement of reasons as the person will get it (the server composes the same text again).
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
}) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideAction, undefined);
  const [choice, setChoice] = useState(0);
  const [reason, setReason] = useState(props.reasons[0]?.code ?? '');
  const [section, setSection] = useState(props.reasons[0]?.sections[0]?.id ?? '');
  const [legal, setLegal] = useState('');
  const [facts, setFacts] = useState('');
  const [days, setDays] = useState<'7' | '30' | 'none'>('7');
  const [note, setNote] = useState('');
  const t = admin.decide;
  const picked = props.ops[choice];
  const restricting = picked ? RESTRICTING.has(picked.op) : false;
  const sections = props.reasons.find((r) => r.code === reason)?.sections ?? [];

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

  if (!picked) return null;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={props.kind} />
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="op" value={picked.op} />
      {props.userId && <input type="hidden" name="userId" value={props.userId} />}
      {picked.appealId && <input type="hidden" name="appealId" value={picked.appealId} />}
      {picked.sanctionId && <input type="hidden" name="sanctionId" value={picked.sanctionId} />}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">{t.action}</legend>
        <div className="space-y-1.5">
          {props.ops.map((o, i) => (
            <label key={`${o.op}-${o.appealId ?? ''}-${o.sanctionId ?? ''}`} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name="$choice" checked={choice === i} onChange={() => setChoice(i)} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      {restricting ? (
        <>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.reason}</span>
            <select
              name="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setSection(props.reasons.find((r) => r.code === e.target.value)?.sections[0]?.id ?? '');
              }}
              className={field}
            >
              {props.reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.section}</span>
            <select name="section" value={section} onChange={(e) => setSection(e.target.value)} className={field}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.legal}</span>
            <input name="legalGround" value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={200} dir={fieldDir(legal)} className={field} />
            <span className="mt-1 block text-xs text-neutral-500">{t.legalHint}</span>
          </label>
          {TIMED.has(picked.op) && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">{t.days}</span>
              <select name="days" value={days} onChange={(e) => setDays(e.target.value as '7' | '30' | 'none')} className={field}>
                {(picked.op === 'suspended' ? (['7', '30'] as const) : (['7', '30', 'none'] as const)).map((d) => (
                  <option key={d} value={d}>
                    {t.dayOptions[d]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.facts}</span>
            <textarea name="facts" required minLength={10} maxLength={1000} rows={3} value={facts} onChange={(e) => setFacts(e.target.value)} dir={fieldDir(facts)} className={field} />
            <span className="mt-1 block text-xs text-neutral-500">{t.factsHint}</span>
          </label>
          {preview && (
            <div className="rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">
              <p className="mb-1 text-xs font-bold text-neutral-500">{t.preview}</p>
              {preview}
            </div>
          )}
        </>
      ) : picked.op !== 'approve' ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{picked.op === 'keep' ? t.keepNote : t.note}</span>
          <textarea name="note" rows={2} maxLength={1000} required={picked.op === 'keep'} minLength={picked.op === 'keep' ? 10 : undefined} value={note} onChange={(e) => setNote(e.target.value)} dir={fieldDir(note)} className={field} />
        </label>
      ) : null}

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending} variant={restricting ? 'danger' : 'primary'} className="w-full">
        {t.submit}
      </Button>
    </form>
  );
}
