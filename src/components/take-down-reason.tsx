import Link from 'next/link';
import { messages } from '../messages/fa';
import { sectionAnchor } from '../messages/legal-types';
import { groundSection } from '../modules/moderation/terms';
import { Alert } from './ui';

/** The notice on a taken-down listing's or event's edit page: the statement and the section of the terms it cites */
export function TakeDownReason({ notice, reason }: { notice: string; reason: { statement: string | null; policyGround: string | null } | null }) {
  const section = groundSection(reason?.policyGround);
  return (
    <Alert tone="error">
      {notice}
      {reason?.statement && (
        <>
          <br />
          <span className="font-semibold">{messages.form.reason}</span> {reason.statement}
        </>
      )}
      {section && (
        <>
          {' '}
          <Link href={`/terms#${sectionAnchor(section)}`} className="font-semibold underline">
            {messages.moderation.termsSection(section)}
          </Link>
        </>
      )}{' '}
      <Link href="/account/notices" className="font-semibold underline">
        {messages.notices.link}
      </Link>
    </Alert>
  );
}
