import type { Metadata } from 'next';
import { LegalDocPage } from '../../components/legal-doc';
import { pages } from '../../messages/fa';

export const metadata: Metadata = {
  title: pages.privacy.title,
  alternates: { canonical: '/privacy', languages: { fa: '/privacy', de: '/privacy/de' } },
};

export default function PrivacyPage() {
  return <LegalDocPage doc={pages.privacy} lang="fa" other="/privacy/de" nav="privacy" />;
}
