import type { Metadata } from 'next';
import Link from 'next/link';
import { Flag } from '../../../components/flag';
import { Icon, type IconName } from '../../../components/icons';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { openingDrafts, type CountryInfo, type OpeningDraft } from '../../../modules/launch/country-page';
import { cityLaunch, keyCitiesOf } from '../../../modules/launch/waitlist';
import { activeCountries } from '../../../modules/listings/queries';
import { cityFoundingPlaces } from '../../../modules/payments/founding';
import { eventsPath } from '../../../modules/search/paths';
import { turnstileSiteKey } from '../../../modules/security/server';
import { currentSession } from '../../../modules/users/server';
import { prepareInAction } from './prepare-action';
import { WaitlistForm } from './waitlist-form';

// A planned country that isn't open yet (wave 2 part 8, mockups final/home-waitlist and
// final/waitlist-announced), at /austria and on the first page for visitors from there: what
// Peydoo is, «خبرم کن» for its waitlist cities, the first city's goal with the real count of
// verified businesses (round 12: only businesses decide), what pioneers get, and where to go
// until then. Before it opens (prestart) people prepare listings and business pages for the
// opening day; once the day is announced, the day itself (a calendar date, never a countdown)
// with what happens when, and the visitor's own drafts.

const t = messages.countryPage;

/** «شنبه ۲۰ مارس ۲۰۲۷» for an announced day (a date without a time); `short`: «۲۰ مارس» */
export function openingDay(opensOn: string, short = false): string {
  const o: Intl.DateTimeFormatOptions = short ? { day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { ...o, timeZone: 'UTC' }).format(new Date(`${opensOn}T00:00:00Z`));
}

export function countrySoonMetadata(country: CountryInfo): Metadata {
  return {
    title: country.opensOn ? t.titleOn(country.nameFa, openingDay(country.opensOn)) : t.title(country.nameFa),
    description: t.intro,
    alternates: { canonical: `/${country.slug}` },
  };
}

/** A progress bar filling from the right. SVG attributes, because the CSP allows no style attributes. */
function Bar({ value, max, tone }: { value: number; max: number; tone: 'saffron' | 'brand' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1 block h-2 w-full overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <rect width="100" height="4" className="fill-white" />
      <rect x={100 - pct} width={pct} height="4" className={tone === 'saffron' ? 'fill-saffron-500' : 'fill-brand-600'} />
    </svg>
  );
}

