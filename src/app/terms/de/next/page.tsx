import type { Metadata } from 'next';
import { LegalVersionPage } from '../../../../components/legal-doc';
import { legalDe } from '../../../../messages/legal-de';

// The new German version before its day (src/modules/legal/versions.ts)
export const metadata: Metadata = {
  title: legalDe.terms.title,
  alternates: { canonical: '/terms/de/next', languages: { fa: '/terms/next', de: '/terms/de/next' } },
  robots: { index: false, follow: true },
};

export default function TermsDeNextPage() {
  return <LegalVersionPage doc="terms" lang="de" next />;
}
