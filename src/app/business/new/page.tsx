import { Card, LinkButton, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { activeCountries } from '../../../modules/listings/queries';
import { canPostListing, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { chosenCountry } from '../../country-choice';
import { NoScriptSteps } from '../../my/listings/[id]/no-script-steps';
import { PostingBar } from '../../new/posting-bar';
import { createBusinessAction } from '../actions';
import { BusinessForm } from '../business-form';

// A new business in three steps (wave 1, mockups final/business-new and business-legal), under the
// posting pages' own bar. It is made in the country the visitor chose, like a listing.

export const metadata = { title: messages.business.wizard.title, robots: { index: false } };

export default async function NewBusinessPage() {
  const { user } = await requireSession('/business/new');
  const db = appDb();
  const t = messages.business;
  const allowed = canPostListing(await loadActor(db, user.id));
  if (!allowed.ok) {
    return (
      <PageShell title={t.wizard.title}>
        <Card className="space-y-4">
          <p className="leading-relaxed text-neutral-700">{t.phoneRequired}</p>
          <LinkButton href="/account/phone" className="w-full">
            {messages.post.verifyPhone}
          </LinkButton>
        </Card>
      </PageShell>
    );
  }
  const country = (await chosenCountry(db)) ?? (await activeCountries(db)).find((c) => c.code === 'DE')!;
  return (
    <>
      <PostingBar title={t.wizard.title} closeHref="/business" />
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10 sm:px-6">
        <NoScriptSteps />
        <BusinessForm
          action={createBusinessAction}
          mode="create"
          initial={{}}
          country={{ code: country.code, nameFa: country.nameFa }}
          place={{ countryCode: country.code, place: '', placeValue: '', district: '', area: null, center: null }}
          logoUrl={null}
          host={new URL(webEnv().APP_URL).host}
          legalCountry={country.code === 'DE' || country.code === 'AT'}
        />
      </main>
    </>
  );
}
