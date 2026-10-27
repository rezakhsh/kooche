import { Card } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { TaskPage } from '../../../components/settings';
import { messages } from '../../../messages/fa';
import { placeLabel, placeValue } from '../../../modules/listings/places';
import { activeCountries, savedPlace } from '../../../modules/listings/queries';
import { requireSession } from '../../../modules/users/server';
import { chosenCountry } from '../../country-choice';
import { SavedPlaceForm } from './form';

export const metadata = { title: messages.account.place, robots: { index: false } };

// "My location": the place new listings start with (users.home_*). Postal code, place, city and
// district only; no position is ever saved here.

export default async function SavedPlacePage() {
  const { user } = await requireSession('/account/place');
  const db = appDb();
  const [countries, saved, chosen] = await Promise.all([activeCountries(db), savedPlace(db, user.id), chosenCountry(db)]);
  const t = messages.account;
  return (
    <TaskPage title={t.place} back="/account/settings" backLabel={messages.account.back}>
      <Card className="space-y-4">
        <p className="text-sm text-neutral-600">{saved ? t.placeHint : t.placeNone}</p>
        <SavedPlaceForm
          countries={countries.map((c) => ({ code: c.code, nameFa: c.nameFa }))}
          hasPlace={!!saved}
          initial={{
            countryCode: saved?.place.countryCode ?? chosen?.code ?? countries[0]?.code ?? '',
            place: saved ? placeLabel(saved.place) : '',
            placeValue: saved ? placeValue(saved.place) : '',
            district: saved?.district ?? '',
            area: null,
            center: saved?.place.center ?? null,
          }}
        />
      </Card>
    </TaskPage>
  );
}
