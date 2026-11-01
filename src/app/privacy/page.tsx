import type { Metadata } from 'next';
import { LegalVersionPage } from '../../components/legal-doc';
import { pages } from '../../messages/fa';

export const metadata: Metadata = {
  title: pages.privacy.title,
  alternates: { canonical: '/privacy', languages: { fa: '/privacy', de: '/privacy/de' } },
};

export default function PrivacyPage() {
  return <LegalVersionPage doc="privacy" lang="fa" />;
}
