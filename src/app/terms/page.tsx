import type { Metadata } from 'next';
import { LegalDocPage } from '../../components/legal-doc';
import { pages } from '../../messages/fa';

export const metadata: Metadata = {
  title: pages.terms.title,
  alternates: { canonical: '/terms', languages: { fa: '/terms', de: '/terms/de' } },
};

export default function TermsPage() {
  return <LegalDocPage doc={pages.terms} lang="fa" other="/terms/de" />;
}
