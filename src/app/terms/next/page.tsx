import type { Metadata } from 'next';
import { LegalVersionPage } from '../../../components/legal-doc';
import { pages } from '../../../messages/fa';

// The new version before its day (src/modules/legal/versions.ts); the current page once it starts
export const metadata: Metadata = {
  title: pages.terms.title,
  alternates: { canonical: '/terms/next', languages: { fa: '/terms/next', de: '/terms/de/next' } },
  robots: { index: false, follow: true },
};

export default function TermsNextPage() {
  return <LegalVersionPage doc="terms" lang="fa" next />;
}
