import Link from 'next/link';
import { messages } from '../messages/fa';

/** Above "publish" on the listing and event forms: publishing confirms the content fits the terms */
export function TermsNotice() {
  const t = messages.form;
  return (
    <p className="text-xs leading-relaxed text-neutral-600">
      {t.termsBefore}
      <Link href="/terms#s5" target="_blank" className="text-brand-800 underline">
        {t.termsLink}
      </Link>
      {t.termsAfter}
    </p>
  );
}