export async function CountrySoon({ country, detected = false }: { country: CountryInfo; detected?: boolean }) {
  const db = appDb();
  const [cities, open, session] = await Promise.all([keyCitiesOf(db, country.code), activeCountries(db), currentSession()]);
  const waiting = cities.filter((c) => c.status === 'waitlist');
  const first = waiting[0] ?? null;
  const [launch, founding, drafts] = await Promise.all([
    first ? cityLaunch(db, first.id) : null,
    first ? cityFoundingPlaces(db, first.id) : null,
    session && country.mode === 'prestart' ? openingDrafts(db, session.user.id, country.code) : ([] as OpeningDraft[]),
  ]);
  const name = launch?.groupNames.join(' و ') ?? first?.nameFa ?? '';
  const day = country.opensOn ? openingDay(country.opensOn) : null;
  const prestart = country.mode === 'prestart';
  const elsewhere = open[0] ?? null;
  const share = `https://t.me/share/url?url=${encodeURIComponent(`${webEnv().APP_URL}/${country.slug}`)}&text=${encodeURIComponent(t.inviteText(country.nameFa))}`;

  const perks: Array<[IconName, string, string]> = [];
  if (launch && launch.reward.left > 0) perks.push(['sparkle', t.perks.reward(launch.reward.places, name), t.perks.rewardSub]);
  if (prestart) perks.push(['doc', t.perks.prepare, t.perks.prepareSub]);
  if (founding) perks.push(['store', t.perks.founding, t.perks.foundingSub(Math.max(0, founding.places - founding.used), name)]);
  if (founding) perks.push(['star', t.perks.badge, t.perks.badgeSub]);

  return (
    <main className="pb-24">
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-4 lg:pt-14">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-800">
            <Flag code={country.code} className="h-4 w-6" />
            {detected ? messages.home.seemsIn(country.nameFa) : country.nameFa}
          </p>
          <h1 className="mt-3 text-[26px] font-black leading-[1.5] text-balance lg:text-4xl">{day ? t.titleOn(country.nameFa, day) : t.title(country.nameFa)}</h1>
          <p className="mt-2 text-base leading-8 text-neutral-700">{day ? t.introOn : t.intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-4">
          {day && (
            <ol className="rounded-3xl border border-neutral-200 p-4">
              {(
                [
                  ['done', t.when.announced, null],
                  ['now', t.when.prepare, t.when.prepareSub],
                  ['later', t.when.open, day],
                ] as const
              ).map(([state, title, sub], i) => (
                <li key={title} className={`flex gap-3 ${i ? 'mt-3' : ''}`}>
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${state === 'done' ? 'bg-brand-700 text-white' : state === 'now' ? 'border-2 border-saffron-500 bg-saffron-50' : 'border-2 border-neutral-300'}`}
                  >
                    {state === 'done' ? <Icon name="check" className="size-3.5" /> : state === 'now' ? <i className="size-2 rounded-full bg-saffron-500" /> : null}
                  </span>
                  <span className="flex-1">
                    <b className="block text-sm">{title}</b>
                    {sub && <span className="text-xs text-neutral-600">{sub}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {drafts.length > 0 && (
            <div>
              <h2 className="text-lg font-extrabold">{t.drafts.title}</h2>
              <ul className="mt-3 space-y-2">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/my/listings/${d.id}`} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 hover:border-brand-300">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon name="doc" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{d.title || messages.post.title}</b>
                        <span className={`text-xs font-bold ${d.status === 'draft' ? 'text-brand-800' : 'text-saffron-800'}`}>{t.drafts[d.status]}</span>
                      </span>
                      <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prestart && (
            <div className="rounded-3xl border-2 border-brand-200 bg-brand-50 p-4 lg:p-5">
              <h2 className="text-lg font-extrabold">{t.prepare.title}</h2>
              <p className="mt-1 text-sm leading-7 text-neutral-700">{t.prepare.text(country.nameFa)}</p>
              <form action={prepareInAction} className="mt-3 grid grid-cols-2 gap-2">
                <input type="hidden" name="country" value={country.slug} />
                <button name="what" value="listing" className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-2 text-sm font-bold text-white hover:bg-brand-800">
                  <Icon name="plus" className="size-5" />
                  {t.prepare.listing}
                </button>
                <button name="what" value="business" className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-brand-300 bg-white px-2 text-sm font-bold text-brand-800 hover:bg-brand-100">
                  <Icon name="store" className="size-5" />
                  {t.prepare.business}
                </button>
              </form>
            </div>
          )}

          {waiting.length > 0 && (
            <div className="rounded-3xl border border-neutral-200 p-4 lg:p-6">
              <h2 className="mb-3 text-lg font-extrabold">{t.formTitle}</h2>
              <WaitlistForm cities={waiting.map((c) => ({ id: c.id, nameFa: c.nameFa }))} turnstileSiteKey={turnstileSiteKey()} />
            </div>
          )}
        </div>

        <div>
          {launch?.goal && (
            <div className="mt-4 rounded-2xl bg-saffron-50 p-4 lg:mt-0">
              <p className="text-sm font-bold text-saffron-800">{day ? t.gate.goalsTitle(name) : messages.launch.goalLine(name, launch.goal)}</p>
              <p className="mt-3 flex justify-between text-xs text-saffron-800">
                <span>{t.gate.count(launch.businesses, launch.goal)}</span>
                <span>{t.gate.percent(Math.min(100, Math.round((launch.businesses / launch.goal) * 100)))}</span>
              </p>
              <Bar value={launch.businesses} max={launch.goal} tone="brand" />
              <p className="mt-3 flex items-center gap-2 text-xs text-saffron-800">
                <Icon name="people" className="size-4" />
                {messages.launch.waiting(launch.waiting, name)}
              </p>
              <p className="mt-3 text-xs leading-6 text-saffron-800">{day ? t.gate.noteOn(day) : t.gate.note}</p>
              <a
                href={share}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-saffron-300 bg-white text-sm font-bold text-neutral-900 hover:bg-saffron-50"
              >
                <Icon name="send" className="size-4 text-brand-700" />
                {t.invite}
              </a>
            </div>
          )}
          {perks.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-extrabold">{t.perksTitle}</h2>
              <ul className="mt-3 space-y-2">
                {perks.map(([icon, title, sub]) => (
                  <li key={title} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon name={icon} className="size-5" />
                    </span>
                    <span>
                      <b className="block text-sm">{title}</b>
                      <span className="text-xs leading-6 text-neutral-600">{sub}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {elsewhere && (
        <section className="mx-auto max-w-2xl px-4 lg:max-w-5xl">
          <h2 className="mt-7 text-lg font-extrabold">{t.meanwhile.title}</h2>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {(
              [
                ['calendar', t.meanwhile.online, t.meanwhile.onlineSub, `${eventsPath(elsewhere.slug, null)}?attendance=online`],
                ['globe', t.meanwhile.open(elsewhere.nameFa), t.meanwhile.openSub(elsewhere.nameFa), `/${elsewhere.slug}`],
              ] as const
            ).map(([icon, title, sub, href]) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:border-brand-300">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon name={icon} className="size-5" />
                  </span>
                  <span className="flex-1">
                    <b className="block text-sm">{title}</b>
                    <span className="text-xs text-neutral-600">{sub}</span>
                  </span>
                  <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
