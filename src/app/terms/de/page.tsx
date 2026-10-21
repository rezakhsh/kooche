import type { Metadata } from 'next';
import { LegalDocPage } from '../../../components/legal-doc';
import { legalDe } from '../../../messages/legal-de';

// The binding German version (approved Oct 21, 2026)
export const metadata: Metadata = {
  title: legalDe.terms.title,
  alternates: { canonical: '/terms/de', languages: { fa: '/terms', de: '/terms/de' } },
};

export default function TermsDePage() {
  return <LegalDocPage doc={legalDe.terms} lang="de" other="/terms" />;
}
