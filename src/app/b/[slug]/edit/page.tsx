import { PageShell } from '../../../../components/ui';
import { messages } from '../../../../messages/fa';
import { updateBusinessAction } from '../../../business/actions';
import { BusinessForm } from '../../../business/business-form';
import { memberOf } from '../member';

export const metadata = { title: messages.business.editTitle, robots: { index: false } };

export default async function EditBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, cityLocal } = await memberOf(slug, `/b/${slug}/edit`, ['owner']);
  const initial: Record<string, string> = {
    name: org.name,
    slug: org.slug,
    legalName: org.legalName ?? '',
    legalForm: org.legalForm ?? '',
    representativeName: org.representativeName ?? '',
    addressLine1: org.addressLine1 ?? '',
    addressLine2: org.addressLine2 ?? '',
    place: [org.postalCode, cityLocal].filter(Boolean).join(' '),
    phone: org.phoneE164 ?? '',
    email: org.email ?? '',
    website: org.website ?? '',
    registerCourt: org.registerCourt ?? '',
    registrationNumber: org.registrationNumber ?? '',
    vatId: org.vatId ?? '',
    imprintExtra: org.imprintExtra ?? '',
    description: org.description,
  };
  return (
    <PageShell title={messages.business.editTitle} wide>
      <BusinessForm action={updateBusinessAction.bind(null, org.id, org.slug)} initial={initial} slugLocked submit={messages.business.save} />
    </PageShell>
  );
}
