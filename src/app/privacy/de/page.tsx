import type { Metadata } from 'next';
import { LegalVersionPage } from '../../../components/legal-doc';
import { legalDe } from '../../../messages/legal-de';

// The binding German version (approved Oct 21, 2026)
export const metadata: Metadata = {
  title: legalDe.privacy.title,
  alternates: { canonical: '/privacy/de', languages: { fa: '/privacy', de: '/privacy/de' } },
};

export default function PrivacyDePage() {
  return <LegalVersionPage doc="privacy" lang="de" />;
}
