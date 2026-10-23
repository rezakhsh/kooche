import { formatDate } from '../../lib/format';
import { messages } from '../../messages/fa';

// The statement of reasons for a decision by staff (DSA art. 17(3)), stored in
// moderation_decisions.statement_fa and sent to the person it concerns: what was decided (and
// until when), the facts in the moderator's words, whether it followed a report, the section of
// the terms or the law, that a person decided, and how to challenge it.

export type StatementWhat =
  | { kind: 'listing_removed' | 'event_removed' | 'listing_rejected'; title: string }
  | { kind: 'warning' | 'banned' | 'message_hidden' }
  | { kind: 'posting_restricted' | 'messaging_restricted' | 'suspended'; until: Date | null }
  | { kind: 'business_suspended'; name: string };

export type StatementInput = {
  what: StatementWhat;
  facts: string;
  section: string | null;
  legalGround: string | null;
  onReport: boolean;
  timeZone: string;
};

export function composeStatement(input: StatementInput): string {
  const t = messages.moderation.staff;
  const w = input.what;
  const until = (d: Date | null) => (d ? t.until(formatDate(d, input.timeZone)) : t.untilFurther);
  const what =
    w.kind === 'listing_removed' || w.kind === 'event_removed' || w.kind === 'listing_rejected'
      ? t.what[w.kind](w.title)
      : w.kind === 'posting_restricted' || w.kind === 'messaging_restricted' || w.kind === 'suspended'
        ? t.what[w.kind](until(w.until))
        : w.kind === 'business_suspended'
          ? t.what.business_suspended(w.name)
          : t.what[w.kind];
  return [
    what,
    t.facts(input.facts.trim()),
    input.onReport ? t.onReport : t.onOwn,
    ...(input.section ? [t.ground(input.section)] : []),
    ...(input.legalGround ? [t.legal(input.legalGround.trim())] : []),
    t.byPerson,
    t.redress,
  ].join(' ');
}
