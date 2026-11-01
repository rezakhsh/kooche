import type { Metadata } from 'next';
import { LegalVersionPage } from '../../../components/legal-doc';
import { pages } from '../../../messages/fa';

// The new version before its day (src/modules/legal/versions.ts); the current page once it starts
export const metadata: Metadata = {
  title: pages.privacy.title,
  alternates: { canonical: '/privacy/next', languages: { fa: '/privacy/next', de: '/privacy/de/next' } },
  robots: { index: false, follow: true },
};

export default function PrivacyNextPage() {
  return <LegalVersionPage doc="privacy" lang="fa" next />;
}
