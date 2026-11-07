import type { Metadata } from 'next';
import { LegalDocPage } from '../../../components/legal-doc';
import { aydinlatma } from '../../../messages/legal-tr';

// The Turkish privacy notice (Aydınlatma Metni, Art. 10 KVKK; Turkey plan, owner Nov 5, 2026),
// linked from privacy policy 13.3. A draft for the Turkish adviser: the banner stays until checked.
export const metadata: Metadata = {
  title: aydinlatma.title,
  // Its own notice, not a translation of the privacy policy: no hreflang set (a one-sided set,
  // which /privacy can't answer, is ignored by Google anyway; SEO audit, Nov 2026)
  alternates: { canonical: '/privacy/tr' },
};

export default function PrivacyTrPage() {
  return <LegalDocPage doc={aydinlatma} lang="tr" other="/privacy" />;
}
