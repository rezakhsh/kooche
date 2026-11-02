import type { Metadata } from 'next';
import { LegalVersionPage } from '../../../components/legal-doc';
import { legalDe } from '../../../messages/legal-de';

// The German version (approved Oct 21, 2026; both language versions binding since Nov 2, 2026)
export const metadata: Metadata = {
  title: legalDe.terms.title,
  alternates: { canonical: '/terms/de', languages: { fa: '/terms', de: '/terms/de' } },
};

export default function TermsDePage() {
  return <LegalVersionPage doc="terms" lang="de" />;
}
