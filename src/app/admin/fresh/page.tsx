import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { admin, messages } from '../../../messages/fa';
import { requireStaff } from '../../../modules/admin/server';
import { PUBLIC_REASONS } from '../../../modules/moderation/reasons';
import { AdminTitle } from '../ui';
import { FreshList } from './cards';
import { freshCards } from './data';

// The quick look at new listings from accounts under 7 days and from numbers of another zone (wave 2
// part 5): the moderation routine, list B, until the AI review takes this over. Since Nov 3, 2026
// (owner: staff need the photos, title, description, price and the seller's history to decide) one
// wide card each, suspicious ones first and red, 20 at a time, with approve and take down on the
// card (./cards.tsx, ./data.ts).

export default async function FreshPage() {
  await requireStaff('listing.moderate');
  const first = await freshCards(appDb(), { timeZone: webEnv().APP_TIME_ZONE });
  const t = admin.fresh;
  const reasons = PUBLIC_REASONS.listing.map((code) => ({ code, label: messages.report.reasons[code] ?? code, template: admin.decide.templates[code] ?? '' }));
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {first.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{t.empty}</p>
      ) : (
        <FreshList first={first} reasons={reasons} />
      )}
    </>
  );
}
