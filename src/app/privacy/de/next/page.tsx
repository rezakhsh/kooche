import type { Metadata } from 'next';
import { LegalVersionPage } from '../../../../components/legal-doc';
import { legalDe } from '../../../../messages/legal-de';

// The new German version before its day (src/modules/legal/versions.ts)
export const metadata: Metadata = {
  title: legalDe.privacy.title,
  alternates: { canonical: '/privacy/de/next', languages: { fa: '/privacy/next', de: '/privacy/de/next' } },
  robots: { index: false, follow: true },
};

export default function PrivacyDeNextPage() {
  return <LegalVersionPage doc="privacy" lang="de" next />;
}
