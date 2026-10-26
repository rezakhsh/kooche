import type { Metadata } from 'next';
import Link from 'next/link';
import { appDb } from '../../../db/drizzle';
import { cityLaunch } from '../../../modules/launch/waitlist';
import { turnstileSiteKey } from '../../../modules/security/server';
import type { Browse } from './resolve';
import { Flag } from '../../../components/flag';
import { Icon } from '../../../components/icons';
import { LinkButton } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import type { CityLaunch } from '../../../modules/launch/waitlist';
import { browsePath, eventsPath } from '../../../modules/search/paths';
import type { City } from '../../../modules/search/places';
import type { Country } from '../../../modules/listings/queries';
import { WaitlistForm } from './waitlist-form';

// A city that isn't open yet (round 12, mockup city-waitlist): its one goal (verified
// businesses), the people waiting for information, "notify me", the founding-business offer, the
// country's key cities, and where to go until then. Events and businesses already work here.

const fa = (n: number) => n.toLocaleString('fa-IR');

/** The waitlist of the page's city when it isn't open yet, else null (a normal browse page) */
export async function waitingCity(b: Browse): Promise<CityLaunch | null> {
  if (!b.city) return null;
  const launch = await cityLaunch(appDb(), b.city.id);
  return launch && launch.status !== 'open' ? launch : null;
}

export function waitlistMetadata(b: Browse, launch: CityLaunch): Metadata {
  const title = messages.launch.title(launch.groupNames.join(' و '));
  return { title, description: launch.goal ? messages.launch.goalLine(launch.groupNames.join(' و '), launch.goal) : undefined, alternates: { canonical: `/${b.country.slug}/${b.city!.slug}` } };
}

/** The page for a waiting city */
export function CityWaitlist({ b, launch }: { b: Browse; launch: CityLaunch }) {
  return <WaitlistPage country={b.country} city={b.city!} launch={launch} turnstileSiteKey={turnstileSiteKey()} />;
}

/** A progress bar filling from the right. SVG attributes, because the CSP allows no style attributes. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-2 block h-3 w-full overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <rect width="100" height="4" className="fill-neutral-100" />
      <rect x={100 - pct} width={pct} height="4" className="fill-brand-600" />
    </svg>
  );
}

export function WaitlistPage({ country, city, launch, turnstileSiteKey }: { country: Country; city: City; launch: CityLaunch; turnstileSiteKey: string | null }) {
  const t = messages.launch;
  const name = launch.groupNames.join(' و ');
  const goal = launch.goal;
  const openKey = launch.keyCities.filter((k) => k.status === 'open');
  return (
    <main className="pb-24">
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pt-6 pb-4 lg:pt-12">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-800">
            <Flag code={country.code} className="h-4 w-6" />
            {t.eyebrow(city.nameFa, country.nameFa)}
          </p>
          <h1 className="mt-2 text-[26px] font-black leading-[1.5] lg:text-4xl">{t.title(name)}</h1>
          <p className="mt-1 text-base leading-8 text-neutral-700">{goal ? t.goalLine(name, goal) : t.laterLine(city.nameFa, country.nameFa)}</p>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
            {goal && (
              <>
                <p className="flex items-baseline justify-between gap-3">
                  <b className="text-lg">{t.progress(launch.businesses, goal)}</b>
                  <span className="text-sm text-neutral-600">{t.remaining(Math.max(0, goal - launch.businesses))}</span>
                </p>
                <Bar value={launch.businesses} max={goal} />
              </>
            )}
            <p className={`${goal ? 'mt-3' : ''} flex items-center gap-2 text-sm text-neutral-700`}>
              <Icon name="people" className="size-4 text-brand-700" />
              {t.waiting(launch.waiting, name)}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-2 max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="rounded-3xl border border-neutral-200 p-4 lg:p-6">
          <div className="flex items-center gap-3 rounded-2xl bg-saffron-50 p-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-saffron-800">
              <Icon name="star" className="size-6" />
            </span>
            <span>
              <b className="block text-sm">{t.reward(launch.reward.places, name)}</b>
              <span className="text-xs leading-6 text-saffron-800">{t.rewardLeft(launch.reward.left)}</span>
            </span>
          </div>
          <h2 className="mt-4 mb-3 text-lg font-extrabold">{t.notifyTitle}</h2>
          <WaitlistForm cityId={city.id} turnstileSiteKey={turnstileSiteKey} />
        </div>

        <div>
          {goal && (
            <div className="mt-4 rounded-3xl border-2 border-brand-200 bg-brand-50 p-4 lg:mt-0 lg:p-5">
              <p className="flex items-center gap-2 text-xs font-bold text-brand-800">
                <Icon name="store" className="size-4" />
                {t.business.eyebrow}
              </p>
              <h2 className="mt-1 text-lg font-extrabold">{t.business.title(goal, name)}</h2>
              <ul className="mt-3 space-y-2">
                {t.business.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm">
                    <Icon name="check" className="size-5 shrink-0 text-brand-700" />
                    {p}
                  </li>
                ))}
              </ul>
              <LinkButton href="/business/new" className="mt-4 w-full">
                {t.business.cta}
              </LinkButton>
            </div>
          )}
          {launch.keyCities.length > 0 && (
            <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-bold">{t.country.line(country.nameFa, openKey.length, launch.keyCities.length)}</p>
              <p className="mt-1 text-xs leading-6 text-neutral-600">{t.country.rule(country.nameFa)}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-center text-xs sm:grid-cols-3">
                {launch.keyCities.map((k) => (
                  <Link
                    key={k.id}
                    href={browsePath(country.slug, k.slug, null)}
                    className={`rounded-xl px-1 py-2 ${k.status === 'open' ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                  >
                    <b className="block">{k.nameFa}</b>
                    {k.status === 'open' ? t.country.open : `${fa(k.businesses)}/${fa(k.goal ?? 0)}`}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 lg:max-w-5xl">
        <h2 className="mt-7 text-lg font-extrabold">{t.meanwhile.title}</h2>
        <ul className="mt-3 grid gap-2 lg:grid-cols-3">
          {openKey.map((k) => (
            <li key={k.id}>
              <Link href={browsePath(country.slug, k.slug, null)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:border-brand-300">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon name="pin" className="size-5" />
                </span>
                <span className="flex-1">
                  <b className="block text-sm">{t.meanwhile.openCity(k.nameFa)}</b>
                  <span className="text-xs text-neutral-600">{t.meanwhile.openCitySub}</span>
                </span>
                <Icon name="chevronEnd" className="size-4 text-neutral-400" />
              </Link>
            </li>
          ))}
          <li>
            <Link href={eventsPath(country.slug, city.slug)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:border-brand-300">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name="calendar" className="size-5" />
              </span>
              <span className="flex-1">
                <b className="block text-sm">{t.meanwhile.events(city.nameFa)}</b>
                <span className="text-xs text-neutral-600">{t.meanwhile.eventsSub}</span>
              </span>
              <Icon name="chevronEnd" className="size-4 text-neutral-400" />
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
