import type { Metadata } from 'next';
import { LegalVersionPage } from '../../components/legal-doc';
import { pages } from '../../messages/fa';

export const metadata: Metadata = {
  title: pages.terms.title,
  alternates: { canonical: '/terms', languages: { fa: '/terms', de: '/terms/de' } },
};

export default function TermsPage() {
  return <LegalVersionPage doc="terms" lang="fa" />;
}
