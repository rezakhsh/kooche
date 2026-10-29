import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { messages } from '../../../../messages/fa';
import { placeOfListing, placeLabel, placeValue } from '../../../../modules/listings/places';

import { streetMapVersion } from '../../../../modules/maps/street-map';
import { imageUrl } from '../../../../modules/media/server';
import { WEEKDAYS, validHours } from '../../../../modules/organizations/hours';
import { updateBusinessAction } from '../../../business/actions';
import { BusinessForm } from '../../../business/business-form';
import { PostingBar } from '../../../new/posting-bar';
import { memberOf } from '../member';
import { preparingCountries } from '../../../../modules/launch/country-page';

// Editing a business (wave 1): the three parts of the new-business steps on one page, one save.

export const metadata = { title: messages.business.editTitle, robots: { index: false } };

const CHIP_FORMS = ['Einzelunternehmen', 'GmbH', 'UG (haftungsbeschränkt)', 'GbR'];

export default async function EditBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await memberOf(slug, `/b/${slug}/edit`, ['owner']);
  const db = appDb();
  const [place, countries] = await Promise.all([placeOfListing(db, org), preparingCountries(db)]);
  const country = countries.find((c) => c.code === org.countryCode);
  const hours = validHours(org.openingHours) ? org.openingHours : {};
  const initial: Record<string, string> = {
    name: org.name,
    slug: org.slug,
    businessType: org.businessType ?? '',
    tagline: org.tagline ?? '',
    servesOnline: org.servesOnline ? 'on' : '',
    languages: org.languages.join(','),
    phone: org.phoneE164 ?? '',
    email: org.email ?? '',
    website: org.website ?? '',
    instagram: org.instagram ?? '',
    telegram: org.telegram ?? '',
    description: org.description,
    pin: org.pin ? `${org.pin.lat},${org.pin.lng}` : '',
    legalName: org.legalName ?? '',
    legalForm: !org.legalForm ? '' : CHIP_FORMS.includes(org.legalForm) ? org.legalForm : 'other',
    legalFormOther: org.legalForm && !CHIP_FORMS.includes(org.legalForm) ? org.legalForm : '',
    representativeName: org.representativeName ?? '',
    addressLine1: org.addressLine1 ?? '',
    addressLine2: org.addressLine2 ?? '',
    legalPostal: org.addressLine1 ? (org.postalCode ?? '') : '',
    registerCourt: org.registerCourt ?? '',
    registrationNumber: org.registrationNumber ?? '',
    vatId: org.vatId ?? '',
    imprintExtra: org.imprintExtra ?? '',
    ...Object.fromEntries(
      WEEKDAYS.flatMap((d) => {
        const range = hours[d]?.[0];
        return range ? [[`hours.${d}.open`, 'on'], [`hours.${d}.from`, range[0]], [`hours.${d}.to`, range[1]]] : [];
      }),
    ),
  };
  return (
    <>
      <PostingBar title={messages.business.wizard.editTitle} category={org.name} closeHref={`/b/${org.slug}/manage`} />
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10 sm:px-6">
        <BusinessForm
          action={updateBusinessAction.bind(null, org.id, org.slug)}
          mode="edit"
          initial={initial}
          country={{ code: org.countryCode, nameFa: country?.nameFa ?? org.countryCode }}
          place={{ countryCode: org.countryCode, place: place ? placeLabel(place) : '', placeValue: place ? placeValue(place) : '', district: '', area: null, center: place?.center ?? null }}
          logoUrl={org.logoKey ? imageUrl(org.logoKey, 'thumb', 'webp') : null}
          host={new URL(webEnv().APP_URL).host}
          mapVersion={streetMapVersion()}
          legalCountry={org.countryCode === 'DE' || org.countryCode === 'AT'}
        />
      </main>
    </>
  );
}
